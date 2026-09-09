import Link from "next/link";
import { FolderInput, Plus, Search } from "lucide-react";
import { EmptyState } from "@/components/common/empty-state";
import { PageHeader } from "@/components/common/page-header";
import { PageTransition } from "@/components/common/page-transition";
import { BrokerStatusBadge } from "@/components/broker/broker-status-badge";
import { ClientDeleteButton } from "@/components/broker/client-delete-button";
import { ClientsExportButton } from "@/components/broker/clients-export-button";
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
  canCreateWorkspaceRecords,
  isWorkspaceManager,
} from "@/lib/auth/workspace-permissions";
import {
  brokerClientDisplayName,
  brokerClientStatusLabels,
  brokerClientStatuses,
  brokerClientTypeLabel,
  insuranceTypeLabel,
  isBrokerClientStatus,
} from "@/lib/broker/clients";
import { getBrokerClients } from "@/lib/broker/data";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type SearchParams = {
  status?: string;
  q?: string;
  /** "carriers" bascule sur les dossiers compagnies / fournisseurs. */
  vue?: string;
};

function buildHref(
  status: string | null,
  q: string | undefined,
  vue?: string | null,
) {
  const params = new URLSearchParams();
  if (status) params.set("status", status);
  if (q) params.set("q", q);
  if (vue) params.set("vue", vue);
  const qs = params.toString();
  return qs ? `/courtier/clients?${qs}` : "/courtier/clients";
}

export default async function CourtierClientsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const context = await requireActiveWorkspaceContext();
  const organizationId = context.organization!.id;
  const canManage = isWorkspaceManager(context.membership?.role);
  const canEdit = canCreateWorkspaceRecords(context.membership?.role);

  const { status: statusParam, q, vue } = await searchParams;
  // Les compagnies vivent à part : mêmes dossiers, mais ce ne sont pas des
  // assurés. Les mélanger à la liste ferait mentir chaque compteur.
  const carriersView = vue === "carriers";
  const activeStatus =
    !carriersView && statusParam && isBrokerClientStatus(statusParam)
      ? statusParam
      : undefined;
  const search = q?.trim() || undefined;

  const clients = await getBrokerClients(organizationId, {
    status: activeStatus,
    search,
    scope: carriersView ? "carriers" : "clients",
  });

  // Le statut décrit une progression commerciale : sans objet sur une compagnie.
  const filters: { key: string | null; label: string }[] = carriersView
    ? []
    : [
        { key: null, label: "Tous" },
        ...brokerClientStatuses.map((status) => ({
          key: status,
          label: brokerClientStatusLabels[status],
        })),
      ];

  return (
    <PageTransition>
      <div className="space-y-5">
        <PageHeader
          title={carriersView ? "Vos compagnies" : "Vos dossiers clients"}
          description={
            carriersView
              ? "Compagnies, plateformes et fournisseurs — leurs échanges et leurs documents, rangés à part de votre portefeuille."
              : "Centralisez et suivez tous vos dossiers, du premier contact à la signature."
          }
          actions={
            <div className="flex items-center gap-2">
              {canManage && !carriersView && clients.length > 0 ? (
                <ClientsExportButton />
              ) : null}
              {canEdit && !carriersView ? (
                <Button asChild variant="ghost">
                  <Link
                    href="/courtier/import"
                    className="inline-flex items-center gap-1.5"
                  >
                    <FolderInput className="size-3.5" strokeWidth={2} />
                    Importer des clients
                  </Link>
                </Button>
              ) : null}
              <Button asChild>
                <Link
                  href="/courtier/clients/new"
                  className="inline-flex items-center gap-1.5"
                >
                  <Plus className="size-3.5" strokeWidth={2.25} />
                  Nouveau dossier
                </Link>
              </Button>
            </div>
          }
        />

        {/* Deux portefeuilles distincts, jamais mélangés dans un compteur. */}
        <div
          className="inline-flex items-center gap-1 rounded-lg border p-1"
          style={{
            borderColor: "var(--border-1)",
            background: "var(--bg-sunken)",
          }}
        >
          {(
            [
              { key: null, label: "Clients" },
              { key: "carriers", label: "Compagnies" },
            ] as { key: string | null; label: string }[]
          ).map((tab) => {
            const isActive = (tab.key ?? null) === (carriersView ? "carriers" : null);
            return (
              <Link
                key={tab.label}
                href={buildHref(null, search, tab.key)}
                className="rounded-md px-3 py-1.5 text-[12.5px] font-medium transition-colors"
                style={
                  isActive
                    ? {
                        background: "var(--bg-surface)",
                        color: "var(--fg-1)",
                        boxShadow: "var(--shadow-sm)",
                      }
                    : { color: "var(--fg-3)" }
                }
              >
                {tab.label}
              </Link>
            );
          })}
        </div>

        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-1.5">
            {filters.map((filter) => {
              const isActive = (filter.key ?? null) === (activeStatus ?? null);
              return (
                <Link
                  key={filter.label}
                  href={buildHref(filter.key, search, carriersView ? "carriers" : null)}
                  className={cn(
                    "rounded-full border px-3 py-1.5 text-[12px] font-medium transition-colors",
                  )}
                  style={
                    isActive
                      ? {
                          background: "var(--brand-navy-800)",
                          borderColor: "var(--brand-navy-800)",
                          color: "#FFFFFF",
                        }
                      : {
                          background: "var(--bg-surface)",
                          borderColor: "var(--border-1)",
                          color: "var(--fg-2)",
                        }
                  }
                >
                  {filter.label}
                </Link>
              );
            })}
          </div>

          <form
            action="/courtier/clients"
            method="get"
            className="relative w-full lg:w-72"
          >
            {activeStatus ? (
              <input type="hidden" name="status" value={activeStatus} />
            ) : null}
            {carriersView ? (
              <input type="hidden" name="vue" value="carriers" />
            ) : null}
            <Search
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--fg-4)]"
              strokeWidth={1.75}
              aria-hidden="true"
            />
            <input
              type="search"
              name="q"
              defaultValue={search ?? ""}
              placeholder={
                carriersView ? "Rechercher une compagnie…" : "Rechercher un client…"
              }
              className="h-9 w-full rounded-md border bg-[var(--bg-surface)] pl-9 pr-3 text-[13px] outline-none transition-colors focus:border-[var(--border-focus)]"
              style={{ borderColor: "var(--border-1)", color: "var(--fg-1)" }}
            />
          </form>
        </div>

        <section
          className="overflow-hidden rounded-lg border bg-[var(--bg-surface)]"
          style={{
            borderColor: "var(--border-1)",
            boxShadow: "var(--shadow-sm)",
          }}
        >
          {clients.length > 0 ? (
            <div className="-mx-px overflow-x-auto">
              <Table className="min-w-[680px]">
                <TableHeader>
                  <TableRow
                    className="hover:bg-transparent"
                    style={{ background: "var(--bg-sunken)" }}
                  >
                    <TableHead className="h-10 text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--fg-3)]">
                      {carriersView ? "Compagnie" : "Client"}
                    </TableHead>
                    <TableHead className="h-10 text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--fg-3)]">
                      Type
                    </TableHead>
                    {carriersView ? null : (
                      <>
                        <TableHead className="h-10 text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--fg-3)]">
                          Branche
                        </TableHead>
                        <TableHead className="h-10 text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--fg-3)]">
                          Statut
                        </TableHead>
                      </>
                    )}
                    <TableHead className="h-10 text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--fg-3)]">
                      Mis à jour
                    </TableHead>
                    {canManage ? (
                      <TableHead className="h-10 w-12 text-right">
                        <span className="sr-only">Actions</span>
                      </TableHead>
                    ) : null}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {clients.map((client) => (
                    <TableRow
                      key={client.id}
                      className="duration-100 hover:bg-[rgba(14,34,56,0.025)]"
                    >
                      <TableCell>
                        <Link
                          href={`/courtier/clients/${client.id}`}
                          className="text-[13px] font-semibold text-[var(--fg-1)] transition-colors hover:text-[var(--brand-navy-800)]"
                        >
                          {brokerClientDisplayName(client)}
                        </Link>
                        {client.email ? (
                          <p className="mt-0.5 text-[11.5px] text-[var(--fg-3)]">
                            {client.email}
                          </p>
                        ) : null}
                      </TableCell>
                      <TableCell className="text-[13px] text-[var(--fg-2)]">
                        {brokerClientTypeLabel(client.client_type)}
                      </TableCell>
                      {carriersView ? null : (
                        <>
                          <TableCell className="text-[13px] text-[var(--fg-2)]">
                            {insuranceTypeLabel(client.insurance_type)}
                          </TableCell>
                          <TableCell>
                            <BrokerStatusBadge status={client.status} />
                          </TableCell>
                        </>
                      )}
                      <TableCell className="font-mono text-[12px] text-[var(--fg-3)]">
                        {formatDate(client.updated_at)}
                      </TableCell>
                      {canManage ? (
                        <TableCell className="text-right">
                          <ClientDeleteButton
                            clientId={client.id}
                            clientName={brokerClientDisplayName(client)}
                            variant="row"
                          />
                        </TableCell>
                      ) : null}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="p-5">
              <EmptyState
                title={
                  search || activeStatus
                    ? "Aucun dossier ne correspond"
                    : carriersView
                      ? "Aucune compagnie"
                      : "Aucun dossier client"
                }
                description={
                  search || activeStatus
                    ? "Ajustez vos filtres ou votre recherche pour retrouver un dossier."
                    : carriersView
                      ? "Ouvrez un dossier compagnie pour y ranger les communications de vos partenaires et fournisseurs, hors de votre portefeuille client."
                      : "Créez votre premier dossier client pour commencer à centraliser ses informations et ses documents."
                }
                action={
                  search || activeStatus ? (
                    <Button asChild variant="ghost">
                      <Link
                        href={buildHref(
                          null,
                          undefined,
                          carriersView ? "carriers" : null,
                        )}
                      >
                        Réinitialiser les filtres
                      </Link>
                    </Button>
                  ) : (
                    <Button asChild>
                      <Link href="/courtier/clients/new">
                        {carriersView
                          ? "Créer un dossier compagnie"
                          : "Créer un dossier client"}
                      </Link>
                    </Button>
                  )
                }
              />
            </div>
          )}
        </section>
      </div>
    </PageTransition>
  );
}
