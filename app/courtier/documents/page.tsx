import Link from "next/link";
import { FileText, HardDrive } from "lucide-react";
import { EmptyState } from "@/components/common/empty-state";
import { PageHeader } from "@/components/common/page-header";
import { PageTransition } from "@/components/common/page-transition";
import { DeleteRowButton } from "@/components/broker/delete-row-button";
import { DocumentDownloadButton } from "@/components/broker/document-download-button";
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
import { documentCategoryLabel } from "@/lib/broker/documents";
import { getBrokerClients, getBrokerDocuments } from "@/lib/broker/data";
import { computeStorageUsage, formatBytes } from "@/lib/broker/storage";
import { formatDate } from "@/lib/format";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function CourtierDocumentsPage() {
  const context = await requireActiveWorkspaceContext();
  const organization = context.organization!;
  const organizationId = organization.id;
  const canEdit = canCreateWorkspaceRecords(context.membership?.role);

  const [documents, clients] = await Promise.all([
    getBrokerDocuments(organizationId, { limit: 300 }),
    // GED : un document peut être rangé dans un dossier compagnie.
    getBrokerClients(organizationId, { limit: 1000, scope: "all" }),
  ]);

  const clientNameById = new Map(
    clients.map((client) => [client.id, brokerClientDisplayName(client)]),
  );
  const usage = computeStorageUsage(organization);
  const barColor =
    usage.level === "full" || usage.level === "critical"
      ? "var(--destructive)"
      : usage.level === "warning"
        ? "var(--warning)"
        : "var(--accent)";

  return (
    <PageTransition>
      <div className="space-y-5">
        <PageHeader
          title="Documents"
          description="Tous les documents de vos dossiers clients, classés et sécurisés."
        />

        <section
          className="rounded-lg border bg-[var(--bg-surface)] p-4 sm:p-5"
          style={{
            borderColor: "var(--border-1)",
            boxShadow: "var(--shadow-sm)",
          }}
        >
          <div className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-2 text-[13px] font-semibold text-[var(--fg-1)]">
              <HardDrive
                className="size-4 text-[var(--brand-navy-700)]"
                strokeWidth={1.75}
              />
              Espace de stockage
            </span>
            <span className="text-[12.5px] text-[var(--fg-3)]">
              {formatBytes(usage.usedBytes)} / {formatBytes(usage.limitBytes)} ·{" "}
              {usage.percent}%
            </span>
          </div>
          <div
            className="mt-3 h-2 w-full overflow-hidden rounded-full"
            style={{ background: "var(--brand-navy-50)" }}
          >
            <div
              className="h-full rounded-full transition-[width] duration-300"
              style={{
                width: `${Math.max(2, usage.percent)}%`,
                background: barColor,
              }}
            />
          </div>
        </section>

        <section
          className="overflow-hidden rounded-lg border bg-[var(--bg-surface)]"
          style={{
            borderColor: "var(--border-1)",
            boxShadow: "var(--shadow-sm)",
          }}
        >
          {documents.length > 0 ? (
            // table-fixed : la ligne tient toujours dans la largeur de l'écran.
            // Un titre long est tronqué (complet au survol) au lieu d'étirer sa
            // colonne, et sur écran étroit les colonnes secondaires se replient
            // sous le titre plutôt que d'imposer un défilement horizontal.
            <Table className="table-fixed">
              <TableHeader>
                <TableRow
                  className="hover:bg-transparent"
                  style={{ background: "var(--bg-sunken)" }}
                >
                  <TableHead className="h-10 text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--fg-3)]">Document</TableHead>
                  <TableHead className="hidden w-[24%] h-10 text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--fg-3)] sm:table-cell lg:w-[20%]">
                    Dossier
                  </TableHead>
                  <TableHead className="hidden w-[15%] h-10 text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--fg-3)] lg:table-cell">
                    Type
                  </TableHead>
                  <TableHead className="hidden w-[84px] h-10 text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--fg-3)] lg:table-cell">
                    Taille
                  </TableHead>
                  <TableHead className="hidden w-[104px] h-10 text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--fg-3)] md:table-cell">
                    Ajouté
                  </TableHead>
                  <TableHead className={canEdit ? "h-10 w-[128px]" : "h-10 w-[96px]"} />
                </TableRow>
              </TableHeader>
              <TableBody>
                {documents.map((doc) => {
                  const dossierName = clientNameById.get(doc.client_id) ?? "Dossier";
                  return (
                    <TableRow key={doc.id} className="duration-100">
                      <TableCell className="overflow-hidden">
                        <span className="flex min-w-0 items-center gap-2.5">
                          <FileText
                            className="size-4 shrink-0 text-[var(--brand-navy-700)]"
                            strokeWidth={1.75}
                          />
                          <span className="min-w-0">
                            <span
                              className="block truncate text-[13px] font-medium text-[var(--fg-1)]"
                              title={doc.title}
                            >
                              {doc.title}
                            </span>
                            {/* Ce que les colonnes masquées auraient dit. */}
                            <span className="block truncate text-[11.5px] leading-5 text-[var(--fg-3)] lg:hidden">
                              <span className="sm:hidden">{dossierName} · </span>
                              {documentCategoryLabel(doc.category)} ·{" "}
                              {formatBytes(doc.size_bytes)}
                              <span className="md:hidden"> · {formatDate(doc.created_at)}</span>
                            </span>
                          </span>
                        </span>
                      </TableCell>
                      <TableCell className="hidden overflow-hidden sm:table-cell">
                        <Link
                          href={`/courtier/clients/${doc.client_id}`}
                          className="block truncate text-[13px] text-[var(--brand-navy-700)] transition-colors hover:text-[var(--brand-navy-800)] hover:underline"
                          title={dossierName}
                        >
                          {dossierName}
                        </Link>
                      </TableCell>
                      <TableCell className="hidden truncate text-[13px] text-[var(--fg-2)] lg:table-cell">
                        {documentCategoryLabel(doc.category)}
                      </TableCell>
                      <TableCell className="fd-numeric hidden text-[12.5px] text-[var(--fg-2)] lg:table-cell">
                        {formatBytes(doc.size_bytes)}
                      </TableCell>
                      <TableCell className="hidden font-mono text-[12px] text-[var(--fg-3)] md:table-cell">
                        {formatDate(doc.created_at)}
                      </TableCell>
                      <TableCell className="px-2 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <DocumentDownloadButton
                            clientId={doc.client_id}
                            documentId={doc.id}
                            title={doc.title || doc.file_name}
                          />
                          {canEdit ? (
                            <DeleteRowButton
                              endpoint={`/api/broker/clients/${doc.client_id}/documents/${doc.id}`}
                              label="Supprimer le document"
                              itemName={doc.title || doc.file_name}
                              successMessage="Document supprimé."
                            />
                          ) : null}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          ) : (
            <div className="p-5">
              <EmptyState
                title="Aucun document"
                description="Les documents importés dans vos dossiers clients apparaîtront ici. Ouvrez un dossier pour ajouter contrats, pièces d’identité, RIB et devis."
              />
            </div>
          )}
        </section>
      </div>
    </PageTransition>
  );
}
