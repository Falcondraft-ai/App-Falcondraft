-- ============================================================================
-- 0031_create_broker_clients
--
-- Insurance broker CRM module (workspace_type = 'insurance_broker').
--
--   broker_clients   — the client folder ("dossier client")
--   broker_activity  — per-folder action history / timeline
--
-- Both tables are tenant-scoped by organization_id and protected by RLS,
-- following the same pattern as public.transcripts (0015): active members can
-- read; non-viewers can write; managers can delete. The 'owner' role is the
-- internal FalconDraft role and is included in write policies for parity.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- broker_clients
-- ----------------------------------------------------------------------------
create table if not exists public.broker_clients (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  created_by uuid not null,
  client_type text not null default 'individual',
  first_name text,
  last_name text,
  company_name text,
  email text,
  phone text,
  address text,
  postal_code text,
  city text,
  insurance_type text,
  status text not null default 'new',
  needs text,
  notes text,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint broker_clients_client_type_check
    check (client_type in ('individual', 'company')),
  constraint broker_clients_status_check
    check (status in ('new', 'in_progress', 'advice_ready', 'awaiting_signature', 'signed', 'closed', 'lost'))
);

create index if not exists broker_clients_organization_id_idx on public.broker_clients(organization_id);
create index if not exists broker_clients_status_idx on public.broker_clients(status);
create index if not exists broker_clients_created_by_idx on public.broker_clients(created_by);
create index if not exists broker_clients_archived_at_idx on public.broker_clients(archived_at);

grant select, insert, update, delete on public.broker_clients to authenticated;
grant select, insert, update, delete on public.broker_clients to service_role;

alter table public.broker_clients enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'broker_clients'
      and policyname = 'Active members can select organization broker clients'
  ) then
    execute $policy$
      create policy "Active members can select organization broker clients"
        on public.broker_clients for select to authenticated
        using (
          exists (
            select 1 from public.organization_members
            where organization_members.organization_id = broker_clients.organization_id
              and organization_members.user_id = (select auth.uid())
              and organization_members.status = 'active'
          )
        )
    $policy$;
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'broker_clients'
      and policyname = 'Active non-viewers can insert organization broker clients'
  ) then
    execute $policy$
      create policy "Active non-viewers can insert organization broker clients"
        on public.broker_clients for insert to authenticated
        with check (
          exists (
            select 1 from public.organization_members
            where organization_members.organization_id = broker_clients.organization_id
              and organization_members.user_id = (select auth.uid())
              and organization_members.status = 'active'
              and organization_members.role in ('owner', 'manager', 'member')
          )
        )
    $policy$;
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'broker_clients'
      and policyname = 'Active non-viewers can update organization broker clients'
  ) then
    execute $policy$
      create policy "Active non-viewers can update organization broker clients"
        on public.broker_clients for update to authenticated
        using (
          exists (
            select 1 from public.organization_members
            where organization_members.organization_id = broker_clients.organization_id
              and organization_members.user_id = (select auth.uid())
              and organization_members.status = 'active'
              and organization_members.role in ('owner', 'manager', 'member')
          )
        )
        with check (
          exists (
            select 1 from public.organization_members
            where organization_members.organization_id = broker_clients.organization_id
              and organization_members.user_id = (select auth.uid())
              and organization_members.status = 'active'
              and organization_members.role in ('owner', 'manager', 'member')
          )
        )
    $policy$;
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'broker_clients'
      and policyname = 'Active managers can delete organization broker clients'
  ) then
    execute $policy$
      create policy "Active managers can delete organization broker clients"
        on public.broker_clients for delete to authenticated
        using (
          exists (
            select 1 from public.organization_members
            where organization_members.organization_id = broker_clients.organization_id
              and organization_members.user_id = (select auth.uid())
              and organization_members.status = 'active'
              and organization_members.role in ('owner', 'manager')
          )
        )
    $policy$;
  end if;
end $$;

-- ----------------------------------------------------------------------------
-- broker_activity
-- ----------------------------------------------------------------------------
create table if not exists public.broker_activity (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  client_id uuid not null references public.broker_clients(id) on delete cascade,
  user_id uuid,
  type text not null,
  description text,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create index if not exists broker_activity_organization_id_idx on public.broker_activity(organization_id);
create index if not exists broker_activity_client_id_idx on public.broker_activity(client_id);
create index if not exists broker_activity_created_at_idx on public.broker_activity(created_at);

grant select, insert on public.broker_activity to authenticated;
grant select, insert, update, delete on public.broker_activity to service_role;

alter table public.broker_activity enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'broker_activity'
      and policyname = 'Active members can select organization broker activity'
  ) then
    execute $policy$
      create policy "Active members can select organization broker activity"
        on public.broker_activity for select to authenticated
        using (
          exists (
            select 1 from public.organization_members
            where organization_members.organization_id = broker_activity.organization_id
              and organization_members.user_id = (select auth.uid())
              and organization_members.status = 'active'
          )
        )
    $policy$;
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'broker_activity'
      and policyname = 'Active non-viewers can insert organization broker activity'
  ) then
    execute $policy$
      create policy "Active non-viewers can insert organization broker activity"
        on public.broker_activity for insert to authenticated
        with check (
          exists (
            select 1 from public.organization_members
            where organization_members.organization_id = broker_activity.organization_id
              and organization_members.user_id = (select auth.uid())
              and organization_members.status = 'active'
              and organization_members.role in ('owner', 'manager', 'member')
          )
        )
    $policy$;
  end if;
end $$;
