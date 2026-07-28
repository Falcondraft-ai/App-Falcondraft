import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  extractContract,
  type ContractExtraction,
} from "@/lib/broker/contract-extract";
import { BROKER_FILES_BUCKET } from "@/lib/broker/documents";
import { logBrokerActivity } from "@/lib/broker/server";
import type { Database } from "@/types/database";

type BrokerContractUpdate =
  Database["public"]["Tables"]["broker_contracts"]["Update"];

export type RunContractExtractionResult =
  | { ok: true; skipped?: boolean; data?: ContractExtraction }
  | { ok: false; reason: string; message: string; status: number };

/**
 * Reads the PDF attached to a contract and fills in what the broker hasn't
 * already written. Shared by the manual import on a dossier and by the Outlook
 * briefing. Deliberately additive: a field the broker typed is never
 * overwritten by what the model believes it read.
 */
export async function runContractExtraction(params: {
  adminSupabase: SupabaseClient<Database>;
  organizationId: string;
  clientId: string;
  contractId: string;
  userId: string;
}): Promise<RunContractExtractionResult> {
  const { adminSupabase, organizationId, clientId, contractId, userId } = params;

  const { data: contract } = await adminSupabase
    .from("broker_contracts")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("client_id", clientId)
    .eq("id", contractId)
    .maybeSingle();

  if (!contract) {
    return {
      ok: false,
      reason: "contract_not_found",
      message: "Contrat introuvable.",
      status: 404,
    };
  }
  if (!contract.document_id) {
    return {
      ok: false,
      reason: "no_document",
      message: "Aucun document à analyser.",
      status: 422,
    };
  }

  const { data: doc } = await adminSupabase
    .from("broker_documents")
    .select("storage_path, mime_type, file_name")
    .eq("organization_id", organizationId)
    .eq("id", contract.document_id)
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
    console.error("[broker] contract document download failed:", error);
    return {
      ok: false,
      reason: "download_failed",
      message: "Lecture du document impossible.",
      status: 500,
    };
  }

  const result = await extractContract({
    buffer,
    mimeType: doc.mime_type ?? "",
    fileName: doc.file_name ?? "contrat.pdf",
  });
  if (!result.ok) {
    const status = result.reason === "ai_unconfigured" ? 503 : 502;
    return { ok: false, reason: result.reason, message: result.message, status };
  }

  // Only fill what is still empty — the broker's own input always wins.
  const update: BrokerContractUpdate = { updated_at: new Date().toISOString() };
  const fillText = (
    key: "insurer_name" | "product_name" | "insurance_type" | "policy_number" | "notes",
    value: string | null,
  ) => {
    if (value && !(contract[key] ?? "").toString().trim()) update[key] = value;
  };

  fillText("insurer_name", result.data.insurer_name);
  fillText("product_name", result.data.product_name);
  fillText("insurance_type", result.data.insurance_type);
  fillText("policy_number", result.data.policy_number);
  fillText("notes", result.data.notes);

  if (result.data.effective_date && !contract.effective_date) {
    update.effective_date = result.data.effective_date;
  }
  if (result.data.renewal_date && !contract.renewal_date) {
    update.renewal_date = result.data.renewal_date;
  }
  if (result.data.premium_amount !== null && contract.premium_amount === null) {
    update.premium_amount = result.data.premium_amount;
    if (result.data.premium_frequency) {
      update.premium_frequency = result.data.premium_frequency;
    }
  }
  // Currency and tacit renewal are inserted with defaults ("EUR" / true), so an
  // empty check can't tell a default from a choice. This only ever runs right
  // after an import, where the document is the only source — it wins.
  if (result.data.currency) update.currency = result.data.currency;
  if (result.data.tacit_renewal !== null) {
    update.tacit_renewal = result.data.tacit_renewal;
  }

  if (Object.keys(update).length > 1) {
    const { error: updateError } = await adminSupabase
      .from("broker_contracts")
      .update(update)
      .eq("organization_id", organizationId)
      .eq("id", contractId);
    if (updateError) {
      return {
        ok: false,
        reason: updateError.message,
        message: "Enregistrement de la lecture impossible.",
        status: 500,
      };
    }

    await logBrokerActivity(adminSupabase, {
      organizationId,
      clientId,
      userId,
      type: "contract_updated",
      description: "Contrat pré-rempli à partir du document importé.",
      metadata: { contract_id: contractId },
    });
  }

  return { ok: true, data: result.data };
}
