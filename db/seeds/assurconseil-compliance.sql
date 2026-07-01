-- Seed : fiche d'information cabinet — Assur Conseil Niçois (courtier sur mesure)
-- Données extraites des documents officiels du cabinet, CORRIGÉES :
--   • CGPA : 125 rue de la Faisanderie (adresse à jour, l'« entrée en relation » était périmée)
--   • ORIAS : 15006204 (le « 156 06204 » était une coquille)
--   • Articles : L.521-x (la fiche « mentions » citait les anciens L.520-1 d'avant la DDA 2018)
--   • Coquilles e-mails nettoyées
--
-- Données *tenant* (pas du schéma) → fichier de SEED, à exécuter UNE FOIS, hors migrations.
--
-- 1) Récupérer l'organization_id du cabinet :
--      SELECT id, name FROM organizations WHERE name ILIKE '%assur%conseil%';
-- 2) Remplacer :ORG_ID ci-dessous, puis exécuter ce fichier.

\set ORG_ID '84cc9847-7e99-4773-8641-1230708726c4'

UPDATE organizations
SET broker_settings = COALESCE(broker_settings, '{}'::jsonb) || jsonb_build_object(
  'compliance', $compliance$
{
  "legalName": "Assur Conseil Niçois",
  "legalForm": "SARL",
  "capital": "1 000 €",
  "siren": "813 469 210 00013",
  "rcsCity": "Nice",
  "address": "1015 chemin de la Gorghetta, 06670 Levens",
  "email": "contact@assurconseilnicois.com",
  "phone": "07 68 77 60 17",
  "website": "www.assurconseilnicois.com",
  "manager": "Frank Lejeune",
  "logoUrl": "/brand/assurconseil-logo.png",
  "oriasNumber": "15006204",
  "oriasCategories": "Courtier d'assurance (catégorie B)",
  "adviceScope": "Assur Conseil Niçois exerce son activité en application de l'article L.521-2 II b) du Code des assurances : il n'est pas soumis à une obligation contractuelle de travailler exclusivement avec une ou plusieurs compagnies d'assurance et son analyse se fonde sur un nombre restreint de contrats présents sur le marché. La liste des compagnies partenaires est disponible sur demande.",
  "financialLinks": "Participation financière ou capitalistique : aucune compagnie d'assurance ne détient, directement ou indirectement, plus de 10 % des droits de vote du cabinet ; le cabinet ne détient pas, directement ou indirectement, plus de 10 % des droits de vote d'une compagnie d'assurance (Néant).",
  "remuneration": "Pour la distribution de ses contrats, le cabinet est rémunéré sur la base : d'honoraires payés directement par le souscripteur ou l'adhérent ; de commissions incluses dans la prime d'assurance ; de tout autre avantage économique lié à la distribution du contrat ; ou d'une combinaison de ces modes de rémunération. Le montant des honoraires perçus s'élève à un pourcentage de la prime hors taxe variable selon la compagnie ou le type de contrat.",
  "rcpInsurer": "CGPA",
  "rcpInsurerAddress": "125 rue de la Faisanderie, CS 31666, 75773 Paris cedex 16",
  "rcpReference": "RCP60813",
  "financialGuarantee": "Garantie financière CGPA — police GFI60813",
  "acprStatement": "Sous le contrôle de l'Autorité de Contrôle Prudentiel et de Résolution (ACPR), 4 place de Budapest, CS 92459, 75436 Paris Cedex 09.",
  "claimsAddress": "Assur Conseil Niçois — Service Réclamation, 1015 chemin de la Gorghetta, 06670 Levens",
  "claimsEmail": "reclamation@assurconseilnicois.com",
  "claimsDelay": "Réclamations traitées sous 1 mois",
  "mediatorName": "La Médiation de l'Assurance",
  "mediatorAddress": "Pôle CSCA, TSA 50110, 75441 Paris CEDEX 09",
  "mediatorEmail": "le.mediateur@mediation-assurance.org",
  "mediatorUrl": "https://www.mediation-assurance.org",
  "dpoMode": "none",
  "dpoContact": ""
}
$compliance$::jsonb,
  'partnerInsurers', $partners$
["Add Value","Aleade","Alptis","Apivia","April","ARB","Camacte","Cegema","CFDP","Chubb","Le Courtier du Motard","ECA","Entoria","Generali","Helvetia","Henner","Hiscox","Izeho","Leader Underwriting","Malakoff Humanis","Mondial Assistance","MS Amlin","Netvox","Sollyazar","SPVIE","Suisscourtage","Tetris Assurance"]
$partners$::jsonb
)
WHERE id = :'ORG_ID'
  AND workspace_type = 'insurance_broker';
