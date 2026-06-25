import {
  BROKER_FILES_BUCKET,
  isAllowedDocumentMime,
  MAX_DOCUMENT_SIZE_BYTES,
} from "@/lib/broker/documents";
import { formatBytes } from "@/lib/broker/storage";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import type { BrokerDocumentRow } from "@/types/database";

export type UploadResult =
  | { ok: true; document: BrokerDocumentRow }
  | { ok: false; message: string };

/**
 * Client-side three-step upload: request a signed URL (quota enforced server
 * side), upload straight to Supabase Storage, then confirm to record the
 * document and update storage accounting. Shared by the GED and the quote
 * importer.
 */
export async function uploadBrokerDocument(
  clientId: string,
  file: File,
  category: string,
): Promise<UploadResult> {
  if (file.size > MAX_DOCUMENT_SIZE_BYTES) {
    return {
      ok: false,
      message: `Fichier trop volumineux (max ${formatBytes(MAX_DOCUMENT_SIZE_BYTES)}).`,
    };
  }
  const mime = file.type || "application/octet-stream";
  if (!isAllowedDocumentMime(mime)) {
    return {
      ok: false,
      message: "Type de fichier non autorisé (PDF, images, Word, Excel).",
    };
  }

  const urlRes = await fetch(
    `/api/broker/clients/${clientId}/documents/upload-url`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fileName: file.name,
        sizeBytes: file.size,
        mimeType: mime,
        category,
      }),
    },
  );
  const urlData = (await urlRes.json().catch(() => null)) as
    | { success: true; path: string; token: string; bucket: string }
    | { success: false; message?: string }
    | null;

  if (!urlRes.ok || !urlData?.success) {
    return {
      ok: false,
      message:
        (urlData && "message" in urlData && urlData.message) ||
        "Import impossible.",
    };
  }

  const supabase = getSupabaseBrowserClient();
  if (!supabase) {
    return { ok: false, message: "Service indisponible." };
  }

  const { error: uploadError } = await supabase.storage
    .from(urlData.bucket || BROKER_FILES_BUCKET)
    .uploadToSignedUrl(urlData.path, urlData.token, file, {
      contentType: mime,
    });

  if (uploadError) {
    return { ok: false, message: "Envoi du fichier interrompu." };
  }

  const confirmRes = await fetch(`/api/broker/clients/${clientId}/documents`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      path: urlData.path,
      title: file.name,
      fileName: file.name,
      mimeType: mime,
      sizeBytes: file.size,
      category,
    }),
  });
  const confirmData = (await confirmRes.json().catch(() => null)) as
    | { success: true; document: BrokerDocumentRow }
    | { success: false; message?: string }
    | null;

  if (!confirmRes.ok || !confirmData?.success) {
    return {
      ok: false,
      message:
        (confirmData && "message" in confirmData && confirmData.message) ||
        "Enregistrement impossible.",
    };
  }

  return { ok: true, document: confirmData.document };
}
