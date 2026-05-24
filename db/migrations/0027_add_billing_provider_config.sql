-- ============================================================================
-- 0027_add_billing_provider_config
--
-- Adds workspace-level billing provider configuration to organizations and
-- extends billing_connections with test state tracking columns.
-- ============================================================================

-- --------------------------------------------------------------------------
-- organizations.default_billing_provider
--
-- Default: 'qonto' (backward-compatible with existing single Qonto setup).
-- New workspaces should be seeded with 'none' if desired.
-- --------------------------------------------------------------------------

alter table public.organizations
  add column if not exists default_billing_provider text not null default 'qonto';

comment on column public.organizations.default_billing_provider is
  'Billing/quote provider for this workspace: none, qonto. For now only qonto is implemented.';

-- --------------------------------------------------------------------------
-- billing_connections.last_tested_at / last_error
-- --------------------------------------------------------------------------

alter table public.billing_connections
  add column if not exists last_tested_at timestamptz;

alter table public.billing_connections
  add column if not exists last_error text;

comment on column public.billing_connections.last_tested_at is
  'When the connection was last tested successfully.';
comment on column public.billing_connections.last_error is
  'Last error message from a connection test, if any.';

-- --------------------------------------------------------------------------
-- Refresh RLS — no changes needed (billing_connections stays server-side only)
-- --------------------------------------------------------------------------

notify pgrst, 'reload schema';
