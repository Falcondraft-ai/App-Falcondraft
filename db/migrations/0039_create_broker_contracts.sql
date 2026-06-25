-- ============================================================================
-- 0039_create_broker_contracts
--
-- Insurance contracts (policies) for the broker module. A contract is the core
-- of the broker's recurring business and is distinct from a "dossier" (the
-- working file): a single client can hold several contracts over time. Tracks
-- the insurer, branch, policy number, effective/renewal dates, premium and its
-- frequency, tacit-renewal flag and the expected commission rate.
--
-- The renewal_date drives the in-app renewal reminders (upcoming/overdue
-- échéances surfaced on the dashboard and the dedicated "Renouvellements" view).
-- The actual outbound reminder email is left to the n8n automation layer.
--
--   status: active -> (suspended) -> (terminated | expired)
--           pending = signed but effect date not yet reached
-- ============================================================================

create table if not exists public.broker_contracts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  client_id uuid not null references public.broker_clients(id) on delete cascade,
  created_by uuid not null,
  document_id uuid references public.broker_documents(id) on delete set null,
  insurer_name text,
  product_name text,
  insurance_type text,
  policy_number text,
  status text not null default 'active',
  effective_date date,
  renewal_date date,
  premium_amount numeric,
  premium_frequency text not null default 'annual',
  currency text not null default 'EUR',
  tacit_renewal boolean not null default true,
  commission_rate numeric,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint broker_contracts_status_check
    check (status in ('active', 'pending', 'suspended', 'terminated', 'expired')),
  constraint broker_contracts_frequency_check
    check (premium_frequency in ('monthly', 'quarterly', 'biannual', 'annual', 'single'))
);

create index if not exists broker_contracts_organization_id_idx on public.broker_contracts(organization_id);
create index if not exists broker_contracts_client_id_idx on public.broker_contracts(client_id);
create index if not exists broker_contracts_status_idx on public.broker_contracts(status);
create index if not exists broker_contracts_renewal_date_idx on public.broker_contracts(renewal_date);

grant select, insert, update, delete on public.broker_contracts to authenticated;
grant select, insert, update, delete on public.broker_contracts to service_role;

alter table public.broker_contracts enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'broker_contracts'
      and policyname = 'Active members can select organization broker contracts'
  ) then
    execute $policy$
      create policy "Active members can select organization broker contracts"
        on public.broker_contracts for select to authenticated
        using (
          exists (
            select 1 from public.organization_members
            where organization_members.organization_id = broker_contracts.organization_id
              and organization_members.user_id = (select auth.uid())
              and organization_members.status = 'active'
          )
        )
    $policy$;
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'broker_contracts'
      and policyname = 'Active non-viewers can insert organization broker contracts'
  ) then
    execute $policy$
      create policy "Active non-viewers can insert organization broker contracts"
        on public.broker_contracts for insert to authenticated
        with check (
          exists (
            select 1 from public.organization_members
            where organization_members.organization_id = broker_contracts.organization_id
              and organization_members.user_id = (select auth.uid())
              and organization_members.status = 'active'
              and organization_members.role in ('owner', 'manager', 'member')
          )
        )
    $policy$;
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'broker_contracts'
      and policyname = 'Active non-viewers can update organization broker contracts'
  ) then
    execute $policy$
      create policy "Active non-viewers can update organization broker contracts"
        on public.broker_contracts for update to authenticated
        using (
          exists (
            select 1 from public.organization_members
            where organization_members.organization_id = broker_contracts.organization_id
              and organization_members.user_id = (select auth.uid())
              and organization_members.status = 'active'
              and organization_members.role in ('owner', 'manager', 'member')
          )
        )
        with check (
          exists (
            select 1 from public.organization_members
            where organization_members.organization_id = broker_contracts.organization_id
              and organization_members.user_id = (select auth.uid())
              and organization_members.status = 'active'
              and organization_members.role in ('owner', 'manager', 'member')
          )
        )
    $policy$;
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'broker_contracts'
      and policyname = 'Active managers can delete organization broker contracts'
  ) then
    execute $policy$
      create policy "Active managers can delete organization broker contracts"
        on public.broker_contracts for delete to authenticated
        using (
          exists (
            select 1 from public.organization_members
            where organization_members.organization_id = broker_contracts.organization_id
              and organization_members.user_id = (select auth.uid())
              and organization_members.status = 'active'
              and organization_members.role in ('owner', 'manager')
          )
        )
    $policy$;
  end if;
end $$;
