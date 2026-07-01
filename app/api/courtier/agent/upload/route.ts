import { NextResponse, type NextRequest } from "next/server";
import { canCreateWorkspaceRecords } from "@/lib/auth/workspace-permissions";
import {
  BROKER_FILES_BUCKET,
  MAX_DOCUMENT_SIZE_BYTES,
  isAllowedDocumentMime,
  sanitizeFileName,
} from "@/lib/broker/documents";
import { requireBrokerApiContext } from "@/lib/broker/server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function jsonError(message: string, status: number, reason: string) {
  return NextResponse.json({ success: false, message, reason }, { status });
}

/**
 * Stages a file the user attached in the assistant chat. It lands in a private
 * `_agent/<userId>/` prefix of the broker bucket (not counted against the quota
 * yet) and is only turned into a client document — and moved out of staging —
 * when the assistant files it via `attach_uploaded_file_to_client`.
 */
export async function POST(request: NextRequest) {
  const auth = await requireBrokerApiContext();
  if (!auth.success) return jsonError(auth.message, auth.status, auth.reason);

  if (!canCreateWorkspaceRecords(auth.context.membership?.role)) {
    return jsonError(
      "Votre rôle ne permet pas d'ajouter des documents.",
      403,
      "insufficient_role",
    );
  }

  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) {
    return jsonError("Aucun fichier reçu.", 400, "no_file");
  }

  const mimeType = file.type || "application/octet-stream";
  if (!isAllowedDocumentMime(mimeType)) {
    return jsonError("Type de fichier non pris en charge.", 415, "bad_mime");
  }
  if (file.size <= 0) {
    return jsonError("Fichier vide.", 400, "empty_file");
  }
  if (file.size > MAX_DOCUMENT_SIZE_BYTES) {
    return jsonError("Fichier trop volumineux (max 50 Mo).", 413, "too_large");
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const fileName = sanitizeFileName(file.name || "document");
  const uploadId = crypto.randomUUID();
  const storagePath = `${auth.organizationId}/_agent/${auth.user.id}/${uploadId}-${fileName}`;

  const { error } = await auth.adminSupabase.storage
    .from(BROKER_FILES_BUCKET)
    .upload(storagePath, buffer, { contentType: mimeType, upsert: false });
  if (error) {
    return jsonError("Envoi du fichier impossible.", 500, error.message);
  }

  return NextResponse.json({
    success: true,
    uploadId,
    storagePath,
    fileName,
    mimeType,
    sizeBytes: buffer.byteLength,
  });
}
