import { NextResponse } from "next/server";
import { canCreateWorkspaceRecords } from "@/lib/auth/workspace-permissions";
import { BROKER_FILES_BUCKET, sanitizeFileName } from "@/lib/broker/documents";
import {
  importGroupDisplayName,
  normalizeImportDocCategory,
  readExtraction,
} from "@/lib/broker/imports";
import {
  adjustOrganizationStorage,
  logBrokerActivity,
  requireBrokerApiContext,
} from "@/lib/broker/server";
import { computeStorageUsage } from "@/lib/broker/storage";
import type {
  BrokerClientRow,
  BrokerImportFileRow,
  BrokerImportGroupRow,
} from "@/types/database";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Groups committed per call — keeps a large "reprise" within the time budget. */
const COMMIT_CHUNK_GROUPS = 5;

type RouteContext = { params: Promise<{ batchId: string }> };

function jsonError(message: string, status: number, reason: string) {
  return NextResponse.json({ success: false, message, reason }, { status });
}

export async function POST(_request: Request, ctx: RouteContext) {
  const auth = await requireBrokerApiContext();
  if (!auth.success) return jsonError(auth.message, auth.status, auth.reason);
  if (!canCreateWorkspaceRecords(auth.context.membership?.role)) {
    return jsonError("Action non autorisée pour votre rôle.", 403, "insufficient_role");
  }

  const { batchId } = await ctx.params;
  const admin = auth.adminSupabase;
  const orgId = auth.organizationId;
  const userId = auth.user.id;

  const { data: batch } = await admin
    .from("broker_import_batches")
    .select("id, status")
    .eq("organization_id", orgId)
    .eq("id", batchId)
    .maybeSingle();
  if (!batch) return jsonError("Import introuvable.", 404, "not_found");

  await admin
    .from("broker_import_batches")
    .update({ status: "committing", updated_at: new Date().toISOString() })
    .eq("id", batchId);

  // Next chunk of confirmed-but-not-yet-committed groups.
  const { data: groupRows } = await admin
    .from("broker_import_groups")
    .select("*")
    .eq("organization_id", orgId)
    .eq("batch_id", batchId)
    .eq("status", "confirmed")
    .order("created_at", { ascending: true })
    .limit(COMMIT_CHUNK_GROUPS);
  const groups = (groupRows ?? []) as BrokerImportGroupRow[];

  // Storage quota accounting (running, from the current counter).
  const usage = computeStorageUsage(auth.context.organization);
  let used = usage.usedBytes;
  const limit = usage.limitBytes;

  let createdClients = 0;
  let matchedClients = 0;
  let filedDocuments = 0;

  for (const group of groups) {
    // Resolve the target client: existing match, or a freshly created dossier.
    let clientId = group.match_client_id;
    let isNew = false;
    if (clientId) {
      const { data: existing } = await admin
        .from("broker_clients")
        .select("id")
        .eq("organization_id", orgId)
        .eq("id", clientId)
        .maybeSingle();
      if (!existing) clientId = null; // stale link → create instead
    }
    if (!clientId) {
      const { data: created, error } = await admin
        .from("broker_clients")
        .insert({
          organization_id: orgId,
          created_by: userId,
          client_type: group.client_type,
          first_name: group.first_name,
          last_name: group.last_name,
          company_name: group.company_name,
          email: group.email,
          phone: group.phone,
          address: group.address,
          postal_code: group.postal_code,
          city: group.city,
          insurance_type: group.insurance_type,
          needs: group.needs,
          status: "new",
        })
        .select("*")
        .single();
      if (error || !created) {
        console.error("[import] client create failed:", group.id, error?.message);
        continue; // leave group as confirmed → retried on next call
      }
      clientId = (created as BrokerClientRow).id;
      isNew = true;
      createdClients += 1;
    } else {
      matchedClients += 1;
    }

    // File the included, successfully-analysed files of this group.
    const { data: fileRows } = await admin
      .from("broker_import_files")
      .select("*")
      .eq("organization_id", orgId)
      .eq("batch_id", batchId)
      .eq("group_id", group.id)
      .eq("decision", "include")
      .neq("analysis_status", "failed");
    const files = (fileRows ?? []) as BrokerImportFileRow[];

    let filedInGroup = 0;
    for (const file of files) {
      if (used + file.size_bytes > limit) {
        console.error("[import] storage quota reached, stopping commit");
        await admin
          .from("broker_import_batches")
          .update({ status: "review", updated_at: new Date().toISOString() })
          .eq("id", batchId);
        return jsonError(
          "Quota de stockage atteint : une partie de l'import n'a pas pu être finalisée.",
          413,
          "storage_quota_exceeded",
        );
      }

      const extraction = readExtraction(file);
      const destPath = `${orgId}/${clientId}/${crypto.randomUUID()}-${sanitizeFileName(file.file_name)}`;
      const { error: moveError } = await admin.storage
        .from(BROKER_FILES_BUCKET)
        .move(file.staging_path, destPath);
      if (moveError) {
        console.error("[import] move failed:", file.id, moveError.message);
        continue;
      }

      const { error: docError } = await admin.from("broker_documents").insert({
        organization_id: orgId,
        client_id: clientId,
        uploaded_by: userId,
        category: normalizeImportDocCategory(
          typeof extraction.doc_category === "string" ? extraction.doc_category : null,
        ),
        title:
          (typeof extraction.doc_title === "string" && extraction.doc_title.trim()) ||
          file.file_name,
        file_name: file.file_name,
        storage_path: destPath,
        mime_type: file.mime_type,
        size_bytes: file.size_bytes,
        status: "stored",
      });
      if (docError) {
        console.error("[import] document insert failed:", file.id, docError.message);
        continue;
      }

      // Record the new location so the row no longer points at staging.
      await admin
        .from("broker_import_files")
        .update({ staging_path: destPath, updated_at: new Date().toISOString() })
        .eq("id", file.id);

      await adjustOrganizationStorage(admin, orgId, file.size_bytes);
      used += file.size_bytes;
      filedInGroup += 1;
      filedDocuments += 1;
    }

    await admin
      .from("broker_import_groups")
      .update({
        status: "committed",
        created_client_id: clientId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", group.id);

    await logBrokerActivity(admin, {
      organizationId: orgId,
      clientId,
      userId,
      type: isNew ? "client_created" : "document_added",
      description: isNew
        ? `Dossier importé — ${importGroupDisplayName(group)} (${filedInGroup} pièce${filedInGroup > 1 ? "s" : ""}).`
        : `${filedInGroup} pièce${filedInGroup > 1 ? "s" : ""} rangée${filedInGroup > 1 ? "s" : ""} via un import de portefeuille.`,
      metadata: { import_batch_id: batchId, filed: filedInGroup },
    });
  }

  // Any confirmed groups still left?
  const { count: remaining } = await admin
    .from("broker_import_groups")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", orgId)
    .eq("batch_id", batchId)
    .eq("status", "confirmed");
  const done = (remaining ?? 0) === 0;

  await admin
    .from("broker_import_batches")
    .update({
      status: done ? "completed" : "committing",
      completed_at: done ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", batchId);

  return NextResponse.json({
    success: true,
    done,
    createdClients,
    matchedClients,
    filedDocuments,
    remaining: remaining ?? 0,
  });
}
