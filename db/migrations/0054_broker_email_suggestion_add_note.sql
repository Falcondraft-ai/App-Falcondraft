-- Extend the allowed broker_email_suggestions types.
--   • update_client — already emitted by the app (CRM coordinate updates from
--     emails) but missing from the original 0044 CHECK constraint.
--   • add_note — new: records the important information carried by an email
--     (object to insure and its characteristics, situation, deadline, decision)
--     into the client dossier's internal notes.
-- Rebuild the CHECK constraint with the full set.
alter table public.broker_email_suggestions
  drop constraint if exists broker_email_suggestions_type_check;

alter table public.broker_email_suggestions
  add constraint broker_email_suggestions_type_check
  check (type in (
    'attach_document',
    'draft_reply',
    'create_client',
    'update_client',
    'declare_claim',
    'flag_renewal',
    'add_note'
  ));
