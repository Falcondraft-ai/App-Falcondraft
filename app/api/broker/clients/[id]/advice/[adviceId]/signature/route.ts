import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { canCreateWorkspaceRecords } from "@/lib/auth/workspace-permissions";
import {
  advanceClientStatus,
  logBrokerActivity,
  requireBrokerApiContext,
} from "@/lib/broker/server";
import type { Database } from "@/types/database";

type BrokerAdviceUpdate =
  Database["public"]["Tables"]["broker_advice"]["Update"];

type RouteContext = { params: Promise<{ id: string; adviceId: string }> };

const schema = z.object({
  // Record a signature link (created in DocuSeal, manually or via n8n later).
  signatureUrl: z.string().trim().url().optional().or(z.literal("")),
  // Mark the document as signed.
  markSigned: z.boolean().optional(),
});

function jsonError(message: string, status: number, reason: string) {
  return NextResponse.json({ success: false, message, reason }, { status });
}

export async function PATCH(request: NextRequest, ctx: RouteContext) {
  const auth = await requireBrokerApiContext();
  if (!auth.success) return jsonError(auth.message, auth.status, auth.reason);

  if (!canCreateWorkspaceRecords(auth.context.membership?.role)) {
    return jsonError("Votre rôle ne permet pas cette action.", 403, "insufficient_role");
  }

  const { id: clientId, adviceId } = await ctx.params;

  const body: unknown = await request.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return jsonError("Requête invalide.", 400, "invalid_payload");
  }
  const values = parsed.data;

  const { data: existing } = await auth.adminSupabase
    .from("broker_advice")
    .select("id, status")
    .eq("organization_id", auth.organizationId)
    .eq("client_id", clientId)
    .eq("id", adviceId)
    .maybeSingle();

  if (!existing) {
    return jsonError("Document introuvable.", 404, "advice_not_found");
  }

  if (existing.status === "draft") {
    return jsonError(
      "Validez d’abord le devoir de conseil.",
      400,
      "not_validated",
    );
  }

  const update: BrokerAdviceUpdate = { updated_at: new Date().toISOString() };
  let activityType = "advice_signature_updated";
  let activityDesc = "Demande de signature mise à jour.";

  if (values.markSigned) {
    update.status = "signed";
    update.signature_status = "completed";
    activityType = "advice_signed";
    activityDesc = "Devoir de conseil signé.";
  } else if (values.signatureUrl) {
    update.signature_url = values.signatureUrl;
    update.signature_status = "sent";
    update.status = "sent_for_signature";
    activityType = "advice_signature_prepared";
    activityDesc = "Lien de signature enregistré (envoyé en signature).";
  }

  const { error } = await auth.adminSupabase
    .from("broker_advice")
    .update(update)
    .eq("organization_id", auth.organizationId)
    .eq("id", adviceId);

  if (error) {
    return jsonError("Mise à jour impossible.", 500, error.message);
  }

  await logBrokerActivity(auth.adminSupabase, {
    organizationId: auth.organizationId,
    clientId,
    userId: auth.user.id,
    type: activityType,
    description: activityDesc,
    metadata: { advice_id: adviceId },
  });

  // Auto-advance the dossier status to match the signature workflow.
  if (values.markSigned) {
    await advanceClientStatus(
      auth.adminSupabase,
      auth.organizationId,
      clientId,
      "signed",
    );
  } else if (values.signatureUrl) {
    await advanceClientStatus(
      auth.adminSupabase,
      auth.organizationId,
      clientId,
      "awaiting_signature",
    );
  }

  return NextResponse.json({ success: true });
}
