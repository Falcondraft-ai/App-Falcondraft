import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { canCreateWorkspaceRecords } from "@/lib/auth/workspace-permissions";
import {
  advanceClientStatus,
  logBrokerActivity,
  requireBrokerApiContext,
} from "@/lib/broker/server";
import { supersedeAdviceSignature } from "@/lib/broker/signature";
import type { Database } from "@/types/database";

type BrokerAdviceUpdate =
  Database["public"]["Tables"]["broker_advice"]["Update"];

type RouteContext = { params: Promise<{ id: string; adviceId: string }> };

const schema = z.object({
  title: z.string().trim().min(1).max(255).optional(),
  content: z.string().max(50000).optional(),
  requirements: z.string().max(50000).optional().nullable(),
  validate: z.boolean().optional(),
});

function jsonError(message: string, status: number, reason: string) {
  return NextResponse.json({ success: false, message, reason }, { status });
}

export async function PATCH(request: NextRequest, ctx: RouteContext) {
  const auth = await requireBrokerApiContext();
  if (!auth.success) return jsonError(auth.message, auth.status, auth.reason);

  if (!canCreateWorkspaceRecords(auth.context.membership?.role)) {
    return jsonError(
      "Votre rôle ne permet pas de modifier ce document.",
      403,
      "insufficient_role",
    );
  }

  const { id: clientId, adviceId } = await ctx.params;

  const body: unknown = await request.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return jsonError("Modification invalide.", 400, "invalid_payload");
  }
  const values = parsed.data;

  const { data: existing } = await auth.adminSupabase
    .from("broker_advice")
    .select(
      "id, status, title, content, requirements, signature_status, docuseal_submission_id",
    )
    .eq("organization_id", auth.organizationId)
    .eq("client_id", clientId)
    .eq("id", adviceId)
    .maybeSingle();

  if (!existing) {
    return jsonError("Document introuvable.", 404, "advice_not_found");
  }

  // Did the substance of the document actually change? Validating or renaming
  // doesn't invalidate a signature — rewriting the advice does.
  const substanceChanged =
    (values.content !== undefined && values.content !== existing.content) ||
    (values.requirements !== undefined &&
      (values.requirements?.trim() || null) !== existing.requirements);

  const update: BrokerAdviceUpdate = { updated_at: new Date().toISOString() };
  if (values.title !== undefined) update.title = values.title;
  if (values.content !== undefined) update.content = values.content;
  if (values.requirements !== undefined)
    update.requirements = values.requirements?.trim() || null;

  if (values.validate) {
    update.status = "validated";
    update.validated_by = auth.user.id;
    update.validated_at = new Date().toISOString();
  }

  const { error } = await auth.adminSupabase
    .from("broker_advice")
    .update(update)
    .eq("organization_id", auth.organizationId)
    .eq("id", adviceId);

  if (error) {
    return jsonError("Enregistrement impossible.", 500, error.message);
  }

  // The provider keeps its own copy of the PDF, so an outstanding signature
  // link would still point at the previous wording. Kill it (or flag an already
  // signed document as outdated) rather than let a stale version be signed.
  let signatureCancelled = false;
  let signatureOutdated = false;
  if (substanceChanged) {
    const outcome = await supersedeAdviceSignature({
      adminSupabase: auth.adminSupabase,
      organizationId: auth.organizationId,
      advice: {
        id: adviceId,
        client_id: clientId,
        status: existing.status,
        signature_status: existing.signature_status,
        docuseal_submission_id: existing.docuseal_submission_id,
      },
      userId: auth.user.id,
    });
    signatureCancelled = outcome.cancelledPending;
    signatureOutdated = outcome.flaggedSigned;
  }

  if (values.validate && existing.status !== "validated") {
    await logBrokerActivity(auth.adminSupabase, {
      organizationId: auth.organizationId,
      clientId,
      userId: auth.user.id,
      profileId: auth.profileId,
      type: "advice_validated",
      description: "Devoir de conseil validé.",
      metadata: { advice_id: adviceId },
    });
    // Validated devoir de conseil → dossier ready for signature.
    await advanceClientStatus(
      auth.adminSupabase,
      auth.organizationId,
      clientId,
      "advice_ready",
    );
  }

  return NextResponse.json({
    success: true,
    signatureCancelled,
    signatureOutdated,
  });
}

export async function DELETE(_request: NextRequest, ctx: RouteContext) {
  const auth = await requireBrokerApiContext();
  if (!auth.success) return jsonError(auth.message, auth.status, auth.reason);

  if (auth.context.membership?.role !== "manager") {
    return jsonError(
      "Seul un gestionnaire peut supprimer ce document.",
      403,
      "insufficient_role",
    );
  }

  const { id: clientId, adviceId } = await ctx.params;

  const { error } = await auth.adminSupabase
    .from("broker_advice")
    .delete()
    .eq("organization_id", auth.organizationId)
    .eq("client_id", clientId)
    .eq("id", adviceId);

  if (error) {
    return jsonError("Suppression impossible.", 500, error.message);
  }

  return NextResponse.json({ success: true });
}
