-- ============================================================================
-- 0037_purge_old_agent_messages
--
-- Auto-purge of AI assistant history older than 90 days. Two layers:
--   1) a daily pg_cron job (global, runs even if no one opens the chat);
--   2) the app also prunes the current user's old messages on chat open
--      (see app/api/courtier/agent GET) — covers the case where pg_cron is
--      not enabled on the project.
--
-- The pg_cron setup is wrapped so this migration never fails if the extension
-- is unavailable or not permitted on the project.
-- ============================================================================

do $$
begin
  create extension if not exists pg_cron;

  -- Named schedule = upsert; safe to re-run. Runs daily at 03:15.
  perform cron.schedule(
    'purge-broker-agent-messages',
    '15 3 * * *',
    $cmd$
      delete from public.broker_agent_messages
      where created_at < now() - interval '90 days'
    $cmd$
  );
exception
  when others then
    raise notice 'pg_cron unavailable, skipping scheduled purge (app-level prune still applies): %', sqlerrm;
end $$;
