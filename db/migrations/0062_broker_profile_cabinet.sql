-- ============================================================================
-- 0062_broker_profile_cabinet
--
-- Une fiche cabinet par profil.
--
-- Un même compte peut abriter plusieurs SOCIÉTÉS de courtage : chez le premier
-- client, le gérant, son frère et une associée exercent chacun sous leur propre
-- raison sociale, leur propre n° ORIAS et leur propre RCP. Le devoir de conseil
-- doit porter l'identité de la société qui conseille — jamais celle du voisin
-- de bureau.
--
-- La fiche (même forme que organizations.broker_settings.compliance, cf.
-- CabinetComplianceInfo) vit donc sur le profil. NULL = pas de fiche propre :
-- les documents de ce profil reprennent la fiche du cabinet. Le choix de la
-- fiche se fait dans lib/broker/cabinet.ts.
--
-- Pas de nouvelle politique : la ligne est déjà cloisonnée par organisation
-- (0057), et la colonne hérite des droits de la table.
-- ============================================================================

alter table public.broker_profiles
  add column if not exists cabinet jsonb;

comment on column public.broker_profiles.cabinet is
  'Fiche cabinet (CabinetComplianceInfo) de la société sous laquelle ce profil exerce. NULL = fiche de l''organisation.';
