import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight, ShieldCheck } from "lucide-react";
import { PageTransition } from "@/components/common/page-transition";
import { AdviceEditor } from "@/components/broker/advice-editor";
import { AdviceSignaturePanel } from "@/components/broker/advice-signature-panel";
import { AdviceStatusBadge } from "@/components/broker/advice-status-badge";
import { requireActiveWorkspaceContext } from "@/lib/auth/session";
import {
  canCreateWorkspaceRecords,
  isWorkspaceManager,
} from "@/lib/auth/workspace-permissions";
import { brokerClientDisplayName } from "@/lib/broker/clients";
import { getBrokerAdvice, getBrokerClient } from "@/lib/broker/data";
import { getOutlookConnectionForUser } from "@/lib/email/connections";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AdviceEditorPage({
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

  const canEdit = canCreateWorkspaceRecords(context.membership?.role);
  const canDelete = isWorkspaceManager(context.membership?.role);
  const clientName = brokerClientDisplayName(client);
  const outlookConnected = outlook?.status === "connected";

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
          <span style={{ color: "var(--fg-1)", fontWeight: 600 }}>
            Devoir de conseil
          </span>
        </nav>

        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="fd-eyebrow mb-2">Devoir de conseil</p>
            <h1 className="text-[24px] font-semibold leading-tight tracking-[-0.02em] text-[var(--fg-1)] sm:text-[28px]">
              {client.client_type === "company"
                ? clientName
                : `Conseil pour ${clientName}`}
            </h1>
          </div>
          <AdviceStatusBadge status={advice.status} />
        </div>

        <div
          className="flex items-start gap-3 rounded-lg border px-4 py-3.5"
          style={{
            borderColor: "var(--border-1)",
            background: "var(--brand-navy-50)",
          }}
        >
          <ShieldCheck
            className="mt-0.5 size-4 shrink-0"
            strokeWidth={1.75}
            style={{ color: "var(--brand-navy-700)" }}
          />
          <p className="text-[12.5px] leading-5 text-[var(--fg-2)]">
            FalconDraft vous assiste dans la rédaction, mais ne se substitue pas
            à votre responsabilité professionnelle. Relisez, complétez et validez
            ce document avant toute transmission au client.
          </p>
        </div>

        <section
          className="rounded-lg border bg-[var(--bg-surface)] p-5 sm:p-6"
          style={{
            borderColor: "var(--border-1)",
            boxShadow: "var(--shadow-sm)",
          }}
        >
          <AdviceEditor
            clientId={clientId}
            advice={advice}
            canEdit={canEdit}
            canDelete={canDelete}
          />
        </section>

        <section
          className="rounded-lg border bg-[var(--bg-surface)] p-5"
          style={{
            borderColor: "var(--border-1)",
            boxShadow: "var(--shadow-sm)",
          }}
        >
          <h2 className="text-[14px] font-semibold text-[var(--fg-1)]">
            Signature & envoi
          </h2>
          <p className="mt-1 mb-4 text-[12.5px] leading-5 text-[var(--fg-3)]">
            Préparez la demande de signature et un brouillon Outlook prêt à
            relire. Aucun email n’est jamais envoyé automatiquement.
          </p>
          <AdviceSignaturePanel
            clientId={clientId}
            adviceId={advice.id}
            status={advice.status}
            signatureUrl={advice.signature_url}
            outlookConnected={outlookConnected}
            canEdit={canEdit}
          />
        </section>
      </div>
    </PageTransition>
  );
}
