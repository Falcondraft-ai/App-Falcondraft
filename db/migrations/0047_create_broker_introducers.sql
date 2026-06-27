-- ============================================================================
-- 0047_create_broker_introducers
--
-- Apporteurs (business introducers): a reusable directory of partners who bring
-- in clients, each with a default retrocession rate. Referenced from clients
-- (the introducer who brought them) and from commission lines, so retrocessions
-- can be totalled per introducer for a "relevé".
-- ============================================================================

create table if not exists public.broker_introducers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  created_by uuid not null,
  name text not null,
  retrocession_rate numeric,
  email text,
  phone text,
  notes text,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists broker_introducers_organization_id_idx
  on public.broker_introducers(organization_id);
create index if not exists broker_introducers_archived_at_idx
  on public.broker_introducers(archived_at);

alter table public.broker_clients
  add column if not exists introducer_id uuid
  references public.broker_introducers(id) on delete set null;
create index if not exists broker_clients_introducer_id_idx
  on public.broker_clients(introducer_id);

alter table public.broker_commissions
  add column if not exists introducer_id uuid
  references public.broker_introducers(id) on delete set null;
create index if not exists broker_commissions_introducer_id_idx
  on public.broker_commissions(introducer_id);

grant select, insert, update, delete on public.broker_introducers to authenticated;
grant select, insert, update, delete on public.broker_introducers to service_role;

alter table public.broker_introducers enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public'
      and tablename = 'broker_introducers'
      and policyname = 'Active members can select organization broker_introducers'
  ) then
    create policy "Active members can select organization broker_introducers"
      on public.broker_introducers for select to authenticated
      using (
        exists (
          select 1 from public.organization_members
          where organization_members.organization_id = broker_introducers.organization_id
            and organization_members.user_id = (select auth.uid())
            and organization_members.status = 'active'
        )
      );
  end if;

  if not exists (
    select 1 from pg_policies where schemaname = 'public'
      and tablename = 'broker_introducers'
      and policyname = 'Active non-viewers can insert organization broker_introducers'
  ) then
    create policy "Active non-viewers can insert organization broker_introducers"
      on public.broker_introducers for insert to authenticated
      with check (
        exists (
          select 1 from public.organization_members
          where organization_members.organization_id = broker_introducers.organization_id
            and organization_members.user_id = (select auth.uid())
            and organization_members.status = 'active'
            and organization_members.role in ('owner', 'manager', 'member')
        )
      );
  end if;

  if not exists (
    select 1 from pg_policies where schemaname = 'public'
      and tablename = 'broker_introducers'
      and policyname = 'Active non-viewers can update organization broker_introducers'
  ) then
    create policy "Active non-viewers can update organization broker_introducers"
      on public.broker_introducers for update to authenticated
      using (
        exists (
          select 1 from public.organization_members
          where organization_members.organization_id = broker_introducers.organization_id
            and organization_members.user_id = (select auth.uid())
            and organization_members.status = 'active'
            and organization_members.role in ('owner', 'manager', 'member')
        )
      );
  end if;

  if not exists (
    select 1 from pg_policies where schemaname = 'public'
      and tablename = 'broker_introducers'
      and policyname = 'Active non-viewers can delete organization broker_introducers'
  ) then
    create policy "Active non-viewers can delete organization broker_introducers"
      on public.broker_introducers for delete to authenticated
      using (
        exists (
          select 1 from public.organization_members
          where organization_members.organization_id = broker_introducers.organization_id
            and organization_members.user_id = (select auth.uid())
            and organization_members.status = 'active'
            and organization_members.role in ('owner', 'manager', 'member')
        )
      );
  end if;
end $$;
