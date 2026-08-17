create extension if not exists pgcrypto;

create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  created_at timestamptz not null default now()
);

create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.organization_members (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'owner' check (role in ('owner','admin','member')),
  created_at timestamptz not null default now(),
  primary key (organization_id, user_id)
);

create table if not exists public.employees (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  role text not null,
  goal text not null,
  status text not null default 'draft' check (status in ('draft','active','paused','error','archived')),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.employee_versions (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id) on delete cascade,
  version integer not null check (version > 0),
  specification jsonb not null,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  unique (employee_id, version)
);

create index if not exists organization_members_user_id_idx on public.organization_members(user_id);
create index if not exists employees_organization_id_idx on public.employees(organization_id);
create index if not exists employees_created_by_idx on public.employees(created_by);
create index if not exists employee_versions_employee_id_idx on public.employee_versions(employee_id);
create index if not exists employee_versions_created_by_idx on public.employee_versions(created_by);

create or replace function private.is_org_member(target_org uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.organization_members om
    where om.organization_id = target_org
      and om.user_id = (select auth.uid())
  );
$$;

revoke execute on function private.is_org_member(uuid) from public, anon;
grant execute on function private.is_org_member(uuid) to authenticated;

create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_org_id uuid;
  workspace_name text;
begin
  workspace_name := coalesce(nullif(split_part(new.email, '@', 1), ''), 'My') || '''s Workspace';

  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name', ''));

  insert into public.organizations (name)
  values (workspace_name)
  returning id into new_org_id;

  insert into public.organization_members (organization_id, user_id, role)
  values (new_org_id, new.id, 'owner');

  return new;
end;
$$;

revoke execute on function private.handle_new_user() from public, anon, authenticated;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function private.handle_new_user();

alter table public.profiles enable row level security;
alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;
alter table public.employees enable row level security;
alter table public.employee_versions enable row level security;

drop policy if exists profiles_self_select on public.profiles;
create policy profiles_self_select on public.profiles
for select to authenticated
using ((select auth.uid()) = id);

drop policy if exists profiles_self_update on public.profiles;
create policy profiles_self_update on public.profiles
for update to authenticated
using ((select auth.uid()) = id)
with check ((select auth.uid()) = id);

drop policy if exists organizations_members_select on public.organizations;
create policy organizations_members_select on public.organizations
for select to authenticated
using (private.is_org_member(id));

drop policy if exists members_org_select on public.organization_members;
create policy members_org_select on public.organization_members
for select to authenticated
using (private.is_org_member(organization_id));

drop policy if exists employees_org_select on public.employees;
create policy employees_org_select on public.employees
for select to authenticated
using (private.is_org_member(organization_id));

drop policy if exists employees_org_insert on public.employees;
create policy employees_org_insert on public.employees
for insert to authenticated
with check (
  private.is_org_member(organization_id)
  and created_by = (select auth.uid())
);

drop policy if exists versions_org_select on public.employee_versions;
create policy versions_org_select on public.employee_versions
for select to authenticated
using (
  exists (
    select 1
    from public.employees e
    where e.id = employee_id
      and private.is_org_member(e.organization_id)
  )
);

drop policy if exists versions_org_insert on public.employee_versions;
create policy versions_org_insert on public.employee_versions
for insert to authenticated
with check (
  created_by = (select auth.uid())
  and exists (
    select 1
    from public.employees e
    where e.id = employee_id
      and private.is_org_member(e.organization_id)
  )
);

revoke all on public.profiles, public.organizations, public.organization_members, public.employees, public.employee_versions from anon;
revoke all on public.profiles, public.organizations, public.organization_members, public.employees, public.employee_versions from authenticated;

grant select, update (full_name) on public.profiles to authenticated;
grant select on public.organizations to authenticated;
grant select on public.organization_members to authenticated;
grant select, insert on public.employees to authenticated;
grant select, insert on public.employee_versions to authenticated;

create or replace function public.create_employee_with_version(
  p_organization_id uuid,
  p_name text,
  p_role text,
  p_goal text,
  p_specification jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_employee_id uuid;
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if not private.is_org_member(p_organization_id) then
    raise exception 'Organization access denied' using errcode = '42501';
  end if;

  if nullif(btrim(p_name), '') is null
     or nullif(btrim(p_role), '') is null
     or nullif(btrim(p_goal), '') is null then
    raise exception 'Employee name, role, and goal are required' using errcode = '22023';
  end if;

  if p_specification is null or jsonb_typeof(p_specification) <> 'object' then
    raise exception 'Employee specification must be a JSON object' using errcode = '22023';
  end if;

  insert into public.employees (organization_id, name, role, goal, status, created_by)
  values (p_organization_id, btrim(p_name), btrim(p_role), btrim(p_goal), 'draft', v_user_id)
  returning id into v_employee_id;

  insert into public.employee_versions (employee_id, version, specification, created_by)
  values (v_employee_id, 1, p_specification, v_user_id);

  return v_employee_id;
end;
$$;

revoke execute on function public.create_employee_with_version(uuid,text,text,text,jsonb) from public, anon;
grant execute on function public.create_employee_with_version(uuid,text,text,text,jsonb) to authenticated;
