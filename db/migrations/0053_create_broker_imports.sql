-- ============================================================================
-- 0053_create_broker_imports
--
-- Portfolio import (reprise CRM assistée par IA). A broker drops a whole folder
-- or .zip; files are staged, classified by AI, regrouped into proposed client
-- dossiers, reviewed by the broker, then committed (clients created + documents
-- filed). Three tables:
--   broker_import_batches : one import session
--   broker_import_groups  : one proposed client dossier (new or matched existing)
--   broker_import_files   : one staged file (classified, assigned to a group)
-- All three are org-scoped with RLS, mirroring broker_introducers (0047).
-- Staged bytes live under the broker-files bucket prefix `<org>/_import/<batch>/`
-- and are moved to `<org>/<client>/` on commit — no new bucket needed.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- broker_import_batches
-- ---------------------------------------------------------------------------
create table if not exists public.broker_import_batches (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  created_by uuid not null,
  source_type text not null default 'folder',
  status text not null default 'uploading',
  file_count integer not null default 0,
  analyzed_count integer not null default 0,
  group_count integer not null default 0,
  narrative text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists broker_import_batches_organization_id_idx
  on public.broker_import_batches(organization_id);
create index if not exists broker_import_batches_status_idx
  on public.broker_import_batches(status);
create index if not exists broker_import_batches_created_at_idx
  on public.broker_import_batches(created_at);

-- ---------------------------------------------------------------------------
-- broker_import_groups
-- ---------------------------------------------------------------------------
create table if not exists public.broker_import_groups (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  batch_id uuid not null references public.broker_import_batches(id) on delete cascade,
  match_client_id uuid references public.broker_clients(id) on delete set null,
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
  needs text,
  confidence numeric,
  status text not null default 'pending',
  created_client_id uuid references public.broker_clients(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists broker_import_groups_organization_id_idx
  on public.broker_import_groups(organization_id);
create index if not exists broker_import_groups_batch_id_idx
  on public.broker_import_groups(batch_id);
create index if not exists broker_import_groups_status_idx
  on public.broker_import_groups(status);

-- ---------------------------------------------------------------------------
-- broker_import_files
-- ---------------------------------------------------------------------------
create table if not exists public.broker_import_files (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  batch_id uuid not null references public.broker_import_batches(id) on delete cascade,
  group_id uuid references public.broker_import_groups(id) on delete set null,
  uploaded_by uuid not null,
  original_path text not null,
  file_name text not null,
  mime_type text not null,
  size_bytes bigint not null default 0,
  staging_path text not null,
  analysis_status text not null default 'pending',
  extracted jsonb not null default '{}'::jsonb,
  decision text not null default 'include',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists broker_import_files_organization_id_idx
  on public.broker_import_files(organization_id);
create index if not exists broker_import_files_batch_id_idx
  on public.broker_import_files(batch_id);
create index if not exists broker_import_files_group_id_idx
  on public.broker_import_files(group_id);
create index if not exists broker_import_files_analysis_status_idx
  on public.broker_import_files(analysis_status);

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------
grant select, insert, update, delete on public.broker_import_batches to authenticated;
grant select, insert, update, delete on public.broker_import_batches to service_role;
grant select, insert, update, delete on public.broker_import_groups to authenticated;
grant select, insert, update, delete on public.broker_import_groups to service_role;
grant select, insert, update, delete on public.broker_import_files to authenticated;
grant select, insert, update, delete on public.broker_import_files to service_role;

-- ---------------------------------------------------------------------------
-- RLS — same shape as broker_introducers (0047): active members read, active
-- non-viewers (owner/manager/member) mutate, all scoped to their organization.
-- ---------------------------------------------------------------------------
alter table public.broker_import_batches enable row level security;
alter table public.broker_import_groups enable row level security;
alter table public.broker_import_files enable row level security;

do $$
declare
  tbl text;
begin
  foreach tbl in array array[
    'broker_import_batches',
    'broker_import_groups',
    'broker_import_files'
  ]
  loop
    -- SELECT: any active member of the organization
    if not exists (
      select 1 from pg_policies where schemaname = 'public'
        and tablename = tbl
        and policyname = 'Active members can select organization ' || tbl
    ) then
      execute format(
        'create policy %I on public.%I for select to authenticated using ('
        || 'exists (select 1 from public.organization_members om '
        || 'where om.organization_id = %I.organization_id '
        || 'and om.user_id = (select auth.uid()) and om.status = ''active''))',
        'Active members can select organization ' || tbl, tbl, tbl
      );
    end if;

    -- INSERT: active non-viewers
    if not exists (
      select 1 from pg_policies where schemaname = 'public'
        and tablename = tbl
        and policyname = 'Active non-viewers can insert organization ' || tbl
    ) then
      execute format(
        'create policy %I on public.%I for insert to authenticated with check ('
        || 'exists (select 1 from public.organization_members om '
        || 'where om.organization_id = %I.organization_id '
        || 'and om.user_id = (select auth.uid()) and om.status = ''active'' '
        || 'and om.role in (''owner'', ''manager'', ''member'')))',
        'Active non-viewers can insert organization ' || tbl, tbl, tbl
      );
    end if;

    -- UPDATE: active non-viewers
    if not exists (
      select 1 from pg_policies where schemaname = 'public'
        and tablename = tbl
        and policyname = 'Active non-viewers can update organization ' || tbl
    ) then
      execute format(
        'create policy %I on public.%I for update to authenticated using ('
        || 'exists (select 1 from public.organization_members om '
        || 'where om.organization_id = %I.organization_id '
        || 'and om.user_id = (select auth.uid()) and om.status = ''active'' '
        || 'and om.role in (''owner'', ''manager'', ''member'')))',
        'Active non-viewers can update organization ' || tbl, tbl, tbl
      );
    end if;

    -- DELETE: active non-viewers
    if not exists (
      select 1 from pg_policies where schemaname = 'public'
        and tablename = tbl
        and policyname = 'Active non-viewers can delete organization ' || tbl
    ) then
      execute format(
        'create policy %I on public.%I for delete to authenticated using ('
        || 'exists (select 1 from public.organization_members om '
        || 'where om.organization_id = %I.organization_id '
        || 'and om.user_id = (select auth.uid()) and om.status = ''active'' '
        || 'and om.role in (''owner'', ''manager'', ''member'')))',
        'Active non-viewers can delete organization ' || tbl, tbl, tbl
      );
    end if;
  end loop;
end $$;
