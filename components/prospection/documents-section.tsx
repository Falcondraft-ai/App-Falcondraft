"use client";

import * as React from "react";
import {
  FileText,
  Upload,
  Eye,
  Download,
  Archive,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DeleteDocumentDialog } from "@/components/prospection/delete-dialog";
import type { ProspectDocumentRow } from "@/types/database";

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const MAX_SIZE = 20 * 1024 * 1024;

export function DocumentsSection({
  initialDocuments,
  companyId,
  isManager,
}: {
  initialDocuments: ProspectDocumentRow[];
  companyId: string;
  isManager: boolean;
}) {
  const [documents, setDocuments] = React.useState(initialDocuments);
  const [uploading, setUploading] = React.useState(false);
  const [uploadError, setUploadError] = React.useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] =
    React.useState<ProspectDocumentRow | null>(null);
  const [deleting, setDeleting] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== "application/pdf") {
      setUploadError("Seuls les fichiers PDF sont acceptés.");
      return;
    }

    if (file.size > MAX_SIZE) {
      setUploadError("Fichier trop volumineux (max 20 MB).");
      return;
    }

    setUploadError(null);
    setUploading(true);

    try {
      const res1 = await fetch("/api/prospection/documents/upload-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyId,
          fileName: file.name,
          mimeType: file.type,
          sizeBytes: file.size,
        }),
      });

      const urlData = await res1.json();
      if (!urlData.success) {
        setUploadError(urlData.message ?? "Erreur d'upload.");
        return;
      }

      const uploadRes = await fetch(urlData.signedUrl, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": file.type },
      });

      if (!uploadRes.ok) {
        setUploadError("Échec de l'upload vers le stockage.");
        return;
      }

      const res2 = await fetch("/api/prospection/documents/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyId,
          fileName: file.name,
          filePath: urlData.filePath,
          mimeType: file.type,
          sizeBytes: file.size,
        }),
      });

      const confirmData = await res2.json();
      if (confirmData.success && confirmData.document) {
        setDocuments((prev) => [confirmData.document, ...prev]);
      }
    } catch {
      setUploadError("Erreur réseau lors de l'upload.");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleView(doc: ProspectDocumentRow) {
    try {
      const res = await fetch("/api/prospection/documents/signed-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentId: doc.id }),
      });
      const data = await res.json();
      if (data.success && data.signedUrl) {
        window.open(data.signedUrl, "_blank");
      }
    } catch {
      // silently fail
    }
  }

  async function handleDownload(doc: ProspectDocumentRow) {
    try {
      const res = await fetch("/api/prospection/documents/signed-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentId: doc.id }),
      });
      const data = await res.json();
      if (data.success && data.signedUrl) {
        const a = document.createElement("a");
        a.href = data.signedUrl;
        a.download = doc.file_name;
        a.click();
      }
    } catch {
      // silently fail
    }
  }

  async function handleArchive(doc: ProspectDocumentRow) {
    try {
      const res = await fetch("/api/prospection/documents", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentId: doc.id }),
      });
      const data = await res.json();
      if (data.success) {
        setDocuments((prev) =>
          prev.filter((d) => d.id !== doc.id),
        );
      }
    } catch {
      // silently fail
    }
  }

  async function handlePermanentDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch("/api/prospection/documents", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentId: deleteTarget.id }),
      });
      const data = await res.json();
      if (data.success) {
        setDocuments((prev) =>
          prev.filter((d) => d.id !== deleteTarget.id),
        );
      }
    } catch {
      // silently fail
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  }

  return (
    <>
      <Card className="border rounded-lg overflow-hidden">
        <div className="border-b bg-muted/40 px-4 py-3 flex items-center justify-between">
          <h2 className="text-sm font-medium text-muted-foreground">
            Documents du lead
          </h2>
          <div className="flex items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="application/pdf"
              className="hidden"
              onChange={handleUpload}
            />
            <Button
              variant="outline"
              size="sm"
              disabled={uploading}
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="size-3.5 mr-1.5" />
              {uploading ? "Upload..." : "Ajouter un PDF"}
            </Button>
          </div>
        </div>

        {uploadError && (
          <div className="px-4 py-2 text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/20">
            {uploadError}
          </div>
        )}

        {documents.length === 0 ? (
          <div className="p-6 text-center text-sm text-muted-foreground">
            Aucun document pour ce lead.
          </div>
        ) : (
          <div className="divide-y">
            {documents.map((doc) => (
              <div
                key={doc.id}
                className="flex items-center gap-3 px-4 py-3 hover:bg-muted/20 transition-colors"
              >
                <FileText className="size-4 text-muted-foreground shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">
                    {doc.file_name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatDate(doc.created_at)}
                    {" · "}
                    {formatSize(doc.size_bytes)}
                  </p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => handleView(doc)}
                    title="Voir"
                  >
                    <Eye className="size-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => handleDownload(doc)}
                    title="Télécharger"
                  >
                    <Download className="size-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => handleArchive(doc)}
                    title="Archiver"
                  >
                    <Archive className="size-3.5" />
                  </Button>
                  {isManager && (
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="text-red-600 hover:text-red-700 dark:text-red-400"
                      onClick={() => setDeleteTarget(doc)}
                      title="Supprimer définitivement"
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <DeleteDocumentDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        fileName={deleteTarget?.file_name ?? ""}
        onConfirm={handlePermanentDelete}
        deleting={deleting}
      />
    </>
  );
}
