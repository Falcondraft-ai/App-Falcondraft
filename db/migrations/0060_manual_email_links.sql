-- ============================================================================
-- 0060_manual_email_links
--
-- Rattacher un email à un dossier depuis la boîte, sans passer par un briefing.
--
-- Jusqu'ici un email rangé dans un dossier était forcément issu d'une analyse :
-- broker_email_items.digest_id était obligatoire. Or le courtier voit son
-- courrier en entier dans l'onglet « Vos emails », y compris ce que l'assistant
-- n'a jamais regardé, et doit pouvoir classer d'un clic. Un rattachement fait à
-- la main n'appartient à aucun briefing : la colonne devient facultative plutôt
-- que d'inventer un briefing fantôme pour la satisfaire.
--
-- Un même email ne peut être rangé qu'une fois par profil : l'index unique
-- ci-dessous rend l'opération idempotente (reclasser met à jour la ligne au
-- lieu d'en créer une seconde).
-- ============================================================================

alter table public.broker_email_items
  alter column digest_id drop not null;

-- Rattachements manuels : un seul par (organisation, profil, message).
-- Partiel sur digest_id is null pour ne pas gêner les items de briefing, qui
-- peuvent légitimement revoir le même message dans deux briefings distincts.
create unique index if not exists broker_email_items_manual_link_idx
  on public.broker_email_items(
    organization_id,
    coalesce(profile_id, '00000000-0000-0000-0000-000000000000'::uuid),
    graph_message_id
  )
  where digest_id is null;
