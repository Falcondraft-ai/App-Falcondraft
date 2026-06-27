import type { Plan } from "@/types/database";

export type BillingInterval = "month" | "year";

export type PlanPricing = {
  plan: Plan;
  productName: string;
  /** Amounts in cents (EUR). Annual = 2 months free (×10). */
  amounts: Record<BillingInterval, number>;
  /** Stable Stripe price lookup_keys — referenced by code, never raw price IDs. */
  lookupKeys: Record<BillingInterval, string>;
};

// Offer validated 2026-06-27 (see memory: courtier-saas-offering).
// KEEP IN SYNC with scripts/stripe-setup.mjs.
export const PLAN_PRICING: PlanPricing[] = [
  {
    plan: "essentiel",
    productName: "FalconDraft Courtier — Essentiel",
    amounts: { month: 3900, year: 39000 },
    lookupKeys: {
      month: "courtier_essentiel_month",
      year: "courtier_essentiel_year",
    },
  },
  {
    plan: "cabinet",
    productName: "FalconDraft Courtier — Cabinet",
    amounts: { month: 8900, year: 89000 },
    lookupKeys: {
      month: "courtier_cabinet_month",
      year: "courtier_cabinet_year",
    },
  },
  {
    plan: "performance",
    productName: "FalconDraft Courtier — Performance",
    amounts: { month: 17900, year: 179000 },
    lookupKeys: {
      month: "courtier_performance_month",
      year: "courtier_performance_year",
    },
  },
];

export function getPlanPricing(plan: Plan): PlanPricing | undefined {
  return PLAN_PRICING.find((p) => p.plan === plan);
}

/** Reverse map: Stripe price lookup_key → our plan (used by the webhook). */
export const PLAN_BY_LOOKUP_KEY: Record<string, Plan> = Object.fromEntries(
  PLAN_PRICING.flatMap((p) => [
    [p.lookupKeys.month, p.plan],
    [p.lookupKeys.year, p.plan],
  ]),
);
