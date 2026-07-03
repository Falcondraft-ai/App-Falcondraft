export const brokerAdviceStatuses = [
  "draft",
  "validated",
  "sent_for_signature",
  "signed",
] as const;

export type BrokerAdviceStatus = (typeof brokerAdviceStatuses)[number];

export const brokerAdviceStatusLabels: Record<BrokerAdviceStatus, string> = {
  draft: "Brouillon",
  validated: "Validé",
  sent_for_signature: "Envoyé en signature",
  signed: "Signé",
};

export const brokerAdviceStatusTone: Record<
  BrokerAdviceStatus,
  "draft" | "review" | "sent" | "signed"
> = {
  draft: "draft",
  validated: "review",
  sent_for_signature: "sent",
  signed: "signed",
};

export function isBrokerAdviceStatus(value: string): value is BrokerAdviceStatus {
  return (brokerAdviceStatuses as readonly string[]).includes(value);
}
