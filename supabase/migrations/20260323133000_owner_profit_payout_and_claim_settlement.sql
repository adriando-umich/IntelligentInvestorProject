alter type public.ledger_entry_type add value if not exists 'owner_profit_payout';

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
    when 'operating_expense', 'shared_loan_interest_payment' then
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

create or replace function public.create_owner_profit_payout_entry(
  p_project_id uuid,
  p_effective_at timestamptz,
  p_description text,
  p_amount numeric,
  p_currency_code char(3),
  p_cash_out_project_member_id uuid,
  p_profit_recipient_project_member_id uuid,
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
  v_entry_id uuid;
  v_cash_out_user_id uuid;
  v_cash_out_project_member_id uuid;
  v_profit_recipient_project_member_id uuid;
  v_tag_name text;
  v_tag_slug text;
  v_tag_id uuid;
begin
  if v_user_id is null then
    raise exception 'You must be authenticated to create an owner profit payout';
  end if;

  if round(p_amount, 2) <= 0 then
    raise exception 'Owner profit payout amount must be greater than zero';
  end if;

  if not public.can_create_ledger_entry(p_project_id, 'owner_profit_payout') then
    raise exception 'You do not have permission to post this owner profit payout';
  end if;

  select pm.id, pm.user_id
  into v_cash_out_project_member_id, v_cash_out_user_id
  from public.project_members pm
  where pm.id = p_cash_out_project_member_id
    and pm.project_id = p_project_id
    and pm.is_active = true;

  if not found then
    raise exception 'cash out project member must be an active project member';
  end if;

  select pm.id
  into v_profit_recipient_project_member_id
  from public.project_members pm
  where pm.id = p_profit_recipient_project_member_id
    and pm.project_id = p_project_id
    and pm.is_active = true;

  if not found then
    raise exception 'profit recipient project member must be an active project member';
  end if;

  insert into public.ledger_entries (
    project_id,
    entry_type,
    effective_at,
    description,
    amount,
    currency_code,
    cash_out_project_member_id,
    cash_out_member_id,
    external_counterparty,
    note,
    created_by
  )
  values (
    p_project_id,
    'owner_profit_payout',
    p_effective_at,
    p_description,
    round(p_amount, 2),
    p_currency_code,
    v_cash_out_project_member_id,
    v_cash_out_user_id,
    p_external_counterparty,
    p_note,
    v_user_id
  )
  returning id into v_entry_id;

  insert into public.ledger_allocations (
    ledger_entry_id,
    project_member_id,
    allocation_type,
    amount,
    weight_percent
  )
  values (
    v_entry_id,
    v_profit_recipient_project_member_id,
    'profit_share',
    round(p_amount, 2),
    1
  );

  if p_tag_names is not null then
    foreach v_tag_name in array p_tag_names
    loop
      v_tag_name := nullif(trim(v_tag_name), '');

      if v_tag_name is null then
        continue;
      end if;

      v_tag_slug := public.slugify(v_tag_name);

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

create or replace function public.update_owner_profit_payout_entry(
  p_ledger_entry_id uuid,
  p_project_id uuid,
  p_effective_at timestamptz,
  p_description text,
  p_amount numeric,
  p_currency_code char(3),
  p_cash_out_project_member_id uuid,
  p_profit_recipient_project_member_id uuid,
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
  v_cash_out_user_id uuid;
  v_cash_out_project_member_id uuid;
  v_profit_recipient_project_member_id uuid;
  v_tag_name text;
  v_tag_slug text;
  v_tag_id uuid;
begin
  if v_user_id is null then
    raise exception 'You must be authenticated to update an owner profit payout';
  end if;

  if round(p_amount, 2) <= 0 then
    raise exception 'Owner profit payout amount must be greater than zero';
  end if;

  select *
  into v_entry
  from public.ledger_entries
  where id = p_ledger_entry_id
  for update;

  if not found then
    raise exception 'Ledger entry not found';
  end if;

  if v_entry.project_id <> p_project_id then
    raise exception 'Ledger entry does not belong to the selected project';
  end if;

  if v_entry.status <> 'posted' then
    raise exception 'Only posted transactions can be edited';
  end if;

  if v_entry.entry_type <> 'owner_profit_payout' then
    raise exception 'This update flow only supports owner profit payout entries';
  end if;

  if not public.can_create_ledger_entry(p_project_id, 'owner_profit_payout') then
    raise exception 'You do not have permission to edit this owner profit payout';
  end if;

  select pm.id, pm.user_id
  into v_cash_out_project_member_id, v_cash_out_user_id
  from public.project_members pm
  where pm.id = p_cash_out_project_member_id
    and pm.project_id = p_project_id
    and pm.is_active = true;

  if not found then
    raise exception 'cash out project member must be an active project member';
  end if;

  select pm.id
  into v_profit_recipient_project_member_id
  from public.project_members pm
  where pm.id = p_profit_recipient_project_member_id
    and pm.project_id = p_project_id
    and pm.is_active = true;

  if not found then
    raise exception 'profit recipient project member must be an active project member';
  end if;

  update public.ledger_entries
  set effective_at = p_effective_at,
      description = p_description,
      amount = round(p_amount, 2),
      currency_code = p_currency_code,
      cash_out_project_member_id = v_cash_out_project_member_id,
      cash_out_member_id = v_cash_out_user_id,
      external_counterparty = p_external_counterparty,
      note = p_note,
      updated_at = now()
  where id = p_ledger_entry_id;

  delete from public.ledger_allocations
  where ledger_entry_id = p_ledger_entry_id;

  insert into public.ledger_allocations (
    ledger_entry_id,
    project_member_id,
    allocation_type,
    amount,
    weight_percent
  )
  values (
    p_ledger_entry_id,
    v_profit_recipient_project_member_id,
    'profit_share',
    round(p_amount, 2),
    1
  );

  delete from public.ledger_entry_tags
  where ledger_entry_id = p_ledger_entry_id;

  if p_tag_names is not null then
    foreach v_tag_name in array p_tag_names
    loop
      v_tag_name := nullif(trim(v_tag_name), '');

      if v_tag_name is null then
        continue;
      end if;

      v_tag_slug := public.slugify(v_tag_name);

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

  return p_ledger_entry_id;
end;
$$;

create or replace function public.create_project_claim_settlement(
  p_project_id uuid,
  p_effective_at timestamptz,
  p_description text,
  p_currency_code char(3),
  p_cash_out_project_member_id uuid,
  p_capital_owner_project_member_id uuid,
  p_capital_return_amount numeric default 0,
  p_profit_payout_amount numeric default 0,
  p_tag_names text[] default null,
  p_note text default null,
  p_external_counterparty text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_capital_entry_id uuid;
  v_profit_entry_id uuid;
  v_capital_amount numeric(18,2) := round(coalesce(p_capital_return_amount, 0), 2);
  v_profit_amount numeric(18,2) := round(coalesce(p_profit_payout_amount, 0), 2);
begin
  if v_user_id is null then
    raise exception 'You must be authenticated to create a claim settlement';
  end if;

  if v_capital_amount <= 0 and v_profit_amount <= 0 then
    raise exception 'Claim settlement needs at least one positive payout amount';
  end if;

  if v_capital_amount > 0 then
    select public.create_project_ledger_entry(
      p_project_id := p_project_id,
      p_entry_type := 'capital_return',
      p_effective_at := p_effective_at,
      p_description := p_description,
      p_amount := v_capital_amount,
      p_currency_code := p_currency_code,
      p_cash_in_project_member_id := null,
      p_cash_out_project_member_id := p_cash_out_project_member_id,
      p_capital_owner_project_member_id := p_capital_owner_project_member_id,
      p_allocation_project_member_ids := null,
      p_allocation_amounts := null,
      p_allocation_weight_percents := null,
      p_tag_names := p_tag_names,
      p_note := p_note,
      p_external_counterparty := p_external_counterparty
    )
    into v_capital_entry_id;
  end if;

  if v_profit_amount > 0 then
    select public.create_owner_profit_payout_entry(
      p_project_id := p_project_id,
      p_effective_at := p_effective_at,
      p_description := p_description,
      p_amount := v_profit_amount,
      p_currency_code := p_currency_code,
      p_cash_out_project_member_id := p_cash_out_project_member_id,
      p_profit_recipient_project_member_id := p_capital_owner_project_member_id,
      p_tag_names := p_tag_names,
      p_note := p_note,
      p_external_counterparty := p_external_counterparty
    )
    into v_profit_entry_id;
  end if;

  return jsonb_build_object(
    'capital_return_entry_id', v_capital_entry_id,
    'owner_profit_payout_entry_id', v_profit_entry_id
  );
end;
$$;

grant execute on function public.create_project_claim_settlement(
  uuid,
  timestamptz,
  text,
  char,
  uuid,
  uuid,
  numeric,
  numeric,
  text[],
  text,
  text
) to authenticated;

grant execute on function public.create_owner_profit_payout_entry(
  uuid,
  timestamptz,
  text,
  numeric,
  char,
  uuid,
  uuid,
  text[],
  text,
  text
) to authenticated;

grant execute on function public.update_owner_profit_payout_entry(
  uuid,
  uuid,
  timestamptz,
  text,
  numeric,
  char,
  uuid,
  uuid,
  text[],
  text,
  text
) to authenticated;
