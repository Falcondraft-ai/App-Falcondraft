import { NextResponse, type NextRequest } from "next/server";
import { canCreateWorkspaceRecords } from "@/lib/auth/workspace-permissions";
import { brokerClientDisplayName } from "@/lib/broker/clients";
import {
  buildAdviceDocumentData,
  type CabinetInfo,
} from "@/lib/broker/advice-document";
import { BROKER_FILES_BUCKET } from "@/lib/broker/documents";
import {
  loadCabinetLogo,
  renderDevoirConseilPdf,
} from "@/lib/broker/pdf/render";
import {
  adjustOrganizationStorage,
  logBrokerActivity,
  requireBrokerApiContext,
} from "@/lib/broker/server";
import { parseBrokerSettings } from "@/lib/broker/settings";
import { computeStorageUsage } from "@/lib/broker/storage";
import type { BrokerClientRow, BrokerQuoteRow } from "@/types/database";

// react-pdf renders server-side → Node runtime required.
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
      "Votre rôle ne permet pas de générer ce document.",
      403,
      "insufficient_role",
    );
  }

  const organization = auth.context.organization;
  if (!organization) {
    return jsonError("Organisation introuvable.", 400, "no_organization");
  }

  const { id: clientId, adviceId } = await ctx.params;

  const [adviceRes, clientRes] = await Promise.all([
    auth.adminSupabase
      .from("broker_advice")
      .select("*")
      .eq("organization_id", auth.organizationId)
      .eq("id", adviceId)
      .maybeSingle(),
    auth.adminSupabase
      .from("broker_clients")
      .select("*")
      .eq("organization_id", auth.organizationId)
      .eq("id", clientId)
      .maybeSingle(),
  ]);

  const advice = adviceRes.data;
  const client = clientRes.data as BrokerClientRow | null;
  if (!advice || advice.client_id !== clientId) {
    return jsonError("Devoir de conseil introuvable.", 404, "advice_not_found");
  }
  if (!client) {
    return jsonError("Dossier introuvable.", 404, "client_not_found");
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

  const data = buildAdviceDocumentData({
    cabinet,
    client,
    quote,
    justification: advice.content ?? "",
    date: advice.generated_at,
  });

  let pdf: Buffer;
  try {
    const logo = await loadCabinetLogo(cabinet);
    pdf = await renderDevoirConseilPdf(data, logo);
  } catch (error) {
    console.error("[broker] devoir de conseil PDF render failed:", error);
    return jsonError(
      "La génération du PDF n'a pas abouti. Veuillez réessayer.",
      500,
      "render_failed",
    );
  }

  const fileName = `devoir-de-conseil-${adviceId}.pdf`;
  const storagePath = `${auth.organizationId}/${clientId}/${fileName}`;

  // One GED entry per advice — regenerating overwrites it.
  const { data: existing } = await auth.adminSupabase
    .from("broker_documents")
    .select("id, size_bytes")
    .eq("organization_id", auth.organizationId)
    .eq("storage_path", storagePath)
    .maybeSingle();
  const oldSize = existing?.size_bytes ?? 0;

  const usage = computeStorageUsage(organization);
  if (usage.usedBytes - oldSize + pdf.byteLength > usage.limitBytes) {
    return jsonError("Quota de stockage atteint.", 413, "storage_quota");
  }

  const { error: uploadError } = await auth.adminSupabase.storage
    .from(BROKER_FILES_BUCKET)
    .upload(storagePath, pdf, {
      contentType: "application/pdf",
      upsert: true,
    });
  if (uploadError) {
    return jsonError(
      "Enregistrement du PDF impossible.",
      500,
      uploadError.message,
    );
  }

  // Replace any previous GED entry for this advice's PDF.
  if (existing) {
    await auth.adminSupabase
      .from("broker_documents")
      .delete()
      .eq("id", existing.id);
  }

  const title = `Devoir de conseil — ${brokerClientDisplayName(client)}`;
  const { data: inserted, error: insertError } = await auth.adminSupabase
    .from("broker_documents")
    .insert({
      organization_id: auth.organizationId,
      client_id: clientId,
      uploaded_by: auth.user.id,
      category: "advice_document",
      title,
      file_name: fileName,
      storage_path: storagePath,
      mime_type: "application/pdf",
      size_bytes: pdf.byteLength,
      status: "stored",
    })
    .select("id")
    .single();
  if (insertError || !inserted) {
    await auth.adminSupabase.storage
      .from(BROKER_FILES_BUCKET)
      .remove([storagePath]);
    return jsonError(
      "Rangement du document impossible.",
      500,
      insertError?.message ?? "insert_failed",
    );
  }
  const documentId = inserted.id;

  await adjustOrganizationStorage(
    auth.adminSupabase,
    auth.organizationId,
    pdf.byteLength - oldSize,
  );

  await logBrokerActivity(auth.adminSupabase, {
    organizationId: auth.organizationId,
    clientId,
    userId: auth.user.id,
    type: "document_added",
    description: "Devoir de conseil généré en PDF.",
    metadata: { advice_id: adviceId, document_id: documentId },
  });

  const { data: signed } = await auth.adminSupabase.storage
    .from(BROKER_FILES_BUCKET)
    .createSignedUrl(storagePath, 120, { download: fileName });

  return NextResponse.json({
    success: true,
    documentId,
    url: signed?.signedUrl ?? null,
  });
}
