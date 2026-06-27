-- 0049_add_plan_billing.sql
-- Self-serve SaaS billing for the courtier SaaS: a `plan` per organization
-- (essentiel | cabinet | performance) + Stripe subscription bookkeeping.
-- Entitlements (features, seats, storage) are derived from `plan` in
-- lib/billing/entitlements.ts. The sur-mesure ("custom") offering ignores
-- `plan` and keeps its own entitlement set.
-- Existing broker workspaces are backfilled to the highest plan so nothing is
-- downgraded before billing assigns a real plan.

ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS plan text,
  ADD COLUMN IF NOT EXISTS plan_seats integer,
  ADD COLUMN IF NOT EXISTS trial_ends_at timestamptz,
  ADD COLUMN IF NOT EXISTS current_period_end timestamptz,
  ADD COLUMN IF NOT EXISTS stripe_customer_id text,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id text;

UPDATE organizations
  SET plan = 'performance'
  WHERE workspace_type = 'insurance_broker' AND plan IS NULL;
