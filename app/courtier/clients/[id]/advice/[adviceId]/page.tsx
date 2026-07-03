import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { PageTransition } from "@/components/common/page-transition";
import { AdviceDeleteButton } from "@/components/broker/advice-delete-button";
import { AdviceFlow } from "@/components/broker/advice-flow";
import { AdviceStatusBadge } from "@/components/broker/advice-status-badge";
import { requireActiveWorkspaceContext } from "@/lib/auth/session";
import {
  canCreateWorkspaceRecords,
  isWorkspaceManager,
} from "@/lib/auth/workspace-permissions";
import { brokerClientDisplayName } from "@/lib/broker/clients";
import {
  getBrokerAdvice,
  getBrokerAdvicePdfDocument,
  getBrokerClient,
  getBrokerQuote,
} from "@/lib/broker/data";
import { getOutlookConnectionForUser } from "@/lib/email/connections";
import { formatLongDate } from "@/lib/format";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AdviceWorkspacePage({
  params,
}: {
  params: Promise<{ id: string; adviceId: string }>;
}) {
  const context = await requireActiveWorkspaceContext();
  const organizationId = context.organization!.id;
  const { id: clientId, adviceId } = await params;

  const [client, advice, outlook] = await Promise.all([
    getBrokerClient(organizationId, clientId),
    getBrokerAdvice(organizationId, adviceId),
    getOutlookConnectionForUser({ organizationId, userId: context.user.id }),
  ]);

  if (!client || !advice || advice.client_id !== clientId) {
    notFound();
  }

  const [pdfDocument, quote] = await Promise.all([
    getBrokerAdvicePdfDocument(organizationId, clientId, adviceId),
    advice.quote_id
      ? getBrokerQuote(organizationId, advice.quote_id)
      : Promise.resolve(null),
  ]);

  const canEdit = canCreateWorkspaceRecords(context.membership?.role);
  const canDelete = isWorkspaceManager(context.membership?.role);
  const clientName = brokerClientDisplayName(client);
  const outlookConnected = outlook?.status === "connected";

  const metaParts = [
    `Généré le ${formatLongDate(new Date(advice.generated_at ?? advice.created_at))}`,
    quote
      ? `basé sur le devis ${[quote.insurer_name, quote.product_name]
          .filter(Boolean)
          .join(" — ")}`
      : null,
  ].filter(Boolean);

  return (
    <PageTransition>
      <div className="mx-auto max-w-3xl space-y-6">
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
          <span style={{ color: "var(--fg-1)", fontWeight: 600 }}>
            Devoir de conseil
          </span>
        </nav>

        {/* Document header — quiet, ledger-like, no gradient */}
        <header
          className="relative border-b pb-5"
          style={{ borderColor: "var(--border-1)" }}
        >
          <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
            <div className="min-w-0">
              <p className="fd-eyebrow text-[var(--accent-foreground)]">
                Devoir de conseil
              </p>
              <h1 className="mt-1.5 text-[24px] font-semibold leading-tight tracking-[-0.02em] text-[var(--fg-1)] sm:text-[28px]">
                {client.client_type === "company"
                  ? clientName
                  : `Conseil pour ${clientName}`}
              </h1>
              <p className="fd-meta mt-2">{metaParts.join(" · ")}</p>
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              <AdviceStatusBadge status={advice.status} />
              {canDelete ? (
                <AdviceDeleteButton
                  clientId={clientId}
                  adviceId={advice.id}
                  redirectTo={`/courtier/clients/${clientId}`}
                />
              ) : null}
            </div>
          </div>
          <span
            aria-hidden
            className="absolute -bottom-px left-0 h-[2px] w-10"
            style={{ background: "var(--accent)" }}
          />
        </header>

        <AdviceFlow
          clientId={clientId}
          advice={advice}
          pdf={
            pdfDocument
              ? {
                  documentId: pdfDocument.id,
                  generatedAt: pdfDocument.created_at,
                }
              : null
          }
          outlookConnected={outlookConnected}
          canEdit={canEdit}
        />

        <p className="text-[12px] leading-5 text-[var(--fg-4)]">
          FalconDraft vous assiste, mais ne se substitue pas à votre
          responsabilité professionnelle : relisez, complétez et validez ce
          document avant toute transmission au client.
        </p>
      </div>
    </PageTransition>
  );
}
