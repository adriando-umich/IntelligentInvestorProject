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

create or replace function public.reconciliation_check_status_rank(
  p_status public.reconciliation_check_status
)
returns integer
language sql
immutable
as $$
  select case p_status
    when 'adjustment_posted' then 4
    when 'accepted' then 3
    when 'variance_found' then 2
    when 'matched' then 1
    else 0
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
      case max(public.reconciliation_check_status_rank(check_row.status))
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

  update public.project_member_activity
  set actor_project_member_id = p_canonical_project_member_id
  where actor_project_member_id = p_alias_project_member_id;

  update public.project_member_activity
  set target_project_member_id = p_canonical_project_member_id
  where target_project_member_id = p_alias_project_member_id;

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
      left_at = case
        when public.project_members.is_active then null
        else public.project_members.left_at
      end
  where id = p_canonical_project_member_id;

  delete from public.project_members
  where id = p_alias_project_member_id;
end;
$$;

create or replace function public.accept_project_invite(
  p_invite_token text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
  v_invite public.project_invites;
  v_project_id uuid;
  v_project_member_id uuid;
  v_pending_project_member_id uuid;
  v_existing_user_project_member_id uuid;
  v_display_name text := coalesce(
    nullif(auth.jwt() -> 'user_metadata' ->> 'display_name', ''),
    nullif(auth.jwt() -> 'user_metadata' ->> 'name', ''),
    split_part(v_email, '@', 1),
    'Project member'
  );
begin
  if v_user_id is null then
    raise exception 'You must be authenticated to accept an invite';
  end if;

  select *
  into v_invite
  from public.project_invites
  where invite_token = p_invite_token
  for update;

  if not found then
    raise exception 'Invite not found';
  end if;

  if v_invite.status = 'revoked' then
    raise exception 'This invite has been revoked';
  end if;

  if v_invite.status = 'accepted' then
    return v_invite.project_id;
  end if;

  if v_invite.expires_at < now() then
    update public.project_invites
    set status = 'expired',
        updated_at = now()
    where id = v_invite.id;

    raise exception 'This invite has expired';
  end if;

  if v_invite.email is not null and lower(v_invite.email) <> v_email then
    raise exception 'This invite is reserved for a different email address';
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

  select pm.id
  into v_existing_user_project_member_id
  from public.project_members pm
  where pm.project_id = v_invite.project_id
    and pm.user_id = v_user_id
  order by case when pm.is_active then 0 else 1 end, pm.joined_at asc
  limit 1;

  v_pending_project_member_id := v_invite.project_member_id;

  if v_pending_project_member_id is not null then
    select pm.id
    into v_pending_project_member_id
    from public.project_members pm
    where pm.id = v_pending_project_member_id
      and pm.project_id = v_invite.project_id
      and pm.user_id is null
      and coalesce(pm.membership_status, 'active') = 'pending_invite'
    limit 1;
  end if;

  if v_pending_project_member_id is null and v_email <> '' then
    select pm.id
    into v_pending_project_member_id
    from public.project_members pm
    where pm.project_id = v_invite.project_id
      and pm.is_active = true
      and pm.user_id is null
      and coalesce(pm.membership_status, 'active') = 'pending_invite'
      and lower(pm.pending_email) = v_email
    order by pm.joined_at asc
    limit 1;
  end if;

  if v_existing_user_project_member_id is not null then
    v_project_member_id := v_existing_user_project_member_id;

    if v_pending_project_member_id is not null
       and v_pending_project_member_id <> v_project_member_id then
      perform public.merge_project_member_alias_into_canonical(
        v_pending_project_member_id,
        v_project_member_id
      );
    end if;

    update public.project_members
    set role = v_invite.role,
        is_active = true,
        left_at = null,
        membership_status = 'active',
        pending_email = null,
        display_name = v_display_name
    where id = v_project_member_id
      and project_id = v_invite.project_id;
  elsif v_pending_project_member_id is null then
    insert into public.project_members (
      project_id,
      user_id,
      role,
      is_active,
      left_at,
      membership_status,
      pending_email,
      display_name
    )
    values (
      v_invite.project_id,
      v_user_id,
      v_invite.role,
      true,
      null,
      'active',
      null,
      v_display_name
    )
    returning id into v_project_member_id;
  else
    v_project_member_id := v_pending_project_member_id;

    update public.project_members
    set user_id = v_user_id,
        role = v_invite.role,
        is_active = true,
        left_at = null,
        membership_status = 'active',
        pending_email = null,
        display_name = v_display_name
    where id = v_project_member_id
      and project_id = v_invite.project_id;
  end if;

  update public.project_invites
  set status = 'accepted',
      accepted_by = v_user_id,
      accepted_at = now(),
      updated_at = now(),
      project_member_id = v_project_member_id
  where id = v_invite.id;

  v_project_id := v_invite.project_id;
  return v_project_id;
end;
$$;

do $$
declare
  stale_pending record;
  duplicate_user record;
begin
  for stale_pending in
    select
      pending_member.id as alias_project_member_id,
      active_member.id as canonical_project_member_id
    from public.project_members pending_member
    join public.profiles active_profile
      on lower(active_profile.email) = lower(pending_member.pending_email)
    join public.project_members active_member
      on active_member.project_id = pending_member.project_id
     and active_member.user_id = active_profile.user_id
     and active_member.is_active = true
    where pending_member.user_id is null
      and pending_member.is_active = true
      and coalesce(pending_member.membership_status, 'active') = 'pending_invite'
      and pending_member.id <> active_member.id
  loop
    perform public.merge_project_member_alias_into_canonical(
      stale_pending.alias_project_member_id,
      stale_pending.canonical_project_member_id
    );
  end loop;

  for duplicate_user in
    with ranked_user_members as (
      select
        pm.id,
        pm.project_id,
        pm.user_id,
        first_value(pm.id) over (
          partition by pm.project_id, pm.user_id
          order by case when pm.is_active then 0 else 1 end, pm.joined_at asc, pm.id asc
        ) as canonical_project_member_id,
        row_number() over (
          partition by pm.project_id, pm.user_id
          order by case when pm.is_active then 0 else 1 end, pm.joined_at asc, pm.id asc
        ) as row_number_in_identity
      from public.project_members pm
      where pm.user_id is not null
    )
    select
      id as alias_project_member_id,
      canonical_project_member_id
    from ranked_user_members
    where row_number_in_identity > 1
  loop
    perform public.merge_project_member_alias_into_canonical(
      duplicate_user.alias_project_member_id,
      duplicate_user.canonical_project_member_id
    );
  end loop;
end $$;

create unique index if not exists project_members_project_user_identity_idx
  on public.project_members (project_id, user_id)
  where user_id is not null;

commit;
