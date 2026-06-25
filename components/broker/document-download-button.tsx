"use client";

import * as React from "react";
import { toast } from "sonner";
import { Download, Loader2 } from "lucide-react";

export function DocumentDownloadButton({
  clientId,
  documentId,
}: {
  clientId: string;
  documentId: string;
}) {
  const [loading, setLoading] = React.useState(false);

  async function download() {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/broker/clients/${clientId}/documents/${documentId}/download`,
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
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={download}
      disabled={loading}
      aria-label="Télécharger"
      className="flex size-8 items-center justify-center rounded-md text-[var(--fg-3)] transition-colors hover:bg-[var(--brand-navy-50)] hover:text-[var(--fg-1)]"
    >
      {loading ? (
        <Loader2 className="size-4 animate-spin" strokeWidth={1.75} />
      ) : (
        <Download className="size-4" strokeWidth={1.75} />
      )}
    </button>
  );
}
