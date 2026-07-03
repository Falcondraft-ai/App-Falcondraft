import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { BROKER_FILES_BUCKET } from "@/lib/broker/documents";
import { extractQuote, type QuoteExtraction } from "@/lib/broker/quote-extract";
import { logBrokerActivity } from "@/lib/broker/server";
import type { Database } from "@/types/database";

type BrokerQuoteUpdate =
  Database["public"]["Tables"]["broker_quotes"]["Update"];

export type RunQuoteExtractionResult =
  | { ok: true; skipped?: boolean; data?: QuoteExtraction }
  | { ok: false; reason: string; message: string; status: number };

/**
 * Reads a freshly imported quote's source document (PDF/image) and pre-fills the
 * quote fields. Shared by the import flow (runs automatically, so the broker
 * stays on the dossier) and the manual "re-read" endpoint. Only ever touches a
 * `pending` quote — never clobbers data the broker has reviewed or validated.
 */
export async function runQuoteExtraction(params: {
  adminSupabase: SupabaseClient<Database>;
  organizationId: string;
  clientId: string;
  quoteId: string;
  userId: string;
}): Promise<RunQuoteExtractionResult> {
  const { adminSupabase, organizationId, clientId, quoteId, userId } = params;

  const { data: quote } = await adminSupabase
    .from("broker_quotes")
    .select("id, document_id, extraction_status")
    .eq("organization_id", organizationId)
    .eq("client_id", clientId)
    .eq("id", quoteId)
    .maybeSingle();
  if (!quote) {
    return { ok: false, reason: "quote_not_found", message: "Devis introuvable.", status: 404 };
  }

  // Only auto-extract a pending quote — never clobber reviewed/validated data.
  if (quote.extraction_status !== "pending") {
    return { ok: true, skipped: true };
  }
  if (!quote.document_id) {
    return { ok: false, reason: "no_document", message: "Aucun document à analyser.", status: 422 };
  }

  const { data: doc } = await adminSupabase
    .from("broker_documents")
    .select("storage_path, mime_type, file_name")
    .eq("organization_id", organizationId)
    .eq("id", quote.document_id)
    .maybeSingle();
  if (!doc) {
    return {
      ok: false,
      reason: "document_not_found",
      message: "Document source introuvable.",
      status: 404,
    };
  }

  let buffer: Buffer;
  try {
    const { data: blob, error } = await adminSupabase.storage
      .from(BROKER_FILES_BUCKET)
      .download(doc.storage_path);
    if (error || !blob) throw error ?? new Error("download_failed");
    buffer = Buffer.from(await blob.arrayBuffer());
  } catch (error) {
    console.error("[broker] quote document download failed:", error);
    return {
      ok: false,
      reason: "download_failed",
      message: "Lecture du document impossible.",
      status: 500,
    };
  }

  const result = await extractQuote({
    buffer,
    mimeType: doc.mime_type ?? "",
    fileName: doc.file_name ?? "devis.pdf",
  });
  if (!result.ok) {
    const status = result.reason === "ai_unconfigured" ? 503 : 502;
    return { ok: false, reason: result.reason, message: result.message, status };
  }

  const now = new Date().toISOString();
  // No manual validation step: a read devis is directly usable (validated), so
  // it feeds the devoir de conseil right away. The broker can still edit it.
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
    extraction_status: "validated",
    validated_at: now,
    validated_by: userId,
    updated_at: now,
  };
  const { error: updateError } = await adminSupabase
    .from("broker_quotes")
    .update(update)
    .eq("organization_id", organizationId)
    .eq("id", quoteId);
  if (updateError) {
    return {
      ok: false,
      reason: updateError.message,
      message: "Enregistrement de l'extraction impossible.",
      status: 500,
    };
  }

  await logBrokerActivity(adminSupabase, {
    organizationId,
    clientId,
    userId,
    type: "quote_validated",
    description: "Devis lu et intégré automatiquement.",
    metadata: { quote_id: quoteId },
  });

  return { ok: true, data: result.data };
}
