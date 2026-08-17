create table if not exists public.ai_usage_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  employee_id uuid references public.employees(id) on delete set null,
  task text not null check (task in ('classification','extraction','urgency','discovery','drafting','complex_reasoning')),
  model text not null,
  input_tokens integer not null default 0 check (input_tokens >= 0),
  cached_input_tokens integer not null default 0 check (cached_input_tokens >= 0),
  output_tokens integer not null default 0 check (output_tokens >= 0),
  estimated_cost_usd numeric(14,8) not null default 0 check (estimated_cost_usd >= 0),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);

create index if not exists ai_usage_events_org_created_idx
  on public.ai_usage_events(organization_id, created_at desc);
create index if not exists ai_usage_events_employee_created_idx
  on public.ai_usage_events(employee_id, created_at desc)
  where employee_id is not null;

alter table public.ai_usage_events enable row level security;

create policy "ai_usage_org_select" on public.ai_usage_events
for select using (public.is_org_member(organization_id));

create policy "ai_usage_org_insert" on public.ai_usage_events
for insert with check (
  public.is_org_member(organization_id)
  and created_by = auth.uid()
  and (
    employee_id is null
    or exists (
      select 1 from public.employees e
      where e.id = employee_id
        and e.organization_id = organization_id
    )
  )
);
