-- ============================================================================
-- 0030_add_workspace_type_and_storage
--
-- Adds a workspace "module" discriminator on organizations plus per-workspace
-- storage accounting. A workspace is either the historical commercial proposal
-- automation experience (`sales_automation`, default) or the insurance broker
-- CRM (`insurance_broker`). The type drives which module/dashboard the members
-- land on after login.
--
-- Storage is tracked per workspace with a maintained counter
-- (storage_used_bytes) and a configurable quota (storage_limit_bytes, default
-- 100 GB). The counter is incremented/decremented by the application on file
-- upload/delete and can be reconciled from storage.objects.
-- ============================================================================

alter table public.organizations
  add column if not exists workspace_type text not null default 'sales_automation';

alter table public.organizations
  add column if not exists storage_limit_bytes bigint not null default 107374182400; -- 100 GB

alter table public.organizations
  add column if not exists storage_used_bytes bigint not null default 0;

-- Guard against unknown module values.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'organizations_workspace_type_check'
  ) then
    alter table public.organizations
      add constraint organizations_workspace_type_check
      check (workspace_type in ('sales_automation', 'insurance_broker'));
  end if;
end $$;

-- Never let the counter go negative.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'organizations_storage_used_nonneg_check'
  ) then
    alter table public.organizations
      add constraint organizations_storage_used_nonneg_check
      check (storage_used_bytes >= 0);
  end if;
end $$;

create index if not exists organizations_workspace_type_idx
  on public.organizations(workspace_type);

-- ----------------------------------------------------------------------------
-- Atomic helper to adjust the storage counter (used by the app on upload/delete).
-- SECURITY DEFINER so it can be called through the user-scoped client while the
-- counter stays clamped at 0. Mutations normally flow through service_role, but
-- this keeps the accounting race-free under concurrency.
-- ----------------------------------------------------------------------------
create or replace function public.adjust_organization_storage(
  target_org_id uuid,
  delta_bytes bigint
)
returns bigint
language sql
security definer
set search_path = ''
as $$
  update public.organizations
     set storage_used_bytes = greatest(0, storage_used_bytes + delta_bytes)
   where id = target_org_id
  returning storage_used_bytes;
$$;

revoke all on function public.adjust_organization_storage(uuid, bigint) from public;
revoke all on function public.adjust_organization_storage(uuid, bigint) from anon;
grant execute on function public.adjust_organization_storage(uuid, bigint) to authenticated;
grant execute on function public.adjust_organization_storage(uuid, bigint) to service_role;

-- ============================================================================
-- Rollback (manual):
--   alter table public.organizations drop column if exists workspace_type;
--   alter table public.organizations drop column if exists storage_limit_bytes;
--   alter table public.organizations drop column if exists storage_used_bytes;
--   drop function if exists public.adjust_organization_storage(uuid, bigint);
-- ============================================================================
