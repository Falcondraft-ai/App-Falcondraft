"use client";

import * as React from "react";
import { toast } from "sonner";
import { Download, Eye, Loader2 } from "lucide-react";
import { DocumentPreviewDialog } from "@/components/broker/document-preview-dialog";

/**
 * Actions sur un document de la GED : l'ouvrir, ou le télécharger.
 *
 * L'aperçu passe en premier parce que c'est le geste courant — on veut LIRE le
 * document (vérifier une garantie, une date sur une pièce d'identité), pas
 * l'archiver sur son disque.
 */
export function DocumentDownloadButton({
  clientId,
  documentId,
  title,
}: {
  clientId: string;
  documentId: string;
  /** Fourni ⇒ le document peut être ouvert dans l'outil. */
  title?: string;
}) {
  const [loading, setLoading] = React.useState(false);
  const [previewing, setPreviewing] = React.useState(false);

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
    <div className="flex items-center justify-end gap-1">
      {title ? (
        <button
          type="button"
          onClick={() => setPreviewing(true)}
          aria-label="Ouvrir le document"
          title="Ouvrir le document"
          className="flex size-8 items-center justify-center rounded-md text-[var(--fg-3)] transition-colors hover:bg-[var(--brand-navy-50)] hover:text-[var(--fg-1)]"
        >
          <Eye className="size-4" strokeWidth={1.75} />
        </button>
      ) : null}
      <button
        type="button"
        onClick={download}
        disabled={loading}
        aria-label="Télécharger"
        title="Télécharger"
        className="flex size-8 items-center justify-center rounded-md text-[var(--fg-3)] transition-colors hover:bg-[var(--brand-navy-50)] hover:text-[var(--fg-1)]"
      >
        {loading ? (
          <Loader2 className="size-4 animate-spin" strokeWidth={1.75} />
        ) : (
          <Download className="size-4" strokeWidth={1.75} />
        )}
      </button>

      {title && previewing ? (
        <DocumentPreviewDialog
          open
          onOpenChange={(next) => {
            if (!next) setPreviewing(false);
          }}
          clientId={clientId}
          documentId={documentId}
          title={title}
        />
      ) : null}
    </div>
  );
}
