import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { loadUserOrganizationContextWithAdmin } from "@/lib/auth/organization-context";
import { canMutateWorkspaceDeal } from "@/lib/auth/workspace-permissions";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { getSupabaseServerClient } from "@/lib/supabase/server";

const dealIdSchema = z.string().uuid();
const maxPdfSize = 25 * 1024 * 1024;
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

export async function POST(request: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  const parsedDealId = dealIdSchema.safeParse(id);

  if (!parsedDealId.success) {
    return jsonError("Dossier commercial invalide.", 400, "invalid_deal_id");
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

  const organizationId = userContext.organization.id;
  const dealId = parsedDealId.data;
  const { data: deal } = await adminSupabase
    .from("deals")
    .select("id, created_by")
    .eq("id", dealId)
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (!deal) {
    return jsonError("Dossier commercial introuvable.", 404, "deal_not_found");
  }

  if (
    !canMutateWorkspaceDeal(
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
    return jsonError(
      "Votre rôle ne permet pas de modifier ce dossier.",
      403,
      "insufficient_role",
    );
  }

  const formData = await request.formData().catch(() => null);
  const file = formData?.get("file");

  if (!(file instanceof File)) {
    return jsonError("PDF requis.", 400, "pdf_missing");
  }

  if (file.type !== "application/pdf") {
    return jsonError("Le fichier doit être un PDF.", 400, "invalid_pdf_type");
  }

  if (file.size > maxPdfSize) {
    return jsonError("Le PDF dépasse 25 Mo.", 400, "pdf_too_large");
  }

  const storagePath = `${organizationId}/${dealId}/${crypto.randomUUID()}.pdf`;
  const fileBuffer = new Uint8Array(await file.arrayBuffer());
  const { error: uploadError } = await adminSupabase.storage
    .from(proposalPdfsBucket)
    .upload(storagePath, fileBuffer, {
      contentType: "application/pdf",
      upsert: false,
    });

  if (uploadError) {
    return jsonError("Upload impossible.", 500, uploadError.message);
  }

  const { data: document, error: documentError } = await adminSupabase
    .from("documents")
    .insert({
      organization_id: organizationId,
      deal_id: dealId,
      type: "proposal_pdf_final_uploaded",
      title: "Proposition commerciale PDF final",
      status: "ready",
      storage_path: storagePath,
    })
    .select("id, storage_path")
    .single();

  if (documentError) {
    await adminSupabase.storage.from(proposalPdfsBucket).remove([storagePath]);
    return jsonError("Enregistrement impossible.", 500, documentError.message);
  }

  return NextResponse.json({
    success: true,
    document: {
      id: document.id,
      storagePath: document.storage_path,
    },
  });
}
