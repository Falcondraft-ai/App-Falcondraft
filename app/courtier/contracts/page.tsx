import Link from "next/link";
import { CalendarClock, FileWarning, ShieldCheck } from "lucide-react";
import { DashboardStatCard } from "@/components/common/dashboard-stat-card";
import { EmptyState } from "@/components/common/empty-state";
import { PageHeader } from "@/components/common/page-header";
import { PageTransition } from "@/components/common/page-transition";
import { ContractStatusBadge } from "@/components/broker/contract-status-badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { requireActiveWorkspaceContext } from "@/lib/auth/session";
import {
  brokerClientDisplayName,
  insuranceTypeLabel,
} from "@/lib/broker/clients";
import {
  annualisedPremium,
  contractDisplayLabel,
  formatContractPremium,
  needsRenewalAttention,
  renewalUrgency,
  renewalUrgencyTone,
} from "@/lib/broker/contracts";
import { getBrokerClients, getBrokerContracts } from "@/lib/broker/data";
import { formatCurrency, formatDate } from "@/lib/format";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function BrokerContractsPage() {
  const context = await requireActiveWorkspaceContext();
  const organizationId = context.organization!.id;

  const [contracts, clients] = await Promise.all([
    getBrokerContracts(organizationId, { limit: 1000 }),
    getBrokerClients(organizationId, { limit: 2000, includeArchived: true }),
  ]);

  const clientNames = new Map(
    clients.map((c) => [c.id, brokerClientDisplayName(c)]),
  );

  const activeContracts = contracts.filter((c) => c.status === "active");
  const annualPortfolio = activeContracts.reduce(
    (sum, c) => sum + annualisedPremium(c.premium_amount, c.premium_frequency),
    0,
  );
  const renewalsCount = contracts.filter(needsRenewalAttention).length;

  return (
    <PageTransition>
      <div className="space-y-6">
        <PageHeader
          title="Contrats"
          description="Le portefeuille de contrats du cabinet, leurs primes et leurs échéances."
        />

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <DashboardStatCard
            label="Contrats en cours"
            value={String(activeContracts.length)}
            detail="Contrats actifs du portefeuille"
            icon={<ShieldCheck className="size-3.5" strokeWidth={1.75} />}
          />
          <DashboardStatCard
            label="Primes annualisées"
            value={formatCurrency(annualPortfolio)}
            detail="Volume de primes sur 12 mois"
            tone="accent"
            icon={<CalendarClock className="size-3.5" strokeWidth={1.75} />}
          />
          <DashboardStatCard
            label="Renouvellements à suivre"
            value={String(renewalsCount)}
            detail="Échéances dépassées ou sous 60 jours"
            tone="warning"
            icon={<FileWarning className="size-3.5" strokeWidth={1.75} />}
          />
        </div>

        <section
          className="overflow-hidden rounded-lg border bg-[var(--bg-surface)]"
          style={{ borderColor: "var(--border-1)", boxShadow: "var(--shadow-sm)" }}
        >
          <div
            className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3 sm:px-5 sm:py-4"
            style={{ borderColor: "var(--border-1)" }}
          >
            <h2 className="text-[14px] font-semibold tracking-[-0.005em] text-[var(--fg-1)]">
              Tous les contrats
            </h2>
            <Button asChild variant="ghost" size="sm">
              <Link href="/courtier/contracts/renouvellements">
                Voir les renouvellements
              </Link>
            </Button>
          </div>

          {contracts.length > 0 ? (
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
                      Contrat
                    </TableHead>
                    <TableHead className="h-10 text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--fg-3)]">
                      Prime
                    </TableHead>
                    <TableHead className="h-10 text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--fg-3)]">
                      Échéance
                    </TableHead>
                    <TableHead className="h-10 text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--fg-3)]">
                      Statut
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {contracts.map((contract) => {
                    const urgency = renewalUrgency(contract);
                    const tone = renewalUrgencyTone[urgency];
                    return (
                      <TableRow
                        key={contract.id}
                        className="duration-100 hover:bg-[rgba(14,34,56,0.025)]"
                      >
                        <TableCell>
                          <Link
                            href={`/courtier/clients/${contract.client_id}/contracts/${contract.id}`}
                            className="text-[13px] font-semibold text-[var(--fg-1)] transition-colors hover:text-[var(--brand-navy-800)]"
                          >
                            {clientNames.get(contract.client_id) ?? "Client"}
                          </Link>
                        </TableCell>
                        <TableCell>
                          <p className="text-[13px] text-[var(--fg-1)]">
                            {contractDisplayLabel(contract)}
                          </p>
                          <p className="mt-0.5 text-[11.5px] text-[var(--fg-3)]">
                            {insuranceTypeLabel(contract.insurance_type)}
                          </p>
                        </TableCell>
                        <TableCell className="text-[13px] text-[var(--fg-2)]">
                          {formatContractPremium(contract)}
                        </TableCell>
                        <TableCell>
                          {contract.renewal_date ? (
                            <span
                              className="inline-flex items-center rounded-full border px-2 py-[3px] font-mono text-[11.5px]"
                              style={{
                                color: tone.fg,
                                background: tone.bg,
                                borderColor: tone.bd,
                              }}
                            >
                              {formatDate(contract.renewal_date)}
                            </span>
                          ) : (
                            <span className="text-[12px] text-[var(--fg-4)]">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <ContractStatusBadge status={contract.status} />
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
                title="Aucun contrat pour le moment"
                description="Les contrats s’ajoutent depuis chaque dossier client. Ouvrez un dossier puis renseignez ses contrats en cours pour suivre leurs échéances ici."
                action={
                  <Button asChild>
                    <Link href="/courtier/clients">Ouvrir un dossier</Link>
                  </Button>
                }
              />
            </div>
          )}
        </section>
      </div>
    </PageTransition>
  );
}
