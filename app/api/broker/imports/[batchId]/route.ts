import { NextResponse } from "next/server";
import { canCreateWorkspaceRecords } from "@/lib/auth/workspace-permissions";
import { BROKER_FILES_BUCKET } from "@/lib/broker/documents";
import { requireBrokerApiContext } from "@/lib/broker/server";
import type {
  BrokerImportBatchRow,
  BrokerImportFileRow,
  BrokerImportGroupRow,
} from "@/types/database";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ batchId: string }> };

function jsonError(message: string, status: number, reason: string) {
  return NextResponse.json({ success: false, message, reason }, { status });
}

/** Full batch state (batch + proposed groups + files) for the review UI. */
export async function GET(_request: Request, ctx: RouteContext) {
  const auth = await requireBrokerApiContext();
  if (!auth.success) return jsonError(auth.message, auth.status, auth.reason);

  const { batchId } = await ctx.params;
  const admin = auth.adminSupabase;
  const orgId = auth.organizationId;

  const { data: batchRow } = await admin
    .from("broker_import_batches")
    .select("*")
    .eq("organization_id", orgId)
    .eq("id", batchId)
    .maybeSingle();
  const batch = batchRow as BrokerImportBatchRow | null;
  if (!batch) return jsonError("Import introuvable.", 404, "not_found");

  const [{ data: groups }, { data: files }] = await Promise.all([
    admin
      .from("broker_import_groups")
      .select("*")
      .eq("organization_id", orgId)
      .eq("batch_id", batchId)
      .order("created_at", { ascending: true }),
    admin
      .from("broker_import_files")
      .select("*")
      .eq("organization_id", orgId)
      .eq("batch_id", batchId)
      .order("original_path", { ascending: true }),
  ]);

  return NextResponse.json({
    batch,
    groups: (groups ?? []) as BrokerImportGroupRow[],
    files: (files ?? []) as BrokerImportFileRow[],
  });
}

/** Discards a batch: removes staged bytes and all import rows. */
export async function DELETE(_request: Request, ctx: RouteContext) {
  const auth = await requireBrokerApiContext();
  if (!auth.success) return jsonError(auth.message, auth.status, auth.reason);
  if (!canCreateWorkspaceRecords(auth.context.membership?.role)) {
    return jsonError("Action non autorisée pour votre rôle.", 403, "insufficient_role");
  }

  const { batchId } = await ctx.params;
  const admin = auth.adminSupabase;
  const orgId = auth.organizationId;

  const { data: batchRow } = await admin
    .from("broker_import_batches")
    .select("id, status")
    .eq("organization_id", orgId)
    .eq("id", batchId)
    .maybeSingle();
  if (!batchRow) return jsonError("Import introuvable.", 404, "not_found");
  if (batchRow.status === "committing") {
    return jsonError("Import en cours de finalisation.", 409, "committing");
  }

  // Remove staged (uncommitted) bytes. Committed files were moved out already.
  const { data: staged } = await admin
    .from("broker_import_files")
    .select("staging_path")
    .eq("organization_id", orgId)
    .eq("batch_id", batchId);
  const paths = (staged ?? [])
    .map((f) => (f as { staging_path: string }).staging_path)
    .filter((p) => p.includes("/_import/"));
  if (paths.length > 0) {
    await admin.storage.from(BROKER_FILES_BUCKET).remove(paths);
  }

  // Cascades delete groups + files via FK.
  await admin
    .from("broker_import_batches")
    .delete()
    .eq("organization_id", orgId)
    .eq("id", batchId);

  return NextResponse.json({ success: true });
}
