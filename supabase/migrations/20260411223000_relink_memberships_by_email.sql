begin;

create or replace function public.project_member_role_rank(
  p_role public.project_member_role
)
returns integer
language sql
immutable
as $$
  select case p_role
    when 'owner' then 3
    when 'manager' then 2
    else 1
  end;
$$;

create or replace function public.merge_project_member_alias_into_canonical(
  p_alias_project_member_id uuid,
  p_canonical_project_member_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_alias public.project_members;
  v_canonical public.project_members;
begin
  if p_alias_project_member_id is null
     or p_canonical_project_member_id is null
     or p_alias_project_member_id = p_canonical_project_member_id then
    return;
  end if;

  select *
  into v_alias
  from public.project_members
  where id = p_alias_project_member_id
  for update;

  if not found then
    return;
  end if;

  select *
  into v_canonical
  from public.project_members
  where id = p_canonical_project_member_id
  for update;

  if not found then
    raise exception 'Canonical project member not found';
  end if;

  if v_alias.project_id <> v_canonical.project_id then
    raise exception 'Project member merge requires both rows to belong to the same project';
  end if;

  update public.ledger_entries
  set cash_in_project_member_id = p_canonical_project_member_id
  where cash_in_project_member_id = p_alias_project_member_id;

  update public.ledger_entries
  set cash_out_project_member_id = p_canonical_project_member_id
  where cash_out_project_member_id = p_alias_project_member_id;

  insert into public.ledger_allocations (
    ledger_entry_id,
    project_member_id,
    allocation_type,
    amount,
    weight_percent,
    note
  )
  select
    aggregated.ledger_entry_id,
    p_canonical_project_member_id,
    aggregated.allocation_type,
    aggregated.amount,
    aggregated.weight_percent,
    aggregated.note
  from (
    select
      la.ledger_entry_id,
      la.allocation_type,
      sum(la.amount) as amount,
      case
        when count(*) filter (where la.weight_percent is not null) = 0 then null
        else sum(coalesce(la.weight_percent, 0))
      end as weight_percent,
      nullif(
        string_agg(distinct nullif(trim(la.note), ''), E'\n\n'),
        ''
      ) as note
    from public.ledger_allocations la
    where la.project_member_id in (
      p_alias_project_member_id,
      p_canonical_project_member_id
    )
    group by la.ledger_entry_id, la.allocation_type
  ) as aggregated
  on conflict (ledger_entry_id, project_member_id, allocation_type)
  do update
    set amount = excluded.amount,
        weight_percent = excluded.weight_percent,
        note = coalesce(excluded.note, public.ledger_allocations.note);

  delete from public.ledger_allocations
  where project_member_id = p_alias_project_member_id;

  update public.profit_distribution_runs
  set cash_out_project_member_id = p_canonical_project_member_id
  where cash_out_project_member_id = p_alias_project_member_id;

  insert into public.profit_distribution_lines (
    run_id,
    project_member_id,
    capital_balance_snapshot,
    weight_basis_amount,
    weight_percent,
    distribution_amount
  )
  select
    aggregated.run_id,
    p_canonical_project_member_id,
    aggregated.capital_balance_snapshot,
    aggregated.weight_basis_amount,
    aggregated.weight_percent,
    aggregated.distribution_amount
  from (
    select
      line.run_id,
      sum(line.capital_balance_snapshot) as capital_balance_snapshot,
      sum(line.weight_basis_amount) as weight_basis_amount,
      sum(line.weight_percent) as weight_percent,
      sum(line.distribution_amount) as distribution_amount
    from public.profit_distribution_lines line
    where line.project_member_id in (
      p_alias_project_member_id,
      p_canonical_project_member_id
    )
    group by line.run_id
  ) as aggregated
  on conflict (run_id, project_member_id)
  do update
    set capital_balance_snapshot = excluded.capital_balance_snapshot,
        weight_basis_amount = excluded.weight_basis_amount,
        weight_percent = excluded.weight_percent,
        distribution_amount = excluded.distribution_amount;

  delete from public.profit_distribution_lines
  where project_member_id = p_alias_project_member_id;

  insert into public.reconciliation_checks (
    run_id,
    project_member_id,
    expected_project_cash,
    reported_project_cash,
    variance_amount,
    status,
    member_note,
    review_note,
    submitted_by,
    submitted_at,
    reviewed_by,
    reviewed_at
  )
  select
    aggregated.run_id,
    p_canonical_project_member_id,
    aggregated.expected_project_cash,
    aggregated.reported_project_cash,
    aggregated.variance_amount,
    aggregated.status,
    aggregated.member_note,
    aggregated.review_note,
    aggregated.submitted_by,
    aggregated.submitted_at,
    aggregated.reviewed_by,
    aggregated.reviewed_at
  from (
    select
      check_row.run_id,
      sum(check_row.expected_project_cash) as expected_project_cash,
      case
        when count(*) filter (where check_row.reported_project_cash is not null) = 0
          then null
        else sum(coalesce(check_row.reported_project_cash, 0))
      end as reported_project_cash,
      case
        when count(*) filter (where check_row.variance_amount is not null) = 0
          then null
        else sum(coalesce(check_row.variance_amount, 0))
      end as variance_amount,
      case max(
        case check_row.status
          when 'adjustment_posted' then 4
          when 'accepted' then 3
          when 'variance_found' then 2
          when 'matched' then 1
          else 0
        end
      )
        when 4 then 'adjustment_posted'::public.reconciliation_check_status
        when 3 then 'accepted'::public.reconciliation_check_status
        when 2 then 'variance_found'::public.reconciliation_check_status
        when 1 then 'matched'::public.reconciliation_check_status
        else 'pending'::public.reconciliation_check_status
      end as status,
      nullif(
        string_agg(distinct nullif(trim(check_row.member_note), ''), E'\n\n'),
        ''
      ) as member_note,
      nullif(
        string_agg(distinct nullif(trim(check_row.review_note), ''), E'\n\n'),
        ''
      ) as review_note,
      max(check_row.submitted_by) as submitted_by,
      max(check_row.submitted_at) as submitted_at,
      max(check_row.reviewed_by) as reviewed_by,
      max(check_row.reviewed_at) as reviewed_at
    from public.reconciliation_checks check_row
    where check_row.project_member_id in (
      p_alias_project_member_id,
      p_canonical_project_member_id
    )
    group by check_row.run_id
  ) as aggregated
  on conflict (run_id, project_member_id)
  do update
    set expected_project_cash = excluded.expected_project_cash,
        reported_project_cash = excluded.reported_project_cash,
        variance_amount = excluded.variance_amount,
        status = excluded.status,
        member_note = coalesce(excluded.member_note, public.reconciliation_checks.member_note),
        review_note = coalesce(excluded.review_note, public.reconciliation_checks.review_note),
        submitted_by = coalesce(excluded.submitted_by, public.reconciliation_checks.submitted_by),
        submitted_at = coalesce(excluded.submitted_at, public.reconciliation_checks.submitted_at),
        reviewed_by = coalesce(excluded.reviewed_by, public.reconciliation_checks.reviewed_by),
        reviewed_at = coalesce(excluded.reviewed_at, public.reconciliation_checks.reviewed_at);

  delete from public.reconciliation_checks
  where project_member_id = p_alias_project_member_id;

  update public.project_invites
  set project_member_id = p_canonical_project_member_id
  where project_member_id = p_alias_project_member_id;

  if to_regclass('public.project_member_activity') is not null then
    execute $sql$
      update public.project_member_activity
      set actor_project_member_id = $1
      where actor_project_member_id = $2
    $sql$
    using p_canonical_project_member_id, p_alias_project_member_id;

    execute $sql$
      update public.project_member_activity
      set target_project_member_id = $1
      where target_project_member_id = $2
    $sql$
    using p_canonical_project_member_id, p_alias_project_member_id;
  end if;

  update public.project_members
  set role = case
        when public.project_member_role_rank(v_alias.role)
          > public.project_member_role_rank(public.project_members.role)
          then v_alias.role
        else public.project_members.role
      end,
      joined_at = least(public.project_members.joined_at, v_alias.joined_at),
      display_name = coalesce(
        nullif(trim(public.project_members.display_name), ''),
        nullif(trim(v_alias.display_name), ''),
        public.project_members.display_name
      ),
      is_active = true,
      left_at = null,
      membership_status = 'active',
      pending_email = null,
      user_id = coalesce(public.project_members.user_id, v_alias.user_id)
  where id = p_canonical_project_member_id;

  delete from public.project_members
  where id = p_alias_project_member_id;
end;
$$;

create or replace function public.relink_my_project_memberships_by_email()
returns table (
  relinked_project_count integer,
  merged_membership_count integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
  v_display_name text := coalesce(
    nullif(auth.jwt() -> 'user_metadata' ->> 'display_name', ''),
    nullif(auth.jwt() -> 'user_metadata' ->> 'name', ''),
    split_part(v_email, '@', 1),
    'Project member'
  );
  v_candidate record;
  v_current_project_member_id uuid;
  v_relinked_projects uuid[] := '{}'::uuid[];
  v_merged_count integer := 0;
begin
  if v_user_id is null or v_email = '' then
    return query select 0, 0;
    return;
  end if;

  insert into public.profiles (user_id, display_name, email)
  values (
    v_user_id,
    v_display_name,
    coalesce(auth.jwt() ->> 'email', '')
  )
  on conflict (user_id) do update
    set display_name = excluded.display_name,
        email = excluded.email,
        updated_at = now();

  for v_candidate in
    select
      pm.id as alias_project_member_id,
      pm.project_id,
      pm.role
    from public.project_members pm
    left join public.profiles existing_profile
      on existing_profile.user_id = pm.user_id
    where pm.is_active = true
      and (
        (
          pm.user_id is null
          and coalesce(pm.membership_status, 'active') = 'pending_invite'
          and lower(coalesce(pm.pending_email, '')) = v_email
        )
        or (
          pm.user_id is not null
          and pm.user_id <> v_user_id
          and lower(coalesce(existing_profile.email, '')) = v_email
        )
      )
    order by pm.joined_at asc, pm.id asc
  loop
    select pm.id
    into v_current_project_member_id
    from public.project_members pm
    where pm.project_id = v_candidate.project_id
      and pm.user_id = v_user_id
    order by case when pm.is_active then 0 else 1 end, pm.joined_at asc, pm.id asc
    limit 1;

    if v_current_project_member_id is null then
      update public.project_members
      set user_id = v_user_id,
          role = case
            when public.project_member_role_rank(v_candidate.role)
              > public.project_member_role_rank(public.project_members.role)
              then v_candidate.role
            else public.project_members.role
          end,
          is_active = true,
          left_at = null,
          membership_status = 'active',
          pending_email = null,
          display_name = coalesce(
            nullif(trim(public.project_members.display_name), ''),
            v_display_name
          )
      where id = v_candidate.alias_project_member_id;

      v_current_project_member_id := v_candidate.alias_project_member_id;
    elsif v_current_project_member_id <> v_candidate.alias_project_member_id then
      perform public.merge_project_member_alias_into_canonical(
        v_candidate.alias_project_member_id,
        v_current_project_member_id
      );
      v_merged_count := v_merged_count + 1;
    end if;

    update public.project_members
    set role = case
          when public.project_member_role_rank(v_candidate.role)
            > public.project_member_role_rank(public.project_members.role)
            then v_candidate.role
          else public.project_members.role
        end,
        is_active = true,
        left_at = null,
        membership_status = 'active',
        pending_email = null,
        display_name = coalesce(
          nullif(trim(public.project_members.display_name), ''),
          v_display_name
        )
    where id = v_current_project_member_id;

    update public.projects
    set created_by = v_user_id
    where id = v_candidate.project_id
      and created_by <> v_user_id
      and exists (
        select 1
        from public.project_members pm
        where pm.id = v_current_project_member_id
          and pm.project_id = v_candidate.project_id
          and pm.role = 'owner'
      );

    if not (v_candidate.project_id = any(v_relinked_projects)) then
      v_relinked_projects := array_append(v_relinked_projects, v_candidate.project_id);
    end if;
  end loop;

  return query
  select coalesce(array_length(v_relinked_projects, 1), 0), v_merged_count;
end;
$$;

grant execute on function public.relink_my_project_memberships_by_email() to authenticated;

commit;
