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
      'land_purchase',
      'shared_loan_interest_payment',
      'cash_handover',
      'expense_settlement_payment'
    ) then public.is_project_member(p_project_id)
    else public.is_project_manager(p_project_id)
  end;
$$;

create or replace function public.validate_ledger_entry_shape()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cash_in_user_id uuid;
  v_cash_out_user_id uuid;
begin
  if new.amount <= 0 then
    raise exception 'Ledger entry amount must be greater than zero';
  end if;

  if not public.is_project_member(new.project_id, new.created_by) then
    raise exception 'Entry creator must be an active member of the project';
  end if;

  if new.cash_in_project_member_id is null and new.cash_in_member_id is not null then
    select pm.id, pm.user_id
    into new.cash_in_project_member_id, v_cash_in_user_id
    from public.project_members pm
    where pm.project_id = new.project_id
      and pm.user_id = new.cash_in_member_id
      and pm.is_active = true
    order by pm.joined_at desc
    limit 1;
  elsif new.cash_in_project_member_id is not null then
    select pm.user_id
    into v_cash_in_user_id
    from public.project_members pm
    where pm.id = new.cash_in_project_member_id
      and pm.project_id = new.project_id
      and pm.is_active = true;

    if not found then
      raise exception 'cash_in_project_member_id must belong to the project';
    end if;
  end if;

  if new.cash_out_project_member_id is null and new.cash_out_member_id is not null then
    select pm.id, pm.user_id
    into new.cash_out_project_member_id, v_cash_out_user_id
    from public.project_members pm
    where pm.project_id = new.project_id
      and pm.user_id = new.cash_out_member_id
      and pm.is_active = true
    order by pm.joined_at desc
    limit 1;
  elsif new.cash_out_project_member_id is not null then
    select pm.user_id
    into v_cash_out_user_id
    from public.project_members pm
    where pm.id = new.cash_out_project_member_id
      and pm.project_id = new.project_id
      and pm.is_active = true;

    if not found then
      raise exception 'cash_out_project_member_id must belong to the project';
    end if;
  end if;

  if new.cash_in_project_member_id is not null then
    new.cash_in_member_id := v_cash_in_user_id;
  end if;

  if new.cash_out_project_member_id is not null then
    new.cash_out_member_id := v_cash_out_user_id;
  end if;

  if new.reversal_of_entry_id is not null then
    if new.entry_type <> 'reversal' then
      raise exception 'reversal_of_entry_id is only valid for reversal entries';
    end if;

    if new.cash_in_project_member_id is not null
       or new.cash_out_project_member_id is not null
       or new.cash_in_member_id is not null
       or new.cash_out_member_id is not null then
      raise exception 'reversal entries do not store direct cash leg references';
    end if;
  elsif new.entry_type = 'reversal' then
    raise exception 'reversal entries require reversal_of_entry_id';
  end if;

  case new.entry_type
    when 'capital_contribution' then
      if new.cash_in_project_member_id is null or new.cash_out_project_member_id is not null then
        raise exception 'capital_contribution requires cash_in_project_member_id only';
      end if;
    when 'capital_return' then
      if new.cash_out_project_member_id is null or new.cash_in_project_member_id is not null then
        raise exception 'capital_return requires cash_out_project_member_id only';
      end if;
    when 'owner_profit_payout' then
      if new.cash_out_project_member_id is null or new.cash_in_project_member_id is not null then
        raise exception 'owner_profit_payout requires cash_out_project_member_id only';
      end if;
    when 'operating_income' then
      if new.cash_in_project_member_id is null or new.cash_out_project_member_id is not null then
        raise exception 'operating_income requires cash_in_project_member_id only';
      end if;
    when 'shared_loan_drawdown' then
      if new.cash_in_project_member_id is null or new.cash_out_project_member_id is not null then
        raise exception 'shared_loan_drawdown requires cash_in_project_member_id only';
      end if;
    when 'shared_loan_repayment_principal' then
      if new.cash_out_project_member_id is null or new.cash_in_project_member_id is not null then
        raise exception 'shared_loan_repayment_principal requires cash_out_project_member_id only';
      end if;
    when 'land_purchase' then
      if new.cash_out_project_member_id is null or new.cash_in_project_member_id is not null then
        raise exception 'land_purchase requires cash_out_project_member_id only';
      end if;
    when 'shared_loan_interest_payment' then
      if new.cash_out_project_member_id is null or new.cash_in_project_member_id is not null then
        raise exception 'shared_loan_interest_payment requires cash_out_project_member_id only';
      end if;
    when 'operating_expense' then
      if new.cash_out_project_member_id is null or new.cash_in_project_member_id is not null then
        raise exception 'operating_expense requires cash_out_project_member_id only';
      end if;
    when 'cash_handover' then
      if new.cash_in_project_member_id is null or new.cash_out_project_member_id is null then
        raise exception 'cash_handover requires both cash legs';
      end if;
    when 'expense_settlement_payment' then
      if new.cash_in_project_member_id is null or new.cash_out_project_member_id is null then
        raise exception 'expense_settlement_payment requires both cash legs';
      end if;
    when 'profit_distribution' then
      if new.cash_out_project_member_id is null or new.cash_in_project_member_id is not null then
        raise exception 'profit_distribution requires cash_out_project_member_id only';
      end if;
    when 'reconciliation_adjustment' then
      if new.cash_in_project_member_id is null and new.cash_out_project_member_id is null then
        raise exception 'reconciliation_adjustment requires a cash leg';
      end if;
      if new.cash_in_project_member_id is not null and new.cash_out_project_member_id is not null then
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
    when 'land_purchase', 'operating_expense', 'shared_loan_interest_payment' then
      required_type := 'expense_share';
    when 'profit_distribution', 'owner_profit_payout' then
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
            'land_purchase',
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
            'owner_profit_payout',
            'profit_distribution',
            'reconciliation_adjustment',
            'reversal'
          )
          and public.is_project_manager(le.project_id)
        )
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
  p_allocation_amounts numeric[] default null,
  p_allocation_weight_percents numeric[] default null,
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
  v_member_count integer;
  v_share_amount numeric(18,2);
  v_remainder_amount numeric(18,2);
  v_index integer;
  v_valid_count integer;
  v_allocation_amount numeric(18,2);
  v_allocation_weight_percent numeric(8,5);
  v_allocation_amount_total numeric(18,2) := 0;
  v_allocation_weight_total numeric(8,5) := 0;
  v_has_custom_allocations boolean := p_allocation_amounts is not null or p_allocation_weight_percents is not null;
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

  if v_has_custom_allocations
    and p_entry_type not in ('land_purchase', 'operating_expense', 'shared_loan_interest_payment') then
    raise exception 'Custom allocation splits are only supported for land purchase, operating expense, and shared loan interest entries';
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
    round(p_amount, 2),
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

    when 'land_purchase', 'operating_expense', 'shared_loan_interest_payment' then
      v_member_count := coalesce(array_length(p_allocation_project_member_ids, 1), 0);

      if v_member_count = 0 then
        raise exception 'Land purchase, operating expense, and shared loan interest require allocation members';
      end if;

      if v_has_custom_allocations then
        if p_allocation_amounts is null or p_allocation_weight_percents is null then
          raise exception 'Allocation amounts and weight percents must be provided together';
        end if;

        if coalesce(array_length(p_allocation_amounts, 1), 0) <> v_member_count
          or coalesce(array_length(p_allocation_weight_percents, 1), 0) <> v_member_count then
          raise exception 'Allocation arrays must match the selected member count';
        end if;

        for v_index in 1..v_member_count loop
          v_allocation_amount := round(coalesce(p_allocation_amounts[v_index], 0), 2);
          v_allocation_weight_percent := round(coalesce(p_allocation_weight_percents[v_index], 0), 5);

          if v_allocation_amount <= 0 then
            raise exception 'Allocation amounts must be greater than zero';
          end if;

          if v_allocation_weight_percent <= 0 or v_allocation_weight_percent > 1 then
            raise exception 'Allocation weight percents must be between 0 and 1';
          end if;

          v_allocation_amount_total := round(v_allocation_amount_total + v_allocation_amount, 2);
          v_allocation_weight_total := round(v_allocation_weight_total + v_allocation_weight_percent, 5);

          insert into public.ledger_allocations (
            ledger_entry_id,
            project_member_id,
            allocation_type,
            amount,
            weight_percent
          )
          values (
            v_entry_id,
            p_allocation_project_member_ids[v_index],
            'expense_share',
            v_allocation_amount,
            v_allocation_weight_percent
          );
        end loop;

        if v_allocation_amount_total <> round(p_amount, 2) then
          raise exception 'Allocation amounts for entry % must sum to %', v_entry_id, p_amount;
        end if;

        if abs(v_allocation_weight_total - 1::numeric) > 0.00001 then
          raise exception 'Allocation weight percents for entry % must sum to 1', v_entry_id;
        end if;
      else
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
            'expense_share',
            case
              when v_index = 1 then round(v_share_amount + v_remainder_amount, 2)
              else v_share_amount
            end
          );
        end loop;
      end if;

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

  perform public.assert_ledger_entry_allocations(v_entry_id);

  return v_entry_id;
end;
$$;

create or replace function public.update_project_ledger_entry(
  p_ledger_entry_id uuid,
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
  p_allocation_amounts numeric[] default null,
  p_allocation_weight_percents numeric[] default null,
  p_tag_names text[] default null,
  p_note text default null,
  p_external_counterparty text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_entry public.ledger_entries%rowtype;
  v_cash_in_user_id uuid;
  v_cash_out_user_id uuid;
  v_cash_in_member_id uuid;
  v_cash_out_member_id uuid;
  v_member_count integer;
  v_share_amount numeric(18,2);
  v_remainder_amount numeric(18,2);
  v_index integer;
  v_valid_count integer;
  v_allocation_amount numeric(18,2);
  v_allocation_weight_percent numeric(8,5);
  v_allocation_amount_total numeric(18,2) := 0;
  v_allocation_weight_total numeric(8,5) := 0;
  v_has_custom_allocations boolean := p_allocation_amounts is not null or p_allocation_weight_percents is not null;
  v_existing_profit_allocations jsonb;
  v_existing_profit_total numeric(18,2);
  v_existing_profit_count integer;
  v_existing_profit_index integer := 0;
  v_existing_profit_allocation jsonb;
  v_scaled_profit_amount numeric(18,2);
  v_scaled_profit_total numeric(18,2) := 0;
  v_tag_name text;
  v_tag_slug text;
  v_tag_id uuid;
begin
  if v_user_id is null then
    raise exception 'You must be authenticated to update a ledger entry';
  end if;

  if p_entry_type = 'profit_distribution' then
    raise exception 'Use a dedicated profit distribution flow for this entry type';
  end if;

  if v_has_custom_allocations
    and p_entry_type not in ('land_purchase', 'operating_expense', 'shared_loan_interest_payment') then
    raise exception 'Custom allocation splits are only supported for land purchase, operating expense, and shared loan interest entries';
  end if;

  select *
  into v_entry
  from public.ledger_entries
  where id = p_ledger_entry_id
    and project_id = p_project_id;

  if not found then
    raise exception 'Ledger entry not found';
  end if;

  if p_cash_in_project_member_id is not null then
    select pm.id, pm.user_id
    into v_cash_in_member_id, v_cash_in_user_id
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
    into v_cash_out_member_id, v_cash_out_user_id
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

  if v_entry.entry_type = 'profit_distribution' then
    select
      coalesce(
        jsonb_agg(
          jsonb_build_object(
            'project_member_id', la.project_member_id,
            'amount', la.amount
          )
          order by la.id
        ),
        '[]'::jsonb
      ),
      coalesce(sum(la.amount), 0)::numeric(18,2)
    into v_existing_profit_allocations, v_existing_profit_total
    from public.ledger_allocations la
    where la.ledger_entry_id = p_ledger_entry_id
      and la.allocation_type = 'profit_share';

    v_existing_profit_count := jsonb_array_length(v_existing_profit_allocations);

    if v_existing_profit_count = 0 or v_existing_profit_total <= 0 then
      raise exception 'Existing profit distribution allocations are missing';
    end if;
  end if;

  update public.ledger_entries
  set entry_type = p_entry_type,
      effective_at = p_effective_at,
      description = p_description,
      amount = p_amount,
      currency_code = p_currency_code,
      cash_in_project_member_id = v_cash_in_member_id,
      cash_out_project_member_id = v_cash_out_member_id,
      cash_in_member_id = v_cash_in_user_id,
      cash_out_member_id = v_cash_out_user_id,
      external_counterparty = p_external_counterparty,
      note = p_note
  where id = p_ledger_entry_id;

  delete from public.ledger_allocations
  where ledger_entry_id = p_ledger_entry_id;

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
        p_ledger_entry_id,
        p_capital_owner_project_member_id,
        'capital_owner',
        round(p_amount, 2)
      );

    when 'land_purchase', 'operating_expense', 'shared_loan_interest_payment' then
      v_member_count := coalesce(array_length(p_allocation_project_member_ids, 1), 0);

      if v_member_count = 0 then
        raise exception 'Land purchase, operating expense, and shared loan interest require allocation members';
      end if;

      if v_has_custom_allocations then
        if p_allocation_amounts is null or p_allocation_weight_percents is null then
          raise exception 'Allocation amounts and weight percents must be provided together';
        end if;

        if coalesce(array_length(p_allocation_amounts, 1), 0) <> v_member_count
          or coalesce(array_length(p_allocation_weight_percents, 1), 0) <> v_member_count then
          raise exception 'Allocation arrays must match the selected member count';
        end if;

        for v_index in 1..v_member_count loop
          v_allocation_amount := round(coalesce(p_allocation_amounts[v_index], 0), 2);
          v_allocation_weight_percent := round(coalesce(p_allocation_weight_percents[v_index], 0), 5);

          if v_allocation_amount <= 0 then
            raise exception 'Allocation amounts must be greater than zero';
          end if;

          if v_allocation_weight_percent <= 0 or v_allocation_weight_percent > 1 then
            raise exception 'Allocation weight percents must be between 0 and 1';
          end if;

          v_allocation_amount_total := round(v_allocation_amount_total + v_allocation_amount, 2);
          v_allocation_weight_total := round(v_allocation_weight_total + v_allocation_weight_percent, 5);

          insert into public.ledger_allocations (
            ledger_entry_id,
            project_member_id,
            allocation_type,
            amount,
            weight_percent
          )
          values (
            p_ledger_entry_id,
            p_allocation_project_member_ids[v_index],
            'expense_share',
            v_allocation_amount,
            v_allocation_weight_percent
          );
        end loop;

        if v_allocation_amount_total <> round(p_amount, 2) then
          raise exception 'Allocation amounts for entry % must sum to %', p_ledger_entry_id, p_amount;
        end if;

        if abs(v_allocation_weight_total - 1::numeric) > 0.00001 then
          raise exception 'Allocation weight percents for entry % must sum to 1', p_ledger_entry_id;
        end if;
      else
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
            p_ledger_entry_id,
            p_allocation_project_member_ids[v_index],
            'expense_share',
            case
              when v_index = 1 then round(v_share_amount + v_remainder_amount, 2)
              else v_share_amount
            end
          );
        end loop;
      end if;

    when 'profit_distribution' then
      for v_existing_profit_allocation in
        select value
        from jsonb_array_elements(v_existing_profit_allocations)
      loop
        v_existing_profit_index := v_existing_profit_index + 1;

        if v_existing_profit_index < v_existing_profit_count then
          v_scaled_profit_amount := trunc(
            (
              ((v_existing_profit_allocation ->> 'amount')::numeric / v_existing_profit_total) * p_amount
            ) * 100
          ) / 100;
          v_scaled_profit_total := v_scaled_profit_total + v_scaled_profit_amount;
        else
          v_scaled_profit_amount := round(p_amount - v_scaled_profit_total, 2);
        end if;

        insert into public.ledger_allocations (
          ledger_entry_id,
          project_member_id,
          allocation_type,
          amount
        )
        values (
          p_ledger_entry_id,
          (v_existing_profit_allocation ->> 'project_member_id')::uuid,
          'profit_share',
          round(v_scaled_profit_amount, 2)
        );
      end loop;

    else
      null;
  end case;

  delete from public.ledger_entry_tags
  where ledger_entry_id = p_ledger_entry_id;

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
        p_ledger_entry_id,
        v_tag_id
      )
      on conflict do nothing;
    end loop;
  end if;

  perform public.assert_ledger_entry_allocations(p_ledger_entry_id);

  return p_ledger_entry_id;
end;
$$;

commit;
