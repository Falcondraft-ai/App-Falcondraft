import { NextResponse, type NextRequest } from "next/server";
import { canCreateWorkspaceRecords } from "@/lib/auth/workspace-permissions";
import { brokerClientDisplayName } from "@/lib/broker/clients";
import { logBrokerActivity, requireBrokerApiContext } from "@/lib/broker/server";
import { getOutlookConnectionForUser } from "@/lib/email/connections";
import { createOutlookDraft } from "@/lib/email/outlook-drafts";
import type { BrokerClientRow } from "@/types/database";

type RouteContext = { params: Promise<{ id: string; adviceId: string }> };

function jsonError(message: string, status: number, reason: string) {
  return NextResponse.json({ success: false, message, reason }, { status });
}

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

  const { id: clientId, adviceId } = await ctx.params;

  const [{ data: advice }, { data: client }, outlook] = await Promise.all([
    auth.adminSupabase
      .from("broker_advice")
      .select("*")
      .eq("organization_id", auth.organizationId)
      .eq("client_id", clientId)
      .eq("id", adviceId)
      .maybeSingle(),
    auth.adminSupabase
      .from("broker_clients")
      .select("*")
      .eq("organization_id", auth.organizationId)
      .eq("id", clientId)
      .maybeSingle(),
    getOutlookConnectionForUser({
      organizationId: auth.organizationId,
      userId: auth.user.id,
    }),
  ]);

  if (!advice || !client) {
    return jsonError("Document introuvable.", 404, "not_found");
  }

  if (!outlook || outlook.status !== "connected") {
    return jsonError(
      "Connectez d’abord votre boîte Outlook dans les paramètres.",
      400,
      "outlook_not_connected",
    );
  }

  const typedClient = client as BrokerClientRow;
  const clientEmail = typedClient.email?.trim();
  if (!clientEmail) {
    return jsonError(
      "Le dossier client n’a pas d’adresse email.",
      400,
      "client_email_missing",
    );
  }

  const name = brokerClientDisplayName(typedClient);
  const signatureLine = advice.signature_url
    ? `\n\nLien de signature : ${advice.signature_url}\n`
    : "\n";

  const body =
    `Bonjour,\n\n` +
    `Veuillez trouver ci-dessous votre devoir de conseil. Je reste à votre disposition pour toute question.\n` +
    signatureLine +
    `\n---\n${advice.content}\n---\n\n` +
    `Bien à vous,`;

  let draft: { draftId: string; email: string };
  try {
    draft = await createOutlookDraft({
      organizationId: auth.organizationId,
      userId: auth.user.id,
      to: clientEmail,
      subject: `Votre devoir de conseil — ${name}`,
      body,
    });
  } catch (error) {
    console.error("[broker] outlook draft failed:", error);
    return jsonError(
      "Création du brouillon Outlook impossible.",
      502,
      error instanceof Error ? error.message : "draft_failed",
    );
  }

  await auth.adminSupabase
    .from("broker_advice")
    .update({
      outlook_draft_id: draft.draftId,
      updated_at: new Date().toISOString(),
    })
    .eq("organization_id", auth.organizationId)
    .eq("id", adviceId);

  await logBrokerActivity(auth.adminSupabase, {
    organizationId: auth.organizationId,
    clientId,
    userId: auth.user.id,
    type: "advice_outlook_draft",
    description: `Brouillon Outlook préparé pour ${clientEmail}.`,
    metadata: { advice_id: adviceId },
  });

  return NextResponse.json({ success: true, email: draft.email });
}
