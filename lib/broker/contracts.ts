import type { BrokerContractRow } from "@/types/database";

// ---------------------------------------------------------------------------
// Contract statuses
// ---------------------------------------------------------------------------
export const brokerContractStatuses = [
  "active",
  "pending",
  "suspended",
  "terminated",
  "expired",
] as const;

export type BrokerContractStatus = (typeof brokerContractStatuses)[number];

export const brokerContractStatusLabels: Record<BrokerContractStatus, string> =
  {
    active: "En cours",
    pending: "En attente d’effet",
    suspended: "Suspendu",
    terminated: "Résilié",
    expired: "Échu",
  };

/** Maps a contract status to the shared status-badge tone family. */
export const brokerContractStatusTone: Record<
  BrokerContractStatus,
  "draft" | "review" | "sent" | "signed" | "archived" | "error"
> = {
  active: "signed",
  pending: "review",
  suspended: "draft",
  terminated: "error",
  expired: "archived",
};

export function isBrokerContractStatus(
  value: string,
): value is BrokerContractStatus {
  return (brokerContractStatuses as readonly string[]).includes(value);
}

// ---------------------------------------------------------------------------
// Premium frequencies
// ---------------------------------------------------------------------------
export const brokerPremiumFrequencies = [
  "monthly",
  "quarterly",
  "biannual",
  "annual",
  "single",
] as const;

export type BrokerPremiumFrequency = (typeof brokerPremiumFrequencies)[number];

export const brokerPremiumFrequencyLabels: Record<
  BrokerPremiumFrequency,
  string
> = {
  monthly: "Mensuelle",
  quarterly: "Trimestrielle",
  biannual: "Semestrielle",
  annual: "Annuelle",
  single: "Prime unique",
};

/** Short suffix appended to a formatted premium (e.g. "1 200 € / an"). */
export const brokerPremiumFrequencySuffix: Record<
  BrokerPremiumFrequency,
  string
> = {
  monthly: "/ mois",
  quarterly: "/ trimestre",
  biannual: "/ semestre",
  annual: "/ an",
  single: "",
};

export function isBrokerPremiumFrequency(
  value: string,
): value is BrokerPremiumFrequency {
  return (brokerPremiumFrequencies as readonly string[]).includes(value);
}

export function premiumFrequencyLabel(value: string | null | undefined): string {
  if (!value) return "—";
  return (
    brokerPremiumFrequencyLabels[value as BrokerPremiumFrequency] ?? value
  );
}

/** Annualised premium, used for portfolio totals regardless of frequency. */
export function annualisedPremium(
  amount: number | null | undefined,
  frequency: string | null | undefined,
): number {
  if (amount === null || amount === undefined || !Number.isFinite(amount)) {
    return 0;
  }
  switch (frequency) {
    case "monthly":
      return amount * 12;
    case "quarterly":
      return amount * 4;
    case "biannual":
      return amount * 2;
    case "single":
      return 0; // one-off premium does not contribute to recurring revenue
    case "annual":
    default:
      return amount;
  }
}

// ---------------------------------------------------------------------------
// Renewal window helpers
// ---------------------------------------------------------------------------
export type RenewalUrgency = "overdue" | "soon" | "upcoming" | "later" | "none";

const MS_PER_DAY = 1000 * 60 * 60 * 24;

/** Whole days from today until `date` (negative = past). null if no date. */
export function daysUntil(date: string | null | undefined): number | null {
  if (!date) return null;
  const target = new Date(`${date}T00:00:00`);
  if (Number.isNaN(target.getTime())) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - today.getTime()) / MS_PER_DAY);
}

/**
 * Classifies a renewal date into an urgency band, used to colour and group
 * the renewals view. Only contracts that are active/pending matter for renewal.
 */
export function renewalUrgency(
  contract: Pick<BrokerContractRow, "renewal_date" | "status">,
): RenewalUrgency {
  if (contract.status !== "active" && contract.status !== "pending") {
    return "none";
  }
  const days = daysUntil(contract.renewal_date);
  if (days === null) return "none";
  if (days < 0) return "overdue";
  if (days <= 30) return "soon";
  if (days <= 60) return "upcoming";
  return "later";
}

export const renewalUrgencyLabels: Record<RenewalUrgency, string> = {
  overdue: "Échéance dépassée",
  soon: "Sous 30 jours",
  upcoming: "Sous 60 jours",
  later: "Plus tard",
  none: "—",
};

/** Tone tokens for the renewal urgency pill. */
export const renewalUrgencyTone: Record<
  RenewalUrgency,
  { fg: string; bg: string; bd: string }
> = {
  overdue: {
    fg: "var(--destructive)",
    bg: "var(--destructive-soft, rgba(185,28,28,0.08))",
    bd: "rgba(185,28,28,0.2)",
  },
  soon: {
    fg: "var(--brand-amber-800, #92610f)",
    bg: "var(--brand-amber-50, #fdf7e8)",
    bd: "var(--brand-amber-200, rgba(184,146,42,0.25))",
  },
  upcoming: {
    fg: "var(--brand-navy-700)",
    bg: "var(--brand-navy-50)",
    bd: "var(--border-1)",
  },
  later: {
    fg: "var(--fg-3)",
    bg: "var(--bg-sunken)",
    bd: "var(--border-1)",
  },
  none: {
    fg: "var(--fg-3)",
    bg: "var(--bg-sunken)",
    bd: "var(--border-1)",
  },
};

/** True when a contract needs renewal attention (overdue or within 60 days). */
export function needsRenewalAttention(
  contract: Pick<BrokerContractRow, "renewal_date" | "status">,
): boolean {
  const urgency = renewalUrgency(contract);
  return urgency === "overdue" || urgency === "soon" || urgency === "upcoming";
}

/** Human label for a contract row, used in lists and the agent. */
export function contractDisplayLabel(
  contract: Pick<BrokerContractRow, "insurer_name" | "product_name">,
): string {
  const parts = [contract.insurer_name, contract.product_name]
    .map((p) => p?.trim())
    .filter(Boolean);
  return parts.join(" — ") || "Contrat sans intitulé";
}

/** Formats a premium with its frequency suffix (e.g. "49,90 € / mois"). */
export function formatContractPremium(
  contract: Pick<
    BrokerContractRow,
    "premium_amount" | "premium_frequency" | "currency"
  >,
): string {
  if (contract.premium_amount === null || contract.premium_amount === undefined) {
    return "Montant à renseigner";
  }
  let formatted: string;
  try {
    formatted = new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency: contract.currency || "EUR",
      maximumFractionDigits: 2,
    }).format(contract.premium_amount);
  } catch {
    formatted = `${contract.premium_amount} ${contract.currency || "EUR"}`;
  }
  const suffix = isBrokerPremiumFrequency(contract.premium_frequency)
    ? brokerPremiumFrequencySuffix[contract.premium_frequency]
    : "";
  return suffix ? `${formatted} ${suffix}` : formatted;
}
