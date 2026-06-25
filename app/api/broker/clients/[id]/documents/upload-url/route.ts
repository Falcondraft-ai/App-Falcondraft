import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { canCreateWorkspaceRecords } from "@/lib/auth/workspace-permissions";
import {
  BROKER_FILES_BUCKET,
  brokerDocumentCategories,
  isAllowedDocumentMime,
  MAX_DOCUMENT_SIZE_BYTES,
  sanitizeFileName,
} from "@/lib/broker/documents";
import { requireBrokerApiContext } from "@/lib/broker/server";
import { computeStorageUsage, formatBytes } from "@/lib/broker/storage";

type RouteContext = { params: Promise<{ id: string }> };

const schema = z.object({
  fileName: z.string().trim().min(1).max(255),
  sizeBytes: z.number().int().positive(),
  mimeType: z.string().trim().min(1).max(160),
  category: z.enum(brokerDocumentCategories).default("other"),
});

function jsonError(message: string, status: number, reason: string) {
  return NextResponse.json({ success: false, message, reason }, { status });
}

export async function POST(request: NextRequest, ctx: RouteContext) {
  const auth = await requireBrokerApiContext();
  if (!auth.success) return jsonError(auth.message, auth.status, auth.reason);

  if (!canCreateWorkspaceRecords(auth.context.membership?.role)) {
    return jsonError(
      "Votre rôle ne permet pas d’ajouter des documents.",
      403,
      "insufficient_role",
    );
  }

  const { id: clientId } = await ctx.params;

  const body: unknown = await request.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return jsonError("Requête invalide.", 400, "invalid_payload");
  }
  const values = parsed.data;

  if (!isAllowedDocumentMime(values.mimeType)) {
    return jsonError(
      "Type de fichier non autorisé. Formats acceptés : PDF, images, Word, Excel.",
      415,
      "unsupported_media_type",
    );
  }

  if (values.sizeBytes > MAX_DOCUMENT_SIZE_BYTES) {
    return jsonError(
      `Fichier trop volumineux (max ${formatBytes(MAX_DOCUMENT_SIZE_BYTES)}).`,
      413,
      "file_too_large",
    );
  }

  // Verify the client belongs to this organization.
  const { data: client } = await auth.adminSupabase
    .from("broker_clients")
    .select("id")
    .eq("organization_id", auth.organizationId)
    .eq("id", clientId)
    .maybeSingle();

  if (!client) {
    return jsonError("Dossier introuvable.", 404, "client_not_found");
  }

  // Enforce the per-workspace storage quota before minting the upload URL.
  const usage = computeStorageUsage(auth.context.organization);
  if (usage.usedBytes + values.sizeBytes > usage.limitBytes) {
    return jsonError(
      `Quota de stockage atteint (${formatBytes(usage.usedBytes)} / ${formatBytes(usage.limitBytes)}). Libérez de l’espace avant d’importer ce fichier.`,
      413,
      "storage_quota_exceeded",
    );
  }

  const path = `${auth.organizationId}/${clientId}/${crypto.randomUUID()}-${sanitizeFileName(values.fileName)}`;

  const { data, error } = await auth.adminSupabase.storage
    .from(BROKER_FILES_BUCKET)
    .createSignedUploadUrl(path);

  if (error || !data) {
    return jsonError(
      "Préparation de l’import impossible.",
      500,
      error?.message ?? "signed_upload_failed",
    );
  }

  return NextResponse.json({
    success: true,
    path: data.path,
    token: data.token,
    bucket: BROKER_FILES_BUCKET,
  });
}
