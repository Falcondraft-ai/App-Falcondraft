import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { canCreateWorkspaceRecords } from "@/lib/auth/workspace-permissions";
import { requireBrokerApiContext } from "@/lib/broker/server";
import type { Database } from "@/types/database";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ batchId: string; groupId: string }> };

const patchSchema = z.object({
  clientType: z.enum(["individual", "company"]).optional(),
  firstName: z.string().trim().max(120).nullable().optional(),
  lastName: z.string().trim().max(120).nullable().optional(),
  companyName: z.string().trim().max(160).nullable().optional(),
  email: z.string().trim().max(200).nullable().optional(),
  phone: z.string().trim().max(40).nullable().optional(),
  address: z.string().trim().max(240).nullable().optional(),
  postalCode: z.string().trim().max(20).nullable().optional(),
  city: z.string().trim().max(120).nullable().optional(),
  insuranceType: z.string().trim().max(40).nullable().optional(),
  needs: z.string().trim().max(5000).nullable().optional(),
  matchClientId: z.string().uuid().nullable().optional(),
  status: z.enum(["pending", "confirmed", "skipped"]).optional(),
});

function jsonError(message: string, status: number, reason: string) {
  return NextResponse.json({ success: false, message, reason }, { status });
}

/** Edits a proposed dossier (identity, existing-client link, confirm/skip). */
export async function PATCH(request: NextRequest, ctx: RouteContext) {
  const auth = await requireBrokerApiContext();
  if (!auth.success) return jsonError(auth.message, auth.status, auth.reason);
  if (!canCreateWorkspaceRecords(auth.context.membership?.role)) {
    return jsonError("Action non autorisée pour votre rôle.", 403, "insufficient_role");
  }

  const { batchId, groupId } = await ctx.params;
  const body: unknown = await request.json().catch(() => ({}));
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return jsonError("Requête invalide.", 400, "invalid_payload");

  const admin = auth.adminSupabase;
  const orgId = auth.organizationId;

  const { data: group } = await admin
    .from("broker_import_groups")
    .select("id, status")
    .eq("organization_id", orgId)
    .eq("batch_id", batchId)
    .eq("id", groupId)
    .maybeSingle();
  if (!group) return jsonError("Dossier proposé introuvable.", 404, "not_found");
  if (group.status === "committed") {
    return jsonError("Ce dossier a déjà été importé.", 409, "already_committed");
  }

  const v = parsed.data;

  // If linking to an existing client, verify it belongs to the org.
  if (v.matchClientId) {
    const { data: client } = await admin
      .from("broker_clients")
      .select("id")
      .eq("organization_id", orgId)
      .eq("id", v.matchClientId)
      .maybeSingle();
    if (!client) return jsonError("Client introuvable.", 404, "client_not_found");
  }

  const update: Database["public"]["Tables"]["broker_import_groups"]["Update"] = {
    updated_at: new Date().toISOString(),
  };
  if (v.clientType !== undefined) update.client_type = v.clientType;
  if (v.firstName !== undefined) update.first_name = v.firstName || null;
  if (v.lastName !== undefined) update.last_name = v.lastName || null;
  if (v.companyName !== undefined) update.company_name = v.companyName || null;
  if (v.email !== undefined) update.email = v.email?.toLowerCase() || null;
  if (v.phone !== undefined) update.phone = v.phone || null;
  if (v.address !== undefined) update.address = v.address || null;
  if (v.postalCode !== undefined) update.postal_code = v.postalCode || null;
  if (v.city !== undefined) update.city = v.city || null;
  if (v.insuranceType !== undefined) update.insurance_type = v.insuranceType || null;
  if (v.needs !== undefined) update.needs = v.needs || null;
  if (v.matchClientId !== undefined) update.match_client_id = v.matchClientId;
  if (v.status !== undefined) update.status = v.status;

  const { error } = await admin
    .from("broker_import_groups")
    .update(update)
    .eq("organization_id", orgId)
    .eq("id", groupId);
  if (error) return jsonError("Mise à jour impossible.", 500, error.message);

  return NextResponse.json({ success: true });
}
