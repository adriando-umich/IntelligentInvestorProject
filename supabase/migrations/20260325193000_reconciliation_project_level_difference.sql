alter table public.reconciliation_runs
  add column if not exists closing_note text,
  add column if not exists closing_difference_accepted boolean not null default false,
  add column if not exists closing_difference_amount numeric(18,2),
  add column if not exists reported_total_project_cash_at_close numeric(18,2),
  add column if not exists expected_total_project_cash_at_close numeric(18,2);

drop function if exists public.close_reconciliation_run(uuid, text);
drop function if exists public.close_reconciliation_run(uuid, text, boolean, numeric, numeric, numeric);

create or replace function public.close_reconciliation_run(
  p_run_id uuid,
  p_note text default null,
  p_accept_remaining_difference boolean default false,
  p_remaining_difference_amount numeric default null,
  p_reported_total_project_cash numeric default null,
  p_expected_total_project_cash numeric default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_project_id uuid;
  v_difference numeric(18,2) := round(coalesce(p_remaining_difference_amount, 0), 2);
  v_note text := nullif(trim(coalesce(p_note, '')), '');
begin
  if v_user_id is null then
    raise exception 'You must be authenticated to close a reconciliation run';
  end if;

  select rr.project_id
  into v_project_id
  from public.reconciliation_runs rr
  where rr.id = p_run_id
    and rr.status = 'open';

  if v_project_id is null then
    raise exception 'Open reconciliation run not found';
  end if;

  if not public.is_project_manager(v_project_id, v_user_id) then
    raise exception 'Only owners and managers can close reconciliation runs';
  end if;

  if exists (
    select 1
    from public.reconciliation_checks rc
    where rc.run_id = p_run_id
      and rc.status in ('pending', 'variance_found')
  ) then
    raise exception 'Resolve all pending or unresolved variance checks before closing the run';
  end if;

  if abs(v_difference) > 0.01 and not coalesce(p_accept_remaining_difference, false) then
    raise exception 'Accept the remaining project-level difference before closing the run';
  end if;

  if abs(v_difference) > 0.01 and v_note is null then
    raise exception 'Add a closing explanation before accepting a remaining project-level difference';
  end if;

  update public.reconciliation_runs
  set status = 'closed',
      closed_by = v_user_id,
      closed_at = now(),
      closing_note = v_note,
      closing_difference_accepted = coalesce(p_accept_remaining_difference, false),
      closing_difference_amount = v_difference,
      reported_total_project_cash_at_close = case
        when p_reported_total_project_cash is null then null
        else round(p_reported_total_project_cash, 2)
      end,
      expected_total_project_cash_at_close = case
        when p_expected_total_project_cash is null then null
        else round(p_expected_total_project_cash, 2)
      end
  where id = p_run_id;

  return p_run_id;
end;
$$;

grant execute on function public.close_reconciliation_run(uuid, text, boolean, numeric, numeric, numeric) to authenticated;
