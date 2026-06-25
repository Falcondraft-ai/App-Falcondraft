-- ============================================================================
-- 0035_increase_default_storage_limit
--
-- Raises the per-workspace storage quota default from 100 GB to 250 GB and
-- bumps existing insurance-broker workspaces that were created on the old
-- default. Workspaces explicitly set above 250 GB are left untouched.
-- ============================================================================

alter table public.organizations
  alter column storage_limit_bytes set default 268435456000; -- 250 GB

update public.organizations
   set storage_limit_bytes = 268435456000
 where workspace_type = 'insurance_broker'
   and storage_limit_bytes < 268435456000;
