import { NextResponse, type NextRequest } from "next/server";
import { canCreateWorkspaceRecords } from "@/lib/auth/workspace-permissions";
import { BROKER_FILES_BUCKET } from "@/lib/broker/documents";
import {
  adjustOrganizationStorage,
  logBrokerActivity,
  requireBrokerApiContext,
} from "@/lib/broker/server";

type RouteContext = { params: Promise<{ id: string; docId: string }> };

function jsonError(message: string, status: number, reason: string) {
  return NextResponse.json({ success: false, message, reason }, { status });
}

export async function DELETE(_request: NextRequest, ctx: RouteContext) {
  const auth = await requireBrokerApiContext();
  if (!auth.success) return jsonError(auth.message, auth.status, auth.reason);

  if (!canCreateWorkspaceRecords(auth.context.membership?.role)) {
    return jsonError(
      "Votre rôle ne permet pas de supprimer des documents.",
      403,
      "insufficient_role",
    );
  }

  const { id: clientId, docId } = await ctx.params;

  const { data: document } = await auth.adminSupabase
    .from("broker_documents")
    .select("id, storage_path, size_bytes, title")
    .eq("organization_id", auth.organizationId)
    .eq("client_id", clientId)
    .eq("id", docId)
    .maybeSingle();

  if (!document) {
    return jsonError("Document introuvable.", 404, "document_not_found");
  }

  // Remove the file from storage (best-effort: if it's already gone we still
  // want to delete the row and free the quota — we just log any orphan).
  const { error: removeError } = await auth.adminSupabase.storage
    .from(BROKER_FILES_BUCKET)
    .remove([document.storage_path]);

  if (removeError) {
    console.error(
      "[broker] storage file removal failed (continuing):",
      removeError.message,
    );
  }

  // Delete the metadata row — this is the source of truth for the GED list.
  const { error: deleteError } = await auth.adminSupabase
    .from("broker_documents")
    .delete()
    .eq("organization_id", auth.organizationId)
    .eq("id", docId);

  if (deleteError) {
    console.error("[broker] document row delete failed:", deleteError);
    return jsonError("Suppression impossible.", 500, deleteError.message);
  }

  // Free the storage quota.
  await adjustOrganizationStorage(
    auth.adminSupabase,
    auth.organizationId,
    -(document.size_bytes ?? 0),
  );

  await logBrokerActivity(auth.adminSupabase, {
    organizationId: auth.organizationId,
    clientId,
    userId: auth.user.id,
    type: "document_deleted",
    description: `Document supprimé : ${document.title}.`,
  });

  return NextResponse.json({ success: true });
}
