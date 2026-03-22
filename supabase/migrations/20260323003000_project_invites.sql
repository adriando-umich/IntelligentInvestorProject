do $$
begin
  create type public.project_invite_status as enum (
    'pending',
    'accepted',
    'revoked',
    'expired'
  );
exception
  when duplicate_object then null;
end $$;

create table if not exists public.project_invites (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  email text,
  role public.project_member_role not null default 'member',
  invite_token text not null unique default gen_random_uuid()::text,
  status public.project_invite_status not null default 'pending',
  expires_at timestamptz not null default (now() + interval '14 days'),
  created_by uuid not null references public.profiles (user_id) on delete restrict,
  accepted_by uuid references public.profiles (user_id) on delete restrict,
  accepted_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists project_invites_project_idx
  on public.project_invites (project_id, status, created_at desc);
create index if not exists project_invites_email_idx
  on public.project_invites (lower(email))
  where email is not null;
create index if not exists project_invites_token_idx
  on public.project_invites (invite_token);

drop trigger if exists set_project_invites_updated_at on public.project_invites;
create trigger set_project_invites_updated_at
before update on public.project_invites
for each row
execute function public.set_updated_at();

alter table public.project_invites enable row level security;

drop policy if exists "project_invites_select_managers" on public.project_invites;
create policy "project_invites_select_managers"
on public.project_invites
for select
to authenticated
using (public.is_project_manager(project_id));

drop policy if exists "project_invites_insert_managers" on public.project_invites;
create policy "project_invites_insert_managers"
on public.project_invites
for insert
to authenticated
with check (
  created_by = auth.uid()
  and public.is_project_manager(project_id)
);

drop policy if exists "project_invites_update_managers" on public.project_invites;
create policy "project_invites_update_managers"
on public.project_invites
for update
to authenticated
using (public.is_project_manager(project_id))
with check (public.is_project_manager(project_id));

create or replace function public.create_project_invite(
  p_project_id uuid,
  p_email text default null,
  p_role public.project_member_role default 'member'
)
returns public.project_invites
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_email text := lower(nullif(trim(coalesce(p_email, '')), ''));
  v_invite public.project_invites;
begin
  if v_user_id is null then
    raise exception 'You must be authenticated to create an invite';
  end if;

  if not public.is_project_manager(p_project_id, v_user_id) then
    raise exception 'Only owners and managers can create invites';
  end if;

  if p_role not in ('manager', 'member') then
    raise exception 'Invites can only assign manager or member roles';
  end if;

  if v_email is not null and exists (
    select 1
    from public.project_members pm
    join public.profiles p
      on p.user_id = pm.user_id
    where pm.project_id = p_project_id
      and pm.is_active = true
      and lower(p.email) = v_email
  ) then
    raise exception 'That email is already an active member of the project';
  end if;

  insert into public.project_invites (
    project_id,
    email,
    role,
    created_by
  )
  values (
    p_project_id,
    v_email,
    p_role,
    v_user_id
  )
  returning * into v_invite;

  return v_invite;
end;
$$;

create or replace function public.revoke_project_invite(
  p_invite_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_project_id uuid;
begin
  if v_user_id is null then
    raise exception 'You must be authenticated to revoke an invite';
  end if;

  select project_id
  into v_project_id
  from public.project_invites
  where id = p_invite_id;

  if v_project_id is null then
    raise exception 'Invite not found';
  end if;

  if not public.is_project_manager(v_project_id, v_user_id) then
    raise exception 'Only owners and managers can revoke invites';
  end if;

  update public.project_invites
  set status = 'revoked',
      revoked_at = now(),
      updated_at = now()
  where id = p_invite_id
    and status = 'pending';
end;
$$;

create or replace function public.get_project_invite_preview(
  p_invite_token text
)
returns table (
  invite_id uuid,
  project_id uuid,
  project_name text,
  project_description text,
  invited_email text,
  role public.project_member_role,
  status public.project_invite_status,
  expires_at timestamptz
)
language sql
security definer
set search_path = public
as $$
  select
    pi.id,
    pi.project_id,
    p.name,
    p.description,
    pi.email,
    pi.role,
    case
      when pi.status = 'pending' and pi.expires_at < now() then 'expired'::public.project_invite_status
      else pi.status
    end as status,
    pi.expires_at
  from public.project_invites pi
  join public.projects p
    on p.id = pi.project_id
  where pi.invite_token = p_invite_token;
$$;

create or replace function public.accept_project_invite(
  p_invite_token text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
  v_invite public.project_invites;
  v_project_id uuid;
begin
  if v_user_id is null then
    raise exception 'You must be authenticated to accept an invite';
  end if;

  select *
  into v_invite
  from public.project_invites
  where invite_token = p_invite_token;

  if not found then
    raise exception 'Invite not found';
  end if;

  if v_invite.status = 'revoked' then
    raise exception 'This invite has been revoked';
  end if;

  if v_invite.status = 'accepted' then
    return v_invite.project_id;
  end if;

  if v_invite.expires_at < now() then
    update public.project_invites
    set status = 'expired',
        updated_at = now()
    where id = v_invite.id;

    raise exception 'This invite has expired';
  end if;

  if v_invite.email is not null and lower(v_invite.email) <> v_email then
    raise exception 'This invite is reserved for a different email address';
  end if;

  insert into public.profiles (user_id, display_name, email)
  values (
    v_user_id,
    coalesce(
      nullif(auth.jwt() -> 'user_metadata' ->> 'display_name', ''),
      nullif(auth.jwt() -> 'user_metadata' ->> 'name', ''),
      split_part(v_email, '@', 1),
      'Project member'
    ),
    coalesce(auth.jwt() ->> 'email', '')
  )
  on conflict (user_id) do update
    set display_name = excluded.display_name,
        email = excluded.email,
        updated_at = now();

  insert into public.project_members (
    project_id,
    user_id,
    role,
    is_active,
    left_at
  )
  values (
    v_invite.project_id,
    v_user_id,
    v_invite.role,
    true,
    null
  )
  on conflict (project_id, user_id) do update
    set role = excluded.role,
        is_active = true,
        left_at = null;

  update public.project_invites
  set status = 'accepted',
      accepted_by = v_user_id,
      accepted_at = now(),
      updated_at = now()
  where id = v_invite.id;

  v_project_id := v_invite.project_id;
  return v_project_id;
end;
$$;

grant execute on function public.create_project_invite(uuid, text, public.project_member_role) to authenticated;
grant execute on function public.revoke_project_invite(uuid) to authenticated;
grant execute on function public.get_project_invite_preview(text) to authenticated;
grant execute on function public.accept_project_invite(text) to authenticated;
