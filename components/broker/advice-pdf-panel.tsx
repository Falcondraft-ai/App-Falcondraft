"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Download, FileDown, FileText, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/format";

type GenerateResponse =
  | { success: true; url: string | null; documentId: string | null }
  | { success: false; message?: string };

export type AdvicePdfInfo = {
  documentId: string;
  generatedAt: string;
};

export function AdvicePdfPanel({
  clientId,
  adviceId,
  canEdit,
  pdf,
}: {
  clientId: string;
  adviceId: string;
  canEdit: boolean;
  /** The stored PDF (GED entry), when it was already generated. */
  pdf: AdvicePdfInfo | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = React.useState<"none" | "generate" | "download">(
    "none",
  );

  async function generate() {
    if (busy !== "none") return;
    setBusy("generate");
    try {
      const res = await fetch(
        `/api/broker/clients/${clientId}/advice/${adviceId}/pdf`,
        { method: "POST" },
      );
      const data = (await res.json().catch(() => null)) as GenerateResponse | null;
      if (!res.ok || !data?.success) {
        toast.error("Génération impossible", {
          description: (data && "message" in data && data.message) || undefined,
        });
        return;
      }
      toast.success("PDF généré et rangé dans les documents du client.");
      if (data.url) window.open(data.url, "_blank", "noopener,noreferrer");
      router.refresh();
    } finally {
      setBusy("none");
    }
  }

  async function download() {
    if (!pdf || busy !== "none") return;
    setBusy("download");
    try {
      const res = await fetch(
        `/api/broker/clients/${clientId}/documents/${pdf.documentId}/download`,
      );
      const data = (await res.json().catch(() => null)) as
        | { success: true; url: string }
        | { success: false }
        | null;
      if (!res.ok || !data || !("url" in data)) {
        toast.error("Téléchargement indisponible.");
        return;
      }
      window.open(data.url, "_blank", "noopener,noreferrer");
    } finally {
      setBusy("none");
    }
  }

  if (!pdf) {
    return (
      <div className="space-y-3">
        {canEdit ? (
          <Button
            type="button"
            onClick={() => void generate()}
            disabled={busy !== "none"}
            className="inline-flex items-center gap-2"
          >
            {busy === "generate" ? (
              <Loader2 className="size-3.5 animate-spin" strokeWidth={2} />
            ) : (
              <FileDown className="size-3.5" strokeWidth={2} />
            )}
            {busy === "generate" ? "Génération…" : "Générer le PDF"}
          </Button>
        ) : (
          <p className="text-[12.5px] text-[var(--fg-3)]">
            Le PDF n&apos;a pas encore été généré.
          </p>
        )}
        <p className="text-[11.5px] leading-5 text-[var(--fg-3)]">
          La fiche d&apos;information et de conseil reprend le contenu validé, les
          mentions légales et la proposition — elle se range dans les documents
          du client.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div
        className="flex flex-wrap items-center gap-3 rounded-lg border px-3.5 py-3"
        style={{ borderColor: "var(--border-1)", background: "var(--bg-rail)" }}
      >
        <span
          className="flex size-9 shrink-0 items-center justify-center rounded-lg"
          style={{
            background: "var(--bg-surface)",
            border: "1px solid var(--border-1)",
            color: "var(--brand-navy-700)",
          }}
        >
          <FileText className="size-4" strokeWidth={1.75} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-semibold text-[var(--fg-1)]">
            Devoir de conseil (PDF)
          </p>
          <p className="truncate text-[11.5px] text-[var(--fg-3)]">
            Généré le {formatDate(pdf.generatedAt)} · rangé dans les documents
            du client
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void download()}
            disabled={busy !== "none"}
            className="inline-flex items-center gap-1.5"
          >
            {busy === "download" ? (
              <Loader2 className="size-3.5 animate-spin" strokeWidth={2} />
            ) : (
              <Download className="size-3.5" strokeWidth={2} />
            )}
            Télécharger
          </Button>
          {canEdit ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => void generate()}
              disabled={busy !== "none"}
              className="inline-flex items-center gap-1.5"
            >
              {busy === "generate" ? (
                <Loader2 className="size-3.5 animate-spin" strokeWidth={2} />
              ) : (
                <RefreshCw className="size-3.5" strokeWidth={2} />
              )}
              Régénérer
            </Button>
          ) : null}
        </div>
      </div>
      {canEdit ? (
        <p className="text-[11.5px] leading-5 text-[var(--fg-3)]">
          Vous avez modifié le contenu après coup ? Régénérez le PDF pour que le
          document reflète la dernière version validée.
        </p>
      ) : null}
    </div>
  );
}
