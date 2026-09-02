-- ============================================================================
-- 0057_create_broker_profiles
--
-- Profils de cabinet (« Qui êtes-vous ? »).
--
-- Un cabinet de courtage familial travaille à plusieurs sur UN seul compte : le
-- gérant, son frère, sa collaboratrice. Le client refuse de multiplier les
-- identifiants. On garde donc une seule connexion Supabase (le compte du
-- cabinet) et on ajoute une notion légère de PROFIL, choisi à l'arrivée et
-- basculable à tout moment.
--
-- Un profil n'est PAS un compte : il ne porte ni mot de passe ni session. Il
-- sert à (1) savoir sous quelle identité une action est enregistrée, (2)
-- rattacher une boîte email à une personne, (3) présenter à chacun son propre
-- briefing. Les dossiers, eux, restent partagés entre tous les profils du
-- cabinet — c'est tout l'intérêt de la centralisation.
--
-- Limite assumée, décidée avec le client : sans mot de passe par profil, la
-- traçabilité est déclarative. N'importe qui connaissant l'identifiant du
-- cabinet peut agir sous n'importe quel profil. Les colonnes profile_id
-- ci-dessous enregistrent l'identité ACTIVE au moment de l'action, pas une
-- identité prouvée. Si un jour l'ACPR ou un audit RGPD exige mieux, l'ajout
-- d'un code par profil se greffe ici sans toucher au reste.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- broker_profiles
-- ---------------------------------------------------------------------------
create table if not exists public.broker_profiles (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  display_name text not null,
  -- Adresse email du profil. C'est la clé de rattachement de sa boîte (IMAP ou
  -- Microsoft) et ce qui permet de reconnaître ses envois dans un dossier.
  email text,
  -- Intitulé libre affiché sous le nom ("Courtier", "Gestionnaire sinistres").
  role_label text,
  -- Ordre d'affichage dans le sélecteur et le menu de bascule.
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists broker_profiles_organization_id_idx
  on public.broker_profiles(organization_id);

-- Une adresse ne peut désigner qu'un seul profil dans un cabinet : c'est ce qui
-- rend le rattachement des emails déterministe.
create unique index if not exists broker_profiles_org_email_key
  on public.broker_profiles(organization_id, lower(email))
  where email is not null;

-- ---------------------------------------------------------------------------
-- Rattachement des enregistrements au profil actif
--
-- Toutes ces colonnes sont NULLABLE et en `on delete set null` : les données
-- existantes n'ont pas de profil (elles précèdent la fonctionnalité) et la
-- suppression d'un profil ne doit jamais emporter un dossier client.
-- ---------------------------------------------------------------------------
alter table public.broker_clients
  add column if not exists profile_id uuid references public.broker_profiles(id) on delete set null;
alter table public.broker_activity
  add column if not exists profile_id uuid references public.broker_profiles(id) on delete set null;
alter table public.broker_documents
  add column if not exists profile_id uuid references public.broker_profiles(id) on delete set null;
alter table public.broker_advice
  add column if not exists profile_id uuid references public.broker_profiles(id) on delete set null;
alter table public.broker_email_digests
  add column if not exists profile_id uuid references public.broker_profiles(id) on delete set null;

-- La boîte email appartient au profil, pas au compte partagé : trois profils =
-- trois connexions distinctes sous le même utilisateur Supabase.
alter table public.email_connections
  add column if not exists profile_id uuid references public.broker_profiles(id) on delete cascade;

create index if not exists broker_clients_profile_id_idx
  on public.broker_clients(profile_id);
create index if not exists broker_activity_profile_id_idx
  on public.broker_activity(profile_id);
create index if not exists broker_email_digests_profile_id_idx
  on public.broker_email_digests(profile_id);
create index if not exists email_connections_profile_id_idx
  on public.email_connections(profile_id);

-- ---------------------------------------------------------------------------
-- Droits
--
-- Une table fraîchement créée n'hérite d'aucun privilège pour les rôles de
-- l'application : sans ce bloc, PostgREST répond « permission denied » (42501)
-- et la RLS n'est même pas atteinte. Les autres tables du module les déclarent
-- de la même façon.
-- ---------------------------------------------------------------------------
grant select, insert, update, delete on public.broker_profiles to authenticated;
grant select, insert, update, delete on public.broker_profiles to service_role;

-- ---------------------------------------------------------------------------
-- RLS — même contrat que les autres tables broker : cloisonnement par
-- organisation, écriture réservée aux non-lecteurs.
-- ---------------------------------------------------------------------------
alter table public.broker_profiles enable row level security;

do $$
declare
  tbl text := 'broker_profiles';
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public'
      and tablename = tbl
      and policyname = 'Active members can select organization broker_profiles'
  ) then
    execute format(
      'create policy %I on public.%I for select to authenticated using ('
      || 'exists (select 1 from public.organization_members om '
      || 'where om.organization_id = %I.organization_id '
      || 'and om.user_id = (select auth.uid()) and om.status = ''active''))',
      'Active members can select organization broker_profiles', tbl, tbl
    );
  end if;

  if not exists (
    select 1 from pg_policies where schemaname = 'public'
      and tablename = tbl
      and policyname = 'Active non-viewers can insert organization broker_profiles'
  ) then
    execute format(
      'create policy %I on public.%I for insert to authenticated with check ('
      || 'exists (select 1 from public.organization_members om '
      || 'where om.organization_id = %I.organization_id '
      || 'and om.user_id = (select auth.uid()) and om.status = ''active'' '
      || 'and om.role in (''owner'', ''manager'', ''member'')))',
      'Active non-viewers can insert organization broker_profiles', tbl, tbl
    );
  end if;

  if not exists (
    select 1 from pg_policies where schemaname = 'public'
      and tablename = tbl
      and policyname = 'Active non-viewers can update organization broker_profiles'
  ) then
    execute format(
      'create policy %I on public.%I for update to authenticated using ('
      || 'exists (select 1 from public.organization_members om '
      || 'where om.organization_id = %I.organization_id '
      || 'and om.user_id = (select auth.uid()) and om.status = ''active'' '
      || 'and om.role in (''owner'', ''manager'', ''member'')))',
      'Active non-viewers can update organization broker_profiles', tbl, tbl
    );
  end if;

  if not exists (
    select 1 from pg_policies where schemaname = 'public'
      and tablename = tbl
      and policyname = 'Active non-viewers can delete organization broker_profiles'
  ) then
    execute format(
      'create policy %I on public.%I for delete to authenticated using ('
      || 'exists (select 1 from public.organization_members om '
      || 'where om.organization_id = %I.organization_id '
      || 'and om.user_id = (select auth.uid()) and om.status = ''active'' '
      || 'and om.role in (''owner'', ''manager'', ''member'')))',
      'Active non-viewers can delete organization broker_profiles', tbl, tbl
    );
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Unicité des connexions email
--
-- L'index d'origine (organization_id, user_id, provider) interdisait deux
-- boîtes du même fournisseur pour un utilisateur. Avec les profils c'est
-- précisément ce qu'on veut : un cabinet = un compte, trois profils, trois
-- boîtes IMAP. On étend donc la clé au profil.
--
-- coalesce() plutôt que le NULL brut : en SQL deux NULL sont distincts, ce qui
-- rouvrirait la porte aux doublons sur les espaces sans profil (SaaS dossiers).
-- ---------------------------------------------------------------------------
drop index if exists public.email_connections_user_provider_idx;

create unique index if not exists email_connections_user_provider_profile_idx
  on public.email_connections(
    organization_id,
    user_id,
    provider,
    coalesce(profile_id, '00000000-0000-0000-0000-000000000000'::uuid)
  );
