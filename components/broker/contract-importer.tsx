"use client";

import { useRouter } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";
import { Loader2, Upload } from "lucide-react";
import { documentUploadAccept } from "@/lib/broker/documents";
import { uploadBrokerDocument } from "@/lib/broker/upload-client";

type CreateResponse =
  | { success: true; contractId: string; extracted?: boolean }
  | { success: false; message?: string };

async function createContract(
  clientId: string,
  documentId: string | null,
): Promise<CreateResponse | null> {
  const res = await fetch(`/api/broker/clients/${clientId}/contracts`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ documentId }),
  });
  return (await res.json().catch(() => null)) as CreateResponse | null;
}

/**
 * Imports a contract from its PDF: the document is filed in the dossier, the
 * contract is created from it and pre-filled by reading the document — the
 * broker only checks and completes.
 */
export function ContractImporter({
  clientId,
  canEdit,
  storageFull,
}: {
  clientId: string;
  canEdit: boolean;
  storageFull: boolean;
}) {
  const router = useRouter();
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [busy, setBusy] = React.useState(false);

  if (!canEdit) return null;

  async function handleFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setBusy(true);
    try {
      const upload = await uploadBrokerDocument(clientId, file, "contract");
      if (!upload.ok) {
        toast.error("Import du contrat impossible", {
          description: upload.message,
        });
        return;
      }
      const created = await createContract(clientId, upload.document.id);
      if (!created?.success) {
        toast.error("Création du contrat impossible", {
          description:
            (created && "message" in created && created.message) || undefined,
        });
        return;
      }
      toast.success(
        created.extracted
          ? "Contrat importé et lu — vérifiez les informations."
          : "Contrat importé. Ouvrez-le pour compléter les informations.",
      );
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => !busy && !storageFull && fileInputRef.current?.click()}
        disabled={busy || storageFull}
        className="inline-flex h-9 items-center gap-2 rounded-md border px-3.5 text-[13px] font-medium transition-colors hover:bg-[var(--bg-sunken)] disabled:opacity-60"
        style={{
          borderColor: "var(--border-1)",
          color: "var(--fg-2)",
          cursor: busy || storageFull ? "not-allowed" : "pointer",
        }}
      >
        {busy ? (
          <Loader2 className="size-3.5 animate-spin" strokeWidth={2} />
        ) : (
          <Upload className="size-3.5" strokeWidth={2} />
        )}
        {busy ? "Import en cours…" : "Importer un contrat (PDF)"}
      </button>

      <input
        ref={fileInputRef}
        type="file"
        accept={documentUploadAccept}
        onChange={handleFile}
        className="hidden"
      />
    </>
  );
}
