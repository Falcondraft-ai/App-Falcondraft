"use client";

import * as React from "react";
import { Eye, Download, Trash2, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
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
  });
}

export function AdminDocumentsTab({
  initialDocuments,
}: {
  initialDocuments: ProspectDocumentRow[];
}) {
  const [documents, setDocuments] = React.useState(initialDocuments);
  const [deleteTarget, setDeleteTarget] =
    React.useState<ProspectDocumentRow | null>(null);
  const [deleting, setDeleting] = React.useState(false);

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

  async function handleDelete() {
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

  if (documents.length === 0) {
    return (
      <section className="bg-card/75 rounded-lg border p-8 text-center">
        <p className="text-sm font-medium text-muted-foreground">
          Aucun document
        </p>
        <p className="mt-1 text-xs text-muted-foreground/70">
          Les documents uploadés par l&apos;équipe apparaîtront ici.
        </p>
      </section>
    );
  }

  return (
    <div className="space-y-4">
      <div className="bg-card rounded-lg border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40 text-left">
                <th className="px-4 py-3 font-medium text-muted-foreground">
                  Fichier
                </th>
                <th className="px-4 py-3 font-medium text-muted-foreground">
                  Taille
                </th>
                <th className="px-4 py-3 font-medium text-muted-foreground hidden md:table-cell">
                  Date
                </th>
                <th className="px-4 py-3 font-medium text-muted-foreground hidden lg:table-cell">
                  Statut
                </th>
                <th className="px-4 py-3 font-medium text-muted-foreground w-12" />
              </tr>
            </thead>
            <tbody>
              {documents.map((doc) => (
                <tr
                  key={doc.id}
                  className="border-b last:border-0 hover:bg-muted/30 transition-colors"
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <FileText className="size-3.5 text-muted-foreground shrink-0" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate max-w-64">
                          {doc.file_name}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {formatSize(doc.size_bytes)}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground hidden md:table-cell text-xs">
                    {formatDate(doc.created_at)}
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell">
                    <span
                      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${
                        doc.status === "active"
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800"
                          : "bg-zinc-50 text-zinc-500 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700"
                      }`}
                    >
                      {doc.status === "active" ? "Actif" : doc.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center gap-1 justify-end">
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
                        className="text-red-600 hover:text-red-700 dark:text-red-400"
                        onClick={() => setDeleteTarget(doc)}
                        title="Supprimer définitivement"
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <DeleteDocumentDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        fileName={deleteTarget?.file_name ?? ""}
        onConfirm={handleDelete}
        deleting={deleting}
      />
    </div>
  );
}
