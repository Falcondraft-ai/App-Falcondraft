import { NextResponse, type NextRequest } from "next/server";
import { canCreateWorkspaceRecords } from "@/lib/auth/workspace-permissions";
import {
  buildAdviceDocumentData,
  type CabinetInfo,
} from "@/lib/broker/advice-document";
import { brokerClientDisplayName } from "@/lib/broker/clients";
import { loadCabinetLegalAnnexes } from "@/lib/broker/legal-annexes";
import {
  loadCabinetLogo,
  renderDevoirConseilPdf,
} from "@/lib/broker/pdf/render";
import { logBrokerActivity, requireBrokerApiContext } from "@/lib/broker/server";
import { parseBrokerSettings } from "@/lib/broker/settings";
import { getOutlookConnectionForUser } from "@/lib/email/connections";
import {
  createOutlookDraft,
  type OutlookDraftAttachment,
} from "@/lib/email/outlook-drafts";
import type { BrokerClientRow, BrokerQuoteRow } from "@/types/database";

// react-pdf renders the devoir de conseil attachment server-side → Node runtime.
export const runtime = "nodejs";

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
  const settings = parseBrokerSettings(auth.context.organization);
  const cabinet: CabinetInfo = {
    ...settings.compliance,
    partnerInsurers: settings.partnerInsurers,
  };

  // Resolve the quote backing this advice (for the regenerated PDF).
  let quote: BrokerQuoteRow | null = null;
  if (advice.quote_id) {
    const { data } = await auth.adminSupabase
      .from("broker_quotes")
      .select("*")
      .eq("organization_id", auth.organizationId)
      .eq("id", advice.quote_id)
      .maybeSingle();
    quote = (data as BrokerQuoteRow | null) ?? null;
  }

  // Attachments: devoir de conseil (regenerated) + cabinet legal annexes.
  const attachments: OutlookDraftAttachment[] = [];
  try {
    const data = buildAdviceDocumentData({
      cabinet,
      client: typedClient,
      quote,
      justification: advice.content ?? "",
      date: advice.generated_at,
    });
    const logo = await loadCabinetLogo(cabinet);
    const pdf = await renderDevoirConseilPdf(data, logo);
    attachments.push({
      filename: `Devoir de conseil — ${name}.pdf`,
      contentType: "application/pdf",
      contentBase64: pdf.toString("base64"),
    });
  } catch (error) {
    console.error("[broker] devoir de conseil PDF for email failed:", error);
  }
  attachments.push(...(await loadCabinetLegalAnnexes()));

  const signatureBlock = advice.signature_url
    ? `Pour signer électroniquement votre devoir de conseil :\n${advice.signature_url}\n\n`
    : "";
  const signOff = [cabinet.manager, cabinet.legalName].filter(
    (l) => l && l.trim().length > 0,
  );

  const body =
    `Bonjour,\n\n` +
    `Veuillez trouver ci-joint votre devoir de conseil, accompagné de notre ` +
    `document d'entrée en relation et de nos mentions d'information.\n\n` +
    signatureBlock +
    `Je reste à votre disposition pour toute question.\n\n` +
    `Bien à vous,\n` +
    signOff.join("\n");

  let draft: { draftId: string; email: string };
  try {
    draft = await createOutlookDraft({
      organizationId: auth.organizationId,
      userId: auth.user.id,
      to: clientEmail,
      subject: `Votre devoir de conseil — ${name}`,
      body,
      attachments,
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
    description: `Brouillon Outlook préparé pour ${clientEmail} (${attachments.length} pièce(s) jointe(s)).`,
    metadata: { advice_id: adviceId },
  });

  return NextResponse.json({ success: true, email: draft.email });
}
