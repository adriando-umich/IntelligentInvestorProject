begin;

create type public.project_member_activity_event as enum (
  'ownership_transferred',
  'member_removed'
);

create table public.project_member_activity (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  actor_project_member_id uuid not null references public.project_members(id),
  target_project_member_id uuid not null references public.project_members(id),
  event_type public.project_member_activity_event not null,
  metadata jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now()
);

create index project_member_activity_project_id_occurred_at_idx
  on public.project_member_activity (project_id, occurred_at desc);

alter table public.project_member_activity enable row level security;

create policy "Project members can read governance activity"
on public.project_member_activity
for select
to authenticated
using (
  exists (
    select 1
    from public.project_members pm
    where pm.project_id = project_member_activity.project_id
      and pm.user_id = auth.uid()
      and pm.is_active = true
  )
);

create or replace function public.transfer_project_ownership(
  p_project_id uuid,
  p_next_owner_project_member_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_current_owner_member_id uuid;
  v_next_owner_member public.project_members;
  v_now timestamptz := now();
begin
  if v_user_id is null then
    raise exception 'You must be authenticated to transfer project ownership';
  end if;

  select pm.id
  into v_current_owner_member_id
  from public.project_members pm
  where pm.project_id = p_project_id
    and pm.user_id = v_user_id
    and pm.is_active = true
    and pm.role = 'owner'
  for update;

  if v_current_owner_member_id is null then
    raise exception 'Only the current project owner can transfer ownership';
  end if;

  select *
  into v_next_owner_member
  from public.project_members pm
  where pm.id = p_next_owner_project_member_id
    and pm.project_id = p_project_id
  for update;

  if not found
    or not v_next_owner_member.is_active
    or coalesce(v_next_owner_member.membership_status, 'active') <> 'active'
    or v_next_owner_member.user_id is null
    or v_next_owner_member.id = v_current_owner_member_id then
    raise exception 'New owner must be a different active project member';
  end if;

  update public.project_members
  set role = 'manager'
  where project_id = p_project_id
    and is_active = true
    and role = 'owner';

  update public.project_members
  set role = 'owner'
  where id = p_next_owner_project_member_id;

  update public.projects
  set created_by = v_next_owner_member.user_id,
      updated_at = v_now
  where id = p_project_id;

  insert into public.project_member_activity (
    project_id,
    actor_project_member_id,
    target_project_member_id,
    event_type,
    metadata,
    occurred_at
  )
  values (
    p_project_id,
    v_current_owner_member_id,
    p_next_owner_project_member_id,
    'ownership_transferred',
    jsonb_build_object(
      'previous_owner_project_member_id', v_current_owner_member_id,
      'previous_owner_next_role', 'manager',
      'next_owner_previous_role', v_next_owner_member.role
    ),
    v_now
  );

  return p_next_owner_project_member_id;
end;
$$;

grant execute on function public.transfer_project_ownership(uuid, uuid) to authenticated;

create or replace function public.remove_project_member(
  p_project_id uuid,
  p_project_member_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_actor_member public.project_members;
  v_target_member public.project_members;
  v_now timestamptz := now();
begin
  if v_user_id is null then
    raise exception 'You must be authenticated to remove a project member';
  end if;

  select *
  into v_actor_member
  from public.project_members pm
  where pm.project_id = p_project_id
    and pm.user_id = v_user_id
    and pm.is_active = true
  for update;

  if not found or v_actor_member.role not in ('owner', 'manager') then
    raise exception 'Only project owners or managers can remove members';
  end if;

  select *
  into v_target_member
  from public.project_members pm
  where pm.id = p_project_member_id
    and pm.project_id = p_project_id
  for update;

  if not found
    or not v_target_member.is_active
    or coalesce(v_target_member.membership_status, 'active') <> 'active'
    or v_target_member.user_id is null then
    raise exception 'Target must be an active joined project member';
  end if;

  if v_target_member.id = v_actor_member.id then
    raise exception 'You cannot remove yourself from the project';
  end if;

  if v_target_member.role = 'owner' then
    raise exception 'Transfer ownership before removing the current owner';
  end if;

  if v_actor_member.role = 'manager' and v_target_member.role <> 'member' then
    raise exception 'Managers can only remove project members';
  end if;

  update public.project_members
  set is_active = false,
      left_at = v_now
  where id = p_project_member_id;

  update public.projects
  set updated_at = v_now
  where id = p_project_id;

  insert into public.project_member_activity (
    project_id,
    actor_project_member_id,
    target_project_member_id,
    event_type,
    metadata,
    occurred_at
  )
  values (
    p_project_id,
    v_actor_member.id,
    p_project_member_id,
    'member_removed',
    jsonb_build_object('removed_role', v_target_member.role),
    v_now
  );

  return p_project_member_id;
end;
$$;

grant execute on function public.remove_project_member(uuid, uuid) to authenticated;

commit;
