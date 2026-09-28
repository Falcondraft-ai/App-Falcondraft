-- ============================================================================
-- 0063_sent_and_imported_emails
--
-- Un dossier client montre la conversation entière.
--
-- Jusqu'ici, seul le courrier REÇU pouvait être rattaché à un dossier : le
-- briefing ne lit que la boîte de réception. Or le courtier veut retrouver dans
-- le dossier ce qu'il a lui-même écrit à l'assuré, et y verser d'anciens emails
-- sortis de son logiciel de messagerie. Deux sources s'ajoutent :
--
--   * les ENVOYÉS, rattachés automatiquement quand un destinataire est l'adresse
--     d'un dossier (lib/broker/sent-mail-links.ts) ;
--   * les fichiers .eml / .msg déposés dans le dossier, conservés dans la GED
--     (document_id) et lus depuis ce fichier, pas depuis une boîte.
--
-- email_connections.sent_synced_at est le curseur du rattachement automatique :
-- jusqu'où les envoyés de CETTE boîte ont été parcourus, qu'ils aient trouvé un
-- dossier ou non. Sans lui, une fenêtre pleine d'envois sans rapport avec un
-- client serait relue indéfiniment.
--
-- Les lignes existantes restent des emails reçus ('received', aucun document).
-- Pas de nouvelle politique : les lignes restent cloisonnées par organisation.
-- ============================================================================

alter table public.broker_email_items
  add column if not exists direction text not null default 'received',
  add column if not exists to_emails text[] not null default '{}',
  add column if not exists document_id uuid references public.broker_documents(id) on delete cascade;

alter table public.broker_email_items
  drop constraint if exists broker_email_items_direction_check;
alter table public.broker_email_items
  add constraint broker_email_items_direction_check
    check (direction in ('received', 'sent'));

-- Un fichier déposé n'est rattaché qu'une fois.
create unique index if not exists broker_email_items_document_idx
  on public.broker_email_items(document_id)
  where document_id is not null;

alter table public.email_connections
  add column if not exists sent_synced_at timestamptz;
