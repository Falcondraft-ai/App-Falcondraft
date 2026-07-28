-- Electronic signature: full lifecycle tracking on the devoir de conseil.
--
-- Until now only `docuseal_submission_id` / `signature_url` / `signature_status`
-- existed, and the status was refreshed by a manual click. This adds what a
-- real integration needs: the submitter id (to send reminders), the lifecycle
-- timestamps fed by the provider webhook, the expiry, reminder throttling, and
-- links to the countersigned PDF + audit trail once archived in the GED.
alter table public.broker_advice
  add column if not exists docuseal_submitter_id text,
  add column if not exists signature_sent_at timestamptz,
  add column if not exists signature_viewed_at timestamptz,
  add column if not exists signature_completed_at timestamptz,
  add column if not exists signature_declined_at timestamptz,
  add column if not exists signature_decline_reason text,
  add column if not exists signature_expires_at timestamptz,
  add column if not exists signature_last_reminder_at timestamptz,
  add column if not exists signature_reminder_count integer not null default 0,
  add column if not exists signed_document_id uuid
    references public.broker_documents(id) on delete set null,
  add column if not exists audit_log_document_id uuid
    references public.broker_documents(id) on delete set null;

-- The webhook resolves an advice from the provider submission id; the reminder
-- cron scans pending signatures by status + expiry.
create index if not exists broker_advice_docuseal_submission_id_idx
  on public.broker_advice (docuseal_submission_id)
  where docuseal_submission_id is not null;

create index if not exists broker_advice_signature_status_idx
  on public.broker_advice (signature_status)
  where signature_status is not null;
