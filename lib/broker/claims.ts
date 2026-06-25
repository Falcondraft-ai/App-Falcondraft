import type { BrokerClaimRow } from "@/types/database";

export const brokerClaimStatuses = [
  "declared",
  "in_progress",
  "awaiting_docs",
  "settled",
  "closed",
  "rejected",
] as const;

export type BrokerClaimStatus = (typeof brokerClaimStatuses)[number];

export const brokerClaimStatusLabels: Record<BrokerClaimStatus, string> = {
  declared: "Déclaré",
  in_progress: "En cours d’instruction",
  awaiting_docs: "En attente de pièces",
  settled: "Indemnisé",
  closed: "Clos",
  rejected: "Refusé",
};

export const brokerClaimStatusTone: Record<
  BrokerClaimStatus,
  "draft" | "review" | "sent" | "signed" | "archived" | "error"
> = {
  declared: "review",
  in_progress: "sent",
  awaiting_docs: "draft",
  settled: "signed",
  closed: "archived",
  rejected: "error",
};

export function isBrokerClaimStatus(value: string): value is BrokerClaimStatus {
  return (brokerClaimStatuses as readonly string[]).includes(value);
}

/** A claim still being actively handled (vs settled/closed/rejected). */
export function isClaimOpen(status: string): boolean {
  return (
    status === "declared" ||
    status === "in_progress" ||
    status === "awaiting_docs"
  );
}

export const openClaimStatuses: BrokerClaimStatus[] = [
  "declared",
  "in_progress",
  "awaiting_docs",
];

/** Common claim natures, offered as quick suggestions in the form. */
export const commonClaimTypes = [
  "Dégât des eaux",
  "Incendie",
  "Vol / cambriolage",
  "Bris de glace",
  "Accident automobile",
  "Catastrophe naturelle",
  "Responsabilité civile",
  "Dommages électriques",
  "Décès",
  "Arrêt de travail",
  "Autre",
];

export function claimDisplayLabel(
  claim: Pick<BrokerClaimRow, "claim_type">,
): string {
  return claim.claim_type?.trim() || "Sinistre";
}
