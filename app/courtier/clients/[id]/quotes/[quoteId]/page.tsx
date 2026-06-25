import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight, FileText, ScanLine } from "lucide-react";
import { PageTransition } from "@/components/common/page-transition";
import { DocumentDownloadButton } from "@/components/broker/document-download-button";
import { QuoteStatusBadge } from "@/components/broker/quote-status-badge";
import { QuoteValidationForm } from "@/components/broker/quote-validation-form";
import { requireActiveWorkspaceContext } from "@/lib/auth/session";
import {
  canCreateWorkspaceRecords,
  isWorkspaceManager,
} from "@/lib/auth/workspace-permissions";
import { brokerClientDisplayName } from "@/lib/broker/clients";
import {
  getBrokerClient,
  getBrokerClientDocuments,
  getBrokerQuote,
} from "@/lib/broker/data";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function QuoteValidationPage({
  params,
}: {
  params: Promise<{ id: string; quoteId: string }>;
}) {
  const context = await requireActiveWorkspaceContext();
  const organizationId = context.organization!.id;
  const { id: clientId, quoteId } = await params;

  const [client, quote] = await Promise.all([
    getBrokerClient(organizationId, clientId),
    getBrokerQuote(organizationId, quoteId),
  ]);

  if (!client || !quote || quote.client_id !== clientId) {
    notFound();
  }

  const canEdit = canCreateWorkspaceRecords(context.membership?.role);
  const canDelete = isWorkspaceManager(context.membership?.role);
  const clientName = brokerClientDisplayName(client);

  // Resolve the source document (if any) for download.
  const documents = quote.document_id
    ? await getBrokerClientDocuments(organizationId, clientId)
    : [];
  const sourceDocument = quote.document_id
    ? documents.find((doc) => doc.id === quote.document_id)
    : undefined;

  const isValidated = quote.extraction_status === "validated";

  return (
    <PageTransition>
      <div className="mx-auto max-w-3xl space-y-5">
        <nav
          className="flex flex-wrap items-center gap-1.5 text-[12px]"
          style={{ color: "var(--fg-3)" }}
          aria-label="Breadcrumb"
        >
          <Link href="/courtier/clients" className="hover:text-[var(--fg-1)]">
            Dossiers clients
          </Link>
          <ChevronRight className="size-3" strokeWidth={2} aria-hidden="true" />
          <Link
            href={`/courtier/clients/${clientId}`}
            className="hover:text-[var(--fg-1)]"
          >
            {clientName}
          </Link>
          <ChevronRight className="size-3" strokeWidth={2} aria-hidden="true" />
          <span style={{ color: "var(--fg-1)", fontWeight: 600 }}>Devis</span>
        </nav>

        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="fd-eyebrow mb-2">Devis compagnie</p>
            <h1 className="text-[24px] font-semibold leading-tight tracking-[-0.02em] text-[var(--fg-1)] sm:text-[28px]">
              Vérifier & valider le devis
            </h1>
          </div>
          <QuoteStatusBadge status={quote.extraction_status} />
        </div>

        {/* Extraction-status banner */}
        {!isValidated ? (
          <div
            className="flex items-start gap-3 rounded-lg border px-4 py-3.5"
            style={{
              borderColor: "var(--brand-amber-200)",
              background: "var(--brand-amber-50)",
            }}
          >
            <ScanLine
              className="mt-0.5 size-4 shrink-0"
              strokeWidth={1.75}
              style={{ color: "var(--brand-amber-800)" }}
            />
            <div>
              <p className="text-[13px] font-semibold text-[var(--brand-amber-900)]">
                Extraction automatique bientôt disponible
              </p>
              <p className="mt-0.5 text-[12.5px] leading-5 text-[var(--brand-amber-800)]">
                L’analyse automatique du devis arrive prochainement. En
                attendant, vérifiez et complétez les informations ci-dessous,
                puis validez. Vous restez seul responsable des informations
                retenues.
              </p>
            </div>
          </div>
        ) : (
          <div
            className="flex items-start gap-3 rounded-lg border px-4 py-3.5"
            style={{
              borderColor: "var(--status-signed-bd)",
              background: "var(--status-signed-bg)",
            }}
          >
            <p className="text-[13px] leading-5 text-[var(--status-signed-fg)]">
              Ce devis a été vérifié et validé. Il peut servir de base au devoir
              de conseil.
            </p>
          </div>
        )}

        {sourceDocument ? (
          <div
            className="flex items-center gap-3 rounded-lg border px-4 py-3"
            style={{
              borderColor: "var(--border-1)",
              background: "var(--bg-surface)",
            }}
          >
            <span
              className="flex size-9 shrink-0 items-center justify-center rounded-lg"
              style={{
                background: "var(--brand-navy-50)",
                border: "1px solid var(--border-1)",
                color: "var(--brand-navy-700)",
              }}
            >
              <FileText className="size-4" strokeWidth={1.75} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-semibold text-[var(--fg-1)]">
                {sourceDocument.title}
              </p>
              <p className="text-[11.5px] text-[var(--fg-3)]">
                Devis source importé
              </p>
            </div>
            <DocumentDownloadButton
              clientId={clientId}
              documentId={sourceDocument.id}
            />
          </div>
        ) : null}

        <section
          className="rounded-lg border bg-[var(--bg-surface)] p-5 sm:p-6"
          style={{
            borderColor: "var(--border-1)",
            boxShadow: "var(--shadow-sm)",
          }}
        >
          <QuoteValidationForm
            canDelete={canDelete}
            clientId={clientId}
            quote={quote}
            canEdit={canEdit}
          />
        </section>
      </div>
    </PageTransition>
  );
}
