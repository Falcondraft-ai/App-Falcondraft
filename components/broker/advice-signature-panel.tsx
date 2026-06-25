"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";
import { CheckCircle2, FileSignature, Loader2, Mail } from "lucide-react";
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
    "none" | "draft" | "link" | "signed"
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

  return (
    <div className="space-y-4">
      {/* DocuSeal signature link (auto-creation via n8n later; paste for now) */}
      <div className="space-y-1.5">
        <Label htmlFor="signature-link">
          Lien de signature (DocuSeal)
        </Label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            id="signature-link"
            value={link}
            onChange={(e) => setLink(e.target.value)}
            placeholder="https://docuseal…/sign/…"
            disabled={!canEdit || busy !== "none"}
          />
          <Button
            type="button"
            variant="ghost"
            onClick={saveLink}
            disabled={!canEdit || busy !== "none"}
            className="shrink-0"
          >
            {busy === "link" ? "…" : "Enregistrer le lien"}
          </Button>
        </div>
        <p className="text-[11.5px] text-[var(--fg-3)]">
          La création automatique de la demande DocuSeal arrivera avec les
          automatisations. En attendant, collez ici le lien de signature.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2.5">
        <Button
          type="button"
          onClick={createDraft}
          disabled={!canEdit || busy !== "none"}
          className="inline-flex items-center gap-2"
        >
          {busy === "draft" ? (
            <Loader2 className="size-3.5 animate-spin" strokeWidth={2} />
          ) : (
            <Mail className="size-3.5" strokeWidth={2} />
          )}
          Préparer le brouillon Outlook
        </Button>

        <Button
          type="button"
          variant="outline"
          onClick={markSigned}
          disabled={!canEdit || busy !== "none"}
          className="inline-flex items-center gap-2"
        >
          <FileSignature className="size-3.5" strokeWidth={2} />
          {busy === "signed" ? "…" : "Marquer comme signé"}
        </Button>
      </div>

      {!outlookConnected ? (
        <p className="text-[11.5px] text-[var(--fg-3)]">
          Outlook n’est pas connecté.{" "}
          <Link
            href="/courtier/settings"
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
