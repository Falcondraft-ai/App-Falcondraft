import Link from "next/link";
import {
  DashboardStatCard,
  StatStrip,
} from "@/components/common/dashboard-stat-card";
import { EmptyState } from "@/components/common/empty-state";
import { PageHeader } from "@/components/common/page-header";
import { PageTransition } from "@/components/common/page-transition";
import { ContractStatusBadge } from "@/components/broker/contract-status-badge";
import { DeleteRowButton } from "@/components/broker/delete-row-button";
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
import { canManageWorkspace } from "@/lib/auth/workspace-permissions";
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
  RENEWAL_HORIZON_DAYS,
} from "@/lib/broker/contracts";
import { getBrokerClients, getBrokerContracts } from "@/lib/broker/data";
import { formatCurrency, formatDate } from "@/lib/format";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function BrokerContractsPage() {
  const context = await requireActiveWorkspaceContext();
  const organizationId = context.organization!.id;
  const canDelete = canManageWorkspace(context.membership?.role);

  const [contracts, clients] = await Promise.all([
    getBrokerContracts(organizationId, { limit: 1000 }),
    getBrokerClients(organizationId, {
      limit: 2000,
      includeArchived: true,
      // Résolution de noms : un contrat peut pointer n'importe quel dossier.
      scope: "all",
    }),
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

        <StatStrip className="grid-cols-1 sm:grid-cols-3">
          <DashboardStatCard
            variant="cell"
            label="Contrats en cours"
            value={String(activeContracts.length)}
            detail="Contrats actifs du portefeuille"
          />
          <DashboardStatCard
            variant="cell"
            label="Primes annualisées"
            value={formatCurrency(annualPortfolio)}
            detail="Volume de primes sur 12 mois"
            tone="accent"
          />
          <DashboardStatCard
            variant="cell"
            label="Renouvellements à suivre"
            value={String(renewalsCount)}
            detail={`Échéances dépassées ou sous ${RENEWAL_HORIZON_DAYS} jours`}
            tone="warning"
          />
        </StatStrip>

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
            // Même règle que la page Documents : la ligne tient dans l'écran,
            // les textes longs sont tronqués et les colonnes secondaires se
            // replient sous le contrat quand la place manque.
            <div>
              <Table className="table-fixed">
                <TableHeader>
                  <TableRow
                    className="hover:bg-transparent"
                    style={{ background: "var(--bg-sunken)" }}
                  >
                    <TableHead className="w-[30%] h-10 text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--fg-3)] lg:w-[24%]">
                      Client
                    </TableHead>
                    <TableHead className="h-10 text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--fg-3)]">
                      Contrat
                    </TableHead>
                    <TableHead className="hidden w-[16%] h-10 text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--fg-3)] lg:table-cell">
                      Prime
                    </TableHead>
                    <TableHead className="hidden w-[120px] h-10 text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--fg-3)] md:table-cell">
                      Échéance
                    </TableHead>
                    <TableHead className="hidden w-[148px] h-10 text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--fg-3)] sm:table-cell">
                      Statut
                    </TableHead>
                    {canDelete ? <TableHead className="h-10 w-[52px]" /> : null}
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
                        <TableCell className="overflow-hidden">
                          <Link
                            href={`/courtier/clients/${contract.client_id}/contracts/${contract.id}`}
                            className="block truncate text-[13px] font-semibold text-[var(--fg-1)] transition-colors hover:text-[var(--brand-navy-800)]"
                            title={clientNames.get(contract.client_id) ?? "Client"}
                          >
                            {clientNames.get(contract.client_id) ?? "Client"}
                          </Link>
                        </TableCell>
                        <TableCell className="overflow-hidden">
                          <p
                            className="truncate text-[13px] text-[var(--fg-1)]"
                            title={contractDisplayLabel(contract)}
                          >
                            {contractDisplayLabel(contract)}
                          </p>
                          <p className="mt-0.5 truncate text-[11.5px] text-[var(--fg-3)]">
                            {insuranceTypeLabel(contract.insurance_type)}
                            {/* Ce que les colonnes masquées auraient dit. */}
                            <span className="lg:hidden"> · {formatContractPremium(contract)}</span>
                            {contract.renewal_date ? (
                              <span className="md:hidden">
                                {" "}· Échéance {formatDate(contract.renewal_date)}
                              </span>
                            ) : null}
                          </p>
                        </TableCell>
                        <TableCell className="hidden truncate text-[13px] text-[var(--fg-2)] lg:table-cell">
                          {formatContractPremium(contract)}
                        </TableCell>
                        <TableCell className="hidden md:table-cell">
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
                        <TableCell className="hidden sm:table-cell">
                          <ContractStatusBadge status={contract.status} />
                        </TableCell>
                        {canDelete ? (
                          <TableCell className="px-2 text-right">
                            <DeleteRowButton
                              endpoint={`/api/broker/clients/${contract.client_id}/contracts/${contract.id}`}
                              label="Supprimer le contrat"
                              itemName={contractDisplayLabel(contract)}
                              successMessage="Contrat supprimé."
                            />
                          </TableCell>
                        ) : null}
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
