import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { fetchQontoQuotePdf } from "@/lib/billing/providers/qonto";
import type { Database } from "@/types/database";
import type { SupabaseClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

type BillingDocRow = {
  id: string;
  organization_id: string;
  provider: string;
  document_type: string;
  provider_quote_url: string | null;
  metadata: Record<string, unknown> | null;
};

function jsonError(message: string, status: number, reason?: string) {
  return NextResponse.json(
    { success: false, message, reason },
    { status },
  );
}

function getConfiguredSecret(): string {
  return process.env.N8N_BILLING_SECRET?.trim() ?? "";
}

function getRequestSecret(request: NextRequest): string {
  const authorization = request.headers.get("authorization");

  if (authorization?.startsWith("Bearer ")) {
    return authorization.slice("Bearer ".length).trim();
  }

  return request.headers.get("x-n8n-secret")?.trim() ?? "";
}

function isValidSecret(
  requestSecret: string,
  configuredSecret: string,
): boolean {
  if (!requestSecret || !configuredSecret) {
    return false;
  }

  const requestBuffer = Buffer.from(requestSecret);
  const configuredBuffer = Buffer.from(configuredSecret);

  if (requestBuffer.length !== configuredBuffer.length) {
    return false;
  }

  return timingSafeEqual(requestBuffer, configuredBuffer);
}

async function fetchBillingDocument(
  adminSupabase: SupabaseClient<Database>,
  documentId: string,
): Promise<BillingDocRow | null> {
  const { data, error } = await adminSupabase
    .from("billing_documents")
    .select(
      "id, organization_id, provider, document_type, provider_quote_url, metadata",
    )
    .eq("id", documentId)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return data as unknown as BillingDocRow;
}

function getAttachmentId(billingDoc: BillingDocRow): string | undefined {
  return billingDoc.metadata?.qonto_attachment_id as string | undefined;
}

async function streamQontoPdf(
  adminSupabase: SupabaseClient<Database>,
  billingDoc: BillingDocRow,
  attachmentId: string,
): Promise<NextResponse> {
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
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const documentId = id;

  const adminSupabase = getSupabaseAdminClient();

  if (!adminSupabase) {
    return jsonError(
      "Le service de téléchargement n'est pas configuré.",
      500,
      "service_role_unconfigured",
    );
  }

  const configuredSecret = getConfiguredSecret();
  const requestSecret = getRequestSecret(request);
  const isN8n = configuredSecret.length > 0 && isValidSecret(requestSecret, configuredSecret);

  if (isN8n) {
    return handleN8nDownload(adminSupabase, documentId);
  }

  return handleUserDownload(request, adminSupabase, documentId);
}

async function handleN8nDownload(
  adminSupabase: SupabaseClient<Database>,
  documentId: string,
): Promise<NextResponse> {
  const billingDoc = await fetchBillingDocument(adminSupabase, documentId);

  if (!billingDoc) {
    return jsonError(
      "Document de facturation introuvable.",
      404,
      "billing_document_not_found",
    );
  }

  if (
    billingDoc.provider !== "qonto" ||
    billingDoc.document_type !== "quote"
  ) {
    return jsonError(
      "Ce document ne peut pas etre telecharge via ce endpoint.",
      400,
      "unsupported_document_type",
    );
  }

  const attachmentId = getAttachmentId(billingDoc);

  if (attachmentId) {
    try {
      return await streamQontoPdf(adminSupabase, billingDoc, attachmentId);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Erreur inconnue.";

      console.error(
        "[n8n] Qonto attachment PDF download failed.",
        {
          billing_document_id: documentId,
          organization_id: billingDoc.organization_id,
          qonto_attachment_id: attachmentId,
          reason: message,
        },
      );

      if (billingDoc.provider_quote_url) {
        return jsonError(
          `Le telechargement du PDF Qonto a echoue. Le devis existe a l'URL ${billingDoc.provider_quote_url} mais le fichier binaire n'est pas disponible via l'API Qonto.`,
          502,
          "qonto_attachment_download_failed",
        );
      }

      return jsonError(
        "Le telechargement du PDF Qonto a echoue et aucune URL de devis n'est disponible.",
        502,
        "qonto_attachment_download_failed",
      );
    }
  }

  if (billingDoc.provider_quote_url) {
    return jsonError(
      `Aucun attachment PDF disponible pour ce devis. Le devis est accessible a l'URL ${billingDoc.provider_quote_url} mais le telechargement binaire n'est pas possible.`,
      502,
      "qonto_attachment_not_available",
    );
  }

  return jsonError(
    "Le telechargement du PDF Qonto n'est pas disponible. Aucun attachment_id ni URL de devis Qonto trouve.",
    501,
    "qonto_pdf_not_available",
  );
}

async function handleUserDownload(
  request: NextRequest,
  adminSupabase: SupabaseClient<Database>,
  documentId: string,
): Promise<NextResponse> {
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

  const billingDoc = await fetchBillingDocument(adminSupabase, documentId);

  if (!billingDoc) {
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
      "Vous n'avez pas acces a ce document.",
      403,
      "forbidden",
    );
  }

  if (
    billingDoc.provider !== "qonto" ||
    billingDoc.document_type !== "quote"
  ) {
    return jsonError(
      "Ce document ne peut pas etre telecharge via ce endpoint.",
      400,
      "unsupported_document_type",
    );
  }

  const attachmentId = getAttachmentId(billingDoc);

  if (attachmentId) {
    try {
      return await streamQontoPdf(adminSupabase, billingDoc, attachmentId);
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
    }
  }

  if (billingDoc.provider_quote_url) {
    return NextResponse.redirect(billingDoc.provider_quote_url);
  }

  return jsonError(
    "Le telechargement du PDF Qonto n'est pas disponible. Aucun attachment_id ni URL de devis Qonto trouve.",
    501,
    "qonto_pdf_not_available",
  );
}
