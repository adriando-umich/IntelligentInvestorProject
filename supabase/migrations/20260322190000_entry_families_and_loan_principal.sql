do $$
begin
  alter type public.ledger_entry_type add value if not exists 'shared_loan_repayment_principal';
exception
  when duplicate_object then null;
end $$;

create or replace function public.entry_family_for_type(
  p_entry_type public.ledger_entry_type
)
returns text
language sql
immutable
set search_path = public
as $$
  select case
    when p_entry_type in ('reconciliation_adjustment', 'reversal') then 'correction'
    else 'business'
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
    when 'shared_loan_drawdown' then
      if new.cash_in_member_id is null or new.cash_out_member_id is not null then
        raise exception 'shared_loan_drawdown requires cash_in_member_id only';
      end if;
    when 'shared_loan_repayment_principal' then
      if new.cash_out_member_id is null or new.cash_in_member_id is not null then
        raise exception 'shared_loan_repayment_principal requires cash_out_member_id only';
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
