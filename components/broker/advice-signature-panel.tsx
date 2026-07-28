"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";
import {
  AlertTriangle,
  Ban,
  BellRing,
  Check,
  CheckCircle2,
  Copy,
  Download,
  Eye,
  FileSignature,
  Loader2,
  Mail,
  RefreshCw,
  Send,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { BrokerAdviceRow } from "@/types/database";

type Busy =
  | "none"
  | "draft"
  | "link"
  | "signed"
  | "create"
  | "refresh"
  | "remind"
  | "cancel";

function formatMoment(value: string | null): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleString("fr-FR", {
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDay(value: string | null): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function AdviceSignaturePanel({
  clientId,
  advice,
  outlookConnected,
  canEdit,
  electronicSignature,
}: {
  clientId: string;
  advice: BrokerAdviceRow;
  outlookConnected: boolean;
  canEdit: boolean;
  /**
   * Whether the offering includes electronic signature. When false the document
   * is signed off-platform (in person or by return email) and simply marked
   * here.
   */
  electronicSignature: boolean;
}) {
  const router = useRouter();
  const adviceId = advice.id;
  const status = advice.status;
  const signatureUrl = advice.signature_url;
  const signatureStatus = advice.signature_status;

  const [link, setLink] = React.useState(signatureUrl ?? "");
  const [busy, setBusy] = React.useState<Busy>("none");
  const [copied, setCopied] = React.useState(false);

  const isSigned = status === "signed";
  const hasRequest = Boolean(signatureUrl);
  /** A link pasted by hand has no provider request behind it: no reminder,
   *  no status sync, no cancellation — only the link itself. */
  const isTracked = Boolean(advice.docuseal_submission_id);
  const isDeclined = signatureStatus === "declined";
  const isExpired = signatureStatus === "expired";
  const isPending = hasRequest && !isSigned && !isDeclined && !isExpired;

  // The webhook is the primary path, but a deployment without a public webhook
  // URL still has to converge — one silent reconcile when the panel opens.
  const reconciled = React.useRef(false);
  React.useEffect(() => {
    if (!isPending || !isTracked || reconciled.current) return;
    reconciled.current = true;
    let cancelled = false;
    void (async () => {
      const res = await fetch(
        `/api/broker/clients/${clientId}/advice/${adviceId}/signature/docuseal`,
      ).catch(() => null);
      if (!res?.ok || cancelled) return;
      const data = (await res.json().catch(() => null)) as {
        changed?: boolean;
      } | null;
      if (data?.changed && !cancelled) router.refresh();
    })();
    return () => {
      cancelled = true;
    };
  }, [isPending, isTracked, clientId, adviceId, router]);

  async function createDraft() {
    setBusy("draft");
    try {
      const res = await fetch(
        `/api/broker/clients/${clientId}/advice/${adviceId}/outlook-draft`,
        { method: "POST" },
      );
      const data = (await res.json().catch(() => null)) as {
        success?: boolean;
        message?: string;
      } | null;
      if (!res.ok || !data?.success) {
        toast.error("Brouillon non créé", { description: data?.message });
        return;
      }
      toast.success("Brouillon prêt dans Outlook", {
        description: "Relisez-le puis envoyez-le depuis Outlook.",
      });
      router.refresh();
    } finally {
      setBusy("none");
    }
  }

  async function patchSignature(payload: {
    signatureUrl?: string;
    markSigned?: boolean;
  }) {
    const res = await fetch(
      `/api/broker/clients/${clientId}/advice/${adviceId}/signature`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      },
    );
    const data = (await res.json().catch(() => null)) as {
      success?: boolean;
      message?: string;
    } | null;
    return { ok: res.ok && data?.success, message: data?.message };
  }

  async function saveLink() {
    if (!link.trim()) {
      toast.error("Collez d’abord le lien de signature.");
      return;
    }
    setBusy("link");
    try {
      const r = await patchSignature({ signatureUrl: link.trim() });
      if (!r.ok) {
        toast.error("Enregistrement impossible", { description: r.message });
        return;
      }
      toast.success("Lien de signature enregistré.");
      router.refresh();
    } finally {
      setBusy("none");
    }
  }

  async function markSigned() {
    setBusy("signed");
    try {
      const r = await patchSignature({ markSigned: true });
      if (!r.ok) {
        toast.error("Action impossible", { description: r.message });
        return;
      }
      toast.success("Devoir de conseil marqué comme signé.");
      router.refresh();
    } finally {
      setBusy("none");
    }
  }

  async function createRequest() {
    setBusy("create");
    try {
      const res = await fetch(
        `/api/broker/clients/${clientId}/advice/${adviceId}/signature/docuseal`,
        { method: "POST" },
      );
      const data = (await res.json().catch(() => null)) as {
        success?: boolean;
        url?: string;
        message?: string;
      } | null;
      if (!res.ok || !data?.success) {
        toast.error("Demande de signature non créée", {
          description: data?.message,
        });
        return;
      }
      toast.success("Demande de signature prête", {
        description: "Préparez le brouillon Outlook pour l’envoyer au client.",
      });
      router.refresh();
    } finally {
      setBusy("none");
    }
  }

  async function refreshStatus() {
    setBusy("refresh");
    try {
      const res = await fetch(
        `/api/broker/clients/${clientId}/advice/${adviceId}/signature/docuseal`,
      );
      const data = (await res.json().catch(() => null)) as {
        success?: boolean;
        signed?: boolean;
        changed?: boolean;
        message?: string;
      } | null;
      if (!res.ok || !data?.success) {
        toast.error("Statut indisponible", { description: data?.message });
        return;
      }
      if (data.signed) {
        toast.success("Le client a signé le devoir de conseil.");
        router.refresh();
      } else if (data.changed) {
        toast.info("Statut mis à jour.");
        router.refresh();
      } else {
        toast.info("Toujours en attente de signature.");
      }
    } finally {
      setBusy("none");
    }
  }

  async function sendReminder() {
    setBusy("remind");
    try {
      const res = await fetch(
        `/api/broker/clients/${clientId}/advice/${adviceId}/signature/docuseal/reminder`,
        { method: "POST" },
      );
      const data = (await res.json().catch(() => null)) as {
        success?: boolean;
        message?: string;
      } | null;
      if (!res.ok || !data?.success) {
        toast.error("Rappel non envoyé", { description: data?.message });
        return;
      }
      toast.success("Rappel envoyé au client.");
      router.refresh();
    } finally {
      setBusy("none");
    }
  }

  async function cancelRequest() {
    setBusy("cancel");
    try {
      const res = await fetch(
        `/api/broker/clients/${clientId}/advice/${adviceId}/signature/docuseal`,
        { method: "DELETE" },
      );
      const data = (await res.json().catch(() => null)) as {
        success?: boolean;
        message?: string;
      } | null;
      if (!res.ok || !data?.success) {
        toast.error("Annulation impossible", { description: data?.message });
        return;
      }
      toast.success("Demande annulée — le lien ne fonctionne plus.");
      router.refresh();
    } finally {
      setBusy("none");
    }
  }

  /**
   * The download route hands back a short-lived signed URL as JSON rather than
   * streaming the file — linking straight to it would show the raw JSON.
   */
  async function openDocument(documentId: string) {
    const res = await fetch(
      `/api/broker/clients/${clientId}/documents/${documentId}/download`,
    ).catch(() => null);
    const data = (await res?.json().catch(() => null)) as {
      url?: string;
      message?: string;
    } | null;
    if (!res?.ok || !data?.url) {
      toast.error("Téléchargement indisponible", {
        description: data?.message,
      });
      return;
    }
    window.open(data.url, "_blank", "noopener,noreferrer");
  }

  async function copyLink() {
    if (!signatureUrl) return;
    try {
      await navigator.clipboard.writeText(signatureUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
      toast.success("Lien copié.");
    } catch {
      toast.error("Copie impossible", {
        description: "Sélectionnez le lien et copiez-le manuellement.",
      });
    }
  }

  /* ------------------------------------------------------------------ */
  /*  Signé                                                             */
  /* ------------------------------------------------------------------ */

  if (isSigned) {
    const signedAt = formatMoment(advice.signature_completed_at);
    // The document was rewritten after it was signed: the archived signature no
    // longer covers what the file now holds.
    const outdated = signatureStatus === "superseded";
    return (
      <div className="space-y-3">
        <div
          className="flex items-start gap-2.5 rounded-md border px-4 py-3 text-[13px]"
          style={
            outdated
              ? {
                  borderColor: "var(--status-draft-bd)",
                  background: "var(--status-draft-bg)",
                  color: "var(--status-draft-fg)",
                }
              : {
                  borderColor: "var(--status-signed-bd)",
                  background: "var(--status-signed-bg)",
                  color: "var(--status-signed-fg)",
                }
          }
        >
          {outdated ? (
            <AlertTriangle
              className="mt-px size-4 shrink-0"
              strokeWidth={2}
              aria-hidden="true"
            />
          ) : (
            <CheckCircle2
              className="mt-px size-4 shrink-0"
              strokeWidth={2}
              aria-hidden="true"
            />
          )}
          <div className="min-w-0">
            <p className="font-medium">
              {outdated
                ? "Document modifié depuis la signature."
                : "Devoir de conseil signé."}
            </p>
            {outdated ? (
              <p className="mt-0.5 text-[12px] leading-5 opacity-90">
                La version signée{signedAt ? ` le ${signedAt}` : ""} ne
                correspond plus au contenu actuel. Faites signer la nouvelle
                version — l’ancienne reste archivée au dossier.
              </p>
            ) : signedAt ? (
              <p className="mt-0.5 text-[12px] opacity-90">Le {signedAt}.</p>
            ) : null}
          </div>
        </div>

        {electronicSignature ? (
          <Button
            type="button"
            variant={outdated ? "default" : "outline"}
            size="sm"
            onClick={createRequest}
            disabled={!canEdit || busy !== "none"}
            className="inline-flex items-center gap-1.5"
          >
            {busy === "create" ? (
              <Loader2 className="size-3.5 animate-spin" strokeWidth={2} />
            ) : (
              <FileSignature className="size-3.5" strokeWidth={2} />
            )}
            {outdated
              ? "Faire signer la nouvelle version"
              : "Refaire signer ce document"}
          </Button>
        ) : null}

        {advice.signed_document_id || advice.audit_log_document_id ? (
          <div
            className="rounded-lg border p-4"
            style={{
              borderColor: "var(--border-1)",
              background: "var(--bg-surface)",
            }}
          >
            <div className="flex items-center gap-2">
              <span
                className="flex size-7 items-center justify-center rounded-md"
                style={{
                  background: "var(--brand-navy-50)",
                  color: "var(--brand-navy-700)",
                  border: "1px solid var(--border-1)",
                }}
              >
                <ShieldCheck className="size-4" strokeWidth={1.75} />
              </span>
              <p className="text-[13px] font-semibold text-[var(--fg-1)]">
                Pièces classées dans le dossier
              </p>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {advice.signed_document_id ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => openDocument(advice.signed_document_id!)}
                  className="inline-flex items-center gap-1.5"
                >
                  <Download className="size-3.5" strokeWidth={2} />
                  Document signé
                </Button>
              ) : null}
              {advice.audit_log_document_id ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => openDocument(advice.audit_log_document_id!)}
                  className="inline-flex items-center gap-1.5"
                >
                  <Download className="size-3.5" strokeWidth={2} />
                  Preuve de signature
                </Button>
              ) : null}
            </div>
            <p className="mt-2.5 text-[11.5px] leading-5 text-[var(--fg-3)]">
              La preuve de signature horodate l’identité du signataire, sa date
              et son adresse IP — c’est elle qui fait foi en cas de litige.
            </p>
          </div>
        ) : null}
      </div>
    );
  }

  /* ------------------------------------------------------------------ */
  /*  Brouillon d'envoi (commun aux deux offres)                        */
  /* ------------------------------------------------------------------ */

  const draftCard = (
    <OutlookDraftCard
      description={
        electronicSignature
          ? "Un brouillon Outlook prêt à relire, avec le lien de signature et vos documents d’information. Le devoir de conseil n’est pas joint : le client le lit au moment de signer."
          : "Un brouillon Outlook prêt à relire, avec le devoir de conseil et vos documents d’information en pièces jointes. Vous l’envoyez vous-même."
      }
      onCreate={createDraft}
      pending={busy === "draft"}
      disabled={!canEdit || busy !== "none" || !outlookConnected}
      outlookConnected={outlookConnected}
    />
  );

  /* ------------------------------------------------------------------ */
  /*  Sans signature électronique : envoi puis signature hors plateforme */
  /* ------------------------------------------------------------------ */

  if (!electronicSignature) {
    return (
      <div className="grid gap-3 sm:grid-cols-2">
        {draftCard}

        <div
          className="flex flex-col rounded-lg border p-4"
          style={{
            borderColor: "var(--border-1)",
            background: "var(--bg-surface)",
          }}
        >
          <div className="flex items-center gap-2">
            <span
              className="flex size-7 items-center justify-center rounded-md"
              style={{
                background: "var(--brand-navy-50)",
                color: "var(--brand-navy-700)",
                border: "1px solid var(--border-1)",
              }}
            >
              <CheckCircle2 className="size-4" strokeWidth={1.75} />
            </span>
            <p className="text-[13px] font-semibold text-[var(--fg-1)]">
              Signature du client
            </p>
          </div>
          <p className="mt-2 flex-1 text-[12px] leading-5 text-[var(--fg-3)]">
            Faites signer le document au client — en rendez-vous ou par retour
            d’email — puis marquez-le comme signé pour clore le dossier.
          </p>
          <Button
            type="button"
            variant="outline"
            onClick={markSigned}
            disabled={!canEdit || busy !== "none"}
            className="mt-3 inline-flex items-center gap-2 self-start"
          >
            {busy === "signed" ? (
              <Loader2 className="size-3.5 animate-spin" strokeWidth={2} />
            ) : (
              <CheckCircle2 className="size-3.5" strokeWidth={2} />
            )}
            Marquer comme signé
          </Button>
        </div>
      </div>
    );
  }

  /* ------------------------------------------------------------------ */
  /*  Signature électronique                                            */
  /* ------------------------------------------------------------------ */

  const expiresOn = formatDay(advice.signature_expires_at);
  const reminderCount = advice.signature_reminder_count ?? 0;
  const lastReminder = formatMoment(advice.signature_last_reminder_at);

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div
        className="flex flex-col rounded-lg border p-4"
        style={{
          borderColor: "var(--border-1)",
          background: "var(--bg-surface)",
        }}
      >
        <div className="flex items-center gap-2">
          <span
            className="flex size-7 items-center justify-center rounded-md"
            style={{
              background: "var(--brand-navy-50)",
              color: "var(--brand-navy-700)",
              border: "1px solid var(--border-1)",
            }}
          >
            <FileSignature className="size-4" strokeWidth={1.75} />
          </span>
          <p className="text-[13px] font-semibold text-[var(--fg-1)]">
            Signature électronique
          </p>
        </div>

        {!hasRequest ? (
          <>
            {signatureStatus === "superseded" ? (
              <p className="mt-2 text-[12px] leading-5 text-[var(--status-draft-fg)]">
                Le document a été modifié : la demande de signature précédente a
                été annulée et son lien ne fonctionne plus. Préparez-en une
                nouvelle sur la version à jour.
              </p>
            ) : null}
            <p className="mt-2 flex-1 text-[12px] leading-5 text-[var(--fg-3)]">
              Préparez la demande de signature à partir du devoir de conseil.
              Rien n’est envoyé au client à cette étape : vous transmettez le
              lien vous-même avec le brouillon Outlook.
            </p>
            <Button
              type="button"
              onClick={createRequest}
              disabled={!canEdit || busy !== "none"}
              className="mt-3 inline-flex items-center gap-2 self-start"
            >
              {busy === "create" ? (
                <Loader2 className="size-3.5 animate-spin" strokeWidth={2} />
              ) : (
                <FileSignature className="size-3.5" strokeWidth={2} />
              )}
              Préparer la signature
            </Button>

            <details className="mt-3">
              <summary className="cursor-pointer text-[11.5px] text-[var(--fg-3)]">
                Coller un lien manuellement
              </summary>
              <div className="mt-2 space-y-2">
                <Label htmlFor="signature-link" className="text-[11.5px]">
                  Lien de signature
                </Label>
                <Input
                  id="signature-link"
                  value={link}
                  onChange={(e) => setLink(e.target.value)}
                  placeholder="https://…"
                  disabled={!canEdit || busy !== "none"}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={saveLink}
                  disabled={!canEdit || busy !== "none"}
                >
                  {busy === "link" ? "…" : "Enregistrer le lien"}
                </Button>
              </div>
            </details>
          </>
        ) : (
          <>
            {isTracked ? (
              <SignatureTimeline advice={advice} />
            ) : (
              <p className="mt-2 text-[12px] leading-5 text-[var(--fg-3)]">
                Lien de signature enregistré manuellement. Le suivi automatique
                (ouverture, signature, rappels) n’est disponible que pour les
                demandes préparées ici.
              </p>
            )}

            {isDeclined ? (
              <div
                className="mt-3 flex items-start gap-2 rounded-md border px-3 py-2 text-[12px] leading-5"
                style={{
                  borderColor: "var(--status-error-bd)",
                  background: "var(--status-error-bg)",
                  color: "var(--status-error-fg)",
                }}
              >
                <AlertTriangle
                  className="mt-px size-3.5 shrink-0"
                  strokeWidth={2}
                  aria-hidden="true"
                />
                <span>
                  Le client a refusé de signer.
                  {advice.signature_decline_reason
                    ? ` Motif : ${advice.signature_decline_reason}`
                    : " Reprenez contact avec lui avant de relancer une signature."}
                </span>
              </div>
            ) : null}

            {isExpired ? (
              <div
                className="mt-3 flex items-start gap-2 rounded-md border px-3 py-2 text-[12px] leading-5"
                style={{
                  borderColor: "var(--status-draft-bd)",
                  background: "var(--status-draft-bg)",
                  color: "var(--status-draft-fg)",
                }}
              >
                <AlertTriangle
                  className="mt-px size-3.5 shrink-0"
                  strokeWidth={2}
                  aria-hidden="true"
                />
                <span>
                  Le lien de signature a expiré. Préparez-en un nouveau pour
                  relancer le client.
                </span>
              </div>
            ) : null}

            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={copyLink}
                disabled={busy !== "none"}
                className="inline-flex items-center gap-1.5"
              >
                {copied ? (
                  <Check className="size-3.5" strokeWidth={2} />
                ) : (
                  <Copy className="size-3.5" strokeWidth={2} />
                )}
                {copied ? "Lien copié" : "Copier le lien"}
              </Button>
              {isPending && isTracked ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={sendReminder}
                  disabled={!canEdit || busy !== "none"}
                  className="inline-flex items-center gap-1.5"
                >
                  {busy === "remind" ? (
                    <Loader2 className="size-3.5 animate-spin" strokeWidth={2} />
                  ) : (
                    <BellRing className="size-3.5" strokeWidth={2} />
                  )}
                  Relancer
                </Button>
              ) : (
                <Button
                  type="button"
                  size="sm"
                  onClick={createRequest}
                  disabled={!canEdit || busy !== "none"}
                  className="inline-flex items-center gap-1.5"
                >
                  {busy === "create" ? (
                    <Loader2 className="size-3.5 animate-spin" strokeWidth={2} />
                  ) : (
                    <FileSignature className="size-3.5" strokeWidth={2} />
                  )}
                  Nouvelle demande
                </Button>
              )}
            </div>

            <p className="mt-2.5 text-[11.5px] leading-5 text-[var(--fg-3)]">
              N’ouvrez pas le lien vous-même : il est nominatif et son ouverture
              serait enregistrée comme celle du client.
              {expiresOn && isPending ? ` Valable jusqu’au ${expiresOn}.` : ""}
            </p>

            {reminderCount > 0 ? (
              <p className="mt-1 text-[11.5px] text-[var(--fg-4)]">
                {reminderCount} rappel{reminderCount > 1 ? "s" : ""} envoyé
                {reminderCount > 1 ? "s" : ""}
                {lastReminder ? ` — dernier le ${lastReminder}` : ""}.
              </p>
            ) : null}

            <div
              className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 border-t pt-3"
              style={{ borderColor: "var(--border-1)" }}
            >
              {isTracked ? (
                <button
                  type="button"
                  onClick={refreshStatus}
                  disabled={busy !== "none"}
                  className="inline-flex items-center gap-1.5 text-[12px] font-medium text-[var(--brand-navy-700)] transition-colors hover:text-[var(--brand-navy-800)] disabled:opacity-50"
                >
                  {busy === "refresh" ? (
                    <Loader2 className="size-3.5 animate-spin" strokeWidth={2} />
                  ) : (
                    <RefreshCw className="size-3.5" strokeWidth={2} />
                  )}
                  Actualiser
                </button>
              ) : null}
              <button
                type="button"
                onClick={markSigned}
                disabled={!canEdit || busy !== "none"}
                className="inline-flex items-center gap-1.5 text-[12px] font-medium text-[var(--brand-navy-700)] transition-colors hover:text-[var(--brand-navy-800)] disabled:opacity-50"
              >
                <CheckCircle2 className="size-3.5" strokeWidth={2} />
                {busy === "signed" ? "…" : "Signé hors ligne"}
              </button>
              {isPending && isTracked ? (
                <button
                  type="button"
                  onClick={cancelRequest}
                  disabled={!canEdit || busy !== "none"}
                  className="inline-flex items-center gap-1.5 text-[12px] font-medium text-[var(--fg-3)] transition-colors hover:text-[var(--status-error-fg)] disabled:opacity-50"
                >
                  <Ban className="size-3.5" strokeWidth={2} />
                  {busy === "cancel" ? "…" : "Annuler la demande"}
                </button>
              ) : null}
            </div>
          </>
        )}
      </div>

      {/* Le brouillon n'a de sens qu'une fois le lien de signature disponible. */}
      {hasRequest ? draftCard : null}
    </div>
  );
}

/* -------------------------------------------------------------------------- */

/**
 * Outlook draft card. Stays available after signature: sending the client their
 * countersigned copy is part of the job, not something that ends at the
 * signature.
 */
function OutlookDraftCard({
  description,
  onCreate,
  pending,
  disabled,
  outlookConnected,
}: {
  description: string;
  onCreate: () => void;
  pending: boolean;
  disabled: boolean;
  outlookConnected: boolean;
}) {
  return (
    <div
      className="flex flex-col rounded-lg border p-4"
      style={{
        borderColor: "var(--border-1)",
        background: "var(--bg-surface)",
      }}
    >
      <div className="flex items-center gap-2">
        <span
          className="flex size-7 items-center justify-center rounded-md"
          style={{
            background: "var(--accent-soft)",
            color: "var(--accent-foreground)",
            border: "1px solid var(--accent-soft)",
          }}
        >
          <Mail className="size-4" strokeWidth={1.75} />
        </span>
        <p className="text-[13px] font-semibold text-[var(--fg-1)]">
          Brouillon d’envoi
        </p>
      </div>
      <p className="mt-2 flex-1 text-[12px] leading-5 text-[var(--fg-3)]">
        {description}
      </p>
      <Button
        type="button"
        onClick={onCreate}
        disabled={disabled}
        className="mt-3 inline-flex items-center gap-2 self-start"
      >
        {pending ? (
          <Loader2 className="size-3.5 animate-spin" strokeWidth={2} />
        ) : (
          <Mail className="size-3.5" strokeWidth={2} />
        )}
        Préparer le brouillon
      </Button>
      {!outlookConnected ? (
        <p className="mt-2 text-[11.5px] text-[var(--fg-3)]">
          <Link
            href="/courtier/settings/integrations"
            className="font-medium text-[var(--brand-navy-700)] hover:underline"
          >
            Connecter Outlook
          </Link>{" "}
          pour préparer le brouillon.
        </p>
      ) : null}
    </div>
  );
}

/** Where the signature request stands, at a glance. */
function SignatureTimeline({ advice }: { advice: BrokerAdviceRow }) {
  const steps = [
    {
      key: "sent",
      icon: Send,
      label: "Demande préparée",
      at: advice.signature_sent_at,
      done: Boolean(advice.signature_sent_at),
    },
    {
      key: "viewed",
      icon: Eye,
      label: "Ouverte par le client",
      at: advice.signature_viewed_at,
      done: Boolean(advice.signature_viewed_at),
    },
    {
      key: "signed",
      icon: CheckCircle2,
      label:
        advice.signature_status === "declined"
          ? "Refusée par le client"
          : "Signée",
      at:
        advice.signature_status === "declined"
          ? advice.signature_declined_at
          : advice.signature_completed_at,
      done: Boolean(
        advice.signature_completed_at || advice.signature_declined_at,
      ),
    },
  ];

  return (
    <ol className="mt-3 space-y-2">
      {steps.map((step) => {
        const Icon = step.icon;
        const at = formatMoment(step.at);
        return (
          <li key={step.key} className="flex items-center gap-2.5">
            <span
              className="flex size-5 shrink-0 items-center justify-center rounded-full"
              style={
                step.done
                  ? {
                      background: "var(--status-signed-bg)",
                      color: "var(--status-signed-fg)",
                    }
                  : {
                      background: "var(--bg-subtle, var(--brand-navy-50))",
                      color: "var(--fg-4)",
                      border: "1px dashed var(--border-1)",
                    }
              }
            >
              <Icon className="size-3" strokeWidth={2.25} aria-hidden="true" />
            </span>
            <span
              className="text-[12px]"
              style={{ color: step.done ? "var(--fg-1)" : "var(--fg-4)" }}
            >
              {step.label}
              {at ? (
                <span className="text-[var(--fg-3)]"> · {at}</span>
              ) : step.done ? null : (
                <span className="text-[var(--fg-4)]"> · en attente</span>
              )}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
