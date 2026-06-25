-- ============================================================================
-- 0038_add_broker_settings
--
-- Per-workspace configuration for the insurance-broker module, stored as JSONB
-- on organizations. Holds the contract branches the cabinet offers and its
-- partner insurers (used to drive the dossier and quote forms). Shape:
--   { "enabledBranches": ["auto","habitation",...],
--     "partnerInsurers": ["AXA","Generali",...] }
-- An empty object means "use the defaults" (all standard branches).
-- ============================================================================

alter table public.organizations
  add column if not exists broker_settings jsonb not null default '{}'::jsonb;
