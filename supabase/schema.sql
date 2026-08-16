create extension if not exists pgcrypto;

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
  version integer not null,
  specification jsonb not null,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  unique (employee_id, version)
);

create index if not exists employees_organization_id_idx on public.employees(organization_id);
create index if not exists employee_versions_employee_id_idx on public.employee_versions(employee_id);

create or replace function public.is_org_member(target_org uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.organization_members
    where organization_id = target_org
      and user_id = auth.uid()
  );
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  new_org_id uuid;
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name', ''));

  insert into public.organizations (name)
  values (coalesce(split_part(new.email, '@', 1), 'My') || '''s Workspace')
  returning id into new_org_id;

  insert into public.organization_members (organization_id, user_id, role)
  values (new_org_id, new.id, 'owner');

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;
alter table public.employees enable row level security;
alter table public.employee_versions enable row level security;

drop policy if exists "profiles_self_select" on public.profiles;
create policy "profiles_self_select" on public.profiles
for select using (id = auth.uid());

drop policy if exists "organizations_members_select" on public.organizations;
create policy "organizations_members_select" on public.organizations
for select using (public.is_org_member(id));

drop policy if exists "members_org_select" on public.organization_members;
create policy "members_org_select" on public.organization_members
for select using (public.is_org_member(organization_id));

drop policy if exists "employees_org_select" on public.employees;
create policy "employees_org_select" on public.employees
for select using (public.is_org_member(organization_id));

drop policy if exists "employees_org_insert" on public.employees;
create policy "employees_org_insert" on public.employees
for insert with check (
  public.is_org_member(organization_id)
  and created_by = auth.uid()
);

drop policy if exists "employees_org_update" on public.employees;
create policy "employees_org_update" on public.employees
for update using (public.is_org_member(organization_id));

drop policy if exists "versions_org_select" on public.employee_versions;
create policy "versions_org_select" on public.employee_versions
for select using (
  exists (
    select 1
    from public.employees e
    where e.id = employee_id
      and public.is_org_member(e.organization_id)
  )
);

drop policy if exists "versions_org_insert" on public.employee_versions;
create policy "versions_org_insert" on public.employee_versions
for insert with check (
  created_by = auth.uid()
  and exists (
    select 1
    from public.employees e
    where e.id = employee_id
      and public.is_org_member(e.organization_id)
  )
);

create or replace function public.create_employee_with_version(
  p_name text,
  p_role text,
  p_goal text,
  p_specification jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_org_id uuid;
  v_employee_id uuid;
begin
  select organization_id
  into v_org_id
  from public.organization_members
  where user_id = auth.uid()
  order by created_at asc
  limit 1;

  if v_org_id is null then
    raise exception 'No organization found for current user';
  end if;

  insert into public.employees (
    organization_id,
    name,
    role,
    goal,
    status,
    created_by
  )
  values (
    v_org_id,
    p_name,
    p_role,
    p_goal,
    'draft',
    auth.uid()
  )
  returning id into v_employee_id;

  insert into public.employee_versions (
    employee_id,
    version,
    specification,
    created_by
  )
  values (
    v_employee_id,
    1,
    p_specification,
    auth.uid()
  );

  return v_employee_id;
end;
$$;

grant execute on function public.create_employee_with_version(text,text,text,jsonb) to authenticated;
