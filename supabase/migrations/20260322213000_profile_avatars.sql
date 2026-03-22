alter table public.profiles
add column if not exists avatar_url text;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  display_name text;
  avatar_url text;
begin
  display_name := coalesce(
    nullif(new.raw_user_meta_data ->> 'display_name', ''),
    nullif(new.raw_user_meta_data ->> 'name', ''),
    split_part(coalesce(new.email, ''), '@', 1),
    'New member'
  );

  avatar_url := coalesce(
    nullif(new.raw_user_meta_data ->> 'avatar_url', ''),
    nullif(new.raw_user_meta_data ->> 'picture', '')
  );

  insert into public.profiles (user_id, display_name, email, avatar_url)
  values (new.id, display_name, coalesce(new.email, ''), avatar_url)
  on conflict (user_id) do update
    set display_name = excluded.display_name,
        email = excluded.email,
        avatar_url = coalesce(excluded.avatar_url, public.profiles.avatar_url),
        updated_at = now();

  return new;
end;
$$;

create or replace function public.create_project_with_owner(
  p_name text,
  p_description text default null,
  p_currency_code text default 'VND'
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_project_id uuid;
  v_base_slug text;
  v_slug text;
  v_suffix integer := 1;
  v_avatar_url text;
begin
  if v_user_id is null then
    raise exception 'You must be authenticated to create a project';
  end if;

  if length(trim(coalesce(p_name, ''))) < 3 then
    raise exception 'Project name must be at least 3 characters long';
  end if;

  v_avatar_url := coalesce(
    nullif(auth.jwt() -> 'user_metadata' ->> 'avatar_url', ''),
    nullif(auth.jwt() -> 'user_metadata' ->> 'picture', '')
  );

  insert into public.profiles (user_id, display_name, email, avatar_url)
  values (
    v_user_id,
    coalesce(
      nullif(auth.jwt() -> 'user_metadata' ->> 'display_name', ''),
      nullif(auth.jwt() -> 'user_metadata' ->> 'name', ''),
      split_part(coalesce(auth.jwt() ->> 'email', ''), '@', 1),
      'Project member'
    ),
    coalesce(auth.jwt() ->> 'email', ''),
    v_avatar_url
  )
  on conflict (user_id) do update
    set avatar_url = coalesce(excluded.avatar_url, public.profiles.avatar_url),
        updated_at = now();

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
