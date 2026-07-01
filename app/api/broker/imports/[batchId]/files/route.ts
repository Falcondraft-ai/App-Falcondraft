import { NextResponse, type NextRequest } from "next/server";
import { canCreateWorkspaceRecords } from "@/lib/auth/workspace-permissions";
import {
  BROKER_FILES_BUCKET,
  MAX_DOCUMENT_SIZE_BYTES,
  isAllowedDocumentMime,
  sanitizeFileName,
} from "@/lib/broker/documents";
import { MAX_IMPORT_FILES, importStagingPrefix } from "@/lib/broker/imports";
import { requireBrokerApiContext } from "@/lib/broker/server";
import type { BrokerImportBatchRow } from "@/types/database";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

type RouteContext = { params: Promise<{ batchId: string }> };

function jsonError(message: string, status: number, reason: string) {
  return NextResponse.json({ success: false, message, reason }, { status });
}

/** Stages one file of the batch (bytes in the `_import/<batch>/` prefix, not
 * counted against the quota) and records it as a pending import file. */
export async function POST(request: NextRequest, ctx: RouteContext) {
  const auth = await requireBrokerApiContext();
  if (!auth.success) return jsonError(auth.message, auth.status, auth.reason);
  if (!canCreateWorkspaceRecords(auth.context.membership?.role)) {
    return jsonError("Action non autorisée pour votre rôle.", 403, "insufficient_role");
  }

  const { batchId } = await ctx.params;
  const { data: batchRow } = await auth.adminSupabase
    .from("broker_import_batches")
    .select("*")
    .eq("organization_id", auth.organizationId)
    .eq("id", batchId)
    .maybeSingle();
  const batch = batchRow as BrokerImportBatchRow | null;
  if (!batch) return jsonError("Import introuvable.", 404, "not_found");
  if (batch.status !== "uploading") {
    return jsonError("Cet import n'accepte plus de fichiers.", 409, "not_uploading");
  }
  if (batch.file_count >= MAX_IMPORT_FILES) {
    return jsonError(
      `Limite de ${MAX_IMPORT_FILES} fichiers par import atteinte.`,
      413,
      "too_many_files",
    );
  }

  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  const originalPath =
    (form?.get("path") as string | null)?.trim() || "";
  if (!(file instanceof File)) return jsonError("Aucun fichier reçu.", 400, "no_file");

  const mimeType = file.type || "application/octet-stream";
  if (!isAllowedDocumentMime(mimeType)) {
    return jsonError("Type de fichier non pris en charge.", 415, "bad_mime");
  }
  if (file.size <= 0) return jsonError("Fichier vide.", 400, "empty_file");
  if (file.size > MAX_DOCUMENT_SIZE_BYTES) {
    return jsonError("Fichier trop volumineux (max 50 Mo).", 413, "too_large");
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const fileName = sanitizeFileName(file.name || "document");
  const stagingPath = `${importStagingPrefix(auth.organizationId, batchId)}/${crypto.randomUUID()}-${fileName}`;

  const { error: uploadError } = await auth.adminSupabase.storage
    .from(BROKER_FILES_BUCKET)
    .upload(stagingPath, buffer, { contentType: mimeType, upsert: false });
  if (uploadError) {
    return jsonError("Envoi du fichier impossible.", 500, uploadError.message);
  }

  const { data: inserted, error: insertError } = await auth.adminSupabase
    .from("broker_import_files")
    .insert({
      organization_id: auth.organizationId,
      batch_id: batchId,
      uploaded_by: auth.user.id,
      original_path: originalPath || file.name || fileName,
      file_name: file.name || fileName,
      mime_type: mimeType,
      size_bytes: buffer.byteLength,
      staging_path: stagingPath,
      analysis_status: "pending",
    })
    .select("id")
    .single();

  if (insertError || !inserted) {
    await auth.adminSupabase.storage.from(BROKER_FILES_BUCKET).remove([stagingPath]);
    return jsonError("Enregistrement du fichier impossible.", 500, insertError?.message ?? "insert_failed");
  }

  await auth.adminSupabase
    .from("broker_import_batches")
    .update({ file_count: batch.file_count + 1, updated_at: new Date().toISOString() })
    .eq("id", batchId);

  return NextResponse.json({ success: true, fileId: inserted.id });
}
