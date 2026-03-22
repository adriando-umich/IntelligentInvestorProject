begin;

alter table public.ledger_entries
  add column if not exists cash_in_project_member_id uuid references public.project_members (id) on delete restrict,
  add column if not exists cash_out_project_member_id uuid references public.project_members (id) on delete restrict;

update public.ledger_entries le
set cash_in_project_member_id = (
  select project_member.id
  from public.project_members project_member
  where project_member.project_id = le.project_id
    and project_member.user_id = le.cash_in_member_id
  order by project_member.is_active desc, project_member.joined_at desc
  limit 1
)
where le.cash_in_member_id is not null
  and le.cash_in_project_member_id is null;

update public.ledger_entries le
set cash_out_project_member_id = (
  select project_member.id
  from public.project_members project_member
  where project_member.project_id = le.project_id
    and project_member.user_id = le.cash_out_member_id
  order by project_member.is_active desc, project_member.joined_at desc
  limit 1
)
where le.cash_out_member_id is not null
  and le.cash_out_project_member_id is null;

create index if not exists ledger_entries_cash_in_project_member_idx
  on public.ledger_entries (cash_in_project_member_id);

create index if not exists ledger_entries_cash_out_project_member_idx
  on public.ledger_entries (cash_out_project_member_id);

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

create or replace function public.reconciliation_expected_cash_snapshot(
  p_project_id uuid,
  p_as_of timestamptz default now()
)
returns table (
  project_member_id uuid,
  expected_project_cash numeric
)
language sql
stable
security definer
set search_path = public
as $$
  with effective_entries as (
    select
      le.project_id,
      le.amount,
      le.cash_in_project_member_id,
      le.cash_out_project_member_id,
      case
        when le.entry_type = 'reversal' then -1
        else 1
      end as effect_factor
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
            when ee.cash_in_project_member_id = pm.id then ee.amount * ee.effect_factor
            else 0
          end
        ),
        0
      ) -
      coalesce(
        sum(
          case
            when ee.cash_out_project_member_id = pm.id then ee.amount * ee.effect_factor
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
  v_cash_in_project_member_id uuid;
  v_cash_out_project_member_id uuid;
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
