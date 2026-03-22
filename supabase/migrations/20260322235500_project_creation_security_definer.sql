create or replace function public.create_project_with_owner(
  p_name text,
  p_description text default null,
  p_currency_code text default 'VND'
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_project_id uuid;
  v_base_slug text;
  v_slug text;
  v_suffix integer := 1;
begin
  if v_user_id is null then
    raise exception 'You must be authenticated to create a project';
  end if;

  if length(trim(coalesce(p_name, ''))) < 3 then
    raise exception 'Project name must be at least 3 characters long';
  end if;

  insert into public.profiles (user_id, display_name, email)
  values (
    v_user_id,
    coalesce(
      nullif(auth.jwt() -> 'user_metadata' ->> 'display_name', ''),
      nullif(auth.jwt() -> 'user_metadata' ->> 'name', ''),
      split_part(coalesce(auth.jwt() ->> 'email', ''), '@', 1),
      'Project member'
    ),
    coalesce(auth.jwt() ->> 'email', '')
  )
  on conflict (user_id) do nothing;

  v_base_slug := regexp_replace(lower(trim(p_name)), '[^a-z0-9]+', '-', 'g');
  v_base_slug := trim(both '-' from v_base_slug);

  if v_base_slug = '' then
    v_base_slug := 'project';
  end if;

  v_slug := v_base_slug;

  while exists (
    select 1
    from public.projects
    where slug = v_slug
  ) loop
    v_suffix := v_suffix + 1;
    v_slug := v_base_slug || '-' || v_suffix;
  end loop;

  insert into public.projects (
    name,
    slug,
    description,
    currency_code,
    created_by
  )
  values (
    trim(p_name),
    v_slug,
    nullif(trim(coalesce(p_description, '')), ''),
    upper(left(coalesce(nullif(trim(p_currency_code), ''), 'VND'), 3)),
    v_user_id
  )
  returning id into v_project_id;

  insert into public.project_members (
    project_id,
    user_id,
    role
  )
  values (
    v_project_id,
    v_user_id,
    'owner'
  )
  on conflict (project_id, user_id) do nothing;

  return v_project_id;
end;
$$;

grant execute on function public.create_project_with_owner(text, text, text) to authenticated;
