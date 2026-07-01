import Link from "next/link";
import { notFound } from "next/navigation";
import { Check, ChevronRight, FileText, PenLine, Send } from "lucide-react";
import type { ReactNode } from "react";
import { PageTransition } from "@/components/common/page-transition";
import { AdviceEditor } from "@/components/broker/advice-editor";
import { AdvicePdfPanel } from "@/components/broker/advice-pdf-panel";
import { AdviceSignaturePanel } from "@/components/broker/advice-signature-panel";
import { AdviceStatusBadge } from "@/components/broker/advice-status-badge";
import { BrokerAvatar } from "@/components/broker/broker-avatar";
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

// Workflow progress derived from the advice status.
const statusProgress: Record<string, number> = {
  draft: 0,
  validated: 1,
  sent_for_signature: 2,
  signed: 3,
};

function Stepper({ progress }: { progress: number }) {
  const steps: { label: string; icon: ReactNode }[] = [
    { label: "Rédiger & valider", icon: <PenLine className="size-3.5" strokeWidth={2} /> },
    { label: "Signature électronique", icon: <FileText className="size-3.5" strokeWidth={2} /> },
    { label: "Brouillon d’envoi", icon: <Send className="size-3.5" strokeWidth={2} /> },
  ];
  return (
    <ol className="flex items-center gap-1.5">
      {steps.map((step, i) => {
        const done = progress > i;
        const active = progress === i;
        return (
          <li key={step.label} className="flex flex-1 items-center gap-1.5">
            <div
              className="flex min-w-0 flex-1 items-center gap-2 rounded-lg border px-3 py-2"
              style={{
                borderColor: done
                  ? "var(--accent-soft)"
                  : active
                    ? "var(--brand-navy-300)"
                    : "var(--border-1)",
                background: done
                  ? "var(--accent-soft)"
                  : active
                    ? "var(--brand-navy-50)"
                    : "var(--bg-surface)",
              }}
            >
              <span
                className="flex size-6 shrink-0 items-center justify-center rounded-full"
                style={{
                  background: done
                    ? "var(--accent)"
                    : active
                      ? "var(--brand-navy-800)"
                      : "var(--bg-sunken)",
                  color: done || active ? "#fff" : "var(--fg-4)",
                }}
              >
                {done ? <Check className="size-3.5" strokeWidth={2.5} /> : step.icon}
              </span>
              <span
                className="truncate text-[12px] font-medium"
                style={{
                  color: done
                    ? "var(--accent-foreground)"
                    : active
                      ? "var(--fg-1)"
                      : "var(--fg-3)",
                }}
              >
                {step.label}
              </span>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

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
  const progress = statusProgress[advice.status] ?? 0;

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

        {/* Hero */}
        <header
          className="overflow-hidden rounded-2xl border px-5 py-6 sm:px-6"
          style={{
            borderColor: "var(--border-1)",
            background:
              "linear-gradient(135deg, var(--accent-soft) 0%, var(--bg-surface) 60%)",
            boxShadow: "var(--shadow-sm)",
          }}
        >
          <div className="flex items-start justify-between gap-4">
            <div className="flex min-w-0 items-start gap-3.5">
              <BrokerAvatar name={clientName} size={48} />
              <div className="min-w-0">
                <p className="fd-eyebrow text-[var(--accent-foreground)]">
                  Devoir de conseil
                </p>
                <h1 className="mt-1.5 text-[24px] font-semibold leading-tight tracking-[-0.02em] text-[var(--fg-1)] sm:text-[28px]">
                  {client.client_type === "company"
                    ? clientName
                    : `Conseil pour ${clientName}`}
                </h1>
              </div>
            </div>
            <AdviceStatusBadge status={advice.status} />
          </div>

          <div className="mt-5">
            <Stepper progress={progress} />
          </div>
        </header>

        <p className="px-1 text-[12px] leading-5 text-[var(--fg-3)]">
          FalconDraft vous assiste, mais ne se substitue pas à votre
          responsabilité professionnelle : relisez, complétez et validez ce
          document avant toute transmission au client.
        </p>

        <section
          className="rounded-xl border bg-[var(--bg-surface)] p-5 sm:p-6"
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
          className="rounded-xl border bg-[var(--bg-surface)] p-5"
          style={{
            borderColor: "var(--border-1)",
            boxShadow: "var(--shadow-sm)",
          }}
        >
          <h2 className="text-[14px] font-semibold text-[var(--fg-1)]">
            Document PDF
          </h2>
          <p className="mb-4 mt-1 text-[12.5px] leading-5 text-[var(--fg-3)]">
            Générez la fiche d’information et de conseil au format PDF, prête à
            relire, télécharger et faire signer.
          </p>
          <AdvicePdfPanel
            clientId={clientId}
            adviceId={advice.id}
            canEdit={canEdit}
          />
        </section>

        <section
          className="rounded-xl border bg-[var(--bg-surface)] p-5"
          style={{
            borderColor: "var(--border-1)",
            boxShadow: "var(--shadow-sm)",
          }}
        >
          <h2 className="text-[14px] font-semibold text-[var(--fg-1)]">
            Signature & envoi
          </h2>
          <p className="mb-4 mt-1 text-[12.5px] leading-5 text-[var(--fg-3)]">
            Préparez la signature électronique et un brouillon Outlook prêt à
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
