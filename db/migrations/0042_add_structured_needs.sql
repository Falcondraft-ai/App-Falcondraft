-- ============================================================================
-- 0042_add_structured_needs
--
-- Structured "recueil de besoins" for the broker module. Until now a dossier's
-- needs were a single free-text field (broker_clients.needs). This adds a JSONB
-- column holding branch-specific questionnaire answers (auto, habitation, santé,
-- prévoyance, emprunteur, pro…). The free-text `needs` column is kept as a
-- "compléments" field.
--
-- Shape: { "<question_id>": "<answer>" , ... } — the question catalogue lives in
-- code (lib/broker/needs.ts), keyed by the client's branch. These structured
-- answers feed the devoir de conseil template (and, later, the compliance flow).
-- ============================================================================

alter table public.broker_clients
  add column if not exists structured_needs jsonb not null default '{}'::jsonb;
