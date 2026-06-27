import { annualisedPremium } from "@/lib/broker/contracts";
import type { BrokerCommissionRow, BrokerContractRow } from "@/types/database";

const YEAR_MS = 365 * 24 * 60 * 60 * 1000;
/** A contract is flagged as under-paid below this share of its expected annual. */
const GAP_THRESHOLD = 0.8;

/**
 * Expected yearly commission for a contract = its annualised premium times the
 * commission rate. Contracts without a rate or a recurring premium (e.g. a
 * single premium) yield 0 and are excluded from the figures.
 */
export function expectedAnnualCommission(
  contract: Pick<
    BrokerContractRow,
    "premium_amount" | "premium_frequency" | "commission_rate"
  >,
): number {
  const rate = contract.commission_rate ?? 0;
  if (rate <= 0) return 0;
  const annualPremium = annualisedPremium(
    contract.premium_amount,
    contract.premium_frequency,
  );
  if (annualPremium <= 0) return 0;
  return (annualPremium * rate) / 100;
}

export type CommissionForecast = {
  annual: number;
  monthly: number;
  contractsCounted: number;
};
export type MissingCommission = {
  contract: BrokerContractRow;
  expectedAnnual: number;
};
export type CommissionGap = {
  contract: BrokerContractRow;
  expectedAnnual: number;
  received12m: number;
  ratio: number;
};
export type CommissionInsights = {
  forecast: CommissionForecast;
  missing: MissingCommission[];
  gaps: CommissionGap[];
};

/**
 * Single pass over the book to derive the three differentiating views:
 *  - forecast: projected annual commission across active contracts;
 *  - missing: active, commission-bearing contracts with no commission line at
 *    all (the insurer likely never paid);
 *  - gaps: contracts whose commission received over the trailing 12 months is
 *    below 80% of the expected annual (possible under-payment).
 */
export function computeCommissionInsights(
  contracts: BrokerContractRow[],
  commissions: BrokerCommissionRow[],
  now: number = Date.now(),
): CommissionInsights {
  const cutoff = now - YEAR_MS;

  const byContract = new Map<string, { count: number; received12m: number }>();
  for (const line of commissions) {
    if (!line.contract_id) continue;
    const entry = byContract.get(line.contract_id) ?? {
      count: 0,
      received12m: 0,
    };
    entry.count += 1;
    const t = line.created_at ? Date.parse(line.created_at) : NaN;
    if (Number.isFinite(t) && t >= cutoff) {
      entry.received12m += line.commission_amount ?? 0;
    }
    byContract.set(line.contract_id, entry);
  }

  let annual = 0;
  let counted = 0;
  const missing: MissingCommission[] = [];
  const gaps: CommissionGap[] = [];

  for (const contract of contracts) {
    if (contract.status !== "active") continue;
    const expected = expectedAnnualCommission(contract);
    if (expected <= 0) continue;

    annual += expected;
    counted += 1;

    const rec = byContract.get(contract.id);
    if (!rec || rec.count === 0) {
      missing.push({ contract, expectedAnnual: expected });
    } else if (rec.received12m < expected * GAP_THRESHOLD) {
      gaps.push({
        contract,
        expectedAnnual: expected,
        received12m: rec.received12m,
        ratio: rec.received12m / expected,
      });
    }
  }

  missing.sort((a, b) => b.expectedAnnual - a.expectedAnnual);
  gaps.sort(
    (a, b) =>
      b.expectedAnnual - b.received12m - (a.expectedAnnual - a.received12m),
  );

  return {
    forecast: { annual, monthly: annual / 12, contractsCounted: counted },
    missing,
    gaps,
  };
}
