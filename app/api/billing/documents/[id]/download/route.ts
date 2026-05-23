import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { fetchQontoQuotePdf } from "@/lib/billing/providers/qonto";

export const runtime = "nodejs";

function jsonError(message: string, status: number, reason?: string) {
  return NextResponse.json(
    { success: false, message, reason },
    { status },
  );
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const billingDocumentId = id;

  const supabase = await getSupabaseServerClient();

  if (!supabase) {
    return jsonError(
      "Le service n'est pas configuré.",
      500,
      "server_unconfigured",
    );
  }

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return jsonError("Authentification requise.", 401, "unauthenticated");
  }

  const adminSupabase = getSupabaseAdminClient();

  if (!adminSupabase) {
    return jsonError(
      "Le service de téléchargement n'est pas configuré.",
      500,
      "service_role_unconfigured",
    );
  }

  const { data: billingDoc, error: docError } = await adminSupabase
    .from("billing_documents")
    .select(
      "id, organization_id, provider, document_type, provider_quote_url, metadata",
    )
    .eq("id", billingDocumentId)
    .maybeSingle();

  if (docError || !billingDoc) {
    return jsonError(
      "Document de facturation introuvable.",
      404,
      "billing_document_not_found",
    );
  }

  const { data: membership, error: membershipError } = await adminSupabase
    .from("organization_members")
    .select("id")
    .eq("organization_id", billingDoc.organization_id)
    .eq("user_id", user.id)
    .eq("status", "active")
    .maybeSingle();

  if (membershipError || !membership) {
    return jsonError(
      "Vous n'avez pas accès à ce document.",
      403,
      "forbidden",
    );
  }

  if (
    billingDoc.provider !== "qonto" ||
    billingDoc.document_type !== "quote"
  ) {
    return jsonError(
      "Ce document ne peut pas être téléchargé via ce endpoint.",
      400,
      "unsupported_document_type",
    );
  }

  const attachmentId =
    (billingDoc.metadata as Record<string, unknown> | null)
      ?.qonto_attachment_id as string | undefined;

  if (attachmentId) {
    try {
      const { buffer, filename } = await fetchQontoQuotePdf(
        adminSupabase,
        billingDoc.organization_id,
        attachmentId,
      );

      return new NextResponse(new Uint8Array(buffer), {
        status: 200,
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `inline; filename="${filename}"`,
          "Content-Length": buffer.length.toString(),
          "Cache-Control": "private, no-cache, no-store, must-revalidate",
        },
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Erreur inconnue.";

      console.error(
        "Qonto attachment PDF download failed, falling back to quote URL redirect.",
        {
          billing_document_id: billingDocumentId,
          organization_id: billingDoc.organization_id,
          qonto_attachment_id: attachmentId,
          reason: message,
        },
      );
      // Fall through to quote_url redirect below
    }
  }

  if (billingDoc.provider_quote_url) {
    return NextResponse.redirect(billingDoc.provider_quote_url);
  }

  return jsonError(
    "Le téléchargement du PDF Qonto n'est pas disponible. Aucun attachment_id ni URL de devis Qonto trouvé.",
    501,
    "qonto_pdf_not_available",
  );
}
