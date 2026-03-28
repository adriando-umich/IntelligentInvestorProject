begin;

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
      left_at = now()
  where id = p_project_member_id;

  update public.projects
  set updated_at = now()
  where id = p_project_id;

  return p_project_member_id;
end;
$$;

grant execute on function public.remove_project_member(uuid, uuid) to authenticated;

commit;
