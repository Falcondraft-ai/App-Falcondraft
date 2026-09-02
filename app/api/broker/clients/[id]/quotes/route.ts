import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { canCreateWorkspaceRecords } from "@/lib/auth/workspace-permissions";
import { runQuoteExtraction } from "@/lib/broker/quote-ingest";
import { logBrokerActivity, requireBrokerApiContext } from "@/lib/broker/server";

export const runtime = "nodejs";
export const maxDuration = 60;

type RouteContext = { params: Promise<{ id: string }> };

const schema = z.object({
  documentId: z.string().uuid().optional().nullable(),
  insurerName: z.string().trim().max(160).optional().nullable(),
});

function jsonError(message: string, status: number, reason: string) {
  return NextResponse.json({ success: false, message, reason }, { status });
}

export async function POST(request: NextRequest, ctx: RouteContext) {
  const auth = await requireBrokerApiContext();
  if (!auth.success) return jsonError(auth.message, auth.status, auth.reason);

  if (!canCreateWorkspaceRecords(auth.context.membership?.role)) {
    return jsonError(
      "Votre rôle ne permet pas d’ajouter un devis.",
      403,
      "insufficient_role",
    );
  }

  const { id: clientId } = await ctx.params;

  const body: unknown = await request.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return jsonError("Requête invalide.", 400, "invalid_payload");
  }
  const values = parsed.data;

  const { data: client } = await auth.adminSupabase
    .from("broker_clients")
    .select("id")
    .eq("organization_id", auth.organizationId)
    .eq("id", clientId)
    .maybeSingle();

  if (!client) {
    return jsonError("Dossier introuvable.", 404, "client_not_found");
  }

  // If a source document is provided, ensure it belongs to this client.
  if (values.documentId) {
    const { data: doc } = await auth.adminSupabase
      .from("broker_documents")
      .select("id")
      .eq("organization_id", auth.organizationId)
      .eq("client_id", clientId)
      .eq("id", values.documentId)
      .maybeSingle();
    if (!doc) {
      return jsonError("Document source introuvable.", 404, "document_not_found");
    }
  }

  const { data: quote, error } = await auth.adminSupabase
    .from("broker_quotes")
    .insert({
      organization_id: auth.organizationId,
      client_id: clientId,
      created_by: auth.user.id,
      document_id: values.documentId ?? null,
      insurer_name: values.insurerName?.trim() || null,
      extraction_status: "pending",
    })
    .select("id")
    .single();

  if (error || !quote) {
    return jsonError(
      "Création du devis impossible.",
      500,
      error?.message ?? "insert_failed",
    );
  }

  await logBrokerActivity(auth.adminSupabase, {
    organizationId: auth.organizationId,
    clientId,
    userId: auth.user.id,
    profileId: auth.profileId,
    type: "quote_imported",
    description: "Devis compagnie importé — en attente de vérification.",
    metadata: { quote_id: quote.id },
  });

  // Read the PDF/image right away so the broker stays on the dossier and sees a
  // pre-filled devis (insurer, prime, garanties) without opening the detail
  // view. Best-effort: if the read fails, the quote stays "pending" and can be
  // re-read from its detail page later.
  let extracted = false;
  if (values.documentId) {
    const extraction = await runQuoteExtraction({
      adminSupabase: auth.adminSupabase,
      organizationId: auth.organizationId,
      clientId,
      quoteId: quote.id,
      userId: auth.user.id,
    }).catch(() => null);
    extracted = Boolean(extraction?.ok && !extraction.skipped);
  }

  return NextResponse.json({ success: true, quoteId: quote.id, extracted });
}
