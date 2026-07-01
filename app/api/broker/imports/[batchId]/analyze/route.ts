import { NextResponse } from "next/server";
import { canCreateWorkspaceRecords } from "@/lib/auth/workspace-permissions";
import { BROKER_FILES_BUCKET } from "@/lib/broker/documents";
import { classifyImportFile } from "@/lib/broker/import-classify";
import {
  ANALYZE_CHUNK_SIZE,
  MAX_AI_READ_BYTES,
} from "@/lib/broker/imports";
import { requireBrokerApiContext } from "@/lib/broker/server";
import type { BrokerImportBatchRow, BrokerImportFileRow } from "@/types/database";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

type RouteContext = { params: Promise<{ batchId: string }> };

function jsonError(message: string, status: number, reason: string) {
  return NextResponse.json({ success: false, message, reason }, { status });
}

/**
 * Analyses the next chunk of pending files (classification via AI/heuristic).
 * Called repeatedly by the client until `done` — resumable because it always
 * picks the remaining `pending` files. Per-file failures are isolated.
 */
export async function POST(_request: Request, ctx: RouteContext) {
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
    .select("*")
    .eq("organization_id", orgId)
    .eq("id", batchId)
    .maybeSingle();
  const batch = batchRow as BrokerImportBatchRow | null;
  if (!batch) return jsonError("Import introuvable.", 404, "not_found");

  if (batch.status === "uploading") {
    await admin
      .from("broker_import_batches")
      .update({ status: "analyzing", updated_at: new Date().toISOString() })
      .eq("id", batchId);
  }

  const { data: pendingRows } = await admin
    .from("broker_import_files")
    .select("*")
    .eq("organization_id", orgId)
    .eq("batch_id", batchId)
    .eq("analysis_status", "pending")
    .order("created_at", { ascending: true })
    .limit(ANALYZE_CHUNK_SIZE);
  const pending = (pendingRows ?? []) as BrokerImportFileRow[];

  await Promise.all(
    pending.map(async (file) => {
      try {
        const { data: blob, error } = await admin.storage
          .from(BROKER_FILES_BUCKET)
          .download(file.staging_path);
        if (error || !blob) throw new Error("download_failed");
        const buffer = Buffer.from(await blob.arrayBuffer());

        const extraction = await classifyImportFile({
          buffer,
          mimeType: file.mime_type,
          fileName: file.file_name,
          originalPath: file.original_path,
          maxAiBytes: MAX_AI_READ_BYTES,
        });

        await admin
          .from("broker_import_files")
          .update({
            extracted: extraction,
            analysis_status: "analyzed",
            decision: extraction.is_client_document ? "include" : "exclude",
            updated_at: new Date().toISOString(),
          })
          .eq("id", file.id);
      } catch (err) {
        console.error("[import] file analysis failed:", file.id, err);
        await admin
          .from("broker_import_files")
          .update({ analysis_status: "failed", updated_at: new Date().toISOString() })
          .eq("id", file.id);
      }
    }),
  );

  // Recompute progress from the source of truth.
  const { count: remaining } = await admin
    .from("broker_import_files")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", orgId)
    .eq("batch_id", batchId)
    .eq("analysis_status", "pending");
  const remainingCount = remaining ?? 0;
  const analyzedCount = Math.max(0, batch.file_count - remainingCount);

  await admin
    .from("broker_import_batches")
    .update({ analyzed_count: analyzedCount, updated_at: new Date().toISOString() })
    .eq("id", batchId);

  return NextResponse.json({
    success: true,
    analyzed: analyzedCount,
    total: batch.file_count,
    remaining: remainingCount,
    done: remainingCount === 0,
  });
}
