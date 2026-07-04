"use client";

import * as React from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Check, Lock, PenLine } from "lucide-react";
import { AdviceEditor } from "@/components/broker/advice-editor";
import {
  AdvicePdfPanel,
  type AdvicePdfInfo,
} from "@/components/broker/advice-pdf-panel";
import { AdviceSignaturePanel } from "@/components/broker/advice-signature-panel";
import { formatDate } from "@/lib/format";
import type { BrokerAdviceRow } from "@/types/database";

type StepState = "locked" | "active" | "done";

function bulletCount(text: string | null): number {
  if (!text) return 0;
  return text.split("\n").filter((line) => line.trim().startsWith("-")).length;
}

/**
 * One numbered step of the guided rail. The number column doubles as a
 * progress indicator: filled once done, outlined while active, muted while
 * locked. `last` removes the connector line below the marker.
 */
function Step({
  index,
  title,
  hint,
  state,
  action,
  last = false,
  children,
}: {
  index: number;
  title: string;
  hint: string;
  state: StepState;
  action?: React.ReactNode;
  last?: boolean;
  children: React.ReactNode;
}) {
  return (
    <li className="relative flex gap-4 pb-8 last:pb-0 sm:gap-5">
      {!last ? (
        <span
          aria-hidden
          className="absolute bottom-0 left-[15px] top-9 w-px"
          style={{ background: "var(--border-1)" }}
        />
      ) : null}

      <span
        className="fd-serif fd-numeric z-[1] flex size-8 shrink-0 select-none items-center justify-center rounded-full text-[13.5px] font-semibold"
        style={
          state === "done"
            ? {
                background: "var(--brand-navy-800)",
                color: "var(--fg-inverse)",
              }
            : state === "active"
              ? {
                  background: "var(--bg-surface)",
                  border: "1.5px solid var(--brand-navy-700)",
                  color: "var(--brand-navy-800)",
                }
              : {
                  background: "var(--bg-sunken)",
                  border: "1px solid var(--border-1)",
                  color: "var(--fg-4)",
                }
        }
      >
        {state === "done" ? (
          <Check className="size-4" strokeWidth={2.5} />
        ) : (
          index
        )}
      </span>

      <div className="min-w-0 flex-1 pt-[3px]">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <div className="min-w-0">
            <h2
              className="text-[14.5px] font-semibold tracking-[-0.005em]"
              style={{
                color: state === "locked" ? "var(--fg-4)" : "var(--fg-1)",
              }}
            >
              {title}
            </h2>
            <p
              className="mt-0.5 text-[12.5px] leading-5"
              style={{
                color: state === "locked" ? "var(--fg-4)" : "var(--fg-3)",
              }}
            >
              {hint}
            </p>
          </div>
          {action}
        </div>
        <div className="mt-3">{children}</div>
      </div>
    </li>
  );
}

function LockedNote({ children }: { children: React.ReactNode }) {
  return (
    <p
      className="inline-flex items-center gap-2 rounded-md border border-dashed px-3 py-2 text-[12px]"
      style={{ borderColor: "var(--border-2)", color: "var(--fg-4)" }}
    >
      <Lock className="size-3.5 shrink-0" strokeWidth={1.75} aria-hidden />
      {children}
    </p>
  );
}

function StepCard({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="rounded-xl border bg-[var(--bg-surface)] p-4 sm:p-5"
      style={{ borderColor: "var(--border-1)", boxShadow: "var(--shadow-sm)" }}
    >
      {children}
    </div>
  );
}

/**
 * Guided workflow of the devoir de conseil, in the only order that makes
 * sense: review & validate the drafted content, then produce the PDF, then
 * have it signed and sent. Later steps stay locked until the content is
 * validated (also enforced server-side).
 */
export function AdviceFlow({
  clientId,
  advice,
  pdf,
  outlookConnected,
  canEdit,
  electronicSignature,
}: {
  clientId: string;
  advice: BrokerAdviceRow;
  pdf: AdvicePdfInfo | null;
  outlookConnected: boolean;
  canEdit: boolean;
  /** SaaS offering only — the bespoke broker has no e-signature (DocuSeal). */
  electronicSignature: boolean;
}) {
  const reduceMotion = useReducedMotion();
  const reviewed = advice.status !== "draft";
  const signed = advice.status === "signed";
  const [contentOpen, setContentOpen] = React.useState(!reviewed);
  const pdfStepRef = React.useRef<HTMLDivElement | null>(null);

  function handleValidated() {
    setContentOpen(false);
    window.setTimeout(() => {
      pdfStepRef.current?.scrollIntoView({
        behavior: reduceMotion ? "auto" : "smooth",
        block: "center",
      });
    }, 300);
  }

  const requirementsCount = bulletCount(advice.requirements);
  const motifsCount = bulletCount(advice.content);
  const summaryParts = [
    requirementsCount > 0
      ? `${requirementsCount} exigence${requirementsCount > 1 ? "s" : ""}`
      : null,
    motifsCount > 0
      ? `${motifsCount} motif${motifsCount > 1 ? "s" : ""}`
      : null,
  ].filter(Boolean);

  return (
    <ol className="list-none">
      {/* 1 — Relire & ajuster le contenu */}
      <Step
        index={1}
        title="Relire & ajuster le contenu"
        hint={
          reviewed
            ? "Le contenu a été relu et validé. Vous pouvez encore le modifier."
            : "L'assistant a préparé les exigences et les motifs — relisez, corrigez, puis validez."
        }
        state={reviewed ? "done" : "active"}
        action={
          reviewed && !contentOpen && canEdit ? (
            <button
              type="button"
              onClick={() => setContentOpen(true)}
              className="inline-flex shrink-0 items-center gap-1.5 text-[12px] font-medium text-[var(--fg-link)] transition-colors hover:text-[var(--fg-link-hover)]"
            >
              <PenLine className="size-3.5" strokeWidth={1.75} />
              Modifier le contenu
            </button>
          ) : undefined
        }
      >
        <AnimatePresence initial={false} mode="wait">
          {contentOpen ? (
            <motion.div
              key="editor"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{
                duration: reduceMotion ? 0 : 0.24,
                ease: [0.16, 1, 0.3, 1],
              }}
              className="overflow-hidden"
            >
              <StepCard>
                <AdviceEditor
                  clientId={clientId}
                  advice={advice}
                  canEdit={canEdit}
                  onValidated={handleValidated}
                />
              </StepCard>
            </motion.div>
          ) : (
            <motion.div
              key="summary"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: reduceMotion ? 0 : 0.18 }}
              className="flex flex-wrap items-center gap-2.5 rounded-lg border px-3.5 py-2.5"
              style={{
                borderColor: "var(--status-signed-bd)",
                background: "var(--status-signed-bg)",
              }}
            >
              <Check
                className="size-4 shrink-0"
                strokeWidth={2.25}
                style={{ color: "var(--status-signed-fg)" }}
                aria-hidden
              />
              <p
                className="text-[12.5px] font-medium"
                style={{ color: "var(--status-signed-fg)" }}
              >
                Contenu validé
                {advice.validated_at
                  ? ` le ${formatDate(advice.validated_at)}`
                  : ""}
                {summaryParts.length > 0
                  ? ` · ${summaryParts.join(" · ")}`
                  : ""}
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </Step>

      {/* 2 — Document PDF */}
      <Step
        index={2}
        title="Générer le document PDF"
        hint="La fiche d'information et de conseil, mise en page à partir du contenu validé."
        state={!reviewed ? "locked" : pdf ? "done" : "active"}
      >
        <div ref={pdfStepRef}>
          {!reviewed ? (
            <LockedNote>
              Validez d&apos;abord le contenu (étape 1) pour générer le PDF.
            </LockedNote>
          ) : (
            <StepCard>
              <AdvicePdfPanel
                clientId={clientId}
                adviceId={advice.id}
                canEdit={canEdit}
                pdf={pdf}
              />
            </StepCard>
          )}
        </div>
      </Step>

      {/* 3 — Signature & envoi */}
      <Step
        index={3}
        title={
          electronicSignature ? "Faire signer & envoyer" : "Envoyer & faire signer"
        }
        hint={
          electronicSignature
            ? "Créez le lien de signature électronique, puis préparez un brouillon Outlook prêt à relire — rien ne part sans vous."
            : "Préparez un brouillon Outlook prêt à relire — rien ne part sans vous — puis marquez le document signé une fois retourné."
        }
        state={!reviewed ? "locked" : signed ? "done" : "active"}
        last
      >
        {!reviewed ? (
          <LockedNote>
            Disponible une fois le contenu validé et le PDF prêt.
          </LockedNote>
        ) : (
          <AdviceSignaturePanel
            clientId={clientId}
            adviceId={advice.id}
            status={advice.status}
            signatureUrl={advice.signature_url}
            outlookConnected={outlookConnected}
            canEdit={canEdit}
            electronicSignature={electronicSignature}
          />
        )}
      </Step>
    </ol>
  );
}
