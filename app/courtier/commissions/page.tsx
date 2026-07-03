import Link from "next/link";
import { Sparkles } from "lucide-react";
import {
  DashboardStatCard,
  StatStrip,
} from "@/components/common/dashboard-stat-card";
import { EmptyState } from "@/components/common/empty-state";
import { PageHeader } from "@/components/common/page-header";
import { PageTransition } from "@/components/common/page-transition";
import {
  CommissionInsights,
  type InsightItem,
} from "@/components/broker/commission-insights";
import { CommissionStatementCreator } from "@/components/broker/commission-statement-creator";
import { CommissionStatusBadge } from "@/components/broker/commission-status-badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { requireActiveWorkspaceContext } from "@/lib/auth/session";
import { canCreateWorkspaceRecords } from "@/lib/auth/workspace-permissions";
import { brokerClientDisplayName } from "@/lib/broker/clients";
import { computeCommissionInsights } from "@/lib/broker/commission-analytics";
import {
  formatEuro,
  statementDisplayLabel,
  sumCommissions,
} from "@/lib/broker/commissions";
import { contractDisplayLabel } from "@/lib/broker/contracts";
import {
  getBrokerClients,
  getBrokerCommissions,
  getBrokerCommissionStatements,
  getBrokerContracts,
} from "@/lib/broker/data";
import { parseBrokerSettings } from "@/lib/broker/settings";
import { formatDate } from "@/lib/format";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function BrokerCommissionsPage() {
  const context = await requireActiveWorkspaceContext();
  const organizationId = context.organization!.id;

  const [statements, commissions, clients, contracts] = await Promise.all([
    getBrokerCommissionStatements(organizationId, { limit: 200 }),
    getBrokerCommissions(organizationId, { limit: 5000 }),
    getBrokerClients(organizationId, { limit: 5000, includeArchived: true }),
    getBrokerContracts(organizationId, { limit: 5000 }),
  ]);

  const canEdit = canCreateWorkspaceRecords(context.membership?.role);
  const insurers = parseBrokerSettings(context.organization).partnerInsurers;
  const totals = sumCommissions(commissions);
  const toReconcile = statements.filter((s) => s.status === "received").length;

  // Pilotage: forecast, missing commissions and under-payment gaps.
  const insights = computeCommissionInsights(contracts, commissions);
  const clientNameById = new Map(
    clients.map((c) => [c.id, brokerClientDisplayName(c)] as const),
  );
  const missingItems: InsightItem[] = insights.missing.map((m) => ({
    contractId: m.contract.id,
    clientId: m.contract.client_id,
    label: contractDisplayLabel(m.contract),
    clientName: clientNameById.get(m.contract.client_id) ?? "Client",
    expectedAnnual: m.expectedAnnual,
  }));
  const gapItems: InsightItem[] = insights.gaps.map((g) => ({
    contractId: g.contract.id,
    clientId: g.contract.client_id,
    label: contractDisplayLabel(g.contract),
    clientName: clientNameById.get(g.contract.client_id) ?? "Client",
    expectedAnnual: g.expectedAnnual,
    received12m: g.received12m,
  }));
  const insightsCurrency = commissions[0]?.currency ?? "EUR";

  // Lines total per statement, for the bordereau table.
  const linesByStatement = new Map<string, number>();
  for (const line of commissions) {
    if (!line.statement_id) continue;
    linesByStatement.set(
      line.statement_id,
      (linesByStatement.get(line.statement_id) ?? 0) +
        (line.commission_amount ?? 0),
    );
  }

  return (
    <PageTransition>
      <div className="space-y-6">
        <PageHeader
          title="Commissions"
          description="Vos bordereaux compagnies, le pointage des commissions et les rétrocessions."
        />

        <StatStrip className="grid-cols-1 sm:grid-cols-3">
          <DashboardStatCard
            variant="cell"
            label="Commissions perçues"
            value={formatEuro(totals.gross)}
            detail="Total des commissions enregistrées"
          />
          <DashboardStatCard
            variant="cell"
            label="Rétrocessions versées"
            value={formatEuro(totals.retrocession)}
            detail="Reversées aux apporteurs"
            tone="accent"
          />
          <DashboardStatCard
            variant="cell"
            label="Net conservé"
            value={formatEuro(totals.net)}
            detail="Après rétrocessions"
            tone="success"
          />
        </StatStrip>

        <CommissionInsights
          forecast={insights.forecast}
          missing={missingItems}
          gaps={gapItems}
          currency={insightsCurrency}
        />

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-[15px] font-semibold tracking-[-0.005em] text-[var(--fg-1)]">
              Bordereaux compagnies
            </h2>
            <p className="mt-0.5 text-[12.5px] text-[var(--fg-3)]">
              {toReconcile > 0
                ? `${toReconcile} bordereau${toReconcile > 1 ? "x" : ""} à pointer.`
                : "Tous vos bordereaux sont pointés."}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            {canEdit ? (
              <Link
                href="/courtier/commissions/import"
                className="inline-flex h-9 items-center gap-1.5 rounded-md px-3.5 text-[13px] font-semibold text-white transition-colors hover:opacity-95"
                style={{
                  background: "var(--brand-navy-800)",
                  border: "1px solid var(--brand-navy-800)",
                }}
              >
                <Sparkles className="size-3.5" strokeWidth={2} />
                Importer un bordereau
              </Link>
            ) : null}
            <CommissionStatementCreator insurers={insurers} canEdit={canEdit} />
          </div>
        </div>

        <section
          className="overflow-hidden rounded-lg border bg-[var(--bg-surface)]"
          style={{ borderColor: "var(--border-1)", boxShadow: "var(--shadow-sm)" }}
        >
          {statements.length > 0 ? (
            <div className="-mx-px overflow-x-auto">
              <Table className="min-w-[680px]">
                <TableHeader>
                  <TableRow
                    className="hover:bg-transparent"
                    style={{ background: "var(--bg-sunken)" }}
                  >
                    <TableHead className="h-10 text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--fg-3)]">
                      Bordereau
                    </TableHead>
                    <TableHead className="h-10 text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--fg-3)]">
                      Total annoncé
                    </TableHead>
                    <TableHead className="h-10 text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--fg-3)]">
                      Saisi
                    </TableHead>
                    <TableHead className="h-10 text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--fg-3)]">
                      Statut
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {statements.map((statement) => {
                    const captured = linesByStatement.get(statement.id) ?? 0;
                    return (
                      <TableRow
                        key={statement.id}
                        className="duration-100 hover:bg-[rgba(14,34,56,0.025)]"
                      >
                        <TableCell>
                          <Link
                            href={`/courtier/commissions/${statement.id}`}
                            className="text-[13px] font-semibold text-[var(--fg-1)] transition-colors hover:text-[var(--brand-navy-800)]"
                          >
                            {statementDisplayLabel(statement)}
                          </Link>
                          <p className="mt-0.5 text-[11.5px] text-[var(--fg-3)]">
                            Ajouté le {formatDate(statement.created_at)}
                          </p>
                        </TableCell>
                        <TableCell className="text-[13px] text-[var(--fg-2)]">
                          {formatEuro(statement.total_amount, statement.currency)}
                        </TableCell>
                        <TableCell className="text-[13px] text-[var(--fg-2)]">
                          {formatEuro(captured, statement.currency)}
                        </TableCell>
                        <TableCell>
                          <CommissionStatusBadge
                            status={statement.status}
                            kind="statement"
                          />
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="p-5">
              <EmptyState
                title="Aucun bordereau pour le moment"
                description="Créez un bordereau dès qu’une compagnie vous transmet son relevé de commissions, puis saisissez les lignes pour le pointer."
                action={
                  canEdit ? (
                    <div className="flex flex-col items-center gap-2.5 sm:flex-row">
                      <Link
                        href="/courtier/commissions/import"
                        className="inline-flex h-9 items-center gap-1.5 rounded-md px-3.5 text-[13px] font-semibold text-white transition-colors hover:opacity-95"
                        style={{
                          background: "var(--brand-navy-800)",
                          border: "1px solid var(--brand-navy-800)",
                        }}
                      >
                        <Sparkles className="size-3.5" strokeWidth={2} />
                        Importer un bordereau
                      </Link>
                      <CommissionStatementCreator
                        insurers={insurers}
                        canEdit={canEdit}
                      />
                    </div>
                  ) : undefined
                }
              />
            </div>
          )}
        </section>
      </div>
    </PageTransition>
  );
}
