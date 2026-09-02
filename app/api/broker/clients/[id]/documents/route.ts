import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { canCreateWorkspaceRecords } from "@/lib/auth/workspace-permissions";
import {
  BROKER_FILES_BUCKET,
  brokerDocumentCategories,
} from "@/lib/broker/documents";
import {
  adjustOrganizationStorage,
  logBrokerActivity,
  requireBrokerApiContext,
} from "@/lib/broker/server";

type RouteContext = { params: Promise<{ id: string }> };

const schema = z.object({
  path: z.string().trim().min(1),
  title: z.string().trim().min(1).max(255),
  fileName: z.string().trim().min(1).max(255),
  mimeType: z.string().trim().min(1).max(160),
  sizeBytes: z.number().int().nonnegative().default(0),
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

  const expectedPrefix = `${auth.organizationId}/${clientId}/`;
  if (!values.path.startsWith(expectedPrefix)) {
    return jsonError("Chemin de fichier invalide.", 400, "invalid_path");
  }

  // Size accounting: the client-reported size was already validated against the
  // quota when minting the upload URL. We treat it as authoritative and use the
  // storage object size only as a best-effort cross-check (storage.list is
  // eventually consistent and may not expose metadata.size right after upload).
  const folder = `${auth.organizationId}/${clientId}`;
  const basename = values.path.slice(folder.length + 1);
  let sizeBytes = values.sizeBytes;
  try {
    const { data: listed } = await auth.adminSupabase.storage
      .from(BROKER_FILES_BUCKET)
      .list(folder, { search: basename, limit: 100 });
    const object = listed?.find((item) => item.name === basename);
    const storageSize = Number(
      (object?.metadata as { size?: number } | null)?.size ?? 0,
    );
    if (storageSize > 0) {
      sizeBytes = storageSize;
    }
  } catch (error) {
    console.error("[broker] storage size cross-check failed:", error);
  }

  const { data: document, error } = await auth.adminSupabase
    .from("broker_documents")
    .insert({
      organization_id: auth.organizationId,
      client_id: clientId,
      uploaded_by: auth.user.id,
      category: values.category,
      title: values.title,
      file_name: values.fileName,
      storage_path: values.path,
      mime_type: values.mimeType,
      size_bytes: sizeBytes,
      status: "stored",
    })
    .select("*")
    .single();

  if (error || !document) {
    console.error("[broker] document insert failed:", error);
    // Roll back the orphaned upload so storage doesn't drift.
    await auth.adminSupabase.storage
      .from(BROKER_FILES_BUCKET)
      .remove([values.path]);

    // Surface a clear, actionable message when the module isn't migrated yet.
    const raw = error?.message ?? "";
    const missingTable =
      error?.code === "42P01" ||
      /broker_documents/i.test(raw) &&
        /(does not exist|relation|schema cache|could not find)/i.test(raw);

    return jsonError(
      missingTable
        ? "Le module documents n’est pas initialisé : appliquez la migration 0032 dans Supabase."
        : "Enregistrement du document impossible.",
      500,
      error?.message ?? "insert_failed",
    );
  }

  await adjustOrganizationStorage(
    auth.adminSupabase,
    auth.organizationId,
    sizeBytes,
  );

  await logBrokerActivity(auth.adminSupabase, {
    organizationId: auth.organizationId,
    clientId,
    userId: auth.user.id,
    profileId: auth.profileId,
    type: "document_added",
    description: `Document ajouté : ${values.title}.`,
    metadata: { category: values.category, size_bytes: sizeBytes },
  });

  return NextResponse.json({ success: true, document });
}
