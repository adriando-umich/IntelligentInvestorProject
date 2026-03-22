create or replace function public.reconciliation_expected_cash_snapshot(
  p_project_id uuid,
  p_as_of timestamptz default now()
)
returns table (
  project_member_id uuid,
  expected_project_cash numeric(18,2)
)
language sql
stable
security definer
set search_path = public
as $$
  with effective_entries as (
    select
      le.id,
      le.project_id,
      le.cash_in_member_id,
      le.cash_out_member_id,
      le.amount::numeric(18,2) as amount,
      (
        1 - coalesce(
          (
            select count(*)
            from public.ledger_entries reversal_entry
            where reversal_entry.reversal_of_entry_id = le.id
              and reversal_entry.entry_type = 'reversal'
              and reversal_entry.status = 'posted'
              and reversal_entry.effective_at <= p_as_of
          ),
          0
        )
      )::numeric(18,2) as effect_factor
    from public.ledger_entries le
    where le.project_id = p_project_id
      and le.status = 'posted'
      and le.entry_type <> 'reversal'
      and le.effective_at <= p_as_of
  )
  select
    pm.id as project_member_id,
    round(
      coalesce(
        sum(
          case
            when ee.cash_in_member_id = pm.user_id then ee.amount * ee.effect_factor
            else 0
          end
        ),
        0
      ) -
      coalesce(
        sum(
          case
            when ee.cash_out_member_id = pm.user_id then ee.amount * ee.effect_factor
            else 0
          end
        ),
        0
      ),
      2
    )::numeric(18,2) as expected_project_cash
  from public.project_members pm
  left join effective_entries ee
    on ee.project_id = pm.project_id
  where pm.project_id = p_project_id
    and pm.is_active = true
  group by pm.id;
$$;

create or replace function public.open_reconciliation_run(
  p_project_id uuid,
  p_as_of timestamptz default now(),
  p_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_run_id uuid;
begin
  if v_user_id is null then
    raise exception 'You must be authenticated to open a reconciliation run';
  end if;

  if not public.is_project_manager(p_project_id, v_user_id) then
    raise exception 'Only owners and managers can open reconciliation runs';
  end if;

  if exists (
    select 1
    from public.reconciliation_runs rr
    where rr.project_id = p_project_id
      and rr.status = 'open'
  ) then
    raise exception 'This project already has an open reconciliation run';
  end if;

  insert into public.reconciliation_runs (
    project_id,
    as_of,
    note,
    opened_by
  )
  values (
    p_project_id,
    coalesce(p_as_of, now()),
    nullif(trim(coalesce(p_note, '')), ''),
    v_user_id
  )
  returning id into v_run_id;

  insert into public.reconciliation_checks (
    run_id,
    project_member_id,
    expected_project_cash
  )
  select
    v_run_id,
    snapshot.project_member_id,
    snapshot.expected_project_cash
  from public.reconciliation_expected_cash_snapshot(
    p_project_id,
    coalesce(p_as_of, now())
  ) as snapshot;

  return v_run_id;
end;
$$;

create or replace function public.submit_reconciliation_check(
  p_check_id uuid,
  p_reported_project_cash numeric,
  p_member_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_project_id uuid;
  v_member_user_id uuid;
begin
  if v_user_id is null then
    raise exception 'You must be authenticated to submit a reconciliation check';
  end if;

  select
    rr.project_id,
    pm.user_id
  into
    v_project_id,
    v_member_user_id
  from public.reconciliation_checks rc
  join public.reconciliation_runs rr
    on rr.id = rc.run_id
  join public.project_members pm
    on pm.id = rc.project_member_id
  where rc.id = p_check_id
    and rr.status = 'open';

  if v_project_id is null then
    raise exception 'Open reconciliation check not found';
  end if;

  if v_member_user_id <> v_user_id
     and not public.is_project_manager(v_project_id, v_user_id) then
    raise exception 'Only the member or a project manager can submit this check';
  end if;

  update public.reconciliation_checks
  set reported_project_cash = round(p_reported_project_cash, 2),
      member_note = nullif(trim(coalesce(p_member_note, '')), ''),
      submitted_by = v_user_id,
      submitted_at = now()
  where id = p_check_id;

  return p_check_id;
end;
$$;

create or replace function public.accept_reconciliation_check(
  p_check_id uuid,
  p_review_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_project_id uuid;
  v_reported_cash numeric(18,2);
  v_variance numeric(18,2);
begin
  if v_user_id is null then
    raise exception 'You must be authenticated to review a reconciliation check';
  end if;

  select
    rr.project_id,
    rc.reported_project_cash,
    round(coalesce(rc.reported_project_cash, 0) - rc.expected_project_cash, 2)
  into
    v_project_id,
    v_reported_cash,
    v_variance
  from public.reconciliation_checks rc
  join public.reconciliation_runs rr
    on rr.id = rc.run_id
  where rc.id = p_check_id
    and rr.status = 'open';

  if v_project_id is null then
    raise exception 'Open reconciliation check not found';
  end if;

  if not public.is_project_manager(v_project_id, v_user_id) then
    raise exception 'Only owners and managers can accept reconciliation variance';
  end if;

  if v_reported_cash is null then
    raise exception 'The member must submit a reported amount before review';
  end if;

  if abs(v_variance) <= 0.01 then
    raise exception 'This check already matches and does not need variance acceptance';
  end if;

  update public.reconciliation_checks
  set status = 'accepted',
      review_note = nullif(trim(coalesce(p_review_note, '')), ''),
      reviewed_by = v_user_id,
      reviewed_at = now()
  where id = p_check_id;

  return p_check_id;
end;
$$;

create or replace function public.post_reconciliation_adjustment(
  p_check_id uuid,
  p_effective_at timestamptz default now(),
  p_description text default null,
  p_review_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_project_id uuid;
  v_project_member_id uuid;
  v_member_user_id uuid;
  v_currency_code char(3);
  v_reported_cash numeric(18,2);
  v_expected_cash numeric(18,2);
  v_variance numeric(18,2);
  v_entry_id uuid;
  v_description text;
begin
  if v_user_id is null then
    raise exception 'You must be authenticated to post a reconciliation adjustment';
  end if;

  select
    rr.project_id,
    rc.project_member_id,
    pm.user_id,
    p.currency_code,
    rc.reported_project_cash,
    rc.expected_project_cash,
    round(coalesce(rc.reported_project_cash, 0) - rc.expected_project_cash, 2)
  into
    v_project_id,
    v_project_member_id,
    v_member_user_id,
    v_currency_code,
    v_reported_cash,
    v_expected_cash,
    v_variance
  from public.reconciliation_checks rc
  join public.reconciliation_runs rr
    on rr.id = rc.run_id
  join public.project_members pm
    on pm.id = rc.project_member_id
  join public.projects p
    on p.id = rr.project_id
  where rc.id = p_check_id
    and rr.status = 'open';

  if v_project_id is null then
    raise exception 'Open reconciliation check not found';
  end if;

  if not public.is_project_manager(v_project_id, v_user_id) then
    raise exception 'Only owners and managers can post reconciliation adjustments';
  end if;

  if v_reported_cash is null then
    raise exception 'The member must submit a reported amount before posting an adjustment';
  end if;

  if abs(v_variance) <= 0.01 then
    raise exception 'This check does not need a reconciliation adjustment';
  end if;

  v_description := coalesce(
    nullif(trim(coalesce(p_description, '')), ''),
    'Reconciliation adjustment'
  );

  insert into public.ledger_entries (
    project_id,
    entry_type,
    effective_at,
    description,
    amount,
    currency_code,
    cash_in_member_id,
    cash_out_member_id,
    note,
    created_by
  )
  values (
    v_project_id,
    'reconciliation_adjustment',
    coalesce(p_effective_at, now()),
    v_description,
    abs(v_variance),
    v_currency_code,
    case when v_variance > 0 then v_member_user_id else null end,
    case when v_variance < 0 then v_member_user_id else null end,
    nullif(trim(coalesce(p_review_note, '')), ''),
    v_user_id
  )
  returning id into v_entry_id;

  update public.reconciliation_checks
  set status = 'adjustment_posted',
      review_note = nullif(trim(coalesce(p_review_note, '')), ''),
      reviewed_by = v_user_id,
      reviewed_at = now()
  where id = p_check_id;

  return v_entry_id;
end;
$$;

create or replace function public.close_reconciliation_run(
  p_run_id uuid,
  p_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_project_id uuid;
begin
  if v_user_id is null then
    raise exception 'You must be authenticated to close a reconciliation run';
  end if;

  select rr.project_id
  into v_project_id
  from public.reconciliation_runs rr
  where rr.id = p_run_id
    and rr.status = 'open';

  if v_project_id is null then
    raise exception 'Open reconciliation run not found';
  end if;

  if not public.is_project_manager(v_project_id, v_user_id) then
    raise exception 'Only owners and managers can close reconciliation runs';
  end if;

  if exists (
    select 1
    from public.reconciliation_checks rc
    where rc.run_id = p_run_id
      and rc.status in ('pending', 'variance_found')
  ) then
    raise exception 'Resolve all pending or unresolved variance checks before closing the run';
  end if;

  update public.reconciliation_runs
  set status = 'closed',
      closed_by = v_user_id,
      closed_at = now(),
      note = coalesce(
        nullif(trim(coalesce(p_note, '')), ''),
        note
      )
  where id = p_run_id;

  return p_run_id;
end;
$$;

grant execute on function public.reconciliation_expected_cash_snapshot(uuid, timestamptz) to authenticated;
grant execute on function public.open_reconciliation_run(uuid, timestamptz, text) to authenticated;
grant execute on function public.submit_reconciliation_check(uuid, numeric, text) to authenticated;
grant execute on function public.accept_reconciliation_check(uuid, text) to authenticated;
grant execute on function public.post_reconciliation_adjustment(uuid, timestamptz, text, text) to authenticated;
grant execute on function public.close_reconciliation_run(uuid, text) to authenticated;
