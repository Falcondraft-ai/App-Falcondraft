import type { BrokerComplianceRow } from "@/types/database";

// ---------------------------------------------------------------------------
// LCB-FT risk classification
// ---------------------------------------------------------------------------
export const brokerRiskLevels = ["low", "standard", "high"] as const;

export type BrokerRiskLevel = (typeof brokerRiskLevels)[number];

export const brokerRiskLevelLabels: Record<BrokerRiskLevel, string> = {
  low: "Risque faible",
  standard: "Risque standard",
  high: "Risque élevé",
};

export const brokerRiskLevelTone: Record<
  BrokerRiskLevel,
  { fg: string; bg: string; bd: string }
> = {
  low: {
    fg: "var(--success, #15803d)",
    bg: "var(--success-soft, #f0fdf4)",
    bd: "rgba(21,128,61,0.2)",
  },
  standard: {
    fg: "var(--brand-navy-700)",
    bg: "var(--brand-navy-50)",
    bd: "var(--border-1)",
  },
  high: {
    fg: "var(--destructive)",
    bg: "var(--destructive-soft, rgba(185,28,28,0.08))",
    bd: "rgba(185,28,28,0.2)",
  },
};

export function isBrokerRiskLevel(value: string): value is BrokerRiskLevel {
  return (brokerRiskLevels as readonly string[]).includes(value);
}

export function riskLevelLabel(value: string | null | undefined): string {
  if (!value) return "Non évalué";
  return brokerRiskLevelLabels[value as BrokerRiskLevel] ?? value;
}

// ---------------------------------------------------------------------------
// Per-client compliance completeness
// ---------------------------------------------------------------------------
export type ComplianceStatus = {
  identityOk: boolean;
  riskOk: boolean;
  consentOk: boolean;
  ddaOk: boolean;
  completedCount: number;
  totalCount: number;
  /** True when every mandatory pillar is satisfied. */
  complete: boolean;
  /** Human labels for the pillars still missing. */
  missing: string[];
};

/**
 * Evaluates the four mandatory pillars of a client compliance record. A null
 * record (never started) counts as fully incomplete.
 */
export function computeComplianceStatus(
  record: BrokerComplianceRow | null,
): ComplianceStatus {
  const identityOk = Boolean(record?.identity_verified);
  const riskOk = Boolean(record?.risk_level);
  const consentOk = Boolean(record?.consent_data_processing);
  const ddaOk = Boolean(record?.info_sheet_delivered);

  const pillars: { ok: boolean; label: string }[] = [
    { ok: ddaOk, label: "Fiche d’information (DDA)" },
    { ok: identityOk, label: "Identité vérifiée (LCB-FT)" },
    { ok: riskOk, label: "Classification du risque (LCB-FT)" },
    { ok: consentOk, label: "Consentement RGPD" },
  ];

  const completedCount = pillars.filter((p) => p.ok).length;

  return {
    identityOk,
    riskOk,
    consentOk,
    ddaOk,
    completedCount,
    totalCount: pillars.length,
    complete: completedCount === pillars.length,
    missing: pillars.filter((p) => !p.ok).map((p) => p.label),
  };
}

export type ComplianceLevel = "complete" | "partial" | "empty";

export function complianceLevel(status: ComplianceStatus): ComplianceLevel {
  if (status.complete) return "complete";
  if (status.completedCount > 0) return "partial";
  return "empty";
}

export const complianceLevelLabels: Record<ComplianceLevel, string> = {
  complete: "Conforme",
  partial: "À compléter",
  empty: "Non démarré",
};

export const complianceLevelTone: Record<
  ComplianceLevel,
  { fg: string; bg: string; bd: string }
> = {
  complete: {
    fg: "var(--success, #15803d)",
    bg: "var(--success-soft, #f0fdf4)",
    bd: "rgba(21,128,61,0.2)",
  },
  partial: {
    fg: "var(--brand-amber-800, #92610f)",
    bg: "var(--brand-amber-50, #fdf7e8)",
    bd: "var(--brand-amber-200, rgba(184,146,42,0.25))",
  },
  empty: {
    fg: "var(--fg-3)",
    bg: "var(--bg-sunken)",
    bd: "var(--border-1)",
  },
};

// ---------------------------------------------------------------------------
// Cabinet-level "fiche d'information" (DDA) — stored on broker_settings.compliance
// ---------------------------------------------------------------------------
export type CabinetComplianceInfo = {
  // Identité
  legalName: string;
  legalForm: string;
  capital: string;
  siren: string;
  rcsCity: string;
  address: string;
  email: string;
  phone: string;
  website: string;
  manager: string;
  /** Chemin/URL du logo cabinet (asset public ou Storage). Non éditable ici. */
  logoUrl: string;
  // Immatriculation & garanties
  oriasNumber: string;
  oriasCategories: string;
  adviceScope: string;
  financialLinks: string;
  remuneration: string;
  rcpInsurer: string;
  rcpInsurerAddress: string;
  rcpReference: string;
  financialGuarantee: string;
  acprStatement: string;
  // Réclamation & médiation
  claimsAddress: string;
  claimsEmail: string;
  claimsDelay: string;
  mediatorName: string;
  mediatorAddress: string;
  mediatorEmail: string;
  mediatorUrl: string;
  // RGPD
  /** "none" | "external" | "internal" */
  dpoMode: string;
  dpoContact: string;
};

export type CabinetFieldGroup =
  | "identity"
  | "regulatory"
  | "recourse"
  | "rgpd";

export const cabinetComplianceFields: {
  key: keyof CabinetComplianceInfo;
  label: string;
  placeholder: string;
  group: CabinetFieldGroup;
  multiline?: boolean;
  type?: "text" | "textarea" | "select";
  options?: { value: string; label: string }[];
}[] = [
  // --- Identité ---
  {
    key: "legalName",
    label: "Dénomination du cabinet",
    placeholder: "Ex. Cabinet Martin Assurances",
    group: "identity",
  },
  {
    key: "legalForm",
    label: "Forme juridique",
    placeholder: "Ex. SARL, SAS, EI",
    group: "identity",
  },
  {
    key: "capital",
    label: "Capital social",
    placeholder: "Ex. 1 000 €",
    group: "identity",
  },
  {
    key: "siren",
    label: "SIREN / SIRET",
    placeholder: "Ex. 812 345 678 00013",
    group: "identity",
  },
  {
    key: "rcsCity",
    label: "Ville du RCS",
    placeholder: "Ex. Nice",
    group: "identity",
  },
  {
    key: "address",
    label: "Adresse du siège",
    placeholder: "12 rue des Lilas, 75011 Paris",
    group: "identity",
  },
  {
    key: "email",
    label: "Email de contact",
    placeholder: "contact@cabinet.fr",
    group: "identity",
  },
  {
    key: "phone",
    label: "Téléphone",
    placeholder: "01 23 45 67 89",
    group: "identity",
  },
  {
    key: "website",
    label: "Site web",
    placeholder: "www.cabinet.fr",
    group: "identity",
  },
  {
    key: "manager",
    label: "Représentant légal / gérant",
    placeholder: "Ex. Prénom Nom",
    group: "identity",
  },
  // --- Immatriculation & garanties ---
  {
    key: "oriasNumber",
    label: "N° ORIAS",
    placeholder: "Ex. 16001234",
    group: "regulatory",
  },
  {
    key: "oriasCategories",
    label: "Catégorie d’immatriculation ORIAS",
    placeholder: "Ex. Courtier d’assurance (catégorie B)",
    group: "regulatory",
  },
  {
    key: "adviceScope",
    label: "Modalités d’exercice / base du conseil",
    placeholder:
      "Ex. Exerce selon l’article L.521-2 II b) du Code des assurances ; analyse fondée sur un nombre restreint de contrats.",
    group: "regulatory",
    multiline: true,
  },
  {
    key: "financialLinks",
    label: "Liens financiers avec les compagnies",
    placeholder:
      "Ex. Aucune compagnie ne détient plus de 10 % du cabinet ; le cabinet ne détient pas plus de 10 % d’une compagnie (Néant).",
    group: "regulatory",
    multiline: true,
  },
  {
    key: "remuneration",
    label: "Mode de rémunération",
    placeholder:
      "Ex. Honoraires payés par le client, commissions incluses dans la prime…",
    group: "regulatory",
    multiline: true,
  },
  {
    key: "rcpInsurer",
    label: "Assureur responsabilité civile professionnelle (RCP)",
    placeholder: "Ex. CGPA",
    group: "regulatory",
  },
  {
    key: "rcpInsurerAddress",
    label: "Adresse de l’assureur RCP",
    placeholder: "Ex. 125 rue de la Faisanderie, 75116 Paris",
    group: "regulatory",
  },
  {
    key: "rcpReference",
    label: "N° de police RCP",
    placeholder: "Ex. RCP00000",
    group: "regulatory",
  },
  {
    key: "financialGuarantee",
    label: "Garantie financière",
    placeholder: "Ex. Police GFI00000",
    group: "regulatory",
  },
  {
    key: "acprStatement",
    label: "Autorité de contrôle (ACPR)",
    placeholder:
      "Sous le contrôle de l’ACPR — 4 place de Budapest, CS 92459, 75436 Paris Cedex 09",
    group: "regulatory",
    multiline: true,
  },
  // --- Réclamation & médiation ---
  {
    key: "claimsAddress",
    label: "Adresse du service réclamation",
    placeholder: "Service Réclamation, 12 rue des Lilas, 75011 Paris",
    group: "recourse",
    multiline: true,
  },
  {
    key: "claimsEmail",
    label: "Email réclamation",
    placeholder: "reclamation@cabinet.fr",
    group: "recourse",
  },
  {
    key: "claimsDelay",
    label: "Délai de traitement des réclamations",
    placeholder: "Ex. 1 mois",
    group: "recourse",
  },
  {
    key: "mediatorName",
    label: "Médiateur de l’assurance",
    placeholder: "Ex. La Médiation de l’Assurance",
    group: "recourse",
  },
  {
    key: "mediatorAddress",
    label: "Adresse du médiateur",
    placeholder: "Pôle CSCA, TSA 50110, 75441 Paris CEDEX 09",
    group: "recourse",
    multiline: true,
  },
  {
    key: "mediatorEmail",
    label: "Email du médiateur",
    placeholder: "le.mediateur@mediation-assurance.org",
    group: "recourse",
  },
  {
    key: "mediatorUrl",
    label: "Site du médiateur",
    placeholder: "https://www.mediation-assurance.org",
    group: "recourse",
  },
  // --- RGPD ---
  {
    key: "dpoMode",
    label: "Délégué à la protection des données (DPO)",
    placeholder: "",
    group: "rgpd",
    type: "select",
    options: [
      { value: "none", label: "Aucun DPO désigné" },
      { value: "external", label: "DPO externe" },
      { value: "internal", label: "DPO interne" },
    ],
  },
  {
    key: "dpoContact",
    label: "Coordonnées du DPO (si applicable)",
    placeholder: "Nom + email du délégué",
    group: "rgpd",
  },
];

export function emptyCabinetComplianceInfo(): CabinetComplianceInfo {
  return {
    legalName: "",
    legalForm: "",
    capital: "",
    siren: "",
    rcsCity: "",
    address: "",
    email: "",
    phone: "",
    website: "",
    manager: "",
    logoUrl: "",
    oriasNumber: "",
    oriasCategories: "",
    adviceScope: "",
    financialLinks: "",
    remuneration: "",
    rcpInsurer: "",
    rcpInsurerAddress: "",
    rcpReference: "",
    financialGuarantee: "",
    acprStatement: "",
    claimsAddress: "",
    claimsEmail: "",
    claimsDelay: "",
    mediatorName: "",
    mediatorAddress: "",
    mediatorEmail: "",
    mediatorUrl: "",
    dpoMode: "none",
    dpoContact: "",
  };
}

/** True when the essential cabinet fiche-d'information fields are filled. */
export function isCabinetComplianceComplete(
  info: CabinetComplianceInfo,
): boolean {
  return Boolean(
    info.legalName.trim() &&
      info.oriasNumber.trim() &&
      info.rcpInsurer.trim(),
  );
}
