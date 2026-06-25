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
  legalName: string;
  legalForm: string;
  siren: string;
  oriasNumber: string;
  oriasCategories: string;
  address: string;
  rcpInsurer: string;
  rcpReference: string;
  financialGuarantee: string;
  acprStatement: string;
  mediatorName: string;
  mediatorUrl: string;
};

export const cabinetComplianceFields: {
  key: keyof CabinetComplianceInfo;
  label: string;
  placeholder: string;
  group: "identity" | "regulatory" | "mediation";
  multiline?: boolean;
}[] = [
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
    key: "siren",
    label: "SIREN",
    placeholder: "Ex. 812 345 678",
    group: "identity",
  },
  {
    key: "address",
    label: "Adresse du cabinet",
    placeholder: "12 rue des Lilas, 75011 Paris",
    group: "identity",
  },
  {
    key: "oriasNumber",
    label: "N° ORIAS",
    placeholder: "Ex. 16001234",
    group: "regulatory",
  },
  {
    key: "oriasCategories",
    label: "Catégories d’immatriculation ORIAS",
    placeholder: "Ex. Courtier en assurance (COA)",
    group: "regulatory",
  },
  {
    key: "rcpInsurer",
    label: "Assureur responsabilité civile professionnelle (RCP)",
    placeholder: "Ex. MMA",
    group: "regulatory",
  },
  {
    key: "rcpReference",
    label: "Référence du contrat RCP",
    placeholder: "N° de police RCP",
    group: "regulatory",
  },
  {
    key: "financialGuarantee",
    label: "Garantie financière",
    placeholder: "Établissement et montant",
    group: "regulatory",
  },
  {
    key: "acprStatement",
    label: "Autorité de contrôle (ACPR)",
    placeholder:
      "Immatriculé auprès de l’ACPR — 4 place de Budapest, 75009 Paris",
    group: "regulatory",
    multiline: true,
  },
  {
    key: "mediatorName",
    label: "Médiateur de l’assurance",
    placeholder: "Ex. La Médiation de l’Assurance",
    group: "mediation",
  },
  {
    key: "mediatorUrl",
    label: "Site du médiateur",
    placeholder: "https://www.mediation-assurance.org",
    group: "mediation",
  },
];

export function emptyCabinetComplianceInfo(): CabinetComplianceInfo {
  return {
    legalName: "",
    legalForm: "",
    siren: "",
    oriasNumber: "",
    oriasCategories: "",
    address: "",
    rcpInsurer: "",
    rcpReference: "",
    financialGuarantee: "",
    acprStatement: "",
    mediatorName: "",
    mediatorUrl: "",
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
