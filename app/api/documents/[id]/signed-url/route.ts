import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { loadUserOrganizationContextWithAdmin } from "@/lib/auth/organization-context";
import { canAccessWorkspaceDeal } from "@/lib/auth/workspace-permissions";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { getSupabaseServerClient } from "@/lib/supabase/server";

const documentIdSchema = z.string().uuid();
const proposalPdfsBucket =
  process.env.SUPABASE_PROPOSAL_PDFS_BUCKET ?? "proposal-pdfs";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

function jsonError(message: string, status: number, reason: string) {
  return NextResponse.json(
    {
      success: false,
      message,
      reason,
    },
    { status },
  );
}

export async function GET(request: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  const parsedDocumentId = documentIdSchema.safeParse(id);

  if (!parsedDocumentId.success) {
    return jsonError("Document invalide.", 400, "invalid_document_id");
  }

  const supabase = await getSupabaseServerClient();

  if (!supabase) {
    return jsonError("Opération indisponible.", 500, "supabase_unconfigured");
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
      "Opération indisponible.",
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

  const { data: document } = await adminSupabase
    .from("documents")
    .select("id, organization_id, deal_id, storage_path, title")
    .eq("id", parsedDocumentId.data)
    .eq("organization_id", userContext.organization.id)
    .maybeSingle();

  if (!document) {
    return jsonError("Document introuvable.", 404, "document_not_found");
  }

  const { data: deal } = await adminSupabase
    .from("deals")
    .select("id, created_by")
    .eq("id", document.deal_id)
    .eq("organization_id", userContext.organization.id)
    .maybeSingle();

  if (
    !deal ||
    !canAccessWorkspaceDeal(
      {
        userId: user.id,
        role: userContext.membership.role,
        allowMemberCompanyVisibility:
          userContext.organization.allow_member_company_visibility,
        scope: "organization",
      },
      deal.created_by,
    )
  ) {
    return jsonError("Document introuvable.", 404, "document_not_found");
  }

  if (!document.storage_path) {
    return jsonError(
      "Ce document n’a pas de fichier associé.",
      400,
      "storage_path_missing",
    );
  }

  const shouldDownload = request.nextUrl.searchParams.get("download") === "1";
  const signedUrlOptions = shouldDownload
    ? { download: `${document.title}.pdf` }
    : undefined;
  const { data, error } = await adminSupabase.storage
    .from(proposalPdfsBucket)
    .createSignedUrl(document.storage_path, 60, signedUrlOptions);

  if (error || !data?.signedUrl) {
    return jsonError("Lien sécurisé indisponible.", 500, "signed_url_failed");
  }

  return NextResponse.json({
    success: true,
    url: data.signedUrl,
  });
}
