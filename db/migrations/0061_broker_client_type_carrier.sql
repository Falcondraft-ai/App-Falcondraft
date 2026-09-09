-- ============================================================================
-- 0061_broker_client_type_carrier
--
-- Un troisième type de dossier : la compagnie.
--
-- Le courtier ne reçoit pas que du courrier de clients. Les compagnies, les
-- plateformes et les fournisseurs lui écrivent tous les jours, et jusqu'ici ces
-- échanges n'avaient nulle part où aller : `client_type` ne connaissait que
-- 'individual' et 'company', c'est-à-dire deux formes d'ASSURÉ. Ranger une
-- circulaire de compagnie dans un dossier « entreprise » revenait à la compter
-- comme un client de plus.
--
-- 'carrier' ouvre un dossier de correspondant : même GED, mêmes emails
-- rattachés, même historique — mais exclu du portefeuille. La couche de données
-- (lib/broker/data.ts, option `scope`) écarte ces dossiers par défaut, de sorte
-- que les compteurs du tableau de bord, la liste des clients et les exports
-- continuent de ne parler que de vrais assurés.
--
-- Rien à convertir : aucun dossier existant ne change de type.
-- ============================================================================

alter table public.broker_clients
  drop constraint if exists broker_clients_client_type_check;

alter table public.broker_clients
  add constraint broker_clients_client_type_check
    check (client_type in ('individual', 'company', 'carrier'));

-- Le portefeuille se lit presque toujours « sans les compagnies » : l'index
-- partiel évite un balayage complet sur les cabinets qui en accumulent.
create index if not exists broker_clients_real_clients_idx
  on public.broker_clients(organization_id, updated_at desc)
  where client_type <> 'carrier';
