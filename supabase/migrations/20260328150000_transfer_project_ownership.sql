begin;

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
      updated_at = now()
  where id = p_project_id;

  return p_next_owner_project_member_id;
end;
$$;

grant execute on function public.transfer_project_ownership(uuid, uuid) to authenticated;

commit;
