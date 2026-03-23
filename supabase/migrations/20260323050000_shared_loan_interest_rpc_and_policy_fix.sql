begin;

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
      'shared_loan_interest_payment',
      'cash_handover',
      'expense_settlement_payment'
    ) then public.is_project_member(p_project_id)
    else public.is_project_manager(p_project_id)
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
    when 'operating_expense', 'shared_loan_interest_payment' then
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
          le.entry_type in (
            'operating_income',
            'operating_expense',
            'shared_loan_interest_payment',
            'cash_handover',
            'expense_settlement_payment'
          )
          and public.is_project_member(le.project_id)
        )
        or (
          le.entry_type in (
            'capital_contribution',
            'capital_return',
            'profit_distribution',
            'reconciliation_adjustment',
            'reversal'
          )
          and public.is_project_manager(le.project_id)
        )
      )
  )
);

drop function if exists public.create_project_ledger_entry(
  uuid,
  public.ledger_entry_type,
  timestamptz,
  text,
  numeric,
  char,
  uuid,
  uuid,
  uuid,
  uuid[],
  text,
  text
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
  v_cash_in_project_member_id uuid;
  v_cash_out_project_member_id uuid;
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
    select pm.id, pm.user_id
    into v_cash_in_project_member_id, v_cash_in_user_id
    from public.project_members pm
    where pm.id = p_cash_in_project_member_id
      and pm.project_id = p_project_id
      and pm.is_active = true;

    if not found then
      raise exception 'cash in project member must be an active project member';
    end if;
  end if;

  if p_cash_out_project_member_id is not null then
    select pm.id, pm.user_id
    into v_cash_out_project_member_id, v_cash_out_user_id
    from public.project_members pm
    where pm.id = p_cash_out_project_member_id
      and pm.project_id = p_project_id
      and pm.is_active = true;

    if not found then
      raise exception 'cash out project member must be an active project member';
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
    cash_in_project_member_id,
    cash_out_project_member_id,
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
    v_cash_in_project_member_id,
    v_cash_out_project_member_id,
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

    when 'operating_income', 'operating_expense', 'shared_loan_interest_payment' then
      v_member_count := coalesce(array_length(p_allocation_project_member_ids, 1), 0);

      if v_member_count = 0 then
        raise exception 'Operating income, operating expense, and shared loan interest require allocation members';
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
language sql
security invoker
set search_path = public
as $$
  select public.create_project_ledger_entry(
    p_project_id,
    p_entry_type,
    p_effective_at,
    p_description,
    p_amount,
    p_currency_code,
    p_cash_in_project_member_id,
    p_cash_out_project_member_id,
    p_capital_owner_project_member_id,
    p_allocation_project_member_ids,
    null,
    p_note,
    p_external_counterparty
  );
$$;

grant execute on function public.create_project_ledger_entry(
  uuid,
  public.ledger_entry_type,
  timestamptz,
  text,
  numeric,
  char,
  uuid,
  uuid,
  uuid,
  uuid[],
  text[],
  text,
  text
) to authenticated;

grant execute on function public.create_project_ledger_entry(
  uuid,
  public.ledger_entry_type,
  timestamptz,
  text,
  numeric,
  char,
  uuid,
  uuid,
  uuid,
  uuid[],
  text,
  text
) to authenticated;

commit;
