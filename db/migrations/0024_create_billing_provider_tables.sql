-- ============================================================================
-- 0024_create_billing_provider_tables
--
-- Creates billing_connections and billing_documents for the long-term
-- billing provider architecture.
--
-- billing_connections: per-organization billing provider connections.
--   SERVER-SIDE ONLY via service_role. No authenticated-user policies
--   exist because encrypted_credentials must never be exposed.
--
-- billing_documents: billing provider document metadata (no PDF storage).
--   Qonto quote PDFs are NOT stored in Supabase Storage — they are fetched
--   on demand by the FalconDraft backend via GET /api/billing/documents/:id/download
--   and streamed to the browser.
--
-- The existing documents table is NOT modified.
-- Old Invoice Ninja quote_pdf rows are NOT migrated yet.
-- No storage buckets are created.
-- ============================================================================

-- --------------------------------------------------------------------------
-- updated_at trigger function
-- --------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

revoke all on function public.set_updated_at() from public;
revoke all on function public.set_updated_at() from anon;

-- --------------------------------------------------------------------------
-- Cross-organization consistency validator for billing_documents
--
-- Prevents accidentally inserting a billing_documents row where deal_id or
-- workflow_run_id belongs to a different organization than organization_id.
-- This is a safety net for service_role writes — it cannot be bypassed.
-- --------------------------------------------------------------------------

create or replace function public.check_billing_document_org_consistency()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.deal_id is not null then
    if not exists (
      select 1
      from public.deals
      where deals.id = new.deal_id
        and deals.organization_id = new.organization_id
    ) then
      raise exception 'billing_documents.deal_id does not belong to the same organization (org=%, deal=%)',
        new.organization_id, new.deal_id;
    end if;
  end if;

  if new.workflow_run_id is not null then
    if not exists (
      select 1
      from public.workflow_runs
      where workflow_runs.id = new.workflow_run_id
        and workflow_runs.organization_id = new.organization_id
    ) then
      raise exception 'billing_documents.workflow_run_id does not belong to the same organization (org=%, run=%)',
        new.organization_id, new.workflow_run_id;
    end if;
  end if;

  return new;
end;
$$;

revoke all on function public.check_billing_document_org_consistency() from public;
revoke all on function public.check_billing_document_org_consistency() from anon;

-- --------------------------------------------------------------------------
-- billing_connections
-- --------------------------------------------------------------------------

create table public.billing_connections (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  provider text not null,
  auth_type text not null,
  status text not null default 'connected',
  encrypted_credentials jsonb not null,
  provider_account_id text,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint billing_connections_provider_check check (
    provider in ('qonto', 'pennylane', 'odoo', 'invoice_ninja', 'manual')
  ),
  constraint billing_connections_auth_type_check check (
    auth_type in ('api_key', 'oauth', 'manual')
  ),
  constraint billing_connections_status_check check (
    status in ('connected', 'disconnected', 'error')
  ),
  constraint billing_connections_org_provider_unique unique (organization_id, provider)
);

comment on table public.billing_connections is
  'Per-organization billing provider connections. Server-side only — no authenticated-user access. All reads and writes go through the service_role admin client.';

comment on column public.billing_connections.encrypted_credentials is
  'Encrypted provider credentials. Never exposed to authenticated users.';

create index billing_connections_organization_id_idx
  on public.billing_connections(organization_id);
create index billing_connections_provider_idx
  on public.billing_connections(provider);
create index billing_connections_status_idx
  on public.billing_connections(status);

create trigger trg_billing_connections_updated_at
  before update on public.billing_connections
  for each row
  execute function public.set_updated_at();

-- --------------------------------------------------------------------------
-- billing_documents
-- --------------------------------------------------------------------------

create table public.billing_documents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  deal_id uuid references public.deals(id) on delete set null,
  workflow_run_id uuid references public.workflow_runs(id) on delete set null,
  provider text not null,
  document_type text not null default 'quote',
  provider_client_id text,
  provider_quote_id text,
  provider_quote_number text,
  provider_quote_url text,
  provider_status text,
  amount_ht numeric(12,2),
  amount_tva numeric(12,2),
  amount_ttc numeric(12,2),
  currency text not null default 'EUR',
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint billing_documents_provider_check check (
    provider in ('qonto', 'pennylane', 'odoo', 'invoice_ninja', 'manual')
  ),
  constraint billing_documents_document_type_check check (
    document_type in ('quote', 'invoice', 'credit_note')
  )
);

comment on table public.billing_documents is
  'Billing provider document metadata. Qonto quote PDFs are NOT stored in Supabase Storage — they are fetched on demand via GET /api/billing/documents/:id/download and streamed to the browser.';

create unique index billing_documents_provider_quote_id_unique
  on public.billing_documents(provider, provider_quote_id)
  where provider_quote_id is not null;

create index billing_documents_organization_id_idx
  on public.billing_documents(organization_id);
create index billing_documents_deal_id_idx
  on public.billing_documents(deal_id);
create index billing_documents_workflow_run_id_idx
  on public.billing_documents(workflow_run_id);
create index billing_documents_provider_idx
  on public.billing_documents(provider);
create index billing_documents_provider_quote_id_idx
  on public.billing_documents(provider_quote_id);
create index billing_documents_document_type_idx
  on public.billing_documents(document_type);
create index billing_documents_created_at_idx
  on public.billing_documents(created_at);

create trigger trg_billing_documents_updated_at
  before update on public.billing_documents
  for each row
  execute function public.set_updated_at();

create trigger trg_billing_documents_org_consistency
  before insert or update on public.billing_documents
  for each row
  execute function public.check_billing_document_org_consistency();

-- --------------------------------------------------------------------------
-- RLS
-- --------------------------------------------------------------------------

alter table public.billing_connections enable row level security;
alter table public.billing_documents enable row level security;

-- --------------------------------------------------------------------------
-- billing_connections — NO authenticated-user policies
--
-- This table is server-side only. The service_role bypasses RLS entirely.
-- No SELECT / INSERT / UPDATE / DELETE policies are created for authenticated
-- users because encrypted_credentials must never be exposed.
-- --------------------------------------------------------------------------

-- --------------------------------------------------------------------------
-- billing_documents — SELECT-only for authenticated users
-- --------------------------------------------------------------------------

create policy "Active members can select organization billing documents"
  on public.billing_documents
  for select
  to authenticated
  using (public.is_active_org_member(billing_documents.organization_id));

-- No INSERT / UPDATE / DELETE policies for authenticated users.
-- All writes to billing_documents go through the service_role admin client.

-- --------------------------------------------------------------------------
-- Grants
-- --------------------------------------------------------------------------

grant select on table public.billing_documents to authenticated;

-- No grants on billing_connections for authenticated users.
-- The service_role already has full access.

notify pgrst, 'reload schema';
