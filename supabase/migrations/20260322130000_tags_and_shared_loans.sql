do $$
begin
  alter type public.ledger_entry_type add value if not exists 'shared_loan_drawdown';
exception
  when duplicate_object then null;
end $$;

create table if not exists public.project_tags (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  slug text not null check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, slug)
);

create table if not exists public.ledger_entry_tags (
  ledger_entry_id uuid not null references public.ledger_entries (id) on delete cascade,
  project_tag_id uuid not null references public.project_tags (id) on delete cascade,
  primary key (ledger_entry_id, project_tag_id)
);

create index if not exists project_tags_project_idx on public.project_tags (project_id);
create index if not exists project_tags_slug_idx on public.project_tags (project_id, slug);
create index if not exists ledger_entry_tags_project_tag_idx on public.ledger_entry_tags (project_tag_id);

drop trigger if exists set_project_tags_updated_at on public.project_tags;
create trigger set_project_tags_updated_at
before update on public.project_tags
for each row
execute function public.set_updated_at();

alter table public.project_tags enable row level security;
alter table public.ledger_entry_tags enable row level security;

drop policy if exists "project_tags_select_members" on public.project_tags;
create policy "project_tags_select_members"
on public.project_tags
for select
to authenticated
using (public.is_project_member(project_id));

drop policy if exists "project_tags_insert_members" on public.project_tags;
create policy "project_tags_insert_members"
on public.project_tags
for insert
to authenticated
with check (public.is_project_member(project_id));

drop policy if exists "project_tags_update_managers" on public.project_tags;
create policy "project_tags_update_managers"
on public.project_tags
for update
to authenticated
using (public.is_project_manager(project_id))
with check (public.is_project_manager(project_id));

drop policy if exists "ledger_entry_tags_select_members" on public.ledger_entry_tags;
create policy "ledger_entry_tags_select_members"
on public.ledger_entry_tags
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

drop policy if exists "ledger_entry_tags_insert_entry_creator_or_manager" on public.ledger_entry_tags;
create policy "ledger_entry_tags_insert_entry_creator_or_manager"
on public.ledger_entry_tags
for insert
to authenticated
with check (
  exists (
    select 1
    from public.ledger_entries le
    where le.id = ledger_entry_id
      and (
        le.created_by = auth.uid()
        or public.is_project_manager(le.project_id)
      )
  )
);

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
    when 'shared_loan_drawdown' then
      if new.cash_in_member_id is null or new.cash_out_member_id is not null then
        raise exception 'shared_loan_drawdown requires cash_in_member_id only';
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

drop function if exists public.create_project_ledger_entry(
  uuid,
  public.ledger_entry_type,
  timestamptz,
  text,
  numeric,
  char(3),
  uuid,
  uuid,
  uuid,
  uuid[],
  text,
  text
);

create function public.create_project_ledger_entry(
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
  p_tag_names text[] default null,
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
  v_tag_name text;
  v_tag_slug text;
  v_tag_id uuid;
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

  if p_tag_names is not null then
    foreach v_tag_name in array p_tag_names loop
      v_tag_name := trim(coalesce(v_tag_name, ''));

      if v_tag_name = '' then
        continue;
      end if;

      v_tag_slug := regexp_replace(lower(v_tag_name), '[^a-z0-9]+', '-', 'g');
      v_tag_slug := trim(both '-' from v_tag_slug);

      if v_tag_slug = '' then
        continue;
      end if;

      insert into public.project_tags (
        project_id,
        name,
        slug
      )
      values (
        p_project_id,
        v_tag_name,
        v_tag_slug
      )
      on conflict (project_id, slug) do update
        set name = excluded.name,
            updated_at = now()
      returning id into v_tag_id;

      insert into public.ledger_entry_tags (
        ledger_entry_id,
        project_tag_id
      )
      values (
        v_entry_id,
        v_tag_id
      )
      on conflict do nothing;
    end loop;
  end if;

  return v_entry_id;
end;
$$;

grant execute on function public.create_project_ledger_entry(
  uuid,
  public.ledger_entry_type,
  timestamptz,
  text,
  numeric,
  char(3),
  uuid,
  uuid,
  uuid,
  uuid[],
  text[],
  text,
  text
) to authenticated;
