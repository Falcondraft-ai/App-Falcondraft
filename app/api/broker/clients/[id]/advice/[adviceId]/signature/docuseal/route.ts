import { NextResponse, type NextRequest } from "next/server";
import { canCreateWorkspaceRecords } from "@/lib/auth/workspace-permissions";
import {
  buildAdviceDocumentData,
  type CabinetInfo,
} from "@/lib/broker/advice-document";
import { brokerClientDisplayName } from "@/lib/broker/clients";
import {
  createDevoirConseilSubmission,
  getSubmissionStatus,
} from "@/lib/broker/docuseal";
import {
  loadCabinetLogo,
  renderDevoirConseilPdf,
} from "@/lib/broker/pdf/render";
import {
  advanceClientStatus,
  logBrokerActivity,
  requireBrokerApiContext,
} from "@/lib/broker/server";
import { parseBrokerSettings } from "@/lib/broker/settings";
import type {
  BrokerClientRow,
  BrokerQuoteRow,
  Database,
} from "@/types/database";

export const runtime = "nodejs";

type BrokerAdviceUpdate =
  Database["public"]["Tables"]["broker_advice"]["Update"];
type RouteContext = { params: Promise<{ id: string; adviceId: string }> };

function jsonError(message: string, status: number, reason: string) {
  return NextResponse.json({ success: false, message, reason }, { status });
}

// POST — create the DocuSeal submission and store the signing link.
export async function POST(_request: NextRequest, ctx: RouteContext) {
  const auth = await requireBrokerApiContext();
  if (!auth.success) return jsonError(auth.message, auth.status, auth.reason);
  if (!canCreateWorkspaceRecords(auth.context.membership?.role)) {
    return jsonError("Votre rôle ne permet pas cette action.", 403, "insufficient_role");
  }
  const organization = auth.context.organization;
  if (!organization) {
    return jsonError("Organisation introuvable.", 400, "no_organization");
  }

  const { id: clientId, adviceId } = await ctx.params;

  const { data: advice } = await auth.adminSupabase
    .from("broker_advice")
    .select("id, client_id, quote_id, content, generated_at, status")
    .eq("organization_id", auth.organizationId)
    .eq("id", adviceId)
    .maybeSingle();
  if (!advice || advice.client_id !== clientId) {
    return jsonError("Devoir de conseil introuvable.", 404, "advice_not_found");
  }
  if (advice.status === "draft") {
    return jsonError("Validez d'abord le devoir de conseil.", 400, "not_validated");
  }

  const { data: client } = await auth.adminSupabase
    .from("broker_clients")
    .select("*")
    .eq("organization_id", auth.organizationId)
    .eq("id", clientId)
    .maybeSingle();
  if (!client) return jsonError("Dossier introuvable.", 404, "client_not_found");
  if (!client.email) {
    return jsonError(
      "Renseignez l'email du client pour créer le lien de signature.",
      422,
      "no_email",
    );
  }

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

  const settings = parseBrokerSettings(organization);
  const cabinet: CabinetInfo = {
    ...settings.compliance,
    partnerInsurers: settings.partnerInsurers,
  };
  const clientName = brokerClientDisplayName(client as BrokerClientRow);

  let pdfBase64: string;
  try {
    const data = buildAdviceDocumentData({
      cabinet,
      client: client as BrokerClientRow,
      quote,
      justification: advice.content ?? "",
      date: advice.generated_at,
    });
    const logo = await loadCabinetLogo(cabinet);
    const pdf = await renderDevoirConseilPdf(data, logo, { forSignature: true });
    pdfBase64 = pdf.toString("base64");
  } catch (error) {
    console.error("[broker] signature PDF render failed:", error);
    return jsonError("La génération du document de signature a échoué.", 500, "render_failed");
  }

  const result = await createDevoirConseilSubmission({
    pdfBase64,
    documentName: `Devoir de conseil — ${clientName}`,
    clientName,
    clientEmail: client.email,
  });
  if (!result.success) {
    const status = result.reason === "unconfigured" ? 503 : 502;
    return jsonError(result.message, status, result.reason);
  }

  const update: BrokerAdviceUpdate = {
    docuseal_submission_id: String(result.submissionId),
    signature_url: result.signingUrl,
    signature_status: "sent",
    status: "sent_for_signature",
    updated_at: new Date().toISOString(),
  };
  const { error } = await auth.adminSupabase
    .from("broker_advice")
    .update(update)
    .eq("organization_id", auth.organizationId)
    .eq("id", adviceId);
  if (error) {
    return jsonError("Enregistrement du lien impossible.", 500, error.message);
  }

  await logBrokerActivity(auth.adminSupabase, {
    organizationId: auth.organizationId,
    clientId,
    userId: auth.user.id,
    type: "advice_signature_prepared",
    description: "Lien de signature DocuSeal créé (à transmettre au client).",
    metadata: { advice_id: adviceId, submission_id: result.submissionId },
  });
  await advanceClientStatus(
    auth.adminSupabase,
    auth.organizationId,
    clientId,
    "awaiting_signature",
  );

  return NextResponse.json({ success: true, url: result.signingUrl });
}

// GET — refresh the signature status from DocuSeal; mark signed when complete.
export async function GET(_request: NextRequest, ctx: RouteContext) {
  const auth = await requireBrokerApiContext();
  if (!auth.success) return jsonError(auth.message, auth.status, auth.reason);

  const { id: clientId, adviceId } = await ctx.params;

  const { data: advice } = await auth.adminSupabase
    .from("broker_advice")
    .select("id, client_id, status, docuseal_submission_id")
    .eq("organization_id", auth.organizationId)
    .eq("id", adviceId)
    .maybeSingle();
  if (!advice || advice.client_id !== clientId) {
    return jsonError("Devoir de conseil introuvable.", 404, "advice_not_found");
  }
  if (!advice.docuseal_submission_id) {
    return NextResponse.json({ success: true, status: advice.status, signed: false });
  }

  const result = await getSubmissionStatus(advice.docuseal_submission_id);
  if (!result) {
    return NextResponse.json({ success: true, status: advice.status, signed: false });
  }

  if (result.completed && advice.status !== "signed") {
    const update: BrokerAdviceUpdate = {
      status: "signed",
      signature_status: "completed",
      updated_at: new Date().toISOString(),
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
      type: "advice_signed",
      description: "Devoir de conseil signé (DocuSeal).",
      metadata: { advice_id: adviceId },
    });
    await advanceClientStatus(
      auth.adminSupabase,
      auth.organizationId,
      clientId,
      "signed",
    );
  }

  return NextResponse.json({
    success: true,
    status: result.completed ? "signed" : advice.status,
    signed: result.completed,
  });
}
