"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";
import {
  CheckCircle2,
  FileSignature,
  Loader2,
  Mail,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function AdviceSignaturePanel({
  clientId,
  adviceId,
  status,
  signatureUrl,
  outlookConnected,
  canEdit,
}: {
  clientId: string;
  adviceId: string;
  status: string;
  signatureUrl: string | null;
  outlookConnected: boolean;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [link, setLink] = React.useState(signatureUrl ?? "");
  const [busy, setBusy] = React.useState<
    "none" | "draft" | "link" | "signed" | "docuseal" | "refresh"
  >("none");

  const isDraft = status === "draft";
  const isSigned = status === "signed";

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
        email?: string;
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

  async function createDocusealLink() {
    setBusy("docuseal");
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
        toast.error("Lien non créé", { description: data?.message });
        return;
      }
      toast.success("Lien de signature créé — transmettez-le au client.");
      if (data.url) window.open(data.url, "_blank", "noopener,noreferrer");
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
        { method: "GET" },
      );
      const data = (await res.json().catch(() => null)) as {
        success?: boolean;
        signed?: boolean;
        message?: string;
      } | null;
      if (!res.ok || !data?.success) {
        toast.error("Statut indisponible", { description: data?.message });
        return;
      }
      if (data.signed) {
        toast.success("Le client a signé le devoir de conseil.");
        router.refresh();
      } else {
        toast.info("Pas encore signé.");
      }
    } finally {
      setBusy("none");
    }
  }

  if (isDraft) {
    return (
      <p className="text-[12.5px] leading-5 text-[var(--fg-3)]">
        Validez le devoir de conseil pour préparer la signature et le brouillon
        Outlook.
      </p>
    );
  }

  if (isSigned) {
    return (
      <div
        className="flex items-center gap-2 rounded-md border px-4 py-3 text-[13px] font-medium"
        style={{
          borderColor: "var(--status-signed-bd)",
          background: "var(--status-signed-bg)",
          color: "var(--status-signed-fg)",
        }}
      >
        <CheckCircle2 className="size-4" strokeWidth={2} />
        Devoir de conseil signé.
      </div>
    );
  }

  const hasLink = Boolean(signatureUrl);

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {/* 1 — Signature électronique */}
      <div
        className="flex flex-col rounded-lg border p-4"
        style={{ borderColor: "var(--border-1)", background: "var(--bg-surface)" }}
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

        <p className="mt-2 text-[12px] leading-5 text-[var(--fg-3)]">
          Créez le lien de signature DocuSeal à partir du devoir de conseil, puis
          transmettez-le au client.
        </p>

        <div className="mt-3 flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            onClick={createDocusealLink}
            disabled={!canEdit || busy !== "none"}
            className="inline-flex items-center gap-1.5"
          >
            {busy === "docuseal" ? (
              <Loader2 className="size-3.5 animate-spin" strokeWidth={2} />
            ) : (
              <FileSignature className="size-3.5" strokeWidth={2} />
            )}
            {hasLink ? "Recréer le lien" : "Créer le lien (DocuSeal)"}
          </Button>
          {hasLink ? (
            <Button
              asChild
              variant="outline"
              size="sm"
              className="inline-flex items-center gap-1.5"
            >
              <a href={signatureUrl ?? "#"} target="_blank" rel="noreferrer">
                Ouvrir le lien
              </a>
            </Button>
          ) : null}
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
          {hasLink ? (
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
              Rafraîchir le statut
            </button>
          ) : null}
          <button
            type="button"
            onClick={markSigned}
            disabled={!canEdit || busy !== "none"}
            className="inline-flex items-center gap-1.5 text-[12px] font-medium text-[var(--brand-navy-700)] transition-colors hover:text-[var(--brand-navy-800)] disabled:opacity-50"
          >
            <CheckCircle2 className="size-3.5" strokeWidth={2} />
            {busy === "signed" ? "…" : "Marquer comme signé"}
          </button>
        </div>

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
              placeholder="https://docuseal…/s/…"
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
      </div>

      {/* 2 — Brouillon d’envoi */}
      <div
        className="flex flex-col rounded-lg border p-4"
        style={{ borderColor: "var(--border-1)", background: "var(--bg-surface)" }}
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
          Un brouillon Outlook prêt à relire, avec le devoir de conseil et le lien
          de signature. Vous l’envoyez vous-même.
        </p>
        <Button
          type="button"
          onClick={createDraft}
          disabled={!canEdit || busy !== "none" || !outlookConnected}
          className="mt-3 inline-flex items-center gap-2 self-start"
        >
          {busy === "draft" ? (
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
    </div>
  );
}
