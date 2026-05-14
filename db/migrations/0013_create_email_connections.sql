create table if not exists public.email_connections (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null,
  provider text not null,
  email text not null,
  access_token text not null,
  refresh_token text not null,
  expires_at timestamptz not null,
  status text not null default 'connected',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint email_connections_provider_check
    check (provider in ('gmail')),
  constraint email_connections_status_check
    check (status in ('connected', 'disconnected', 'error'))
);

create index if not exists email_connections_organization_id_idx
  on public.email_connections(organization_id);

create unique index if not exists email_connections_user_provider_idx
  on public.email_connections(organization_id, user_id, provider);

alter table public.email_connections enable row level security;

drop policy if exists "Active members can select own email connections"
  on public.email_connections;

create policy "Active members can select own email connections"
  on public.email_connections
  for select
  to authenticated
  using (
    user_id = (select auth.uid())
    and exists (
      select 1
      from public.organization_members
      where organization_members.organization_id = email_connections.organization_id
        and organization_members.user_id = (select auth.uid())
        and organization_members.status = 'active'
    )
  );

drop policy if exists "Active members can insert own email connections"
  on public.email_connections;

create policy "Active members can insert own email connections"
  on public.email_connections
  for insert
  to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1
      from public.organization_members
      where organization_members.organization_id = email_connections.organization_id
        and organization_members.user_id = (select auth.uid())
        and organization_members.status = 'active'
    )
  );

drop policy if exists "Active members can update own email connections"
  on public.email_connections;

create policy "Active members can update own email connections"
  on public.email_connections
  for update
  to authenticated
  using (
    user_id = (select auth.uid())
    and exists (
      select 1
      from public.organization_members
      where organization_members.organization_id = email_connections.organization_id
        and organization_members.user_id = (select auth.uid())
        and organization_members.status = 'active'
    )
  )
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1
      from public.organization_members
      where organization_members.organization_id = email_connections.organization_id
        and organization_members.user_id = (select auth.uid())
        and organization_members.status = 'active'
    )
  );

drop policy if exists "Active members can delete own email connections"
  on public.email_connections;

create policy "Active members can delete own email connections"
  on public.email_connections
  for delete
  to authenticated
  using (
    user_id = (select auth.uid())
    and exists (
      select 1
      from public.organization_members
      where organization_members.organization_id = email_connections.organization_id
        and organization_members.user_id = (select auth.uid())
        and organization_members.status = 'active'
    )
  );

grant select, insert, update, delete
  on table public.email_connections
  to authenticated, service_role;
