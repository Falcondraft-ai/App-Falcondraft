-- ============================================================================
-- 0025_grant_billing_provider_access
--
-- billing_connections and billing_documents are server-side-only tables.
-- The service_role admin client needs explicit INSERT/UPDATE/DELETE grants
-- to write billing_documents rows, and SELECT to read billing_connections.
--
-- Authenticated users already have SELECT on billing_documents (from 0024).
-- billing_connections must NEVER be granted to authenticated because
-- encrypted_credentials are stored in this table.
--
-- This follows the same pattern as 0021 (system_workflow_configs) and 0015
-- (transcripts) which both explicitly grant CRUD to service_role.
-- ============================================================================

grant select, insert, update, delete on public.billing_documents to service_role;
grant select on public.billing_connections to service_role;

notify pgrst, 'reload schema';
