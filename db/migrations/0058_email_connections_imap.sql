-- ============================================================================
-- 0058_email_connections_imap
--
-- Connexions email IMAP/SMTP, à côté des connexions OAuth existantes.
--
-- Pourquoi : tous les cabinets ne sont pas chez Microsoft ou Google. Un cabinet
-- hébergé chez un fournisseur classique (IONOS, OVH, Gandi…) n'a AUCUNE boîte
-- Microsoft derrière ses adresses — son « Outlook » n'est que le logiciel,
-- configuré en IMAP. L'intégration Graph ne peut structurellement rien y lire.
--
-- Modèle : une même table pour les deux mondes, distingués par `provider`
-- ('outlook' | 'gmail' = OAuth, 'imap' = mot de passe). Les colonnes ajoutées
-- ici ne concernent que 'imap' et restent nulles ailleurs.
--
-- SECRET : le mot de passe de la boîte est chiffré (AES-256-GCM, même
-- mécanisme et même clé TOKEN_ENCRYPTION_KEY que les jetons OAuth) et rangé
-- dans `access_token` — la colonne est déjà traitée comme un secret partout
-- (jamais journalisée, jamais renvoyée au client). Un mot de passe IMAP est
-- plus sensible qu'un jeton OAuth : il ne s'auto-révoque pas et ouvre toute la
-- boîte. Privilégier un mot de passe applicatif dédié quand le fournisseur en
-- propose, et ne jamais l'exposer côté navigateur.
-- ============================================================================

-- Une connexion IMAP n'a ni jeton de rafraîchissement ni expiration : ces deux
-- colonnes étaient NOT NULL pour OAuth, elles deviennent facultatives.
alter table public.email_connections
  alter column refresh_token drop not null;
alter table public.email_connections
  alter column expires_at drop not null;

alter table public.email_connections
  add column if not exists imap_host text,
  add column if not exists imap_port integer,
  add column if not exists imap_secure boolean not null default true,
  add column if not exists smtp_host text,
  add column if not exists smtp_port integer,
  -- SMTP 465 est en TLS implicite, 587 en STARTTLS : deux modes différents,
  -- d'où un booléen distinct de celui d'IMAP.
  add column if not exists smtp_secure boolean not null default true,
  -- Identifiant de connexion : souvent l'adresse elle-même, pas toujours.
  add column if not exists username text,
  -- Dernière vérification réussie des identifiants, pour signaler une boîte
  -- qui ne répond plus sans attendre le prochain briefing.
  add column if not exists last_verified_at timestamptz;

-- ---------------------------------------------------------------------------
-- Cloisonnement des emails traités par profil
--
-- L'idempotence du briefing s'appuie sur « cet email a-t-il déjà été traité ? »,
-- jusqu'ici posé pour un couple (organisation, utilisateur). Avec un compte
-- partagé, l'utilisateur est le MÊME pour tout le cabinet : sans le profil, un
-- email reçu par deux personnes (copie, adresse commune) disparaîtrait du
-- briefing de la seconde sous prétexte que la première l'a déjà vu.
-- ---------------------------------------------------------------------------
alter table public.broker_email_items
  add column if not exists profile_id uuid references public.broker_profiles(id) on delete cascade;

create index if not exists broker_email_items_profile_id_idx
  on public.broker_email_items(profile_id);
