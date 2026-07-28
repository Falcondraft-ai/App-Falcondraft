import { NextResponse, type NextRequest } from "next/server";
import { canCreateWorkspaceRecords } from "@/lib/auth/workspace-permissions";
import { hasFeature } from "@/lib/billing/entitlements";
import {
  buildAdviceDocumentData,
  type CabinetInfo,
} from "@/lib/broker/advice-document";
import { brokerClientDisplayName } from "@/lib/broker/clients";
import {
  archiveSubmission,
  createSignatureRequest,
  getSubmissionState,
} from "@/lib/broker/docuseal";
import {
  loadCabinetLogo,
  renderDevoirConseilPdf,
} from "@/lib/broker/pdf/render";
import {
  countPdfPages,
  signatureFieldArea,
  type SignatureFieldArea,
} from "@/lib/broker/pdf/signature-area";
import {
  advanceClientStatus,
  logBrokerActivity,
  requireBrokerApiContext,
} from "@/lib/broker/server";
import { parseBrokerSettings } from "@/lib/broker/settings";
import {
  applyAdviceSignatureState,
  signatureExpiryDays,
} from "@/lib/broker/signature";
import type {
  BrokerAdviceRow,
  BrokerClientRow,
  BrokerQuoteRow,
  Database,
} from "@/types/database";

export const runtime = "nodejs";

type BrokerAdviceUpdate =
  Database["public"]["Tables"]["broker_advice"]["Update"];
type RouteContext = { params: Promise<{ id: string; adviceId: string }> };

const ADVICE_SIGNATURE_FIELDS =
  "id, client_id, quote_id, content, requirements, generated_at, status, created_by, " +
  "docuseal_submission_id, docuseal_submitter_id, signature_status, signature_url, " +
  "signature_viewed_at, signed_document_id";

function jsonError(message: string, status: number, reason: string) {
  return NextResponse.json({ success: false, message, reason }, { status });
}

/**
 * Creates (or replaces) the electronic signature request for a devoir de
 * conseil. The provider sends nothing itself: the broker transmits the link
 * from their own mailbox via the Outlook draft, then reminders go out from
 * here. Lifecycle updates arrive on /api/broker/webhooks/docuseal.
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
  if (!organization) {
    return jsonError("Organisation introuvable.", 400, "no_organization");
  }
  if (!hasFeature(organization, "esign")) {
    return jsonError(
      "La signature électronique n’est pas incluse dans votre offre.",
      403,
      "feature_not_available",
    );
  }

  const { id: clientId, adviceId } = await ctx.params;

  const { data } = await auth.adminSupabase
    .from("broker_advice")
    .select(ADVICE_SIGNATURE_FIELDS)
    .eq("organization_id", auth.organizationId)
    .eq("id", adviceId)
    .maybeSingle();
  const advice = data as Pick<
    BrokerAdviceRow,
    | "id"
    | "client_id"
    | "quote_id"
    | "content"
    | "requirements"
    | "generated_at"
    | "status"
    | "created_by"
    | "docuseal_submission_id"
    | "docuseal_submitter_id"
    | "signature_status"
    | "signature_url"
    | "signature_viewed_at"
    | "signed_document_id"
  > | null;

  if (!advice || advice.client_id !== clientId) {
    return jsonError("Devoir de conseil introuvable.", 404, "advice_not_found");
  }
  if (advice.status === "draft") {
    return jsonError(
      "Validez d’abord le devoir de conseil.",
      400,
      "not_validated",
    );
  }

  // An already-signed document can be sent out again: the wording is often
  // amended after signature and the client must then sign the new version. The
  // earlier signature and its archived PDFs are preserved (see below).
  const wasSigned = advice.status === "signed";

  const { data: clientRow } = await auth.adminSupabase
    .from("broker_clients")
    .select("*")
    .eq("organization_id", auth.organizationId)
    .eq("id", clientId)
    .maybeSingle();
  const client = clientRow as BrokerClientRow | null;
  if (!client) return jsonError("Dossier introuvable.", 404, "client_not_found");
  if (!client.email) {
    return jsonError(
      "Renseignez l’email du client pour créer la demande de signature.",
      422,
      "no_email",
    );
  }

  const [{ data: quoteRow }, { data: compliance }] = await Promise.all([
    advice.quote_id
      ? auth.adminSupabase
          .from("broker_quotes")
          .select("*")
          .eq("organization_id", auth.organizationId)
          .eq("id", advice.quote_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    auth.adminSupabase
      .from("broker_compliance")
      .select("is_pep")
      .eq("organization_id", auth.organizationId)
      .eq("client_id", clientId)
      .maybeSingle(),
  ]);
  const quote = (quoteRow as BrokerQuoteRow | null) ?? null;

  const settings = parseBrokerSettings(organization);
  const cabinet: CabinetInfo = {
    ...settings.compliance,
    partnerInsurers: settings.partnerInsurers,
  };
  const clientName = brokerClientDisplayName(client);

  let pdfBase64: string;
  let signatureArea: SignatureFieldArea;
  try {
    const documentData = buildAdviceDocumentData({
      cabinet,
      client,
      quote,
      justification: advice.content ?? "",
      requirements: advice.requirements,
      birthCountry: client.birth_country,
      pep: compliance ? (compliance.is_pep ? "Oui" : "Non") : null,
      date: advice.generated_at,
    });
    const logo = await loadCabinetLogo(cabinet);
    const pdf = await renderDevoirConseilPdf(documentData, logo);
    pdfBase64 = pdf.toString("base64");
    // The signature block sits alone on the document's last page, so the field's
    // page number is the page count.
    signatureArea = signatureFieldArea(countPdfPages(pdf));
  } catch (error) {
    console.error("[broker] signature PDF render failed:", error);
    return jsonError(
      "La génération du document à signer a échoué.",
      500,
      "render_failed",
    );
  }

  const result = await createSignatureRequest({
    pdfBase64,
    documentName: `Devoir de conseil — ${clientName}`,
    signerName: clientName,
    signerEmail: client.email,
    signatureArea,
    metadata: {
      kind: "advice",
      advice_id: advice.id,
      client_id: clientId,
      organization_id: auth.organizationId,
    },
    expiresInDays: signatureExpiryDays(),
    replyTo: auth.user.email ?? null,
  });
  if (!result.success) {
    const status = result.reason === "unconfigured" ? 503 : 502;
    return jsonError(result.message, status, result.reason);
  }

  // Supersede the previous request so an old link can no longer be signed.
  const previousSubmissionId = advice.docuseal_submission_id;
  if (previousSubmissionId && previousSubmissionId !== String(result.submissionId)) {
    await archiveSubmission(previousSubmissionId);
  }

  const now = new Date().toISOString();
  const update: BrokerAdviceUpdate = {
    docuseal_submission_id: String(result.submissionId),
    docuseal_submitter_id: String(result.submitterId),
    signature_url: result.signingUrl,
    signature_status: "sent",
    signature_sent_at: now,
    signature_expires_at: result.expiresAt,
    signature_viewed_at: null,
    signature_declined_at: null,
    signature_decline_reason: null,
    signature_last_reminder_at: null,
    signature_reminder_count: 0,
    status: "sent_for_signature",
    updated_at: now,
    // Re-signing starts a fresh round: detach the previous signed PDF and its
    // audit trail so this round archives its own. The GED rows stay in place —
    // the document actually delivered back then remains part of the file.
    ...(wasSigned
      ? { signed_document_id: null, audit_log_document_id: null }
      : {}),
  };
  const { error } = await auth.adminSupabase
    .from("broker_advice")
    .update(update)
    .eq("organization_id", auth.organizationId)
    .eq("id", adviceId);
  if (error) {
    return jsonError(
      "Enregistrement de la demande de signature impossible.",
      500,
      error.message,
    );
  }

  await logBrokerActivity(auth.adminSupabase, {
    organizationId: auth.organizationId,
    clientId,
    userId: auth.user.id,
    type: "advice_signature_prepared",
    description: wasSigned
      ? "Nouvelle demande de signature sur la version à jour du document — la version signée précédente reste archivée au dossier."
      : previousSubmissionId
        ? "Demande de signature électronique regénérée (l’ancien lien est désactivé)."
        : "Demande de signature électronique créée — à transmettre au client.",
    metadata: { advice_id: adviceId, submission_id: result.submissionId },
  });
  await advanceClientStatus(
    auth.adminSupabase,
    auth.organizationId,
    clientId,
    "awaiting_signature",
  );

  return NextResponse.json({
    success: true,
    url: result.signingUrl,
    expiresAt: result.expiresAt,
  });
}

/**
 * Refreshes the signature status on demand. The webhook is the primary path;
 * this stays as a fallback for deployments without a public webhook URL and for
 * the broker's own "Actualiser" button.
 */
export async function GET(_request: NextRequest, ctx: RouteContext) {
  const auth = await requireBrokerApiContext();
  if (!auth.success) return jsonError(auth.message, auth.status, auth.reason);

  const { id: clientId, adviceId } = await ctx.params;

  const { data } = await auth.adminSupabase
    .from("broker_advice")
    .select(
      "id, client_id, created_by, status, signature_status, signature_viewed_at, signed_document_id, docuseal_submission_id",
    )
    .eq("organization_id", auth.organizationId)
    .eq("id", adviceId)
    .maybeSingle();
  const advice = data as Pick<
    BrokerAdviceRow,
    | "id"
    | "client_id"
    | "created_by"
    | "status"
    | "signature_status"
    | "signature_viewed_at"
    | "signed_document_id"
    | "docuseal_submission_id"
  > | null;

  if (!advice || advice.client_id !== clientId) {
    return jsonError("Devoir de conseil introuvable.", 404, "advice_not_found");
  }
  if (!advice.docuseal_submission_id) {
    return NextResponse.json({
      success: true,
      status: advice.status,
      signatureStatus: advice.signature_status,
      signed: advice.status === "signed",
      changed: false,
    });
  }

  const state = await getSubmissionState(advice.docuseal_submission_id);
  if (!state) {
    return NextResponse.json({
      success: true,
      status: advice.status,
      signatureStatus: advice.signature_status,
      signed: advice.status === "signed",
      changed: false,
    });
  }

  const result = await applyAdviceSignatureState({
    adminSupabase: auth.adminSupabase,
    organizationId: auth.organizationId,
    advice,
    state,
    userId: auth.user.id,
  });

  return NextResponse.json({
    success: true,
    status: result.signed ? "signed" : advice.status,
    signatureStatus: result.status ?? advice.signature_status,
    signed: result.signed || advice.status === "signed",
    changed: result.changed,
  });
}

/** Cancels a pending signature request (the link stops working immediately). */
export async function DELETE(_request: NextRequest, ctx: RouteContext) {
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

  const { data: advice } = await auth.adminSupabase
    .from("broker_advice")
    .select("id, client_id, status, docuseal_submission_id")
    .eq("organization_id", auth.organizationId)
    .eq("id", adviceId)
    .maybeSingle();
  if (!advice || advice.client_id !== clientId) {
    return jsonError("Devoir de conseil introuvable.", 404, "advice_not_found");
  }
  if (advice.status === "signed") {
    return jsonError(
      "Ce devoir de conseil est déjà signé.",
      409,
      "already_signed",
    );
  }
  if (!advice.docuseal_submission_id) {
    return jsonError(
      "Aucune demande de signature en cours.",
      404,
      "no_submission",
    );
  }

  await archiveSubmission(advice.docuseal_submission_id);

  const now = new Date().toISOString();
  const update: BrokerAdviceUpdate = {
    signature_status: "cancelled",
    signature_url: null,
    docuseal_submission_id: null,
    docuseal_submitter_id: null,
    signature_expires_at: null,
    status: "validated",
    updated_at: now,
  };
  const { error } = await auth.adminSupabase
    .from("broker_advice")
    .update(update)
    .eq("organization_id", auth.organizationId)
    .eq("id", adviceId);
  if (error) {
    return jsonError("Annulation impossible.", 500, error.message);
  }

  await logBrokerActivity(auth.adminSupabase, {
    organizationId: auth.organizationId,
    clientId,
    userId: auth.user.id,
    type: "advice_signature_cancelled",
    description: "Demande de signature annulée — le lien ne fonctionne plus.",
    metadata: { advice_id: adviceId },
  });

  return NextResponse.json({ success: true });
}
