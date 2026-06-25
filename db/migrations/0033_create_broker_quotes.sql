-- ============================================================================
-- 0033_create_broker_quotes
--
-- Company quotes ("devis compagnie") imported by the broker. The broker uploads
-- a quote PDF received from an insurer; the system will later extract the key
-- fields (n8n, not yet wired). Until then, extraction_status stays 'pending' and
-- the broker verifies / fills the fields manually, then validates.
--
--   extraction_status: pending -> extracted -> validated  (or failed)
--
-- The broker MUST verify and validate the data before it is used downstream
-- (devoir de conseil). This table holds the structured, broker-validated view;
-- raw extraction output is kept in extracted_data (jsonb).
-- ============================================================================

create table if not exists public.broker_quotes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  client_id uuid not null references public.broker_clients(id) on delete cascade,
  document_id uuid references public.broker_documents(id) on delete set null,
  created_by uuid not null,
  insurer_name text,
  product_name text,
  premium_monthly numeric,
  premium_annual numeric,
  currency text not null default 'EUR',
  coverage_summary text,
  deductible text,
  notes text,
  extracted_data jsonb not null default '{}',
  extraction_status text not null default 'pending',
  validated_by uuid,
  validated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint broker_quotes_extraction_status_check
    check (extraction_status in ('pending', 'extracted', 'validated', 'failed'))
);

create index if not exists broker_quotes_organization_id_idx on public.broker_quotes(organization_id);
create index if not exists broker_quotes_client_id_idx on public.broker_quotes(client_id);
create index if not exists broker_quotes_document_id_idx on public.broker_quotes(document_id);
create index if not exists broker_quotes_status_idx on public.broker_quotes(extraction_status);

grant select, insert, update, delete on public.broker_quotes to authenticated;
grant select, insert, update, delete on public.broker_quotes to service_role;

alter table public.broker_quotes enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'broker_quotes'
      and policyname = 'Active members can select organization broker quotes'
  ) then
    execute $policy$
      create policy "Active members can select organization broker quotes"
        on public.broker_quotes for select to authenticated
        using (
          exists (
            select 1 from public.organization_members
            where organization_members.organization_id = broker_quotes.organization_id
              and organization_members.user_id = (select auth.uid())
              and organization_members.status = 'active'
          )
        )
    $policy$;
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'broker_quotes'
      and policyname = 'Active non-viewers can insert organization broker quotes'
  ) then
    execute $policy$
      create policy "Active non-viewers can insert organization broker quotes"
        on public.broker_quotes for insert to authenticated
        with check (
          exists (
            select 1 from public.organization_members
            where organization_members.organization_id = broker_quotes.organization_id
              and organization_members.user_id = (select auth.uid())
              and organization_members.status = 'active'
              and organization_members.role in ('owner', 'manager', 'member')
          )
        )
    $policy$;
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'broker_quotes'
      and policyname = 'Active non-viewers can update organization broker quotes'
  ) then
    execute $policy$
      create policy "Active non-viewers can update organization broker quotes"
        on public.broker_quotes for update to authenticated
        using (
          exists (
            select 1 from public.organization_members
            where organization_members.organization_id = broker_quotes.organization_id
              and organization_members.user_id = (select auth.uid())
              and organization_members.status = 'active'
              and organization_members.role in ('owner', 'manager', 'member')
          )
        )
        with check (
          exists (
            select 1 from public.organization_members
            where organization_members.organization_id = broker_quotes.organization_id
              and organization_members.user_id = (select auth.uid())
              and organization_members.status = 'active'
              and organization_members.role in ('owner', 'manager', 'member')
          )
        )
    $policy$;
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'broker_quotes'
      and policyname = 'Active managers can delete organization broker quotes'
  ) then
    execute $policy$
      create policy "Active managers can delete organization broker quotes"
        on public.broker_quotes for delete to authenticated
        using (
          exists (
            select 1 from public.organization_members
            where organization_members.organization_id = broker_quotes.organization_id
              and organization_members.user_id = (select auth.uid())
              and organization_members.status = 'active'
              and organization_members.role in ('owner', 'manager')
          )
        )
    $policy$;
  end if;
end $$;
