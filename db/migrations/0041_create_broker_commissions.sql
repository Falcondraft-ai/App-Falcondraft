-- ============================================================================
-- 0041_create_broker_commissions
--
-- Broker revenue tracking: commission statements (bordereaux) and the
-- individual commission lines they contain.
--
--   * broker_commission_statements = a "bordereau" sent by an insurer for a
--     period, with the announced total. status: received -> reconciled
--     (pointé) | disputed (litige).
--   * broker_commissions = one commission line, optionally tied to a contract
--     and client. Tracks the commission earned and, optionally, a retrocession
--     paid to a business introducer (apporteur). net = commission - retrocession.
--     status: expected -> received -> reconciled.
--
-- Reconciliation ("pointage") = matching the sum of the lines against the
-- bordereau total, then marking the statement reconciled.
-- ============================================================================

create table if not exists public.broker_commission_statements (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  created_by uuid not null,
  document_id uuid references public.broker_documents(id) on delete set null,
  insurer_name text,
  period_label text,
  period_start date,
  period_end date,
  total_amount numeric,
  currency text not null default 'EUR',
  status text not null default 'received',
  notes text,
  reconciled_at timestamptz,
  reconciled_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint broker_commission_statements_status_check
    check (status in ('received', 'reconciled', 'disputed'))
);

create index if not exists broker_commission_statements_organization_id_idx
  on public.broker_commission_statements(organization_id);
create index if not exists broker_commission_statements_status_idx
  on public.broker_commission_statements(status);

create table if not exists public.broker_commissions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  created_by uuid not null,
  statement_id uuid references public.broker_commission_statements(id) on delete set null,
  contract_id uuid references public.broker_contracts(id) on delete set null,
  client_id uuid references public.broker_clients(id) on delete set null,
  insurer_name text,
  label text,
  base_amount numeric,
  rate numeric,
  commission_amount numeric,
  retrocession_rate numeric,
  retrocession_amount numeric,
  retrocession_beneficiary text,
  period_label text,
  currency text not null default 'EUR',
  status text not null default 'expected',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint broker_commissions_status_check
    check (status in ('expected', 'received', 'reconciled'))
);

create index if not exists broker_commissions_organization_id_idx
  on public.broker_commissions(organization_id);
create index if not exists broker_commissions_statement_id_idx
  on public.broker_commissions(statement_id);
create index if not exists broker_commissions_contract_id_idx
  on public.broker_commissions(contract_id);
create index if not exists broker_commissions_client_id_idx
  on public.broker_commissions(client_id);
create index if not exists broker_commissions_status_idx
  on public.broker_commissions(status);

grant select, insert, update, delete on public.broker_commission_statements to authenticated;
grant select, insert, update, delete on public.broker_commission_statements to service_role;
grant select, insert, update, delete on public.broker_commissions to authenticated;
grant select, insert, update, delete on public.broker_commissions to service_role;

alter table public.broker_commission_statements enable row level security;
alter table public.broker_commissions enable row level security;

do $$
declare
  tbl text;
begin
  foreach tbl in array array['broker_commission_statements', 'broker_commissions']
  loop
    if not exists (
      select 1 from pg_policies
      where schemaname = 'public' and tablename = tbl
        and policyname = 'Active members can select organization ' || tbl
    ) then
      execute format($f$
        create policy %I
          on public.%I for select to authenticated
          using (
            exists (
              select 1 from public.organization_members
              where organization_members.organization_id = %I.organization_id
                and organization_members.user_id = (select auth.uid())
                and organization_members.status = 'active'
            )
          )
      $f$, 'Active members can select organization ' || tbl, tbl, tbl);
    end if;

    if not exists (
      select 1 from pg_policies
      where schemaname = 'public' and tablename = tbl
        and policyname = 'Active non-viewers can insert organization ' || tbl
    ) then
      execute format($f$
        create policy %I
          on public.%I for insert to authenticated
          with check (
            exists (
              select 1 from public.organization_members
              where organization_members.organization_id = %I.organization_id
                and organization_members.user_id = (select auth.uid())
                and organization_members.status = 'active'
                and organization_members.role in ('owner', 'manager', 'member')
            )
          )
      $f$, 'Active non-viewers can insert organization ' || tbl, tbl, tbl);
    end if;

    if not exists (
      select 1 from pg_policies
      where schemaname = 'public' and tablename = tbl
        and policyname = 'Active non-viewers can update organization ' || tbl
    ) then
      execute format($f$
        create policy %I
          on public.%I for update to authenticated
          using (
            exists (
              select 1 from public.organization_members
              where organization_members.organization_id = %I.organization_id
                and organization_members.user_id = (select auth.uid())
                and organization_members.status = 'active'
                and organization_members.role in ('owner', 'manager', 'member')
            )
          )
          with check (
            exists (
              select 1 from public.organization_members
              where organization_members.organization_id = %I.organization_id
                and organization_members.user_id = (select auth.uid())
                and organization_members.status = 'active'
                and organization_members.role in ('owner', 'manager', 'member')
            )
          )
      $f$, 'Active non-viewers can update organization ' || tbl, tbl, tbl, tbl);
    end if;

    if not exists (
      select 1 from pg_policies
      where schemaname = 'public' and tablename = tbl
        and policyname = 'Active managers can delete organization ' || tbl
    ) then
      execute format($f$
        create policy %I
          on public.%I for delete to authenticated
          using (
            exists (
              select 1 from public.organization_members
              where organization_members.organization_id = %I.organization_id
                and organization_members.user_id = (select auth.uid())
                and organization_members.status = 'active'
                and organization_members.role in ('owner', 'manager')
            )
          )
      $f$, 'Active managers can delete organization ' || tbl, tbl, tbl);
    end if;
  end loop;
end $$;
