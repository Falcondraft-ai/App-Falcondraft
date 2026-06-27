-- ============================================================================
-- 0046_add_commission_statement_source
--
-- Archives the source bordereau file (PDF / Excel / CSV) on the statement.
-- A bordereau is org-scoped (not tied to a single client), so it cannot live in
-- broker_documents (which requires a client_id). The file is stored in the
-- existing `broker-files` bucket under `<org_id>/commissions/<uuid>/<name>` and
-- referenced from the statement via these columns.
-- ============================================================================

alter table public.broker_commission_statements
  add column if not exists source_storage_path text,
  add column if not exists source_file_name text,
  add column if not exists source_mime_type text,
  add column if not exists source_size_bytes bigint;
