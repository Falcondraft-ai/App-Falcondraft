import { NextResponse, type NextRequest } from "next/server";
import { canCreateWorkspaceRecords } from "@/lib/auth/workspace-permissions";
import { extractBordereau } from "@/lib/broker/commission-extract";
import { matchExtractedLines } from "@/lib/broker/commission-match";
import { MAX_DOCUMENT_SIZE_BYTES } from "@/lib/broker/documents";
import { requireBrokerApiContext } from "@/lib/broker/server";
import type { BrokerClientRow, BrokerContractRow } from "@/types/database";

export const runtime = "nodejs";
export const maxDuration = 60; // AI read of a bordereau can take a few seconds.

function jsonError(message: string, status: number, reason: string) {
  return NextResponse.json({ success: false, message, reason }, { status });
}

/**
 * Reads an uploaded bordereau (PDF / image / Excel / CSV), extracts the
 * commission lines with the AI, and matches each to a contract/client.
 * Pure preview — nothing is persisted. The broker reviews, then calls /import.
 */
export async function POST(request: NextRequest) {
  const auth = await requireBrokerApiContext();
  if (!auth.success) return jsonError(auth.message, auth.status, auth.reason);

  if (!canCreateWorkspaceRecords(auth.context.membership?.role)) {
    return jsonError(
      "Votre rôle ne permet pas d’importer un bordereau.",
      403,
      "insufficient_role",
    );
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return jsonError("Fichier illisible.", 400, "invalid_form");
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return jsonError("Aucun fichier reçu.", 400, "no_file");
  }
  if (file.size === 0) {
    return jsonError("Le fichier est vide.", 400, "empty_file");
  }
  if (file.size > MAX_DOCUMENT_SIZE_BYTES) {
    return jsonError("Fichier trop volumineux (max 50 Mo).", 413, "too_large");
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const extraction = await extractBordereau({
    buffer,
    mimeType: file.type || "",
    fileName: file.name || "bordereau",
  });

  if (!extraction.ok) {
    // 422 for content the AI couldn't read; the message is broker-friendly.
    return jsonError(extraction.message, 422, extraction.reason);
  }

  // Resolve the books once, then match every line against them.
  const [clientsRes, contractsRes] = await Promise.all([
    auth.adminSupabase
      .from("broker_clients")
      .select("*")
      .eq("organization_id", auth.organizationId)
      .is("archived_at", null)
      .limit(5000),
    auth.adminSupabase
      .from("broker_contracts")
      .select("*")
      .eq("organization_id", auth.organizationId)
      .limit(5000),
  ]);

  const lines = matchExtractedLines(
    extraction.lines,
    (clientsRes.data ?? []) as BrokerClientRow[],
    (contractsRes.data ?? []) as BrokerContractRow[],
  );

  return NextResponse.json({
    success: true,
    sourceKind: extraction.sourceKind,
    statement: extraction.statement,
    lines,
  });
}
