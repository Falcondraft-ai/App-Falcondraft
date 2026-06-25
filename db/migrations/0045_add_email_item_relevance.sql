-- ============================================================================
-- 0045_add_email_item_relevance
--
-- Outlook briefing refinement. Until now only brokerage-relevant emails were
-- stored as items; the rest were merely counted. To let the broker SEE what was
-- set aside (and to let the AI ASK when a case is genuinely subtle), email items
-- now carry a relevance:
--
--   relevant  — clearly about the brokerage activity (shown with actions).
--   uncertain — ambiguous; surfaced in an "À confirmer" section so the broker
--               decides (keep → relevant, or exclude).
--   excluded  — clearly unrelated (ads, newsletters, personal…); shown in a
--               collapsible "Écartés" section, with the reason it was set aside.
-- ============================================================================

alter table public.broker_email_items
  add column if not exists relevance text not null default 'relevant',
  add column if not exists exclusion_reason text;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'broker_email_items_relevance_check'
  ) then
    alter table public.broker_email_items
      add constraint broker_email_items_relevance_check
      check (relevance in ('relevant', 'uncertain', 'excluded'));
  end if;
end $$;

create index if not exists broker_email_items_relevance_idx
  on public.broker_email_items(digest_id, relevance);
