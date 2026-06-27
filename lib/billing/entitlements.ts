import type { OrganizationRow, Plan } from "@/types/database";
import {
  BROKER_OFFERING_CUSTOM,
  getBrokerOffering,
  isBrokerWorkspace,
} from "@/lib/broker/access";

/**
 * Single source of truth for what a courtier SaaS organization can access,
 * derived from its `plan`. Feature gates, seat limits and storage quotas all
 * read from here — never hard-code a plan name in a feature module.
 *
 * Offer validated 2026-06-27 (see memory: courtier-saas-offering). Prices live
 * in Stripe / the marketing site, not here — this file only maps plan → access.
 */

export type Feature =
  | "outlook_briefing"
  | "commissions"
  | "commission_extraction"
  | "esign"
  | "copilot"
  | "proposals";

type PlanConfig = {
  seats: number;
  storageGb: number;
  features: Feature[];
  /** Daily cap on AI Outlook-briefing emails analysed (null = unlimited). */
  briefingDailyCap: number | null;
};

export const PLAN_CONFIG: Record<Plan, PlanConfig> = {
  essentiel: {
    seats: 2,
    storageGb: 10,
    features: ["outlook_briefing"],
    briefingDailyCap: 50,
  },
  cabinet: {
    seats: 5,
    storageGb: 50,
    features: [
      "outlook_briefing",
      "commissions",
      "commission_extraction",
      "esign",
      "copilot",
    ],
    briefingDailyCap: null,
  },
  performance: {
    seats: 10,
    storageGb: 250,
    features: [
      "outlook_briefing",
      "commissions",
      "commission_extraction",
      "esign",
      "copilot",
      "proposals",
    ],
    briefingDailyCap: null,
  },
};

/**
 * Bespoke "courtier sur mesure" offering: keeps every SaaS feature EXCEPT the
 * commercial proposal module (proposals stay SaaS-only). Seats/storage are not
 * plan-bound (driven by the org's own storage quota). Reworked separately.
 */
const CUSTOM_FEATURES: Feature[] = [
  "outlook_briefing",
  "commissions",
  "commission_extraction",
  "esign",
  "copilot",
];

type OrgLike = Pick<
  OrganizationRow,
  "workspace_type" | "broker_offering" | "plan"
> | null | undefined;

export function getPlan(org: OrgLike): Plan | null {
  return org?.plan === "essentiel" ||
    org?.plan === "cabinet" ||
    org?.plan === "performance"
    ? org.plan
    : null;
}

function isCustomBroker(org: OrgLike): boolean {
  return (
    isBrokerWorkspace(org) && getBrokerOffering(org) === BROKER_OFFERING_CUSTOM
  );
}

/** Whether an organization's offering unlocks a given feature. */
export function hasFeature(org: OrgLike, feature: Feature): boolean {
  if (!isBrokerWorkspace(org)) return false;
  if (isCustomBroker(org)) return CUSTOM_FEATURES.includes(feature);
  const plan = getPlan(org);
  return plan ? PLAN_CONFIG[plan].features.includes(feature) : false;
}

/**
 * SaaS proposal-automation module access. Performance plan only (or replaced by
 * the bespoke track for `custom`, which excludes it). Used by the courtier
 * shell + the /courtier/propositions route gate.
 */
export function hasProposalAutomation(org: OrgLike): boolean {
  return hasFeature(org, "proposals");
}

/** Seat limit, or `null` for unmetered offerings (custom / non-plan). */
export function getSeatLimit(org: OrgLike): number | null {
  if (!isBrokerWorkspace(org)) return null;
  if (isCustomBroker(org)) return null;
  const plan = getPlan(org);
  return plan ? PLAN_CONFIG[plan].seats : 0;
}

/** Storage quota in GB from the plan, or `null` for unmetered offerings. */
export function getStorageLimitGb(org: OrgLike): number | null {
  if (!isBrokerWorkspace(org)) return null;
  if (isCustomBroker(org)) return null;
  const plan = getPlan(org);
  return plan ? PLAN_CONFIG[plan].storageGb : 0;
}

/** Daily AI-briefing cap (null = unlimited / not applicable). */
export function getBriefingDailyCap(org: OrgLike): number | null {
  if (isCustomBroker(org)) return null;
  const plan = getPlan(org);
  return plan ? PLAN_CONFIG[plan].briefingDailyCap : null;
}
