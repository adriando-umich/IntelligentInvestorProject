create extension if not exists "pgcrypto";

do $$
begin
  create type public.project_status as enum ('active', 'archived', 'closed');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.project_member_role as enum ('owner', 'manager', 'member');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.ledger_entry_status as enum ('posted', 'voided');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.ledger_entry_type as enum (
    'capital_contribution',
    'capital_return',
    'operating_income',
    'operating_expense',
    'cash_handover',
    'expense_settlement_payment',
    'profit_distribution',
    'reconciliation_adjustment',
    'reversal'
  );
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.ledger_allocation_type as enum (
    'capital_owner',
    'income_share',
    'expense_share',
    'profit_share'
  );
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.reconciliation_run_status as enum ('open', 'closed');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.reconciliation_check_status as enum (
    'pending',
    'matched',
    'variance_found',
    'accepted',
    'adjustment_posted'
  );
exception
  when duplicate_object then null;
end $$;

create table if not exists public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null check (length(trim(display_name)) > 0),
  email text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  description text,
  currency_code char(3) not null default 'VND',
  status public.project_status not null default 'active',
  created_by uuid not null references public.profiles (user_id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.project_members (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  user_id uuid not null references public.profiles (user_id) on delete cascade,
  role public.project_member_role not null default 'member',
  is_active boolean not null default true,
  joined_at timestamptz not null default now(),
  left_at timestamptz,
  unique (project_id, user_id)
);

create table if not exists public.ledger_entries (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  entry_type public.ledger_entry_type not null,
  effective_at timestamptz not null,
  description text not null check (length(trim(description)) > 0),
  amount numeric(18,2) not null check (amount > 0),
  currency_code char(3) not null,
  cash_in_member_id uuid references public.profiles (user_id) on delete restrict,
  cash_out_member_id uuid references public.profiles (user_id) on delete restrict,
  external_counterparty text,
  note text,
  status public.ledger_entry_status not null default 'posted',
  reversal_of_entry_id uuid references public.ledger_entries (id) on delete restrict,
  created_by uuid not null references public.profiles (user_id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ledger_allocations (
  id uuid primary key default gen_random_uuid(),
  ledger_entry_id uuid not null references public.ledger_entries (id) on delete cascade,
  project_member_id uuid not null references public.project_members (id) on delete cascade,
  allocation_type public.ledger_allocation_type not null,
  amount numeric(18,2) not null check (amount >= 0),
  weight_percent numeric(8,5),
  note text,
  unique (ledger_entry_id, project_member_id, allocation_type)
);

create table if not exists public.profit_distribution_runs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  as_of timestamptz not null,
  distribution_date timestamptz not null default now(),
  total_amount numeric(18,2) not null check (total_amount > 0),
  cash_out_member_id uuid not null references public.profiles (user_id) on delete restrict,
  ledger_entry_id uuid not null unique references public.ledger_entries (id) on delete cascade,
  created_by uuid not null references public.profiles (user_id) on delete restrict,
  created_at timestamptz not null default now()
);

create table if not exists public.profit_distribution_lines (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.profit_distribution_runs (id) on delete cascade,
  project_member_id uuid not null references public.project_members (id) on delete cascade,
  capital_balance_snapshot numeric(18,2) not null,
  weight_basis_amount numeric(18,2) not null,
  weight_percent numeric(8,5) not null check (weight_percent >= 0 and weight_percent <= 1),
  distribution_amount numeric(18,2) not null check (distribution_amount >= 0),
  unique (run_id, project_member_id)
);

create table if not exists public.reconciliation_runs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  as_of timestamptz not null,
  status public.reconciliation_run_status not null default 'open',
  opened_by uuid not null references public.profiles (user_id) on delete restrict,
  opened_at timestamptz not null default now(),
  closed_by uuid references public.profiles (user_id) on delete restrict,
  closed_at timestamptz,
  note text
);

create table if not exists public.reconciliation_checks (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.reconciliation_runs (id) on delete cascade,
  project_member_id uuid not null references public.project_members (id) on delete cascade,
  expected_project_cash numeric(18,2) not null,
  reported_project_cash numeric(18,2),
  variance_amount numeric(18,2),
  status public.reconciliation_check_status not null default 'pending',
  member_note text,
  review_note text,
  submitted_by uuid references public.profiles (user_id) on delete restrict,
  submitted_at timestamptz,
  reviewed_by uuid references public.profiles (user_id) on delete restrict,
  reviewed_at timestamptz,
  unique (run_id, project_member_id)
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.is_project_member(
  p_project_id uuid,
  p_user_id uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.project_members pm
    where pm.project_id = p_project_id
      and pm.user_id = p_user_id
      and pm.is_active = true
  );
$$;

create or replace function public.is_project_manager(
  p_project_id uuid,
  p_user_id uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.project_members pm
    where pm.project_id = p_project_id
      and pm.user_id = p_user_id
      and pm.is_active = true
      and pm.role in ('owner', 'manager')
  );
$$;

create or replace function public.project_member_project_id(
  p_project_member_id uuid
)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select pm.project_id
  from public.project_members pm
  where pm.id = p_project_member_id;
$$;

create or replace function public.can_create_ledger_entry(
  p_project_id uuid,
  p_entry_type public.ledger_entry_type
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case
    when p_entry_type in (
      'operating_income',
      'operating_expense',
      'cash_handover',
      'expense_settlement_payment'
    ) then public.is_project_member(p_project_id)
    else public.is_project_manager(p_project_id)
  end;
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  display_name text;
begin
  display_name := coalesce(
    nullif(new.raw_user_meta_data ->> 'display_name', ''),
    nullif(new.raw_user_meta_data ->> 'name', ''),
    split_part(coalesce(new.email, ''), '@', 1),
    'New member'
  );

  insert into public.profiles (user_id, display_name, email)
  values (new.id, display_name, coalesce(new.email, ''))
  on conflict (user_id) do update
    set display_name = excluded.display_name,
        email = excluded.email,
        updated_at = now();

  return new;
end;
$$;

create or replace function public.validate_ledger_entry_shape()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.amount <= 0 then
    raise exception 'Ledger entry amount must be greater than zero';
  end if;

  if not public.is_project_member(new.project_id, new.created_by) then
    raise exception 'Entry creator must be an active member of the project';
  end if;

  if new.cash_in_member_id is not null
     and not public.is_project_member(new.project_id, new.cash_in_member_id) then
    raise exception 'cash_in_member_id must belong to the project';
  end if;

  if new.cash_out_member_id is not null
     and not public.is_project_member(new.project_id, new.cash_out_member_id) then
    raise exception 'cash_out_member_id must belong to the project';
  end if;

  if new.reversal_of_entry_id is not null then
    if new.entry_type <> 'reversal' then
      raise exception 'reversal_of_entry_id is only valid for reversal entries';
    end if;

    if new.cash_in_member_id is not null or new.cash_out_member_id is not null then
      raise exception 'reversal entries do not store direct cash leg references';
    end if;
  elsif new.entry_type = 'reversal' then
    raise exception 'reversal entries require reversal_of_entry_id';
  end if;

  case new.entry_type
    when 'capital_contribution' then
      if new.cash_in_member_id is null or new.cash_out_member_id is not null then
        raise exception 'capital_contribution requires cash_in_member_id only';
      end if;
    when 'capital_return' then
      if new.cash_out_member_id is null or new.cash_in_member_id is not null then
        raise exception 'capital_return requires cash_out_member_id only';
      end if;
    when 'operating_income' then
      if new.cash_in_member_id is null or new.cash_out_member_id is not null then
        raise exception 'operating_income requires cash_in_member_id only';
      end if;
    when 'operating_expense' then
      if new.cash_out_member_id is null or new.cash_in_member_id is not null then
        raise exception 'operating_expense requires cash_out_member_id only';
      end if;
    when 'cash_handover' then
      if new.cash_in_member_id is null or new.cash_out_member_id is null then
        raise exception 'cash_handover requires both cash legs';
      end if;
    when 'expense_settlement_payment' then
      if new.cash_in_member_id is null or new.cash_out_member_id is null then
        raise exception 'expense_settlement_payment requires both cash legs';
      end if;
    when 'profit_distribution' then
      if new.cash_out_member_id is null or new.cash_in_member_id is not null then
        raise exception 'profit_distribution requires cash_out_member_id only';
      end if;
    when 'reconciliation_adjustment' then
      if new.cash_in_member_id is null and new.cash_out_member_id is null then
        raise exception 'reconciliation_adjustment requires a cash leg';
      end if;
      if new.cash_in_member_id is not null and new.cash_out_member_id is not null then
        raise exception 'reconciliation_adjustment should adjust one cash leg at a time';
      end if;
    when 'reversal' then
      null;
  end case;

  return new;
end;
$$;

create or replace function public.assert_ledger_entry_allocations(
  p_ledger_entry_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  entry_row public.ledger_entries%rowtype;
  total_allocated numeric(18,2);
  required_type public.ledger_allocation_type;
  allowed_count integer;
begin
  select *
  into entry_row
  from public.ledger_entries
  where id = p_ledger_entry_id;

  if not found then
    return;
  end if;

  case entry_row.entry_type
    when 'capital_contribution', 'capital_return' then
      required_type := 'capital_owner';
    when 'operating_income' then
      required_type := 'income_share';
    when 'operating_expense' then
      required_type := 'expense_share';
    when 'profit_distribution' then
      required_type := 'profit_share';
    else
      required_type := null;
  end case;

  select count(*)
  into allowed_count
  from public.ledger_allocations la
  where la.ledger_entry_id = p_ledger_entry_id;

  if required_type is null then
    if allowed_count > 0 then
      raise exception 'Entry type % does not allow allocations', entry_row.entry_type;
    end if;
    return;
  end if;

  select coalesce(sum(la.amount), 0)::numeric(18,2)
  into total_allocated
  from public.ledger_allocations la
  where la.ledger_entry_id = p_ledger_entry_id
    and la.allocation_type = required_type;

  if exists (
    select 1
    from public.ledger_allocations la
    where la.ledger_entry_id = p_ledger_entry_id
      and la.allocation_type <> required_type
  ) then
    raise exception 'Entry type % only allows % allocations', entry_row.entry_type, required_type;
  end if;

  if total_allocated <> round(entry_row.amount, 2) then
    raise exception 'Allocations for entry % must sum to %', p_ledger_entry_id, entry_row.amount;
  end if;

  if exists (
    select 1
    from public.ledger_allocations la
    join public.project_members pm
      on pm.id = la.project_member_id
    where la.ledger_entry_id = p_ledger_entry_id
      and pm.project_id <> entry_row.project_id
  ) then
    raise exception 'Allocation members must belong to the same project as the entry';
  end if;
end;
$$;

create or replace function public.enforce_ledger_allocations()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  entry_id uuid;
begin
  entry_id := coalesce(new.ledger_entry_id, old.ledger_entry_id);
  perform public.assert_ledger_entry_allocations(entry_id);
  return null;
end;
$$;

create or replace function public.sync_reconciliation_check_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.reported_project_cash is null then
    if new.status not in ('accepted', 'adjustment_posted') then
      new.status := 'pending';
      new.variance_amount := null;
    end if;
    return new;
  end if;

  if new.status in ('accepted', 'adjustment_posted') then
    if new.variance_amount is null then
      new.variance_amount := round(new.reported_project_cash - new.expected_project_cash, 2);
    end if;
    return new;
  end if;

  new.variance_amount := round(new.reported_project_cash - new.expected_project_cash, 2);

  if abs(new.variance_amount) <= 0.01 then
    new.status := 'matched';
  else
    new.status := 'variance_found';
  end if;

  return new;
end;
$$;

create table if not exists public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null check (length(trim(display_name)) > 0),
  email text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  description text,
  currency_code char(3) not null default 'VND',
  status public.project_status not null default 'active',
  created_by uuid not null references public.profiles (user_id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.project_members (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  user_id uuid not null references public.profiles (user_id) on delete cascade,
  role public.project_member_role not null default 'member',
  is_active boolean not null default true,
  joined_at timestamptz not null default now(),
  left_at timestamptz,
  unique (project_id, user_id)
);

create table if not exists public.ledger_entries (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  entry_type public.ledger_entry_type not null,
  effective_at timestamptz not null,
  description text not null check (length(trim(description)) > 0),
  amount numeric(18,2) not null check (amount > 0),
  currency_code char(3) not null,
  cash_in_member_id uuid references public.profiles (user_id) on delete restrict,
  cash_out_member_id uuid references public.profiles (user_id) on delete restrict,
  external_counterparty text,
  note text,
  status public.ledger_entry_status not null default 'posted',
  reversal_of_entry_id uuid references public.ledger_entries (id) on delete restrict,
  created_by uuid not null references public.profiles (user_id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ledger_allocations (
  id uuid primary key default gen_random_uuid(),
  ledger_entry_id uuid not null references public.ledger_entries (id) on delete cascade,
  project_member_id uuid not null references public.project_members (id) on delete cascade,
  allocation_type public.ledger_allocation_type not null,
  amount numeric(18,2) not null check (amount >= 0),
  weight_percent numeric(8,5),
  note text,
  unique (ledger_entry_id, project_member_id, allocation_type)
);

create table if not exists public.profit_distribution_runs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  as_of timestamptz not null,
  distribution_date timestamptz not null default now(),
  total_amount numeric(18,2) not null check (total_amount > 0),
  cash_out_member_id uuid not null references public.profiles (user_id) on delete restrict,
  ledger_entry_id uuid not null unique references public.ledger_entries (id) on delete cascade,
  created_by uuid not null references public.profiles (user_id) on delete restrict,
  created_at timestamptz not null default now()
);

create table if not exists public.profit_distribution_lines (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.profit_distribution_runs (id) on delete cascade,
  project_member_id uuid not null references public.project_members (id) on delete cascade,
  capital_balance_snapshot numeric(18,2) not null,
  weight_basis_amount numeric(18,2) not null,
  weight_percent numeric(8,5) not null check (weight_percent >= 0 and weight_percent <= 1),
  distribution_amount numeric(18,2) not null check (distribution_amount >= 0),
  unique (run_id, project_member_id)
);

create table if not exists public.reconciliation_runs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  as_of timestamptz not null,
  status public.reconciliation_run_status not null default 'open',
  opened_by uuid not null references public.profiles (user_id) on delete restrict,
  opened_at timestamptz not null default now(),
  closed_by uuid references public.profiles (user_id) on delete restrict,
  closed_at timestamptz,
  note text
);

create table if not exists public.reconciliation_checks (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.reconciliation_runs (id) on delete cascade,
  project_member_id uuid not null references public.project_members (id) on delete cascade,
  expected_project_cash numeric(18,2) not null,
  reported_project_cash numeric(18,2),
  variance_amount numeric(18,2),
  status public.reconciliation_check_status not null default 'pending',
  member_note text,
  review_note text,
  submitted_by uuid references public.profiles (user_id) on delete restrict,
  submitted_at timestamptz,
  reviewed_by uuid references public.profiles (user_id) on delete restrict,
  reviewed_at timestamptz,
  unique (run_id, project_member_id)
);

create index if not exists profiles_email_idx on public.profiles (email);
create index if not exists projects_created_by_idx on public.projects (created_by);
create index if not exists projects_status_idx on public.projects (status);
create index if not exists project_members_project_idx on public.project_members (project_id);
create index if not exists project_members_user_idx on public.project_members (user_id);
create index if not exists project_members_active_idx on public.project_members (project_id, is_active);
create index if not exists ledger_entries_project_effective_idx on public.ledger_entries (project_id, effective_at desc);
create index if not exists ledger_entries_project_status_idx on public.ledger_entries (project_id, status);
create index if not exists ledger_entries_cash_in_idx on public.ledger_entries (cash_in_member_id);
create index if not exists ledger_entries_cash_out_idx on public.ledger_entries (cash_out_member_id);
create index if not exists ledger_allocations_entry_idx on public.ledger_allocations (ledger_entry_id);
create index if not exists ledger_allocations_member_idx on public.ledger_allocations (project_member_id);
create index if not exists profit_distribution_runs_project_idx on public.profit_distribution_runs (project_id, distribution_date desc);
create index if not exists profit_distribution_lines_run_idx on public.profit_distribution_lines (run_id);
create index if not exists reconciliation_runs_project_idx on public.reconciliation_runs (project_id, as_of desc);
create index if not exists reconciliation_checks_run_idx on public.reconciliation_checks (run_id);
create index if not exists reconciliation_checks_status_idx on public.reconciliation_checks (status);

drop trigger if exists set_profiles_updated_at on public.profiles;
create trigger set_profiles_updated_at
before update on public.profiles
for each row
execute function public.set_updated_at();

drop trigger if exists set_projects_updated_at on public.projects;
create trigger set_projects_updated_at
before update on public.projects
for each row
execute function public.set_updated_at();

drop trigger if exists set_ledger_entries_updated_at on public.ledger_entries;
create trigger set_ledger_entries_updated_at
before update on public.ledger_entries
for each row
execute function public.set_updated_at();

drop trigger if exists validate_ledger_entry_shape_trigger on public.ledger_entries;
create trigger validate_ledger_entry_shape_trigger
before insert or update on public.ledger_entries
for each row
execute function public.validate_ledger_entry_shape();

drop trigger if exists validate_ledger_allocations_trigger on public.ledger_allocations;
create constraint trigger validate_ledger_allocations_trigger
after insert or update or delete on public.ledger_allocations
deferrable initially deferred
for each row
execute function public.enforce_ledger_allocations();

drop trigger if exists sync_reconciliation_check_fields_trigger on public.reconciliation_checks;
create trigger sync_reconciliation_check_fields_trigger
before insert or update on public.reconciliation_checks
for each row
execute function public.sync_reconciliation_check_fields();

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.projects enable row level security;
alter table public.project_members enable row level security;
alter table public.ledger_entries enable row level security;
alter table public.ledger_allocations enable row level security;
alter table public.profit_distribution_runs enable row level security;
alter table public.profit_distribution_lines enable row level security;
alter table public.reconciliation_runs enable row level security;
alter table public.reconciliation_checks enable row level security;

drop policy if exists "profiles_select_own_or_authenticated" on public.profiles;
create policy "profiles_select_own_or_authenticated"
on public.profiles
for select
to authenticated
using (true);

drop policy if exists "profiles_insert_self" on public.profiles;
create policy "profiles_insert_self"
on public.profiles
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "profiles_update_self" on public.profiles;
create policy "profiles_update_self"
on public.profiles
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "projects_select_members" on public.projects;
create policy "projects_select_members"
on public.projects
for select
to authenticated
using (public.is_project_member(id));

drop policy if exists "projects_insert_own" on public.projects;
create policy "projects_insert_own"
on public.projects
for insert
to authenticated
with check (created_by = auth.uid());

drop policy if exists "projects_update_managers" on public.projects;
create policy "projects_update_managers"
on public.projects
for update
to authenticated
using (public.is_project_manager(id))
with check (public.is_project_manager(id));

drop policy if exists "projects_delete_owners" on public.projects;
create policy "projects_delete_owners"
on public.projects
for delete
to authenticated
using (public.is_project_manager(id));

drop policy if exists "project_members_select_project_members" on public.project_members;
create policy "project_members_select_project_members"
on public.project_members
for select
to authenticated
using (public.is_project_member(project_id));

drop policy if exists "project_members_insert_managers_or_creator" on public.project_members;
create policy "project_members_insert_managers_or_creator"
on public.project_members
for insert
to authenticated
with check (
  public.is_project_manager(project_id)
  or (
    auth.uid() = user_id
    and exists (
      select 1
      from public.projects p
      where p.id = project_id
      and p.created_by = auth.uid()
    )
  )
);

drop policy if exists "project_members_update_managers" on public.project_members;
create policy "project_members_update_managers"
on public.project_members
for update
to authenticated
using (public.is_project_manager(project_id))
with check (public.is_project_manager(project_id));

drop policy if exists "project_members_delete_managers" on public.project_members;
create policy "project_members_delete_managers"
on public.project_members
for delete
to authenticated
using (public.is_project_manager(project_id));

drop policy if exists "ledger_entries_select_members" on public.ledger_entries;
create policy "ledger_entries_select_members"
on public.ledger_entries
for select
to authenticated
using (public.is_project_member(project_id));

drop policy if exists "ledger_entries_insert_allowed_roles" on public.ledger_entries;
create policy "ledger_entries_insert_allowed_roles"
on public.ledger_entries
for insert
to authenticated
with check (
  created_by = auth.uid()
  and public.can_create_ledger_entry(project_id, entry_type)
);

drop policy if exists "ledger_allocations_select_members" on public.ledger_allocations;
create policy "ledger_allocations_select_members"
on public.ledger_allocations
for select
to authenticated
using (
  exists (
    select 1
    from public.ledger_entries le
    where le.id = ledger_entry_id
      and public.is_project_member(le.project_id)
  )
);

drop policy if exists "ledger_allocations_insert_allowed_roles" on public.ledger_allocations;
create policy "ledger_allocations_insert_allowed_roles"
on public.ledger_allocations
for insert
to authenticated
with check (
  exists (
    select 1
    from public.ledger_entries le
    where le.id = ledger_entry_id
      and (
        (
          le.entry_type in ('operating_income', 'operating_expense', 'cash_handover', 'expense_settlement_payment')
          and public.is_project_member(le.project_id)
        )
        or (
          le.entry_type in ('capital_contribution', 'capital_return', 'profit_distribution', 'reconciliation_adjustment', 'reversal')
          and public.is_project_manager(le.project_id)
        )
      )
  )
);

drop policy if exists "profit_distribution_runs_select_members" on public.profit_distribution_runs;
create policy "profit_distribution_runs_select_members"
on public.profit_distribution_runs
for select
to authenticated
using (public.is_project_member(project_id));

drop policy if exists "profit_distribution_runs_insert_managers" on public.profit_distribution_runs;
create policy "profit_distribution_runs_insert_managers"
on public.profit_distribution_runs
for insert
to authenticated
with check (created_by = auth.uid() and public.is_project_manager(project_id));

drop policy if exists "profit_distribution_lines_select_members" on public.profit_distribution_lines;
create policy "profit_distribution_lines_select_members"
on public.profit_distribution_lines
for select
to authenticated
using (
  exists (
    select 1
    from public.profit_distribution_runs pdr
    where pdr.id = run_id
      and public.is_project_member(pdr.project_id)
  )
);

drop policy if exists "profit_distribution_lines_insert_managers" on public.profit_distribution_lines;
create policy "profit_distribution_lines_insert_managers"
on public.profit_distribution_lines
for insert
to authenticated
with check (
  exists (
    select 1
    from public.profit_distribution_runs pdr
    where pdr.id = run_id
      and public.is_project_manager(pdr.project_id)
  )
);

drop policy if exists "reconciliation_runs_select_members" on public.reconciliation_runs;
create policy "reconciliation_runs_select_members"
on public.reconciliation_runs
for select
to authenticated
using (public.is_project_member(project_id));

drop policy if exists "reconciliation_runs_insert_managers" on public.reconciliation_runs;
create policy "reconciliation_runs_insert_managers"
on public.reconciliation_runs
for insert
to authenticated
with check (opened_by = auth.uid() and public.is_project_manager(project_id));

drop policy if exists "reconciliation_runs_update_managers" on public.reconciliation_runs;
create policy "reconciliation_runs_update_managers"
on public.reconciliation_runs
for update
to authenticated
using (public.is_project_manager(project_id))
with check (public.is_project_manager(project_id));

drop policy if exists "reconciliation_checks_select_members" on public.reconciliation_checks;
create policy "reconciliation_checks_select_members"
on public.reconciliation_checks
for select
to authenticated
using (
  exists (
    select 1
    from public.reconciliation_runs rr
    join public.project_members pm
      on pm.id = reconciliation_checks.project_member_id
    where rr.id = run_id
      and rr.project_id = pm.project_id
      and public.is_project_member(rr.project_id)
  )
);

drop policy if exists "reconciliation_checks_insert_members_or_managers" on public.reconciliation_checks;
create policy "reconciliation_checks_insert_members_or_managers"
on public.reconciliation_checks
for insert
to authenticated
with check (
  exists (
    select 1
    from public.reconciliation_runs rr
    join public.project_members pm
      on pm.id = reconciliation_checks.project_member_id
    where rr.id = run_id
      and rr.project_id = pm.project_id
      and (
        public.is_project_manager(rr.project_id)
        or (
          submitted_by = auth.uid()
          and public.is_project_member(rr.project_id)
        )
        or submitted_by is null
      )
  )
);

drop policy if exists "reconciliation_checks_update_members_or_managers" on public.reconciliation_checks;
create policy "reconciliation_checks_update_members_or_managers"
on public.reconciliation_checks
for update
to authenticated
using (
  exists (
    select 1
    from public.reconciliation_runs rr
    join public.project_members pm
      on pm.id = reconciliation_checks.project_member_id
    where rr.id = run_id
      and rr.project_id = pm.project_id
      and (
        public.is_project_manager(rr.project_id)
        or submitted_by = auth.uid()
      )
  )
)
with check (
  exists (
    select 1
    from public.reconciliation_runs rr
    join public.project_members pm
      on pm.id = reconciliation_checks.project_member_id
    where rr.id = run_id
      and rr.project_id = pm.project_id
      and (
        public.is_project_manager(rr.project_id)
        or submitted_by = auth.uid()
      )
  )
);

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
      and pm.project_id = p_project_id;

    if not found then
      raise exception 'cash in project member does not belong to the project';
    end if;
  end if;

  if p_cash_out_project_member_id is not null then
    select pm.user_id
    into v_cash_out_user_id
    from public.project_members pm
    where pm.id = p_cash_out_project_member_id
      and pm.project_id = p_project_id;

    if not found then
      raise exception 'cash out project member does not belong to the project';
    end if;
  end if;

  if p_capital_owner_project_member_id is not null then
    perform 1
    from public.project_members pm
    where pm.id = p_capital_owner_project_member_id
      and pm.project_id = p_project_id;

    if not found then
      raise exception 'capital owner project member does not belong to the project';
    end if;
  end if;

  if p_allocation_project_member_ids is not null then
    select count(distinct pm.id)
    into v_valid_count
    from public.project_members pm
    where pm.id = any(p_allocation_project_member_ids)
      and pm.project_id = p_project_id;

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

grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant execute on all functions in schema public to authenticated;

alter default privileges in schema public grant select, insert, update, delete on tables to authenticated;
alter default privileges in schema public grant execute on functions to authenticated;
