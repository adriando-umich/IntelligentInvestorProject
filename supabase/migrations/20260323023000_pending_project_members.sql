begin;

do $$
begin
  create type public.project_membership_status as enum (
    'active',
    'pending_invite'
  );
exception
  when duplicate_object then null;
end $$;

alter table public.project_members
  alter column user_id drop not null;

alter table public.project_members
  add column if not exists membership_status public.project_membership_status not null default 'active',
  add column if not exists pending_email text,
  add column if not exists display_name text;

alter table public.project_invites
  add column if not exists project_member_id uuid references public.project_members (id) on delete set null;

create index if not exists project_invites_project_member_idx
  on public.project_invites (project_member_id);

update public.project_members pm
set
  membership_status = 'active',
  pending_email = null,
  display_name = coalesce(nullif(trim(pm.display_name), ''), p.display_name)
from public.profiles p
where pm.user_id = p.user_id;

update public.project_invites pi
set project_member_id = pm.id
from public.project_members pm
join public.profiles p
  on p.user_id = pm.user_id
where pi.project_member_id is null
  and pi.email is not null
  and pm.project_id = pi.project_id
  and pm.is_active = true
  and lower(p.email) = lower(pi.email);

with pending_targets as (
  select
    pi.project_id,
    lower(pi.email) as email,
    case
      when bool_or(pi.role = 'manager') then 'manager'::public.project_member_role
      else 'member'::public.project_member_role
    end as role
  from public.project_invites pi
  where pi.status = 'pending'
    and pi.email is not null
    and pi.project_member_id is null
  group by pi.project_id, lower(pi.email)
)
insert into public.project_members (
  project_id,
  user_id,
  role,
  is_active,
  joined_at,
  membership_status,
  pending_email,
  display_name
)
select
  pt.project_id,
  null,
  pt.role,
  true,
  now(),
  'pending_invite',
  pt.email,
  nullif(
    trim(
      initcap(
        replace(
          replace(
            replace(split_part(pt.email, '@', 1), '.', ' '),
            '_',
            ' '
          ),
          '-',
          ' '
        )
      )
    ),
    ''
  )
from pending_targets pt
where not exists (
  select 1
  from public.project_members pm
  where pm.project_id = pt.project_id
    and pm.is_active = true
    and (
      (pm.user_id is null and lower(coalesce(pm.pending_email, '')) = pt.email)
      or (
        pm.user_id is not null
        and exists (
          select 1
          from public.profiles p
          where p.user_id = pm.user_id
            and lower(p.email) = pt.email
        )
      )
    )
);

update public.project_invites pi
set project_member_id = pm.id
from public.project_members pm
left join public.profiles p
  on p.user_id = pm.user_id
where pi.project_member_id is null
  and pi.email is not null
  and pm.project_id = pi.project_id
  and pm.is_active = true
  and (
    (pm.user_id is null and lower(coalesce(pm.pending_email, '')) = lower(pi.email))
    or (pm.user_id is not null and lower(coalesce(p.email, '')) = lower(pi.email))
  );

create unique index if not exists project_members_pending_email_active_idx
  on public.project_members (project_id, lower(pending_email))
  where pending_email is not null
    and user_id is null
    and is_active = true;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'project_members_membership_consistency'
  ) then
    alter table public.project_members
      add constraint project_members_membership_consistency
      check (
        (membership_status = 'active' and user_id is not null)
        or (
          membership_status = 'pending_invite'
          and user_id is null
          and pending_email is not null
        )
      ) not valid;
  end if;
end $$;

alter table public.project_members
  validate constraint project_members_membership_consistency;

create or replace function public.create_project_with_owner(
  p_name text,
  p_description text default null,
  p_currency_code text default 'VND'
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_project_id uuid;
  v_base_slug text;
  v_slug text;
  v_suffix integer := 1;
  v_display_name text := coalesce(
    nullif(auth.jwt() -> 'user_metadata' ->> 'display_name', ''),
    nullif(auth.jwt() -> 'user_metadata' ->> 'name', ''),
    split_part(coalesce(auth.jwt() ->> 'email', ''), '@', 1),
    'Project member'
  );
begin
  if v_user_id is null then
    raise exception 'You must be authenticated to create a project';
  end if;

  if length(trim(coalesce(p_name, ''))) < 3 then
    raise exception 'Project name must be at least 3 characters long';
  end if;

  insert into public.profiles (user_id, display_name, email)
  values (
    v_user_id,
    v_display_name,
    coalesce(auth.jwt() ->> 'email', '')
  )
  on conflict (user_id) do nothing;

  v_base_slug := regexp_replace(lower(trim(p_name)), '[^a-z0-9]+', '-', 'g');
  v_base_slug := trim(both '-' from v_base_slug);

  if v_base_slug = '' then
    v_base_slug := 'project';
  end if;

  v_slug := v_base_slug;

  while exists (
    select 1
    from public.projects
    where slug = v_slug
  ) loop
    v_suffix := v_suffix + 1;
    v_slug := v_base_slug || '-' || v_suffix;
  end loop;

  insert into public.projects (
    name,
    slug,
    description,
    currency_code,
    created_by
  )
  values (
    trim(p_name),
    v_slug,
    nullif(trim(coalesce(p_description, '')), ''),
    upper(left(coalesce(nullif(trim(p_currency_code), ''), 'VND'), 3)),
    v_user_id
  )
  returning id into v_project_id;

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
    v_project_id,
    v_user_id,
    'owner',
    true,
    null,
    'active',
    null,
    v_display_name
  )
  on conflict (project_id, user_id) do update
    set role = excluded.role,
        is_active = true,
        left_at = null,
        membership_status = 'active',
        pending_email = null,
        display_name = excluded.display_name;

  return v_project_id;
end;
$$;

create or replace function public.create_project_invite(
  p_project_id uuid,
  p_email text default null,
  p_role public.project_member_role default 'member'
)
returns public.project_invites
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_email text := lower(nullif(trim(coalesce(p_email, '')), ''));
  v_invite public.project_invites;
  v_project_member_id uuid;
  v_display_name text;
begin
  if v_user_id is null then
    raise exception 'You must be authenticated to create an invite';
  end if;

  if not public.is_project_manager(p_project_id, v_user_id) then
    raise exception 'Only owners and managers can create invites';
  end if;

  if p_role not in ('manager', 'member') then
    raise exception 'Invites can only assign manager or member roles';
  end if;

  if v_email is not null and exists (
    select 1
    from public.project_members pm
    join public.profiles p
      on p.user_id = pm.user_id
    where pm.project_id = p_project_id
      and pm.is_active = true
      and lower(p.email) = v_email
  ) then
    raise exception 'That email is already an active member of the project';
  end if;

  if v_email is not null then
    select pm.id
    into v_project_member_id
    from public.project_members pm
    where pm.project_id = p_project_id
      and pm.is_active = true
      and pm.user_id is null
      and coalesce(pm.membership_status, 'active') = 'pending_invite'
      and lower(pm.pending_email) = v_email
    order by pm.joined_at asc
    limit 1;

    if v_project_member_id is null then
      v_display_name := nullif(
        trim(
          initcap(
            replace(
              replace(
                replace(split_part(v_email, '@', 1), '.', ' '),
                '_',
                ' '
              ),
              '-',
              ' '
            )
          )
        ),
        ''
      );

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
        p_project_id,
        null,
        p_role,
        true,
        null,
        'pending_invite',
        v_email,
        coalesce(v_display_name, 'Pending member')
      )
      returning id into v_project_member_id;
    else
      update public.project_members
      set role = p_role,
          is_active = true,
          left_at = null,
          membership_status = 'pending_invite',
          pending_email = v_email
      where id = v_project_member_id;
    end if;
  end if;

  insert into public.project_invites (
    project_id,
    email,
    role,
    created_by,
    project_member_id
  )
  values (
    p_project_id,
    v_email,
    p_role,
    v_user_id,
    v_project_member_id
  )
  returning * into v_invite;

  return v_invite;
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

  v_project_member_id := v_invite.project_member_id;

  if v_project_member_id is null and v_email <> '' then
    select pm.id
    into v_project_member_id
    from public.project_members pm
    where pm.project_id = v_invite.project_id
      and pm.is_active = true
      and pm.user_id is null
      and coalesce(pm.membership_status, 'active') = 'pending_invite'
      and lower(pm.pending_email) = v_email
    order by pm.joined_at asc
    limit 1;
  end if;

  if v_project_member_id is null then
    select pm.id
    into v_project_member_id
    from public.project_members pm
    where pm.project_id = v_invite.project_id
      and pm.user_id = v_user_id
    order by case when pm.is_active then 0 else 1 end, pm.joined_at asc
    limit 1;
  end if;

  if v_project_member_id is null then
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
    and coalesce(pm.membership_status, 'active') = 'active'
    and pm.user_id is not null
  group by pm.id;
$$;

create or replace function public.create_project_ledger_entry(
  p_project_id uuid,
  p_entry_type public.ledger_entry_type,
  p_effective_at timestamptz,
  p_description text,
  p_amount numeric,
  p_currency_code char(3),
  p_cash_in_project_member_id uuid default null,
  p_cash_out_project_member_id uuid default null,
  p_capital_owner_project_member_id uuid default null,
  p_allocation_project_member_ids uuid[] default null,
  p_note text default null,
  p_external_counterparty text default null
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_created_by uuid := auth.uid();
  v_entry_id uuid;
  v_cash_in_user_id uuid;
  v_cash_out_user_id uuid;
  v_allocation_type public.ledger_allocation_type;
  v_member_count integer;
  v_share_amount numeric(18,2);
  v_remainder_amount numeric(18,2);
  v_index integer;
  v_valid_count integer;
begin
  if v_created_by is null then
    raise exception 'You must be authenticated to create a ledger entry';
  end if;

  if p_entry_type = 'profit_distribution' then
    raise exception 'Use a dedicated profit distribution flow for this entry type';
  end if;

  if p_cash_in_project_member_id is not null then
    select pm.user_id
    into v_cash_in_user_id
    from public.project_members pm
    where pm.id = p_cash_in_project_member_id
      and pm.project_id = p_project_id
      and pm.is_active = true
      and coalesce(pm.membership_status, 'active') = 'active'
      and pm.user_id is not null;

    if not found then
      raise exception 'cash in project member must be an active joined member';
    end if;
  end if;

  if p_cash_out_project_member_id is not null then
    select pm.user_id
    into v_cash_out_user_id
    from public.project_members pm
    where pm.id = p_cash_out_project_member_id
      and pm.project_id = p_project_id
      and pm.is_active = true
      and coalesce(pm.membership_status, 'active') = 'active'
      and pm.user_id is not null;

    if not found then
      raise exception 'cash out project member must be an active joined member';
    end if;
  end if;

  if p_capital_owner_project_member_id is not null then
    perform 1
    from public.project_members pm
    where pm.id = p_capital_owner_project_member_id
      and pm.project_id = p_project_id
      and pm.is_active = true;

    if not found then
      raise exception 'capital owner project member does not belong to the project';
    end if;
  end if;

  if p_allocation_project_member_ids is not null then
    select count(distinct pm.id)
    into v_valid_count
    from public.project_members pm
    where pm.id = any(p_allocation_project_member_ids)
      and pm.project_id = p_project_id
      and pm.is_active = true;

    if v_valid_count <> coalesce(array_length(p_allocation_project_member_ids, 1), 0) then
      raise exception 'One or more allocation members do not belong to the project';
    end if;
  end if;

  insert into public.ledger_entries (
    project_id,
    entry_type,
    effective_at,
    description,
    amount,
    currency_code,
    cash_in_member_id,
    cash_out_member_id,
    external_counterparty,
    note,
    created_by
  )
  values (
    p_project_id,
    p_entry_type,
    p_effective_at,
    p_description,
    p_amount,
    p_currency_code,
    v_cash_in_user_id,
    v_cash_out_user_id,
    p_external_counterparty,
    p_note,
    v_created_by
  )
  returning id into v_entry_id;

  case p_entry_type
    when 'capital_contribution', 'capital_return' then
      if p_capital_owner_project_member_id is null then
        raise exception 'Capital entries require a capital owner';
      end if;

      insert into public.ledger_allocations (
        ledger_entry_id,
        project_member_id,
        allocation_type,
        amount
      )
      values (
        v_entry_id,
        p_capital_owner_project_member_id,
        'capital_owner',
        round(p_amount, 2)
      );

    when 'operating_income', 'operating_expense' then
      v_member_count := coalesce(array_length(p_allocation_project_member_ids, 1), 0);

      if v_member_count = 0 then
        raise exception 'Operating income and expense require allocation members';
      end if;

      v_allocation_type :=
        case
          when p_entry_type = 'operating_income' then 'income_share'
          else 'expense_share'
        end;

      v_share_amount := trunc((p_amount / v_member_count) * 100) / 100;
      v_remainder_amount := round(p_amount - (v_share_amount * v_member_count), 2);

      for v_index in 1..v_member_count loop
        insert into public.ledger_allocations (
          ledger_entry_id,
          project_member_id,
          allocation_type,
          amount
        )
        values (
          v_entry_id,
          p_allocation_project_member_ids[v_index],
          v_allocation_type,
          case
            when v_index = 1 then round(v_share_amount + v_remainder_amount, 2)
            else v_share_amount
          end
        );
      end loop;

    else
      null;
  end case;

  return v_entry_id;
end;
$$;

grant execute on function public.create_project_with_owner(text, text, text) to authenticated;
grant execute on function public.create_project_invite(uuid, text, public.project_member_role) to authenticated;
grant execute on function public.accept_project_invite(text) to authenticated;

commit;
