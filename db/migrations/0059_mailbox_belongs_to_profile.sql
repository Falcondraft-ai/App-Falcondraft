-- ============================================================================
-- 0059_mailbox_belongs_to_profile
--
-- La boîte email appartient au PROFIL, pas au login.
--
-- Dans un cabinet partagé, « la boîte de Frank » est celle de Frank quelle que
-- soit la personne connectée. Or la clé d'unicité posée en 0057 incluait
-- user_id : deux comptes du même cabinet (le compte partagé du courtier et
-- celui de l'intégrateur, par exemple) pouvaient créer chacun leur connexion
-- pour un même profil, et surtout ne voyaient pas celle de l'autre.
--
-- On distingue donc deux régimes :
--   - profil renseigné (module courtier) → une boîte par (organisation, profil,
--     fournisseur), peu importe qui l'a reliée ;
--   - profil absent (SaaS dossiers) → l'ancienne règle reste, chaque
--     collaborateur ayant sa propre boîte sous son propre compte.
--
-- user_id reste enregistré : il dit QUI a relié la boîte, ce qui reste utile en
-- audit. Il ne sert simplement plus à la retrouver.
-- ============================================================================

drop index if exists public.email_connections_user_provider_profile_idx;

-- Module courtier : la boîte suit le profil.
create unique index if not exists email_connections_profile_provider_idx
  on public.email_connections(organization_id, provider, profile_id)
  where profile_id is not null;

-- SaaS dossiers : une boîte par utilisateur et par fournisseur, comme avant.
create unique index if not exists email_connections_user_provider_idx
  on public.email_connections(organization_id, user_id, provider)
  where profile_id is null;
