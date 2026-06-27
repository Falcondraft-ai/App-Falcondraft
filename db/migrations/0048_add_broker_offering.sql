-- 0048_add_broker_offering.sql
-- Splits insurance-broker workspaces into two offerings:
--   'custom' = bespoke "courtier sur mesure" (no commercial proposal module)
--   'saas'   = self-serve "courtier SaaS" (gets the proposal-automation module)
-- workspace_type stays 'insurance_broker' for BOTH so every existing broker
-- gate (module access, RLS, briefing, invitations) keeps working unchanged.
-- Existing rows backfill to 'saas' so the current broker workspace is SaaS.

ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS broker_offering text NOT NULL DEFAULT 'saas';
