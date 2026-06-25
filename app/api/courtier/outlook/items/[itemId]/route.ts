import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { canCreateWorkspaceRecords } from "@/lib/auth/workspace-permissions";
import { requireBrokerApiContext } from "@/lib/broker/server";

type RouteContext = { params: Promise<{ itemId: string }> };

const schema = z.object({ action: z.enum(["keep", "exclude"]) });

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

  const { data: existing } = await auth.adminSupabase
    .from("broker_email_items")
    .select("id")
    .eq("organization_id", auth.organizationId)
    .eq("user_id", auth.user.id)
    .eq("id", itemId)
    .maybeSingle();

  if (!existing) return jsonError("Email introuvable.", 404, "not_found");

  const relevance = parsed.data.action === "keep" ? "relevant" : "excluded";
  const { error } = await auth.adminSupabase
    .from("broker_email_items")
    .update({ relevance, updated_at: new Date().toISOString() })
    .eq("organization_id", auth.organizationId)
    .eq("user_id", auth.user.id)
    .eq("id", itemId);

  if (error) return jsonError("Mise à jour impossible.", 500, error.message);

  return NextResponse.json({ success: true, relevance });
}
