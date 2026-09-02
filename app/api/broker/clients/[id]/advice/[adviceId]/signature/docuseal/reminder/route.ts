import { NextResponse, type NextRequest } from "next/server";
import { canCreateWorkspaceRecords } from "@/lib/auth/workspace-permissions";
import { hasFeature } from "@/lib/billing/entitlements";
import { resendSignatureRequest } from "@/lib/broker/docuseal";
import {
  logBrokerActivity,
  requireBrokerApiContext,
} from "@/lib/broker/server";
import { parseBrokerSettings } from "@/lib/broker/settings";
import {
  buildReminderMessage,
  REMINDER_MIN_INTERVAL_MS,
} from "@/lib/broker/signature";
import type { Database } from "@/types/database";

type BrokerAdviceUpdate =
  Database["public"]["Tables"]["broker_advice"]["Update"];
type RouteContext = { params: Promise<{ id: string; adviceId: string }> };

function jsonError(message: string, status: number, reason: string) {
  return NextResponse.json({ success: false, message, reason }, { status });
}

/**
 * Sends a reminder to the signer. The first send is always the broker's own
 * Outlook draft; reminders go out through the signature provider so the link
 * is regenerated and the delivery is tracked. Throttled to one per 24 h so a
 * double click can't turn into harassment.
 */
export async function POST(_request: NextRequest, ctx: RouteContext) {
  const auth = await requireBrokerApiContext();
  if (!auth.success) return jsonError(auth.message, auth.status, auth.reason);
  if (!canCreateWorkspaceRecords(auth.context.membership?.role)) {
    return jsonError(
      "Votre rôle ne permet pas cette action.",
      403,
      "insufficient_role",
    );
  }
  const organization = auth.context.organization;
  if (!organization || !hasFeature(organization, "esign")) {
    return jsonError(
      "La signature électronique n’est pas incluse dans votre offre.",
      403,
      "feature_not_available",
    );
  }

  const { id: clientId, adviceId } = await ctx.params;

  const { data: advice } = await auth.adminSupabase
    .from("broker_advice")
    .select(
      "id, client_id, status, signature_status, docuseal_submitter_id, signature_last_reminder_at, signature_reminder_count, signature_expires_at",
    )
    .eq("organization_id", auth.organizationId)
    .eq("id", adviceId)
    .maybeSingle();

  if (!advice || advice.client_id !== clientId) {
    return jsonError("Devoir de conseil introuvable.", 404, "advice_not_found");
  }
  if (advice.status === "signed") {
    return jsonError("Ce document est déjà signé.", 409, "already_signed");
  }
  if (!advice.docuseal_submitter_id) {
    return jsonError(
      "Créez d’abord la demande de signature.",
      400,
      "no_submission",
    );
  }
  if (advice.signature_status === "declined") {
    return jsonError(
      "Le client a refusé de signer — relancez-le directement plutôt que par email automatique.",
      409,
      "declined",
    );
  }
  if (
    advice.signature_expires_at &&
    new Date(advice.signature_expires_at).getTime() < Date.now()
  ) {
    return jsonError(
      "Le lien de signature a expiré. Recréez la demande de signature.",
      409,
      "expired",
    );
  }

  const lastReminder = advice.signature_last_reminder_at
    ? new Date(advice.signature_last_reminder_at).getTime()
    : 0;
  if (Date.now() - lastReminder < REMINDER_MIN_INTERVAL_MS) {
    return jsonError(
      "Un rappel a déjà été envoyé aujourd’hui. Réessayez demain.",
      429,
      "too_soon",
    );
  }

  const settings = parseBrokerSettings(organization);
  const sent = await resendSignatureRequest(
    advice.docuseal_submitter_id,
    buildReminderMessage(settings.compliance.legalName),
  );
  if (!sent) {
    return jsonError(
      "L’envoi du rappel n’a pas abouti. Réessayez dans un instant.",
      502,
      "reminder_failed",
    );
  }

  const now = new Date().toISOString();
  const update: BrokerAdviceUpdate = {
    signature_last_reminder_at: now,
    signature_reminder_count: (advice.signature_reminder_count ?? 0) + 1,
    updated_at: now,
  };
  await auth.adminSupabase
    .from("broker_advice")
    .update(update)
    .eq("organization_id", auth.organizationId)
    .eq("id", adviceId);

  await logBrokerActivity(auth.adminSupabase, {
    organizationId: auth.organizationId,
    clientId,
    userId: auth.user.id,
    profileId: auth.profileId,
    type: "advice_signature_reminded",
    description: "Rappel de signature envoyé au client.",
    metadata: { advice_id: adviceId, automatic: false },
  });

  return NextResponse.json({ success: true });
}
