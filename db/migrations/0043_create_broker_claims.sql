-- ============================================================================
-- 0043_create_broker_claims
--
-- Insurance claims (sinistres) for the broker module. When something happens to
-- a client (water damage, car accident, theft…), the broker assists them:
-- declares the claim to the insurer, follows the file, chases documents and
-- makes sure the client is properly indemnified. A claim is attached to a client
-- and, optionally, to one of their contracts.
--
--   status: declared -> in_progress -> awaiting_docs -> settled -> closed
--           (or rejected). "open" = declared | in_progress | awaiting_docs.
-- ============================================================================

create table if not exists public.broker_claims (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  client_id uuid not null references public.broker_clients(id) on delete cascade,
  contract_id uuid references public.broker_contracts(id) on delete set null,
  created_by uuid not null,
  insurer_name text,
  claim_type text,
  reference text,
  status text not null default 'declared',
  occurrence_date date,
  declaration_date date,
  amount_estimate numeric,
  amount_settled numeric,
  currency text not null default 'EUR',
  description text,
  notes text,
  settled_at timestamptz,
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint broker_claims_status_check
    check (status in ('declared', 'in_progress', 'awaiting_docs', 'settled', 'closed', 'rejected'))
);

create index if not exists broker_claims_organization_id_idx on public.broker_claims(organization_id);
create index if not exists broker_claims_client_id_idx on public.broker_claims(client_id);
create index if not exists broker_claims_contract_id_idx on public.broker_claims(contract_id);
create index if not exists broker_claims_status_idx on public.broker_claims(status);

grant select, insert, update, delete on public.broker_claims to authenticated;
grant select, insert, update, delete on public.broker_claims to service_role;

alter table public.broker_claims enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'broker_claims'
      and policyname = 'Active members can select organization broker claims'
  ) then
    execute $policy$
      create policy "Active members can select organization broker claims"
        on public.broker_claims for select to authenticated
        using (
          exists (
            select 1 from public.organization_members
            where organization_members.organization_id = broker_claims.organization_id
              and organization_members.user_id = (select auth.uid())
              and organization_members.status = 'active'
          )
        )
    $policy$;
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'broker_claims'
      and policyname = 'Active non-viewers can insert organization broker claims'
  ) then
    execute $policy$
      create policy "Active non-viewers can insert organization broker claims"
        on public.broker_claims for insert to authenticated
        with check (
          exists (
            select 1 from public.organization_members
            where organization_members.organization_id = broker_claims.organization_id
              and organization_members.user_id = (select auth.uid())
              and organization_members.status = 'active'
              and organization_members.role in ('owner', 'manager', 'member')
          )
        )
    $policy$;
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'broker_claims'
      and policyname = 'Active non-viewers can update organization broker claims'
  ) then
    execute $policy$
      create policy "Active non-viewers can update organization broker claims"
        on public.broker_claims for update to authenticated
        using (
          exists (
            select 1 from public.organization_members
            where organization_members.organization_id = broker_claims.organization_id
              and organization_members.user_id = (select auth.uid())
              and organization_members.status = 'active'
              and organization_members.role in ('owner', 'manager', 'member')
          )
        )
        with check (
          exists (
            select 1 from public.organization_members
            where organization_members.organization_id = broker_claims.organization_id
              and organization_members.user_id = (select auth.uid())
              and organization_members.status = 'active'
              and organization_members.role in ('owner', 'manager', 'member')
          )
        )
    $policy$;
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'broker_claims'
      and policyname = 'Active managers can delete organization broker claims'
  ) then
    execute $policy$
      create policy "Active managers can delete organization broker claims"
        on public.broker_claims for delete to authenticated
        using (
          exists (
            select 1 from public.organization_members
            where organization_members.organization_id = broker_claims.organization_id
              and organization_members.user_id = (select auth.uid())
              and organization_members.status = 'active'
              and organization_members.role in ('owner', 'manager')
          )
        )
    $policy$;
  end if;
end $$;
