import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { canCreateWorkspaceRecords } from "@/lib/auth/workspace-permissions";
import { requireBrokerApiContext } from "@/lib/broker/server";

type RouteContext = { params: Promise<{ itemId: string }> };

const schema = z.object({
  action: z.enum(["keep", "exclude", "attach_client"]),
  clientId: z.string().uuid().optional(),
});

function jsonError(message: string, status: number, reason: string) {
  return NextResponse.json({ success: false, message, reason }, { status });
}

export async function POST(request: NextRequest, ctx: RouteContext) {
  const auth = await requireBrokerApiContext();
  if (!auth.success) return jsonError(auth.message, auth.status, auth.reason);

  if (!canCreateWorkspaceRecords(auth.context.membership?.role)) {
    return jsonError("Action non autorisée.", 403, "insufficient_role");
  }

  const { itemId } = await ctx.params;
  const body: unknown = await request.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  if (!parsed.success) return jsonError("Requête invalide.", 400, "invalid_payload");

  const admin = auth.adminSupabase;
  const orgId = auth.organizationId;
  const userId = auth.user.id;

  const { data: existing } = await admin
    .from("broker_email_items")
    .select("id")
    .eq("organization_id", orgId)
    .eq("user_id", userId)
    .eq("id", itemId)
    .maybeSingle();

  if (!existing) return jsonError("Email introuvable.", 404, "not_found");

  // --- Rattacher l'email à un dossier client -----------------------------
  if (parsed.data.action === "attach_client") {
    const clientId = parsed.data.clientId;
    if (!clientId) {
      return jsonError("Dossier manquant.", 400, "client_required");
    }

    const { data: client } = await admin
      .from("broker_clients")
      .select("id")
      .eq("organization_id", orgId)
      .eq("id", clientId)
      .maybeSingle();
    if (!client) return jsonError("Dossier introuvable.", 404, "client_not_found");

    const { error } = await admin
      .from("broker_email_items")
      .update({
        suggested_client_id: clientId,
        updated_at: new Date().toISOString(),
      })
      .eq("organization_id", orgId)
      .eq("user_id", userId)
      .eq("id", itemId);
    if (error) return jsonError("Rattachement impossible.", 500, error.message);

    // Propagate to pending sibling suggestions so attach_document / update_client
    // / declare_claim can execute against the chosen dossier.
    const { data: siblings } = await admin
      .from("broker_email_suggestions")
      .select("id, payload")
      .eq("organization_id", orgId)
      .eq("item_id", itemId)
      .eq("status", "pending");
    for (const sib of siblings ?? []) {
      if (sib.payload?.client_id) continue;
      await admin
        .from("broker_email_suggestions")
        .update({
          payload: { ...sib.payload, client_id: clientId },
          updated_at: new Date().toISOString(),
        })
        .eq("id", sib.id);
    }

    return NextResponse.json({ success: true, clientId });
  }

  const relevance = parsed.data.action === "keep" ? "relevant" : "excluded";
  const { error } = await admin
    .from("broker_email_items")
    .update({ relevance, updated_at: new Date().toISOString() })
    .eq("organization_id", orgId)
    .eq("user_id", userId)
    .eq("id", itemId);

  if (error) return jsonError("Mise à jour impossible.", 500, error.message);

  return NextResponse.json({ success: true, relevance });
}
