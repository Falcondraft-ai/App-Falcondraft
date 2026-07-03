export const brokerQuoteStatuses = [
  "pending",
  "extracted",
  "validated",
  "failed",
] as const;

export type BrokerQuoteStatus = (typeof brokerQuoteStatuses)[number];

export const brokerQuoteStatusLabels: Record<BrokerQuoteStatus, string> = {
  pending: "À vérifier",
  extracted: "Extrait — à valider",
  validated: "Validé",
  failed: "Extraction échouée",
};

export const brokerQuoteStatusTone: Record<
  BrokerQuoteStatus,
  "draft" | "review" | "signed" | "error"
> = {
  pending: "review",
  extracted: "draft",
  validated: "signed",
  failed: "error",
};

export function isBrokerQuoteStatus(value: string): value is BrokerQuoteStatus {
  return (brokerQuoteStatuses as readonly string[]).includes(value);
}

export function formatPremium(
  amount: number | null | undefined,
  currency?: string | null,
): string {
  if (amount === null || amount === undefined) return "—";
  const code = currency?.trim() || "EUR";
  try {
    return new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency: code,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${amount} ${code}`;
  }
}
