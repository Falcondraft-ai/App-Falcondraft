import { NextResponse } from "next/server";
import { canCreateWorkspaceRecords } from "@/lib/auth/workspace-permissions";
import { brokerClientDisplayName } from "@/lib/broker/clients";
import {
  clusterImportFiles,
  importGroupDisplayName,
  parseFolderIdentity,
  readExtraction,
  topLevelFolder,
  type ClusterInputFile,
} from "@/lib/broker/imports";
import { requireBrokerApiContext } from "@/lib/broker/server";
import type {
  BrokerClientRow,
  BrokerImportBatchRow,
  BrokerImportFileRow,
  Database,
} from "@/types/database";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

type RouteContext = { params: Promise<{ batchId: string }> };

function jsonError(message: string, status: number, reason: string) {
  return NextResponse.json({ success: false, message, reason }, { status });
}

function normalizeName(v: string | null | undefined): string {
  return (v ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Reclassement: clusters analysed files into proposed dossiers (folder → email
 * → name), dedups each against existing clients, and persists the groups for
 * review. Idempotent — re-running rebuilds the groups from scratch.
 */
export async function POST(request: Request, ctx: RouteContext) {
  const auth = await requireBrokerApiContext();
  if (!auth.success) return jsonError(auth.message, auth.status, auth.reason);
  if (!canCreateWorkspaceRecords(auth.context.membership?.role)) {
    return jsonError("Action non autorisée pour votre rôle.", 403, "insufficient_role");
  }

  // Empty client folders (a .zip that kept the tree can carry folders with no
  // file inside) — we still create a document-less dossier for each.
  const body = (await request.json().catch(() => ({}))) as {
    emptyFolders?: unknown;
  };
  const emptyFolders = Array.isArray(body.emptyFolders)
    ? body.emptyFolders
        .filter((f): f is string => typeof f === "string" && f.trim().length > 0)
        .slice(0, 500)
    : [];

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

  const { count: pending } = await admin
    .from("broker_import_files")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", orgId)
    .eq("batch_id", batchId)
    .eq("analysis_status", "pending");
  if ((pending ?? 0) > 0) {
    return jsonError("L'analyse n'est pas terminée.", 409, "analysis_pending");
  }

  // Reset any previous grouping (idempotent re-run).
  await admin
    .from("broker_import_files")
    .update({ group_id: null, updated_at: new Date().toISOString() })
    .eq("organization_id", orgId)
    .eq("batch_id", batchId);
  await admin
    .from("broker_import_groups")
    .delete()
    .eq("organization_id", orgId)
    .eq("batch_id", batchId);

  const { data: fileRows } = await admin
    .from("broker_import_files")
    .select("*")
    .eq("organization_id", orgId)
    .eq("batch_id", batchId)
    .neq("analysis_status", "failed");
  const files = (fileRows ?? []) as BrokerImportFileRow[];

  const clusterInputs: ClusterInputFile[] = files.map((f) => ({
    id: f.id,
    folder: topLevelFolder(f.original_path),
    extraction: readExtraction(f),
  }));
  const { clusters } = clusterImportFiles(clusterInputs);

  // Existing clients for dedup (email exact, then normalized display name).
  const { data: clientRows } = await admin
    .from("broker_clients")
    .select("id, client_type, first_name, last_name, company_name, email")
    .eq("organization_id", orgId)
    .is("archived_at", null)
    .limit(2000);
  const clients = (clientRows ?? []) as Pick<
    BrokerClientRow,
    "id" | "client_type" | "first_name" | "last_name" | "company_name" | "email"
  >[];
  const byEmail = new Map<string, string>();
  const byName = new Map<string, string>();
  for (const c of clients) {
    if (c.email) byEmail.set(c.email.trim().toLowerCase(), c.id);
    const n = normalizeName(brokerClientDisplayName(c));
    if (n) byName.set(n, c.id);
  }

  let groupCount = 0;
  const createdKeys = new Set<string>();
  for (const cluster of clusters) {
    const identity = cluster.identity;
    const email = identity.email?.trim().toLowerCase() || null;
    const nameKey = normalizeName(
      importGroupDisplayName({
        client_type: identity.client_type,
        first_name: identity.first_name,
        last_name: identity.last_name,
        company_name: identity.company_name,
        email,
      }),
    );
    const matchClientId =
      (email ? byEmail.get(email) : undefined) ??
      (nameKey ? byName.get(nameKey) : undefined) ??
      null;

    const insert: Database["public"]["Tables"]["broker_import_groups"]["Insert"] = {
      organization_id: orgId,
      batch_id: batchId,
      match_client_id: matchClientId,
      client_type: identity.client_type,
      first_name: identity.first_name,
      last_name: identity.last_name,
      company_name: identity.company_name,
      email,
      phone: identity.phone,
      address: identity.address,
      postal_code: identity.postal_code,
      city: identity.city,
      insurance_type: identity.insurance_type,
      confidence: identity.confidence,
      status: "pending",
    };

    const { data: group } = await admin
      .from("broker_import_groups")
      .insert(insert)
      .select("id")
      .single();
    if (!group) continue;
    groupCount += 1;
    if (nameKey) createdKeys.add(nameKey);

    await admin
      .from("broker_import_files")
      .update({ group_id: group.id, updated_at: new Date().toISOString() })
      .eq("organization_id", orgId)
      .in("id", cluster.fileIds);
  }

  // Empty folders → document-less dossiers (deduped against file groups & clients).
  const seenEmpty = new Set<string>();
  for (const folder of emptyFolders) {
    const identity = parseFolderIdentity(folder);
    if (!identity) continue; // generic / unusable folder name
    const nameKey = normalizeName(
      importGroupDisplayName({
        client_type: identity.client_type,
        first_name: identity.first_name,
        last_name: identity.last_name,
        company_name: identity.company_name,
        email: null,
      }),
    );
    if (!nameKey || createdKeys.has(nameKey) || seenEmpty.has(nameKey)) continue;
    seenEmpty.add(nameKey);

    const { data: group } = await admin
      .from("broker_import_groups")
      .insert({
        organization_id: orgId,
        batch_id: batchId,
        match_client_id: byName.get(nameKey) ?? null,
        client_type: identity.client_type,
        first_name: identity.first_name,
        last_name: identity.last_name,
        company_name: identity.company_name,
        email: null,
        phone: null,
        address: null,
        postal_code: null,
        city: null,
        insurance_type: null,
        confidence: null,
        status: "pending",
      })
      .select("id")
      .single();
    if (group) groupCount += 1;
  }

  await admin
    .from("broker_import_batches")
    .update({
      status: "review",
      group_count: groupCount,
      updated_at: new Date().toISOString(),
    })
    .eq("id", batchId);

  return NextResponse.json({ success: true, groupCount });
}
