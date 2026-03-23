begin;

alter table public.profit_distribution_runs
  add column if not exists cash_out_project_member_id uuid references public.project_members (id) on delete restrict;

update public.profit_distribution_runs pdr
set cash_out_project_member_id = pm.id
from public.project_members pm
where pdr.cash_out_project_member_id is null
  and pm.project_id = pdr.project_id
  and pm.user_id = pdr.cash_out_member_id
  and pm.is_active = true;

alter table public.profit_distribution_runs
  alter column cash_out_member_id drop not null;

create index if not exists profit_distribution_runs_cash_out_project_member_idx
on public.profit_distribution_runs (cash_out_project_member_id);

create or replace function public.project_member_capital_balance_as_of(
  p_project_member_id uuid,
  p_as_of timestamptz
)
returns numeric
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    sum(
      case
        when le.entry_type = 'capital_contribution' then la.amount
        when le.entry_type = 'capital_return' then -la.amount
        else 0
      end
    ),
    0
  )::numeric(18,2)
  from public.project_members pm
  left join public.ledger_allocations la
    on la.project_member_id = pm.id
   and la.allocation_type = 'capital_owner'
  left join public.ledger_entries le
    on le.id = la.ledger_entry_id
   and le.project_id = pm.project_id
   and le.status = 'posted'
   and le.effective_at <= p_as_of
  where pm.id = p_project_member_id;
$$;

create or replace function public.create_profit_distribution_entry(
  p_project_id uuid,
  p_effective_at timestamptz,
  p_description text,
  p_amount numeric,
  p_currency_code char(3),
  p_cash_out_project_member_id uuid,
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
  v_run_id uuid;
  v_cash_out_user_id uuid;
  v_cash_out_project_member_id uuid;
  v_capital_rows jsonb := '[]'::jsonb;
  v_capital_row jsonb;
  v_capital_row_count integer := 0;
  v_capital_row_index integer := 0;
  v_total_capital numeric(18,2) := 0;
  v_capital_balance numeric(18,2);
  v_weight_percent numeric(8,5);
  v_distribution_amount numeric(18,2);
  v_distributed_weight numeric(8,5) := 0;
  v_distributed_amount numeric(18,2) := 0;
  v_tag_name text;
  v_tag_slug text;
  v_tag_id uuid;
begin
  if v_user_id is null then
    raise exception 'You must be authenticated to create a profit distribution';
  end if;

  if round(p_amount, 2) <= 0 then
    raise exception 'Profit distribution amount must be greater than zero';
  end if;

  if not public.can_create_ledger_entry(p_project_id, 'profit_distribution') then
    raise exception 'You do not have permission to post this profit distribution';
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

  select
    coalesce(
      jsonb_agg(
        jsonb_build_object(
          'project_member_id', capital_rows.project_member_id,
          'capital_balance', capital_rows.capital_balance
        )
        order by capital_rows.capital_balance desc, capital_rows.project_member_id
      ),
      '[]'::jsonb
    ),
    coalesce(sum(capital_rows.capital_balance), 0)::numeric(18,2)
  into v_capital_rows, v_total_capital
  from (
    select
      pm.id as project_member_id,
      greatest(public.project_member_capital_balance_as_of(pm.id, p_effective_at), 0)::numeric(18,2) as capital_balance
    from public.project_members pm
    where pm.project_id = p_project_id
      and pm.is_active = true
  ) capital_rows
  where capital_rows.capital_balance > 0;

  v_capital_row_count := jsonb_array_length(v_capital_rows);

  if v_capital_row_count = 0 or v_total_capital <= 0 then
    raise exception 'Profit distribution needs at least one member with positive capital as of the chosen date';
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
    'profit_distribution',
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

  for v_capital_row in
    select value
    from jsonb_array_elements(v_capital_rows)
  loop
    v_capital_row_index := v_capital_row_index + 1;
    v_capital_balance := round(
      coalesce((v_capital_row ->> 'capital_balance')::numeric, 0),
      2
    );

    if v_capital_row_index < v_capital_row_count then
      v_weight_percent := trunc(v_capital_balance / v_total_capital, 5);
      v_distribution_amount := trunc(
        round(p_amount, 2) * (v_capital_balance / v_total_capital),
        2
      );
      v_distributed_weight := round(v_distributed_weight + v_weight_percent, 5);
      v_distributed_amount := round(v_distributed_amount + v_distribution_amount, 2);
    else
      v_weight_percent := round(1::numeric - v_distributed_weight, 5);
      v_distribution_amount := round(round(p_amount, 2) - v_distributed_amount, 2);
    end if;

    insert into public.ledger_allocations (
      ledger_entry_id,
      project_member_id,
      allocation_type,
      amount,
      weight_percent
    )
    values (
      v_entry_id,
      (v_capital_row ->> 'project_member_id')::uuid,
      'profit_share',
      round(v_distribution_amount, 2),
      v_weight_percent
    );
  end loop;

  perform public.assert_ledger_entry_allocations(v_entry_id);

  insert into public.profit_distribution_runs (
    project_id,
    as_of,
    distribution_date,
    total_amount,
    cash_out_project_member_id,
    cash_out_member_id,
    ledger_entry_id,
    created_by
  )
  values (
    p_project_id,
    p_effective_at,
    p_effective_at,
    round(p_amount, 2),
    v_cash_out_project_member_id,
    v_cash_out_user_id,
    v_entry_id,
    v_user_id
  )
  returning id into v_run_id;

  insert into public.profit_distribution_lines (
    run_id,
    project_member_id,
    capital_balance_snapshot,
    weight_basis_amount,
    weight_percent,
    distribution_amount
  )
  select
    v_run_id,
    la.project_member_id,
    greatest(public.project_member_capital_balance_as_of(la.project_member_id, p_effective_at), 0)::numeric(18,2),
    greatest(public.project_member_capital_balance_as_of(la.project_member_id, p_effective_at), 0)::numeric(18,2),
    coalesce(la.weight_percent, 0),
    la.amount
  from public.ledger_allocations la
  where la.ledger_entry_id = v_entry_id
    and la.allocation_type = 'profit_share';

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

create or replace function public.update_profit_distribution_entry(
  p_ledger_entry_id uuid,
  p_project_id uuid,
  p_effective_at timestamptz,
  p_description text,
  p_amount numeric,
  p_currency_code char(3),
  p_cash_out_project_member_id uuid,
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
  v_run_id uuid;
  v_cash_out_user_id uuid;
  v_cash_out_project_member_id uuid;
  v_existing_lines jsonb := '[]'::jsonb;
  v_existing_line jsonb;
  v_existing_line_count integer := 0;
  v_existing_line_index integer := 0;
  v_existing_total numeric(18,2) := 0;
  v_scaled_amount numeric(18,2);
  v_scaled_total numeric(18,2) := 0;
  v_scaled_weight numeric(8,5);
  v_scaled_weight_total numeric(8,5) := 0;
  v_tag_name text;
  v_tag_slug text;
  v_tag_id uuid;
begin
  if v_user_id is null then
    raise exception 'You must be authenticated to update a profit distribution';
  end if;

  if round(p_amount, 2) <= 0 then
    raise exception 'Profit distribution amount must be greater than zero';
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

  if v_entry.entry_type <> 'profit_distribution' then
    raise exception 'This update flow only supports profit distribution entries';
  end if;

  if not public.can_create_ledger_entry(p_project_id, 'profit_distribution') then
    raise exception 'You do not have permission to edit this profit distribution';
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

  select pdr.id
  into v_run_id
  from public.profit_distribution_runs pdr
  where pdr.ledger_entry_id = p_ledger_entry_id
  for update;

  if v_run_id is not null then
    select
      coalesce(
        jsonb_agg(
          jsonb_build_object(
            'project_member_id', pdl.project_member_id,
            'capital_balance_snapshot', pdl.capital_balance_snapshot,
            'weight_basis_amount', pdl.weight_basis_amount,
            'weight_percent', pdl.weight_percent,
            'distribution_amount', pdl.distribution_amount
          )
          order by pdl.id
        ),
        '[]'::jsonb
      ),
      coalesce(sum(pdl.distribution_amount), 0)::numeric(18,2)
    into v_existing_lines, v_existing_total
    from public.profit_distribution_lines pdl
    where pdl.run_id = v_run_id;
  else
    select
      coalesce(
        jsonb_agg(
          jsonb_build_object(
            'project_member_id', la.project_member_id,
            'capital_balance_snapshot', greatest(public.project_member_capital_balance_as_of(la.project_member_id, p_effective_at), 0)::numeric(18,2),
            'weight_basis_amount', greatest(public.project_member_capital_balance_as_of(la.project_member_id, p_effective_at), 0)::numeric(18,2),
            'weight_percent', coalesce(la.weight_percent, 0),
            'distribution_amount', la.amount
          )
          order by la.id
        ),
        '[]'::jsonb
      ),
      coalesce(sum(la.amount), 0)::numeric(18,2)
    into v_existing_lines, v_existing_total
    from public.ledger_allocations la
    where la.ledger_entry_id = p_ledger_entry_id
      and la.allocation_type = 'profit_share';
  end if;

  v_existing_line_count := jsonb_array_length(v_existing_lines);

  if v_existing_line_count = 0 or v_existing_total <= 0 then
    raise exception 'Existing profit distribution recipients are missing';
  end if;

  update public.ledger_entries
  set effective_at = p_effective_at,
      description = p_description,
      amount = round(p_amount, 2),
      currency_code = p_currency_code,
      cash_in_project_member_id = null,
      cash_in_member_id = null,
      cash_out_project_member_id = v_cash_out_project_member_id,
      cash_out_member_id = v_cash_out_user_id,
      external_counterparty = p_external_counterparty,
      note = p_note
  where id = p_ledger_entry_id;

  delete from public.ledger_allocations
  where ledger_entry_id = p_ledger_entry_id;

  for v_existing_line in
    select value
    from jsonb_array_elements(v_existing_lines)
  loop
    v_existing_line_index := v_existing_line_index + 1;

    if v_existing_line_index < v_existing_line_count then
      v_scaled_weight := round(
        coalesce((v_existing_line ->> 'weight_percent')::numeric, 0),
        5
      );
      v_scaled_amount := trunc(
        round(p_amount, 2) *
        (
          coalesce((v_existing_line ->> 'distribution_amount')::numeric, 0) /
          v_existing_total
        ),
        2
      );
      v_scaled_weight_total := round(v_scaled_weight_total + v_scaled_weight, 5);
      v_scaled_total := round(v_scaled_total + v_scaled_amount, 2);
    else
      v_scaled_weight := round(1::numeric - v_scaled_weight_total, 5);
      v_scaled_amount := round(round(p_amount, 2) - v_scaled_total, 2);
    end if;

    insert into public.ledger_allocations (
      ledger_entry_id,
      project_member_id,
      allocation_type,
      amount,
      weight_percent
    )
    values (
      p_ledger_entry_id,
      (v_existing_line ->> 'project_member_id')::uuid,
      'profit_share',
      round(v_scaled_amount, 2),
      v_scaled_weight
    );
  end loop;

  perform public.assert_ledger_entry_allocations(p_ledger_entry_id);

  if v_run_id is null then
    insert into public.profit_distribution_runs (
      project_id,
      as_of,
      distribution_date,
      total_amount,
      cash_out_project_member_id,
      cash_out_member_id,
      ledger_entry_id,
      created_by
    )
    values (
      p_project_id,
      p_effective_at,
      p_effective_at,
      round(p_amount, 2),
      v_cash_out_project_member_id,
      v_cash_out_user_id,
      p_ledger_entry_id,
      v_user_id
    )
    returning id into v_run_id;
  else
    update public.profit_distribution_runs
    set as_of = p_effective_at,
        distribution_date = p_effective_at,
        total_amount = round(p_amount, 2),
        cash_out_project_member_id = v_cash_out_project_member_id,
        cash_out_member_id = v_cash_out_user_id
    where id = v_run_id;

    delete from public.profit_distribution_lines
    where run_id = v_run_id;
  end if;

  v_existing_line_index := 0;
  v_scaled_total := 0;
  v_scaled_weight_total := 0;

  for v_existing_line in
    select value
    from jsonb_array_elements(v_existing_lines)
  loop
    v_existing_line_index := v_existing_line_index + 1;

    if v_existing_line_index < v_existing_line_count then
      v_scaled_weight := round(
        coalesce((v_existing_line ->> 'weight_percent')::numeric, 0),
        5
      );
      v_scaled_amount := trunc(
        round(p_amount, 2) *
        (
          coalesce((v_existing_line ->> 'distribution_amount')::numeric, 0) /
          v_existing_total
        ),
        2
      );
      v_scaled_weight_total := round(v_scaled_weight_total + v_scaled_weight, 5);
      v_scaled_total := round(v_scaled_total + v_scaled_amount, 2);
    else
      v_scaled_weight := round(1::numeric - v_scaled_weight_total, 5);
      v_scaled_amount := round(round(p_amount, 2) - v_scaled_total, 2);
    end if;

    insert into public.profit_distribution_lines (
      run_id,
      project_member_id,
      capital_balance_snapshot,
      weight_basis_amount,
      weight_percent,
      distribution_amount
    )
    values (
      v_run_id,
      (v_existing_line ->> 'project_member_id')::uuid,
      round(coalesce((v_existing_line ->> 'capital_balance_snapshot')::numeric, 0), 2),
      round(coalesce((v_existing_line ->> 'weight_basis_amount')::numeric, 0), 2),
      v_scaled_weight,
      round(v_scaled_amount, 2)
    );
  end loop;

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

  return p_ledger_entry_id;
end;
$$;

grant execute on function public.project_member_capital_balance_as_of(
  uuid,
  timestamptz
) to authenticated;

grant execute on function public.create_profit_distribution_entry(
  uuid,
  timestamptz,
  text,
  numeric,
  char,
  uuid,
  text[],
  text,
  text
) to authenticated;

grant execute on function public.update_profit_distribution_entry(
  uuid,
  uuid,
  timestamptz,
  text,
  numeric,
  char,
  uuid,
  text[],
  text,
  text
) to authenticated;

commit;
