"use client";

import { useRouter } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";
import { Loader2, Upload } from "lucide-react";
import { documentUploadAccept } from "@/lib/broker/documents";
import { uploadBrokerDocument } from "@/lib/broker/upload-client";

type CreateResponse =
  | { success: true; quoteId: string }
  | { success: false; message?: string };

async function createQuote(
  clientId: string,
  documentId: string | null,
): Promise<CreateResponse | null> {
  const res = await fetch(`/api/broker/clients/${clientId}/quotes`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ documentId }),
  });
  return (await res.json().catch(() => null)) as CreateResponse | null;
}

export function QuoteImporter({
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
      const upload = await uploadBrokerDocument(clientId, file, "company_quote");
      if (!upload.ok) {
        toast.error("Import du devis impossible", {
          description: upload.message,
        });
        return;
      }
      const created = await createQuote(clientId, upload.document.id);
      if (!created?.success) {
        toast.error("Création du devis impossible", {
          description: (created && "message" in created && created.message) || undefined,
        });
        return;
      }
      toast.success("Devis importé. Vérifiez les informations.");
      router.push(`/courtier/clients/${clientId}/quotes/${created.quoteId}`);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2.5">
      <button
        type="button"
        onClick={() => !busy && !storageFull && fileInputRef.current?.click()}
        disabled={busy || storageFull}
        className="inline-flex h-9 items-center gap-2 rounded-md px-3.5 text-[13px] font-semibold transition-colors disabled:opacity-60"
        style={{
          background: "var(--brand-navy-800)",
          color: "#FFFFFF",
          border: "1px solid var(--brand-navy-800)",
          cursor: busy || storageFull ? "not-allowed" : "pointer",
        }}
      >
        {busy ? (
          <Loader2 className="size-3.5 animate-spin" strokeWidth={2} />
        ) : (
          <Upload className="size-3.5" strokeWidth={2} />
        )}
        {busy ? "Import en cours…" : "Importer un devis (PDF)"}
      </button>

      <input
        ref={fileInputRef}
        type="file"
        accept={documentUploadAccept}
        onChange={handleFile}
        className="hidden"
      />
    </div>
  );
}
