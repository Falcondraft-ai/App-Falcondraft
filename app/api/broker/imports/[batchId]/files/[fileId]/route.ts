import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { canCreateWorkspaceRecords } from "@/lib/auth/workspace-permissions";
import { brokerDocumentCategories } from "@/lib/broker/documents";
import { normalizeImportDocCategory, readExtraction } from "@/lib/broker/imports";
import { requireBrokerApiContext } from "@/lib/broker/server";
import type { BrokerImportFileRow, Database } from "@/types/database";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ batchId: string; fileId: string }> };

const patchSchema = z.object({
  category: z.enum(brokerDocumentCategories).optional(),
  groupId: z.string().uuid().nullable().optional(),
  decision: z.enum(["include", "exclude"]).optional(),
});

function jsonError(message: string, status: number, reason: string) {
  return NextResponse.json({ success: false, message, reason }, { status });
}

/** Edits a staged file: document category, group reassignment, include/exclude. */
export async function PATCH(request: NextRequest, ctx: RouteContext) {
  const auth = await requireBrokerApiContext();
  if (!auth.success) return jsonError(auth.message, auth.status, auth.reason);
  if (!canCreateWorkspaceRecords(auth.context.membership?.role)) {
    return jsonError("Action non autorisée pour votre rôle.", 403, "insufficient_role");
  }

  const { batchId, fileId } = await ctx.params;
  const body: unknown = await request.json().catch(() => ({}));
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return jsonError("Requête invalide.", 400, "invalid_payload");

  const admin = auth.adminSupabase;
  const orgId = auth.organizationId;

  const { data: fileRow } = await admin
    .from("broker_import_files")
    .select("*")
    .eq("organization_id", orgId)
    .eq("batch_id", batchId)
    .eq("id", fileId)
    .maybeSingle();
  const file = fileRow as BrokerImportFileRow | null;
  if (!file) return jsonError("Fichier introuvable.", 404, "not_found");

  const v = parsed.data;

  // Reassignment target must belong to the same batch (or be null = "À trier").
  if (v.groupId) {
    const { data: group } = await admin
      .from("broker_import_groups")
      .select("id")
      .eq("organization_id", orgId)
      .eq("batch_id", batchId)
      .eq("id", v.groupId)
      .maybeSingle();
    if (!group) return jsonError("Dossier cible introuvable.", 404, "group_not_found");
  }

  const update: Database["public"]["Tables"]["broker_import_files"]["Update"] = {
    updated_at: new Date().toISOString(),
  };
  if (v.groupId !== undefined) update.group_id = v.groupId;
  if (v.decision !== undefined) update.decision = v.decision;
  if (v.category !== undefined) {
    update.extracted = {
      ...readExtraction(file),
      doc_category: normalizeImportDocCategory(v.category),
    };
  }

  const { error } = await admin
    .from("broker_import_files")
    .update(update)
    .eq("organization_id", orgId)
    .eq("id", fileId);
  if (error) return jsonError("Mise à jour impossible.", 500, error.message);

  return NextResponse.json({ success: true });
}
