import type { BrokerClientRow } from "@/types/database";

// ---------------------------------------------------------------------------
// Pipeline statuses
// ---------------------------------------------------------------------------
export const brokerClientStatuses = [
  "new",
  "in_progress",
  "advice_ready",
  "awaiting_signature",
  "signed",
  "closed",
  "lost",
] as const;

export type BrokerClientStatus = (typeof brokerClientStatuses)[number];

export const brokerClientStatusLabels: Record<BrokerClientStatus, string> = {
  new: "Nouveau",
  in_progress: "En cours",
  advice_ready: "Devoir de conseil prêt",
  awaiting_signature: "Signature en attente",
  signed: "Signé",
  closed: "Clôturé",
  lost: "Perdu",
};

/** Maps a status to a design-token tone used by the status badge. */
export const brokerClientStatusTone: Record<
  BrokerClientStatus,
  "neutral" | "info" | "accent" | "warning" | "success" | "muted"
> = {
  new: "info",
  in_progress: "accent",
  advice_ready: "accent",
  awaiting_signature: "warning",
  signed: "success",
  closed: "muted",
  lost: "muted",
};

export function isBrokerClientStatus(
  value: string,
): value is BrokerClientStatus {
  return (brokerClientStatuses as readonly string[]).includes(value);
}

// ---------------------------------------------------------------------------
// Insurance branches
// ---------------------------------------------------------------------------
export const brokerInsuranceTypes = [
  "auto",
  "habitation",
  "sante",
  "prevoyance",
  "emprunteur",
  "pro",
  "epargne",
  "autre",
] as const;

export type BrokerInsuranceType = (typeof brokerInsuranceTypes)[number];

export const brokerInsuranceTypeLabels: Record<BrokerInsuranceType, string> = {
  auto: "Auto",
  habitation: "Habitation",
  sante: "Santé / Mutuelle",
  prevoyance: "Prévoyance",
  emprunteur: "Emprunteur",
  pro: "Professionnelle",
  epargne: "Épargne / Retraite",
  autre: "Autre",
};

export function insuranceTypeLabel(value: string | null | undefined): string {
  if (!value) return "—";
  return (
    brokerInsuranceTypeLabels[value as BrokerInsuranceType] ?? value
  );
}

// ---------------------------------------------------------------------------
// Display helpers
// ---------------------------------------------------------------------------
export function brokerClientDisplayName(
  client: Pick<
    BrokerClientRow,
    "client_type" | "first_name" | "last_name" | "company_name"
  >,
): string {
  if (client.client_type === "company") {
    return client.company_name?.trim() || "Client sans nom";
  }
  const full = [client.first_name, client.last_name]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(" ");
  return full || client.company_name?.trim() || "Client sans nom";
}

export function brokerClientInitials(name: string): string {
  return (
    name
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part.at(0)?.toUpperCase() ?? "")
      .join("") || "?"
  );
}
