"use client";

import * as React from "react";
import { toast } from "sonner";
import { Download, Loader2 } from "lucide-react";

/**
 * Downloads a ZIP export of every client dossier (info sheet, attachments and
 * exchanged emails). The build can take a moment, so we fetch as a blob with a
 * loading state rather than a plain link navigation.
 */
export function ClientsExportButton() {
  const [busy, setBusy] = React.useState(false);

  async function exportAll() {
    if (busy) return;
    setBusy(true);
    const toastId = toast.loading("Préparation de l’archive…");
    try {
      const res = await fetch("/api/broker/clients/export").catch(() => null);
      if (!res?.ok) {
        const info = (await res?.json().catch(() => null)) as {
          message?: string;
        } | null;
        toast.error(info?.message ?? "Export impossible.", { id: toastId });
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const stamp = new Date().toISOString().slice(0, 10);
      const link = document.createElement("a");
      link.href = url;
      link.download = `dossiers-clients-${stamp}.zip`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      toast.success("Archive téléchargée.", { id: toastId });
    } catch {
      toast.error("Export impossible.", { id: toastId });
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={exportAll}
      disabled={busy}
      className="inline-flex h-9 items-center gap-1.5 rounded-md border px-3 text-[13px] font-medium transition-colors hover:bg-[var(--bg-sunken)] disabled:opacity-50"
      style={{ borderColor: "var(--border-1)", color: "var(--fg-2)" }}
      title="Exporter tous les dossiers clients (ZIP)"
    >
      {busy ? (
        <Loader2 className="size-3.5 animate-spin" strokeWidth={2} />
      ) : (
        <Download className="size-3.5" strokeWidth={1.75} />
      )}
      {busy ? "Export…" : "Exporter"}
    </button>
  );
}
