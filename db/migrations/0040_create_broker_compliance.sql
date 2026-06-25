-- ============================================================================
-- 0040_create_broker_compliance
--
-- Per-client regulatory compliance record for the broker module. One row per
-- client (enforced by a unique index). Covers the three obligations a broker
-- cannot operate without:
--
--   * DDA  : the "fiche d'information" must be delivered to the client. (The
--            déclaration d'adéquation itself is the devoir de conseil document.)
--   * LCB-FT (anti-money-laundering): identity verification, risk
--            classification, PEP (politically exposed person) check and, for
--            higher-risk clients, the declared origin of funds.
--   * RGPD : register of consents (data processing, marketing) with timestamps,
--            and the right-to-erasure workflow.
--
-- The cabinet-level "fiche d'information" legal data (ORIAS number, RCP, ACPR,
-- médiateur) lives on organizations.broker_settings.compliance — not here.
-- Booleans are stamped with their *_at timestamp by the API when flipped true.
-- ============================================================================

create table if not exists public.broker_compliance (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  client_id uuid not null references public.broker_clients(id) on delete cascade,
  created_by uuid not null,
  updated_by uuid,
  -- LCB-FT
  identity_verified boolean not null default false,
  identity_document_id uuid references public.broker_documents(id) on delete set null,
  identity_verified_at timestamptz,
  identity_verified_by uuid,
  risk_level text,
  is_pep boolean not null default false,
  pep_details text,
  funds_origin text,
  lcbft_notes text,
  -- RGPD
  consent_data_processing boolean not null default false,
  consent_data_processing_at timestamptz,
  consent_marketing boolean not null default false,
  consent_marketing_at timestamptz,
  erasure_requested boolean not null default false,
  erasure_requested_at timestamptz,
  erased_at timestamptz,
  -- DDA
  info_sheet_delivered boolean not null default false,
  info_sheet_delivered_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint broker_compliance_risk_level_check
    check (risk_level is null or risk_level in ('low', 'standard', 'high'))
);

create unique index if not exists broker_compliance_client_uniq
  on public.broker_compliance(organization_id, client_id);
create index if not exists broker_compliance_organization_id_idx
  on public.broker_compliance(organization_id);

grant select, insert, update, delete on public.broker_compliance to authenticated;
grant select, insert, update, delete on public.broker_compliance to service_role;

alter table public.broker_compliance enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'broker_compliance'
      and policyname = 'Active members can select organization broker compliance'
  ) then
    execute $policy$
      create policy "Active members can select organization broker compliance"
        on public.broker_compliance for select to authenticated
        using (
          exists (
            select 1 from public.organization_members
            where organization_members.organization_id = broker_compliance.organization_id
              and organization_members.user_id = (select auth.uid())
              and organization_members.status = 'active'
          )
        )
    $policy$;
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'broker_compliance'
      and policyname = 'Active non-viewers can insert organization broker compliance'
  ) then
    execute $policy$
      create policy "Active non-viewers can insert organization broker compliance"
        on public.broker_compliance for insert to authenticated
        with check (
          exists (
            select 1 from public.organization_members
            where organization_members.organization_id = broker_compliance.organization_id
              and organization_members.user_id = (select auth.uid())
              and organization_members.status = 'active'
              and organization_members.role in ('owner', 'manager', 'member')
          )
        )
    $policy$;
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'broker_compliance'
      and policyname = 'Active non-viewers can update organization broker compliance'
  ) then
    execute $policy$
      create policy "Active non-viewers can update organization broker compliance"
        on public.broker_compliance for update to authenticated
        using (
          exists (
            select 1 from public.organization_members
            where organization_members.organization_id = broker_compliance.organization_id
              and organization_members.user_id = (select auth.uid())
              and organization_members.status = 'active'
              and organization_members.role in ('owner', 'manager', 'member')
          )
        )
        with check (
          exists (
            select 1 from public.organization_members
            where organization_members.organization_id = broker_compliance.organization_id
              and organization_members.user_id = (select auth.uid())
              and organization_members.status = 'active'
              and organization_members.role in ('owner', 'manager', 'member')
          )
        )
    $policy$;
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'broker_compliance'
      and policyname = 'Active managers can delete organization broker compliance'
  ) then
    execute $policy$
      create policy "Active managers can delete organization broker compliance"
        on public.broker_compliance for delete to authenticated
        using (
          exists (
            select 1 from public.organization_members
            where organization_members.organization_id = broker_compliance.organization_id
              and organization_members.user_id = (select auth.uid())
              and organization_members.status = 'active'
              and organization_members.role in ('owner', 'manager')
          )
        )
    $policy$;
  end if;
end $$;
