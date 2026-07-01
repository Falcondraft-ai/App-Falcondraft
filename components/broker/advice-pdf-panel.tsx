"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Download, FileDown, Loader2 } from "lucide-react";

type GenerateResponse =
  | { success: true; url: string | null; documentId: string | null }
  | { success: false; message?: string };

export function AdvicePdfPanel({
  clientId,
  adviceId,
  canEdit,
}: {
  clientId: string;
  adviceId: string;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  const [url, setUrl] = React.useState<string | null>(null);

  if (!canEdit) return null;

  async function generate() {
    if (busy) return;
    setBusy(true);
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
      setUrl(data.url ?? null);
      toast.success("PDF généré et rangé dans les documents du client.");
      if (data.url) window.open(data.url, "_blank", "noopener,noreferrer");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2.5">
      <button
        type="button"
        onClick={() => generate()}
        disabled={busy}
        className="inline-flex h-9 items-center gap-2 rounded-md px-3.5 text-[13px] font-semibold transition-colors disabled:opacity-60"
        style={{
          background: "var(--brand-navy-800)",
          color: "#FFFFFF",
          border: "1px solid var(--brand-navy-800)",
        }}
      >
        {busy ? (
          <Loader2 className="size-3.5 animate-spin" strokeWidth={2} />
        ) : (
          <FileDown className="size-3.5" strokeWidth={2} />
        )}
        {busy ? "Génération…" : "Générer le PDF"}
      </button>

      {url ? (
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex h-9 items-center gap-2 rounded-md px-3.5 text-[13px] font-medium transition-colors"
          style={{
            border: "1px solid var(--border-1)",
            color: "var(--fg-1)",
          }}
        >
          <Download className="size-3.5" strokeWidth={2} />
          Télécharger
        </a>
      ) : null}

      <p className="w-full text-[11.5px] leading-5 text-[var(--fg-3)]">
        Le PDF reprend la fiche d’information et de conseil (mentions légales,
        besoins, proposition) et se range dans les documents du client.
        Régénérez-le après chaque modification.
      </p>
    </div>
  );
}
