import { NextResponse, type NextRequest } from "next/server";
import { canCreateWorkspaceRecords } from "@/lib/auth/workspace-permissions";
import { BROKER_FILES_BUCKET } from "@/lib/broker/documents";
import { extractQuote } from "@/lib/broker/quote-extract";
import { logBrokerActivity, requireBrokerApiContext } from "@/lib/broker/server";
import type { Database } from "@/types/database";

export const runtime = "nodejs";

type BrokerQuoteUpdate =
  Database["public"]["Tables"]["broker_quotes"]["Update"];
type RouteContext = { params: Promise<{ id: string; quoteId: string }> };

function jsonError(message: string, status: number, reason: string) {
  return NextResponse.json({ success: false, message, reason }, { status });
}

export async function POST(_request: NextRequest, ctx: RouteContext) {
  const auth = await requireBrokerApiContext();
  if (!auth.success) return jsonError(auth.message, auth.status, auth.reason);

  if (!canCreateWorkspaceRecords(auth.context.membership?.role)) {
    return jsonError("Votre rôle ne permet pas cette action.", 403, "insufficient_role");
  }

  const { id: clientId, quoteId } = await ctx.params;

  const { data: quote } = await auth.adminSupabase
    .from("broker_quotes")
    .select("id, document_id, extraction_status")
    .eq("organization_id", auth.organizationId)
    .eq("client_id", clientId)
    .eq("id", quoteId)
    .maybeSingle();
  if (!quote) return jsonError("Devis introuvable.", 404, "quote_not_found");

  // Only auto-extract a pending quote — never clobber reviewed/validated data.
  if (quote.extraction_status !== "pending") {
    return NextResponse.json({ success: true, skipped: true });
  }
  if (!quote.document_id) {
    return jsonError("Aucun document à analyser.", 422, "no_document");
  }

  const { data: doc } = await auth.adminSupabase
    .from("broker_documents")
    .select("storage_path, mime_type, file_name")
    .eq("organization_id", auth.organizationId)
    .eq("id", quote.document_id)
    .maybeSingle();
  if (!doc) return jsonError("Document source introuvable.", 404, "document_not_found");

  let buffer: Buffer;
  try {
    const { data: blob, error } = await auth.adminSupabase.storage
      .from(BROKER_FILES_BUCKET)
      .download(doc.storage_path);
    if (error || !blob) throw error ?? new Error("download_failed");
    buffer = Buffer.from(await blob.arrayBuffer());
  } catch (error) {
    console.error("[broker] quote document download failed:", error);
    return jsonError("Lecture du document impossible.", 500, "download_failed");
  }

  const result = await extractQuote({
    buffer,
    mimeType: doc.mime_type ?? "",
    fileName: doc.file_name ?? "devis.pdf",
  });
  if (!result.ok) {
    const status = result.reason === "ai_unconfigured" ? 503 : 502;
    return jsonError(result.message, status, result.reason);
  }

  const update: BrokerQuoteUpdate = {
    insurer_name: result.data.insurer_name,
    product_name: result.data.product_name,
    premium_monthly: result.data.premium_monthly,
    premium_annual: result.data.premium_annual,
    currency: result.data.currency ?? "EUR",
    coverage_summary: result.data.coverage_summary,
    deductible: result.data.deductible,
    vigilance_points: result.data.vigilance_points,
    other_info: result.data.other_info,
    extracted_data: result.data,
    extraction_status: "extracted",
    updated_at: new Date().toISOString(),
  };
  const { error: updateError } = await auth.adminSupabase
    .from("broker_quotes")
    .update(update)
    .eq("organization_id", auth.organizationId)
    .eq("id", quoteId);
  if (updateError) {
    return jsonError("Enregistrement de l'extraction impossible.", 500, updateError.message);
  }

  await logBrokerActivity(auth.adminSupabase, {
    organizationId: auth.organizationId,
    clientId,
    userId: auth.user.id,
    type: "quote_extracted",
    description: "Devis lu automatiquement — à vérifier et valider.",
    metadata: { quote_id: quoteId },
  });

  return NextResponse.json({ success: true, data: result.data });
}
