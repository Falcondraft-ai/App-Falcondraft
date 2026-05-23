import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { loadUserOrganizationContextWithAdmin } from "@/lib/auth/organization-context";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { fetchQontoQuotePdf } from "@/lib/billing/providers/qonto";
import type { Database } from "@/types/database";
import type { SupabaseClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

type AdminClient = SupabaseClient<Database>;

const documentIdSchema = z.string().uuid();
const sourceSchema = z.enum(["documents", "billing_documents"]);
const proposalPdfsBucket =
  process.env.SUPABASE_PROPOSAL_PDFS_BUCKET ?? "proposal-pdfs";

type RouteContext = {
  params: Promise<{ id: string }>;
};

function jsonError(message: string, status: number, reason?: string) {
  return NextResponse.json(
    { success: false, message, reason },
    { status },
  );
}

export async function GET(request: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  const parsedId = documentIdSchema.safeParse(id);

  if (!parsedId.success) {
    return jsonError("Identifiant de document invalide.", 400, "invalid_document_id");
  }

  const documentId = parsedId.data;
  const rawSource = request.nextUrl.searchParams.get("source") ?? "documents";
  const parsedSource = sourceSchema.safeParse(rawSource);

  if (!parsedSource.success) {
    return jsonError(
      'Le paramètre "source" doit être "documents" ou "billing_documents".',
      400,
      "invalid_source",
    );
  }

  const source = parsedSource.data;

  const supabase = await getSupabaseServerClient();

  if (!supabase) {
    return jsonError("Service indisponible.", 500, "supabase_unconfigured");
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return jsonError("Session requise.", 401, "session_missing");
  }

  const adminSupabase = getSupabaseAdminClient();

  if (!adminSupabase) {
    return jsonError(
      "Service indisponible.",
      500,
      "service_role_unconfigured",
    );
  }

  const userContext = await loadUserOrganizationContextWithAdmin(
    user,
    adminSupabase,
  );

  if (!userContext.membership || !userContext.organization) {
    return jsonError(
      "Aucun espace client associé.",
      403,
      "organization_context_missing",
    );
  }

  if (source === "documents") {
    return handleDocumentsDownload(
      adminSupabase,
      documentId,
      userContext.organization.id,
    );
  }

  return handleBillingDocumentsDownload(
    adminSupabase,
    documentId,
    userContext.organization.id,
  );
}

async function handleDocumentsDownload(
  adminSupabase: AdminClient,
  documentId: string,
  organizationId: string,
) {
  const { data: document } = await adminSupabase
    .from("documents")
    .select("id, organization_id, storage_path, title, url")
    .eq("id", documentId)
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (!document) {
    return jsonError("Document introuvable.", 404, "document_not_found");
  }

  if (document.storage_path) {
    const { data, error } = await adminSupabase.storage
      .from(proposalPdfsBucket)
      .createSignedUrl(document.storage_path, 60, {
        download: `${document.title}.pdf`,
      });

    if (error || !data?.signedUrl) {
      return jsonError(
        "Lien sécurisé indisponible.",
        500,
        "signed_url_failed",
      );
    }

    return NextResponse.redirect(data.signedUrl);
  }

  if (document.url) {
    return NextResponse.redirect(document.url);
  }

  return jsonError(
    "Ce document n'a pas de fichier associé.",
    400,
    "no_download_available",
  );
}

async function handleBillingDocumentsDownload(
  adminSupabase: AdminClient,
  documentId: string,
  organizationId: string,
) {
  const { data: billingDoc, error: docError } = await adminSupabase
    .from("billing_documents")
    .select(
      "id, organization_id, provider, document_type, provider_quote_url, metadata",
    )
    .eq("id", documentId)
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (docError || !billingDoc) {
    return jsonError(
      "Document de facturation introuvable.",
      404,
      "billing_document_not_found",
    );
  }

  if (billingDoc.provider === "qonto" && billingDoc.document_type === "quote") {
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
            billing_document_id: documentId,
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

  // TODO: Add support for pennylane, odoo, and other billing providers here.
  return jsonError(
    `Le téléchargement de documents ${billingDoc.provider} (${billingDoc.document_type}) n'est pas encore disponible.`,
    400,
    "unsupported_provider_document_type",
  );
}
