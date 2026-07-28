import {
  brokerClientDisplayName,
  insuranceTypeLabel,
} from "@/lib/broker/clients";
import type { CabinetComplianceInfo } from "@/lib/broker/compliance";
import { summarizeStructuredNeeds } from "@/lib/broker/needs";
import { formatPremium } from "@/lib/broker/quotes";
import type { BrokerClientRow, BrokerQuoteRow } from "@/types/database";

/** Cabinet fiche-d'information + the partner-insurers list (both from settings). */
export type CabinetInfo = CabinetComplianceInfo & { partnerInsurers: string[] };

export type AdviceProposition = {
  insurer: string | null;
  product: string | null;
  premium: string | null;
  coverage: string | null;
  deductible: string | null;
  vigilance: string | null;
  other: string | null;
};

export type AdviceDocumentData = {
  cabinet: CabinetInfo;
  isCompany: boolean;
  clientName: string;
  client: {
    firstName: string | null;
    lastName: string | null;
    companyName: string | null;
    address: string | null;
    birthDate: string | null;
    birthCountry: string | null;
    /** "Oui" / "Non" (from compliance) — omitted from the PDF when unknown. */
    pep: string | null;
    email: string | null;
    phone: string | null;
  };
  branchLabel: string | null;
  /** Which line of the model's IARD product checklist to tick. */
  product: { checkedLabel: string | null; otherText: string | null };
  needsText: string | null;
  structuredNeeds: string[];
  proposition: AdviceProposition | null;
  justification: string;
  date: string;
};

/** Maps our coarse branches onto the model's fine-grained IARD product list.
 *  Only unambiguous matches are auto-ticked; the rest go to "Autres". */
const PRODUCT_BY_BRANCH: Record<string, string> = {
  auto: "Assurance automobile",
};

export function frenchDate(value?: string | Date | null): string {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

function composeAddress(client: BrokerClientRow): string | null {
  const cityLine = [client.postal_code, client.city]
    .filter((p) => p && String(p).trim().length > 0)
    .join(" ");
  const parts = [client.address, cityLine].filter(
    (p) => p && String(p).trim().length > 0,
  );
  return parts.length > 0 ? parts.join(", ") : null;
}

/**
 * Drops the scaffold lines the broker never replaced — « - [Motif 1 : …] ».
 * The editor may show them as guidance, but a bracketed placeholder must never
 * reach a document handed to a client.
 */
function stripPlaceholderLines(text: string): string {
  return text
    .split("\n")
    .filter((line) => {
      const bare = line.trim().replace(/^[-–•·]\s*/, "");
      return !(bare.startsWith("[") && bare.endsWith("]"));
    })
    .join("\n")
    .trim();
}

function quotePremium(quote: BrokerQuoteRow): string | null {
  if (quote.premium_monthly != null) {
    const monthly = `${formatPremium(quote.premium_monthly, quote.currency)} / mois`;
    return quote.premium_annual != null
      ? `${monthly} (${formatPremium(quote.premium_annual, quote.currency)} / an)`
      : monthly;
  }
  if (quote.premium_annual != null) {
    return `${formatPremium(quote.premium_annual, quote.currency)} / an`;
  }
  return null;
}

/**
 * Assembles every field the legal PDFs need from live data. Pure & deterministic
 * — no AI, no I/O. The only free-text input is `justification` (the editable
 * "motifs", optionally AI-drafted and always broker-reviewed).
 */
export function buildAdviceDocumentData(input: {
  cabinet: CabinetInfo;
  client: BrokerClientRow;
  quote: BrokerQuoteRow | null;
  justification: string;
  date?: string | null;
  /** AI-generated "exigences en termes de garantie" (bullets), from the quote. */
  requirements?: string | null;
  /** Identity extras not on the client row (omitted from the PDF when absent). */
  birthCountry?: string | null;
  pep?: string | null;
}): AdviceDocumentData {
  const { cabinet, client, quote } = input;
  const isCompany = client.client_type === "company";
  const branch = insuranceTypeLabel(client.insurance_type);

  const proposition: AdviceProposition | null = quote
    ? {
        insurer: quote.insurer_name,
        product: quote.product_name,
        premium: quotePremium(quote),
        coverage: quote.coverage_summary,
        deductible: quote.deductible,
        vigilance: quote.vigilance_points,
        other: quote.other_info,
      }
    : null;

  return {
    cabinet,
    isCompany,
    clientName: brokerClientDisplayName(client),
    client: {
      firstName: client.first_name,
      lastName: client.last_name,
      companyName: client.company_name,
      address: composeAddress(client),
      birthDate: client.date_of_birth ? frenchDate(client.date_of_birth) : null,
      birthCountry: input.birthCountry ?? null,
      pep: input.pep ?? null,
      email: client.email,
      phone: client.phone,
    },
    branchLabel: branch && branch !== "—" ? branch : null,
    product: (() => {
      const checked = client.insurance_type
        ? (PRODUCT_BY_BRANCH[client.insurance_type] ?? null)
        : null;
      const label = branch && branch !== "—" ? branch : null;
      return { checkedLabel: checked, otherText: checked ? null : label };
    })(),
    needsText: client.notes?.trim() || client.needs?.trim() || null,
    // Prefer the AI-generated exigences (from the quote); else the questionnaire.
    structuredNeeds: (() => {
      const aiExigences = (input.requirements ?? "")
        .split("\n")
        .map((l) => l.trim().replace(/^[-–•·]\s*/, ""))
        .filter((l) => l.length > 0);
      return aiExigences.length > 0
        ? aiExigences
        : summarizeStructuredNeeds(
            client.insurance_type,
            client.structured_needs,
          );
    })(),
    proposition,
    justification: stripPlaceholderLines(input.justification ?? ""),
    date: frenchDate(input.date ?? undefined),
  };
}

// ---------------------------------------------------------------------------
// Missing information — surfaced to the broker BEFORE generating
// ---------------------------------------------------------------------------
/** Where the broker has to go to fill a missing piece of information. */
export type AdviceGapTarget = "client" | "quote" | "justification";

export type AdviceGap = { label: string; target: AdviceGapTarget };

/**
 * Lists what the devoir de conseil will NOT contain, so the broker can decide
 * knowingly: fill it in, or hand over a document without that line. The PDF
 * itself never shows a "[à compléter]" marker — hence this checklist.
 */
export function listAdviceGaps(input: {
  client: BrokerClientRow;
  quote: BrokerQuoteRow | null;
  justification: string;
  requirements?: string | null;
  birthCountry?: string | null;
  pep?: string | null;
}): AdviceGap[] {
  const { client, quote } = input;
  const gaps: AdviceGap[] = [];
  const missing = (value: unknown) =>
    value == null || String(value).trim().length === 0;

  // I — Identité
  if (missing(client.address) && missing(client.postal_code) && missing(client.city)) {
    gaps.push({ label: "Adresse du client", target: "client" });
  }
  if (missing(client.email)) gaps.push({ label: "Email", target: "client" });
  if (missing(client.phone)) gaps.push({ label: "Téléphone", target: "client" });
  if (client.client_type !== "company") {
    if (missing(client.date_of_birth)) {
      gaps.push({ label: "Date de naissance", target: "client" });
    }
    if (missing(input.birthCountry)) {
      gaps.push({ label: "Pays de naissance", target: "client" });
    }
    if (missing(input.pep)) {
      gaps.push({
        label: "Personne politiquement exposée (conformité)",
        target: "client",
      });
    }
  }

  // II — Exigences de garantie
  const hasRequirements =
    (input.requirements ?? "").trim().length > 0 ||
    Object.keys(client.structured_needs ?? {}).length > 0;
  if (!hasRequirements) {
    gaps.push({ label: "Exigences en termes de garantie", target: "quote" });
  }

  // III — Proposition
  if (!quote) {
    gaps.push({
      label: "Proposition (aucun devis rattaché)",
      target: "quote",
    });
  } else {
    if (missing(quote.insurer_name)) {
      gaps.push({ label: "Compagnie", target: "quote" });
    }
    if (missing(quote.product_name)) {
      gaps.push({ label: "Produit / formule", target: "quote" });
    }
    if (quote.premium_monthly == null && quote.premium_annual == null) {
      gaps.push({ label: "Cotisation", target: "quote" });
    }
    if (missing(quote.coverage_summary)) {
      gaps.push({ label: "Garanties principales", target: "quote" });
    }
    if (missing(quote.deductible)) {
      gaps.push({ label: "Franchise", target: "quote" });
    }
    if (missing(quote.vigilance_points)) {
      gaps.push({ label: "Exclusions / points de vigilance", target: "quote" });
    }
  }

  if (stripPlaceholderLines(input.justification ?? "").length === 0) {
    gaps.push({
      label: "Motifs du conseil",
      target: "justification",
    });
  }

  return gaps;
}

/**
 * Initial editable "justification" (motifs) scaffold stored on
 * broker_advice.content. The broker completes it — or an AI draft replaces it
 * (see the advice generation route). Deterministic, no AI here.
 */
export function buildAdviceJustificationDraft(): string {
  // Bullets only — the template already provides the lead-in sentence
  // ("… lequel correspond à vos besoins et exigences sur les points suivants :").
  return [
    "- [Motif 1 : adéquation des garanties au besoin principal du client]",
    "- [Motif 2 : cohérence du niveau de cotisation et de franchise]",
    "- [Motif 3 : point de vigilance, exclusion ou délai de carence signalé au client]",
  ].join("\n");
}
