import Link from "next/link";
import { FileText, HardDrive } from "lucide-react";
import { EmptyState } from "@/components/common/empty-state";
import { PageHeader } from "@/components/common/page-header";
import { PageTransition } from "@/components/common/page-transition";
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

  const [documents, clients] = await Promise.all([
    getBrokerDocuments(organizationId, { limit: 300 }),
    getBrokerClients(organizationId, { limit: 1000 }),
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
            <div className="-mx-px overflow-x-auto">
              <Table className="min-w-[680px]">
                <TableHeader>
                  <TableRow
                    className="hover:bg-transparent"
                    style={{ background: "var(--bg-sunken)" }}
                  >
                    <TableHead className="h-10 text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--fg-3)]">
                      Document
                    </TableHead>
                    <TableHead className="h-10 text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--fg-3)]">
                      Dossier
                    </TableHead>
                    <TableHead className="h-10 text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--fg-3)]">
                      Type
                    </TableHead>
                    <TableHead className="h-10 text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--fg-3)]">
                      Taille
                    </TableHead>
                    <TableHead className="h-10 text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--fg-3)]">
                      Ajouté
                    </TableHead>
                    <TableHead className="h-10" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {documents.map((doc) => (
                    <TableRow key={doc.id} className="duration-100">
                      <TableCell>
                        <span className="flex items-center gap-2.5">
                          <FileText
                            className="size-4 shrink-0 text-[var(--brand-navy-700)]"
                            strokeWidth={1.75}
                          />
                          <span className="truncate text-[13px] font-medium text-[var(--fg-1)]">
                            {doc.title}
                          </span>
                        </span>
                      </TableCell>
                      <TableCell>
                        <Link
                          href={`/courtier/clients/${doc.client_id}`}
                          className="text-[13px] text-[var(--brand-navy-700)] transition-colors hover:text-[var(--brand-navy-800)] hover:underline"
                        >
                          {clientNameById.get(doc.client_id) ?? "Dossier"}
                        </Link>
                      </TableCell>
                      <TableCell className="text-[13px] text-[var(--fg-2)]">
                        {documentCategoryLabel(doc.category)}
                      </TableCell>
                      <TableCell className="fd-numeric text-[12.5px] text-[var(--fg-2)]">
                        {formatBytes(doc.size_bytes)}
                      </TableCell>
                      <TableCell className="font-mono text-[12px] text-[var(--fg-3)]">
                        {formatDate(doc.created_at)}
                      </TableCell>
                      <TableCell className="text-right">
                        <DocumentDownloadButton
                          clientId={doc.client_id}
                          documentId={doc.id}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
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
