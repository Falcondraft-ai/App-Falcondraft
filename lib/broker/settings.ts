import {
  brokerInsuranceTypes,
  type BrokerInsuranceType,
} from "@/lib/broker/clients";
import {
  emptyCabinetComplianceInfo,
  type CabinetComplianceInfo,
} from "@/lib/broker/compliance";
import type { OrganizationRow } from "@/types/database";

export type BrokerWorkspaceSettings = {
  enabledBranches: BrokerInsuranceType[];
  partnerInsurers: string[];
  /** When false, the per-client compliance (DDA/LCB-FT/RGPD) module is hidden. */
  complianceEnabled: boolean;
  compliance: CabinetComplianceInfo;
};

/** Common French insurers, offered as quick suggestions. */
export const commonInsurerSuggestions = [
  "AXA",
  "Generali",
  "Allianz",
  "MAAF",
  "MAIF",
  "Groupama",
  "Macif",
  "Matmut",
  "April",
  "Swiss Life",
  "Crédit Agricole Assurances",
  "Aviva / Abeille",
];

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === "string" && v.length > 0);
}

/**
 * Normalises organizations.broker_settings into a usable settings object.
 * An empty/absent config means "all standard branches enabled".
 */
export function parseBrokerSettings(
  organization: Pick<OrganizationRow, "broker_settings"> | null | undefined,
): BrokerWorkspaceSettings {
  const raw = (organization?.broker_settings ?? {}) as Record<string, unknown>;

  const rawBranches = asStringArray(raw.enabledBranches);
  const enabledBranches = rawBranches.filter((b): b is BrokerInsuranceType =>
    (brokerInsuranceTypes as readonly string[]).includes(b),
  );

  return {
    enabledBranches:
      enabledBranches.length > 0 ? enabledBranches : [...brokerInsuranceTypes],
    partnerInsurers: asStringArray(raw.partnerInsurers).slice(0, 60),
    // Compliance module is on by default; only an explicit `false` disables it.
    complianceEnabled: raw.complianceEnabled !== false,
    compliance: parseCabinetCompliance(raw.compliance),
  };
}

/** Normalises broker_settings.compliance into the cabinet fiche-d'information. */
export function parseCabinetCompliance(value: unknown): CabinetComplianceInfo {
  const base = emptyCabinetComplianceInfo();
  if (!value || typeof value !== "object") return base;
  const raw = value as Record<string, unknown>;
  for (const key of Object.keys(base) as (keyof CabinetComplianceInfo)[]) {
    const v = raw[key];
    if (typeof v === "string") base[key] = v.slice(0, 600);
  }
  return base;
}
