import Link from "next/link";
import {
  DashboardStatCard,
  StatStrip,
} from "@/components/common/dashboard-stat-card";
import { EmptyState } from "@/components/common/empty-state";
import { PageHeader } from "@/components/common/page-header";
import { PageTransition } from "@/components/common/page-transition";
import { ClaimStatusBadge } from "@/components/broker/claim-status-badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { requireActiveWorkspaceContext } from "@/lib/auth/session";
import { claimDisplayLabel, isClaimOpen } from "@/lib/broker/claims";
import { brokerClientDisplayName } from "@/lib/broker/clients";
import { formatEuro } from "@/lib/broker/commissions";
import { getBrokerClaims, getBrokerClients } from "@/lib/broker/data";
import { formatDate } from "@/lib/format";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function BrokerClaimsPage() {
  const context = await requireActiveWorkspaceContext();
  const organizationId = context.organization!.id;

  const [claims, clients] = await Promise.all([
    getBrokerClaims(organizationId, { limit: 1000 }),
    getBrokerClients(organizationId, { limit: 2000, includeArchived: true }),
  ]);

  const clientNames = new Map(
    clients.map((c) => [c.id, brokerClientDisplayName(c)]),
  );

  const openClaims = claims.filter((c) => isClaimOpen(c.status));
  const settledClaims = claims.filter((c) => c.status === "settled");
  const openEstimate = openClaims.reduce(
    (sum, c) => sum + (c.amount_estimate ?? 0),
    0,
  );

  return (
    <PageTransition>
      <div className="space-y-6">
        <PageHeader
          title="Sinistres"
          description="Tous les sinistres de vos clients, leur instruction et leur indemnisation."
        />

        <StatStrip className="grid-cols-1 sm:grid-cols-3">
          <DashboardStatCard
            variant="cell"
            label="Sinistres en cours"
            value={String(openClaims.length)}
            detail="Déclarés, en instruction ou en attente de pièces"
            tone="warning"
          />
          <DashboardStatCard
            variant="cell"
            label="Montant estimé en cours"
            value={formatEuro(openEstimate)}
            detail="Estimation des sinistres ouverts"
            tone="accent"
          />
          <DashboardStatCard
            variant="cell"
            label="Indemnisés"
            value={String(settledClaims.length)}
            detail="Sinistres réglés"
            tone="success"
          />
        </StatStrip>

        <section
          className="overflow-hidden rounded-lg border bg-[var(--bg-surface)]"
          style={{ borderColor: "var(--border-1)", boxShadow: "var(--shadow-sm)" }}
        >
          <div
            className="border-b px-4 py-3 sm:px-5 sm:py-4"
            style={{ borderColor: "var(--border-1)" }}
          >
            <h2 className="text-[14px] font-semibold tracking-[-0.005em] text-[var(--fg-1)]">
              Tous les sinistres
            </h2>
          </div>

          {claims.length > 0 ? (
            <div className="-mx-px overflow-x-auto">
              <Table className="min-w-[720px]">
                <TableHeader>
                  <TableRow
                    className="hover:bg-transparent"
                    style={{ background: "var(--bg-sunken)" }}
                  >
                    <TableHead className="h-10 text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--fg-3)]">
                      Client
                    </TableHead>
                    <TableHead className="h-10 text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--fg-3)]">
                      Sinistre
                    </TableHead>
                    <TableHead className="h-10 text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--fg-3)]">
                      Survenance
                    </TableHead>
                    <TableHead className="h-10 text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--fg-3)]">
                      Montant
                    </TableHead>
                    <TableHead className="h-10 text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--fg-3)]">
                      Statut
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {claims.map((claim) => (
                    <TableRow
                      key={claim.id}
                      className="duration-100 hover:bg-[rgba(14,34,56,0.025)]"
                    >
                      <TableCell>
                        <Link
                          href={`/courtier/clients/${claim.client_id}/claims/${claim.id}`}
                          className="text-[13px] font-semibold text-[var(--fg-1)] transition-colors hover:text-[var(--brand-navy-800)]"
                        >
                          {clientNames.get(claim.client_id) ?? "Client"}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <p className="text-[13px] text-[var(--fg-1)]">
                          {claimDisplayLabel(claim)}
                        </p>
                        {claim.insurer_name ? (
                          <p className="mt-0.5 text-[11.5px] text-[var(--fg-3)]">
                            {claim.insurer_name}
                          </p>
                        ) : null}
                      </TableCell>
                      <TableCell className="font-mono text-[12px] text-[var(--fg-3)]">
                        {claim.occurrence_date
                          ? formatDate(claim.occurrence_date)
                          : "—"}
                      </TableCell>
                      <TableCell className="text-[13px] text-[var(--fg-2)]">
                        {claim.amount_settled != null
                          ? formatEuro(claim.amount_settled, claim.currency)
                          : claim.amount_estimate != null
                            ? `~ ${formatEuro(claim.amount_estimate, claim.currency)}`
                            : "—"}
                      </TableCell>
                      <TableCell>
                        <ClaimStatusBadge status={claim.status} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="p-5">
              <EmptyState
                title="Aucun sinistre pour le moment"
                description="Les sinistres se déclarent depuis le dossier d’un client. Ouvrez un dossier puis déclarez un sinistre pour le suivre ici."
                action={
                  <Link
                    href="/courtier/clients"
                    className="inline-flex h-9 items-center rounded-md px-4 text-[13px] font-semibold"
                    style={{ background: "var(--brand-navy-800)", color: "#fff" }}
                  >
                    Ouvrir un dossier
                  </Link>
                }
              />
            </div>
          )}
        </section>
      </div>
    </PageTransition>
  );
}
