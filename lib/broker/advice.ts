import {
  brokerClientDisplayName,
  insuranceTypeLabel,
} from "@/lib/broker/clients";
import { summarizeStructuredNeeds } from "@/lib/broker/needs";
import { formatPremium } from "@/lib/broker/quotes";
import type { BrokerClientRow, BrokerQuoteRow } from "@/types/database";

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

function frenchDate(date = new Date()): string {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

/**
 * Builds a structured "devoir de conseil" starting point from the client's
 * recorded needs and a (validated) company quote. This is a draft template the
 * broker edits and validates — not a finished legal document. No AI/n8n here.
 */
export function buildAdviceTemplate(
  client: BrokerClientRow,
  quote: BrokerQuoteRow | null,
): string {
  const name = brokerClientDisplayName(client);
  const branch =
    client.insurance_type && insuranceTypeLabel(client.insurance_type) !== "—"
      ? insuranceTypeLabel(client.insurance_type)
      : null;

  const lines: string[] = [];
  lines.push("DEVOIR DE CONSEIL");
  lines.push("");
  lines.push(`Client : ${name}`);
  if (branch) lines.push(`Besoin assurantiel : ${branch}`);
  lines.push(`Date : ${frenchDate()}`);
  lines.push("");

  lines.push("1. Situation et besoins exprimés");
  const structured = summarizeStructuredNeeds(
    client.insurance_type,
    client.structured_needs,
  );
  if (structured.length > 0) {
    lines.push("Éléments recueillis :");
    lines.push(...structured);
    lines.push("");
  }
  lines.push(
    client.needs?.trim() ||
      (structured.length === 0
        ? "[À compléter : situation du client, attentes et garanties recherchées.]"
        : ""),
  );
  lines.push("");

  lines.push("2. Solution recommandée");
  if (quote) {
    if (quote.insurer_name) lines.push(`Compagnie : ${quote.insurer_name}`);
    if (quote.product_name) lines.push(`Produit / formule : ${quote.product_name}`);
    if (quote.premium_monthly !== null) {
      lines.push(
        `Cotisation : ${formatPremium(quote.premium_monthly, quote.currency)} / mois` +
          (quote.premium_annual !== null
            ? ` (${formatPremium(quote.premium_annual, quote.currency)} / an)`
            : ""),
      );
    } else if (quote.premium_annual !== null) {
      lines.push(
        `Cotisation : ${formatPremium(quote.premium_annual, quote.currency)} / an`,
      );
    }
    if (quote.coverage_summary)
      lines.push(`Garanties principales : ${quote.coverage_summary}`);
    if (quote.deductible) lines.push(`Franchise : ${quote.deductible}`);
  } else {
    lines.push(
      "[À compléter : compagnie, produit, cotisation et garanties retenues.]",
    );
  }
  lines.push("");

  lines.push("3. Justification du conseil");
  lines.push(
    "[À compléter : expliquez en quoi la solution recommandée répond aux besoins du client, et les éventuelles alternatives écartées.]",
  );
  lines.push("");

  lines.push("4. Informations complémentaires");
  lines.push(
    "[À compléter : exclusions, délais de carence, points de vigilance signalés au client.]",
  );
  lines.push("");

  lines.push(
    "Ce devoir de conseil a été établi sur la base des informations communiquées par le client. Le client reconnaît avoir été informé des caractéristiques de la solution recommandée avant souscription.",
  );

  return lines.join("\n");
}
