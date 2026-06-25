"use client";

import { useRouter } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";
import {
  Download,
  FileText,
  Loader2,
  Paperclip,
  Trash2,
  Upload,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  brokerDocumentCategories,
  brokerDocumentCategoryLabels,
  documentCategoryLabel,
  documentUploadAccept,
  type BrokerDocumentCategory,
} from "@/lib/broker/documents";
import { formatBytes } from "@/lib/broker/storage";
import { uploadBrokerDocument } from "@/lib/broker/upload-client";
import { formatDate } from "@/lib/format";
import type { BrokerDocumentRow } from "@/types/database";

export function ClientDocuments({
  clientId,
  documents: initialDocuments,
  canEdit,
  storageFull,
}: {
  clientId: string;
  documents: BrokerDocumentRow[];
  canEdit: boolean;
  storageFull: boolean;
}) {
  const router = useRouter();
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [documents, setDocuments] = React.useState(initialDocuments);
  const [category, setCategory] =
    React.useState<BrokerDocumentCategory>("contract");
  const [uploading, setUploading] = React.useState(false);
  const [pendingDeleteId, setPendingDeleteId] = React.useState<string | null>(
    null,
  );
  const [busyId, setBusyId] = React.useState<string | null>(null);

  React.useEffect(() => {
    setDocuments(initialDocuments);
  }, [initialDocuments]);

  function pickFile() {
    if (uploading || storageFull) return;
    fileInputRef.current?.click();
  }

  async function handleFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setUploading(true);
    try {
      const result = await uploadBrokerDocument(clientId, file, category);
      if (!result.ok) {
        toast.error("Import impossible", { description: result.message });
        return;
      }
      setDocuments((current) => [result.document, ...current]);
      toast.success("Document ajouté.");
      router.refresh();
    } finally {
      setUploading(false);
    }
  }

  async function download(doc: BrokerDocumentRow) {
    setBusyId(doc.id);
    try {
      const res = await fetch(
        `/api/broker/clients/${clientId}/documents/${doc.id}/download`,
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
      setBusyId(null);
    }
  }

  async function confirmDelete(doc: BrokerDocumentRow) {
    setBusyId(doc.id);
    try {
      const res = await fetch(
        `/api/broker/clients/${clientId}/documents/${doc.id}`,
        { method: "DELETE" },
      );
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as {
          message?: string;
        } | null;
        toast.error("Suppression impossible", {
          description: data?.message,
        });
        return;
      }
      setDocuments((current) => current.filter((d) => d.id !== doc.id));
      setPendingDeleteId(null);
      toast.success("Document supprimé.");
      router.refresh();
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-4">
      {canEdit ? (
        <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center">
          <Select
            value={category}
            onValueChange={(value) =>
              setCategory(value as BrokerDocumentCategory)
            }
            disabled={uploading}
          >
            <SelectTrigger className="h-9 w-full sm:w-[200px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {brokerDocumentCategories.map((cat) => (
                <SelectItem key={cat} value={cat}>
                  {brokerDocumentCategoryLabels[cat]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <button
            type="button"
            onClick={pickFile}
            disabled={uploading || storageFull}
            className="inline-flex h-9 items-center justify-center gap-2 rounded-md px-3.5 text-[13px] font-semibold transition-colors disabled:opacity-60"
            style={{
              background: "var(--brand-navy-800)",
              color: "#FFFFFF",
              border: "1px solid var(--brand-navy-800)",
              cursor: uploading || storageFull ? "not-allowed" : "pointer",
            }}
          >
            {uploading ? (
              <Loader2 className="size-3.5 animate-spin" strokeWidth={2} />
            ) : (
              <Upload className="size-3.5" strokeWidth={2} />
            )}
            {uploading ? "Import en cours…" : "Importer un document"}
          </button>

          <input
            ref={fileInputRef}
            type="file"
            accept={documentUploadAccept}
            onChange={handleFile}
            className="hidden"
          />
        </div>
      ) : null}

      {storageFull && canEdit ? (
        <p
          className="rounded-md border px-3 py-2 text-[12.5px]"
          style={{
            borderColor: "var(--status-error-bd)",
            background: "var(--status-error-bg)",
            color: "var(--status-error-fg)",
          }}
        >
          Quota de stockage atteint — libérez de l’espace avant d’importer de
          nouveaux fichiers.
        </p>
      ) : null}

      {documents.length > 0 ? (
        <ul
          className="divide-y overflow-hidden rounded-md border"
          style={{ borderColor: "var(--border-1)" }}
        >
          {documents.map((doc) => (
            <li
              key={doc.id}
              className="flex items-center gap-3 px-3.5 py-3"
              style={{ background: "var(--bg-surface)" }}
            >
              <span
                className="flex size-9 shrink-0 items-center justify-center rounded-lg"
                style={{
                  background: "var(--brand-navy-50)",
                  border: "1px solid var(--border-1)",
                  color: "var(--brand-navy-700)",
                }}
              >
                <FileText className="size-4" strokeWidth={1.75} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-semibold text-[var(--fg-1)]">
                  {doc.title}
                </p>
                <p className="truncate text-[11.5px] text-[var(--fg-3)]">
                  {documentCategoryLabel(doc.category)} ·{" "}
                  {formatBytes(doc.size_bytes)} · {formatDate(doc.created_at)}
                </p>
              </div>

              {pendingDeleteId === doc.id ? (
                <div className="flex shrink-0 items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => confirmDelete(doc)}
                    disabled={busyId === doc.id}
                    className="rounded-md px-2 py-1 text-[12px] font-semibold"
                    style={{
                      background: "var(--status-error-bg)",
                      color: "var(--status-error-fg)",
                      border: "1px solid var(--status-error-bd)",
                    }}
                  >
                    {busyId === doc.id ? "…" : "Supprimer"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setPendingDeleteId(null)}
                    className="rounded-md px-2 py-1 text-[12px] text-[var(--fg-3)]"
                  >
                    Annuler
                  </button>
                </div>
              ) : (
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    onClick={() => download(doc)}
                    disabled={busyId === doc.id}
                    aria-label="Télécharger"
                    className="flex size-8 items-center justify-center rounded-md text-[var(--fg-3)] transition-colors hover:bg-[var(--brand-navy-50)] hover:text-[var(--fg-1)]"
                  >
                    {busyId === doc.id ? (
                      <Loader2 className="size-4 animate-spin" strokeWidth={1.75} />
                    ) : (
                      <Download className="size-4" strokeWidth={1.75} />
                    )}
                  </button>
                  {canEdit ? (
                    <button
                      type="button"
                      onClick={() => setPendingDeleteId(doc.id)}
                      aria-label="Supprimer"
                      className="flex size-8 items-center justify-center rounded-md text-[var(--fg-3)] transition-colors hover:bg-[var(--status-error-bg)] hover:text-[var(--status-error-fg)]"
                    >
                      <Trash2 className="size-4" strokeWidth={1.75} />
                    </button>
                  ) : null}
                </div>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <div
          className="flex flex-col items-center gap-2 rounded-md border border-dashed px-4 py-8 text-center"
          style={{ borderColor: "var(--border-strong)" }}
        >
          <Paperclip className="size-5 text-[var(--fg-4)]" strokeWidth={1.5} />
          <p className="text-[13px] font-medium text-[var(--fg-1)]">
            Aucun document
          </p>
          <p className="max-w-sm text-[12px] leading-5 text-[var(--fg-3)]">
            Importez contrats, pièces d’identité, RIB et devis compagnies. Tout
            reste rattaché à ce dossier et sécurisé.
          </p>
        </div>
      )}
    </div>
  );
}
