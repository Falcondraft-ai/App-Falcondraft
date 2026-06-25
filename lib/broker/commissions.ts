import type {
  BrokerCommissionRow,
  BrokerCommissionStatementRow,
} from "@/types/database";

// ---------------------------------------------------------------------------
// Statement (bordereau) statuses
// ---------------------------------------------------------------------------
export const brokerStatementStatuses = [
  "received",
  "reconciled",
  "disputed",
] as const;

export type BrokerStatementStatus = (typeof brokerStatementStatuses)[number];

export const brokerStatementStatusLabels: Record<
  BrokerStatementStatus,
  string
> = {
  received: "Reçu",
  reconciled: "Pointé",
  disputed: "En litige",
};

export const brokerStatementStatusTone: Record<
  BrokerStatementStatus,
  "draft" | "review" | "signed" | "error"
> = {
  received: "review",
  reconciled: "signed",
  disputed: "error",
};

export function isBrokerStatementStatus(
  value: string,
): value is BrokerStatementStatus {
  return (brokerStatementStatuses as readonly string[]).includes(value);
}

// ---------------------------------------------------------------------------
// Commission line statuses
// ---------------------------------------------------------------------------
export const brokerCommissionStatuses = [
  "expected",
  "received",
  "reconciled",
] as const;

export type BrokerCommissionStatus =
  (typeof brokerCommissionStatuses)[number];

export const brokerCommissionStatusLabels: Record<
  BrokerCommissionStatus,
  string
> = {
  expected: "Attendue",
  received: "Reçue",
  reconciled: "Pointée",
};

export const brokerCommissionStatusTone: Record<
  BrokerCommissionStatus,
  "draft" | "review" | "signed"
> = {
  expected: "draft",
  received: "review",
  reconciled: "signed",
};

export function isBrokerCommissionStatus(
  value: string,
): value is BrokerCommissionStatus {
  return (brokerCommissionStatuses as readonly string[]).includes(value);
}

// ---------------------------------------------------------------------------
// Money helpers
// ---------------------------------------------------------------------------
export function formatEuro(
  amount: number | null | undefined,
  currency = "EUR",
): string {
  if (amount === null || amount === undefined || !Number.isFinite(amount)) {
    return "—";
  }
  try {
    return new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${amount} ${currency}`;
  }
}

/** Net commission kept after the retrocession paid to an introducer. */
export function netCommission(
  line: Pick<BrokerCommissionRow, "commission_amount" | "retrocession_amount">,
): number {
  const gross = line.commission_amount ?? 0;
  const retro = line.retrocession_amount ?? 0;
  return gross - retro;
}

export type CommissionTotals = {
  gross: number;
  retrocession: number;
  net: number;
  count: number;
};

export function sumCommissions(
  lines: Pick<
    BrokerCommissionRow,
    "commission_amount" | "retrocession_amount"
  >[],
): CommissionTotals {
  return lines.reduce<CommissionTotals>(
    (acc, line) => {
      acc.gross += line.commission_amount ?? 0;
      acc.retrocession += line.retrocession_amount ?? 0;
      acc.net += netCommission(line);
      acc.count += 1;
      return acc;
    },
    { gross: 0, retrocession: 0, net: 0, count: 0 },
  );
}

export type StatementReconciliation = {
  linesTotal: number;
  declaredTotal: number | null;
  difference: number | null;
  /** True when the lines sum matches the declared bordereau total (±0.01). */
  matches: boolean;
};

/**
 * Compares the sum of a bordereau's commission lines against the total the
 * insurer declared. Powers the "pointage" workflow.
 */
export function reconcileStatement(
  statement: Pick<BrokerCommissionStatementRow, "total_amount">,
  lines: Pick<BrokerCommissionRow, "commission_amount">[],
): StatementReconciliation {
  const linesTotal = lines.reduce(
    (sum, l) => sum + (l.commission_amount ?? 0),
    0,
  );
  const declaredTotal = statement.total_amount ?? null;
  const difference =
    declaredTotal === null ? null : Math.round((declaredTotal - linesTotal) * 100) / 100;
  return {
    linesTotal,
    declaredTotal,
    difference,
    matches: difference !== null && Math.abs(difference) < 0.01,
  };
}

/** Display label for a statement (insurer + period). */
export function statementDisplayLabel(
  statement: Pick<
    BrokerCommissionStatementRow,
    "insurer_name" | "period_label"
  >,
): string {
  const parts = [statement.insurer_name, statement.period_label]
    .map((p) => p?.trim())
    .filter(Boolean);
  return parts.join(" · ") || "Bordereau";
}
