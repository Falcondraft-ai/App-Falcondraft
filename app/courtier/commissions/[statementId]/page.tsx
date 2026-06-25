import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { PageTransition } from "@/components/common/page-transition";
import { CommissionLineManager } from "@/components/broker/commission-line-manager";
import { CommissionStatusBadge } from "@/components/broker/commission-status-badge";
import { StatementReconcileButton } from "@/components/broker/statement-reconcile-button";
import { requireActiveWorkspaceContext } from "@/lib/auth/session";
import { canCreateWorkspaceRecords } from "@/lib/auth/workspace-permissions";
import { brokerClientDisplayName } from "@/lib/broker/clients";
import {
  formatEuro,
  reconcileStatement,
  statementDisplayLabel,
} from "@/lib/broker/commissions";
import { contractDisplayLabel } from "@/lib/broker/contracts";
import {
  getBrokerClients,
  getBrokerCommissionStatement,
  getBrokerContracts,
  getBrokerStatementCommissions,
} from "@/lib/broker/data";
import { formatDate } from "@/lib/format";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function SummaryTile({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: string;
}) {
  return (
    <div
      className="rounded-md border px-4 py-3"
      style={{ borderColor: "var(--border-1)", background: "var(--bg-surface)" }}
    >
      <p className="fd-eyebrow">{label}</p>
      <p
        className="mt-1.5 text-[18px] font-semibold tracking-[-0.01em]"
        style={{ color: accent ?? "var(--fg-1)" }}
      >
        {value}
      </p>
    </div>
  );
}

export default async function BrokerStatementDetailPage({
  params,
}: {
  params: Promise<{ statementId: string }>;
}) {
  const context = await requireActiveWorkspaceContext();
  const organizationId = context.organization!.id;
  const { statementId } = await params;

  const statement = await getBrokerCommissionStatement(
    organizationId,
    statementId,
  );
  if (!statement) {
    notFound();
  }

  const [lines, clients, contracts] = await Promise.all([
    getBrokerStatementCommissions(organizationId, statementId),
    getBrokerClients(organizationId, { limit: 2000, includeArchived: true }),
    getBrokerContracts(organizationId, { limit: 2000 }),
  ]);

  const canEdit = canCreateWorkspaceRecords(context.membership?.role);
  const reconciliation = reconcileStatement(statement, lines);

  const clientOptions = clients.map((c) => ({
    id: c.id,
    name: brokerClientDisplayName(c),
  }));
  const contractOptions = contracts.map((c) => ({
    id: c.id,
    clientId: c.client_id,
    label: contractDisplayLabel(c),
  }));

  const diffColor =
    reconciliation.difference === null
      ? "var(--fg-1)"
      : reconciliation.matches
        ? "var(--success, #15803d)"
        : "var(--destructive)";

  return (
    <PageTransition>
      <div className="space-y-5">
        <nav
          className="flex flex-wrap items-center gap-1.5 text-[12px]"
          style={{ color: "var(--fg-3)" }}
          aria-label="Breadcrumb"
        >
          <Link href="/courtier/commissions" className="hover:text-[var(--fg-1)]">
            Commissions
          </Link>
          <ChevronRight className="size-3" strokeWidth={2} aria-hidden="true" />
          <span style={{ color: "var(--fg-1)", fontWeight: 600 }}>
            {statementDisplayLabel(statement)}
          </span>
        </nav>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <p className="fd-eyebrow mb-2">Bordereau</p>
            <h1 className="text-[24px] font-semibold leading-tight tracking-[-0.02em] text-[var(--fg-1)]">
              {statementDisplayLabel(statement)}
            </h1>
            <div className="mt-2.5 flex items-center gap-2">
              <CommissionStatusBadge status={statement.status} kind="statement" />
              {statement.period_start || statement.period_end ? (
                <span className="text-[12px] text-[var(--fg-3)]">
                  {statement.period_start
                    ? formatDate(statement.period_start)
                    : "?"}{" "}
                  →{" "}
                  {statement.period_end ? formatDate(statement.period_end) : "?"}
                </span>
              ) : null}
            </div>
          </div>
          {canEdit ? (
            <StatementReconcileButton
              statementId={statement.id}
              reconciled={statement.status === "reconciled"}
            />
          ) : null}
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <SummaryTile
            label="Total annoncé"
            value={formatEuro(statement.total_amount, statement.currency)}
          />
          <SummaryTile
            label="Total saisi"
            value={formatEuro(reconciliation.linesTotal, statement.currency)}
          />
          <SummaryTile
            label="Écart"
            value={
              reconciliation.difference === null
                ? "—"
                : formatEuro(reconciliation.difference, statement.currency)
            }
            accent={diffColor}
          />
        </div>

        {reconciliation.declaredTotal !== null && lines.length > 0 ? (
          <div
            className="rounded-md border px-4 py-3 text-[12.5px]"
            style={{
              borderColor: reconciliation.matches
                ? "rgba(21,128,61,0.2)"
                : "var(--brand-amber-200, rgba(184,146,42,0.25))",
              background: reconciliation.matches
                ? "var(--success-soft, #f0fdf4)"
                : "var(--brand-amber-50, #fdf7e8)",
              color: reconciliation.matches
                ? "var(--success, #15803d)"
                : "var(--brand-amber-800, #92610f)",
            }}
          >
            {reconciliation.matches
              ? "Le total saisi correspond au montant annoncé par la compagnie. Vous pouvez pointer ce bordereau."
              : "Le total saisi ne correspond pas encore au montant annoncé. Vérifiez les lignes avant de pointer."}
          </div>
        ) : null}

        <section
          className="rounded-lg border bg-[var(--bg-surface)] p-5"
          style={{ borderColor: "var(--border-1)", boxShadow: "var(--shadow-sm)" }}
        >
          <h2 className="text-[14px] font-semibold tracking-[-0.005em] text-[var(--fg-1)]">
            Lignes de commission
          </h2>
          <p className="mt-1 text-[12.5px] leading-5 text-[var(--fg-3)]">
            Saisissez chaque commission du bordereau, rattachez-la à un dossier ou
            un contrat, et indiquez une éventuelle rétrocession.
          </p>
          <div className="mt-4">
            <CommissionLineManager
              statementId={statement.id}
              commissions={lines}
              clients={clientOptions}
              contracts={contractOptions}
              canEdit={canEdit}
            />
          </div>
        </section>
      </div>
    </PageTransition>
  );
}
