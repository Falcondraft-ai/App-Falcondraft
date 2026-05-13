import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { loadUserOrganizationContextWithAdmin } from "@/lib/auth/organization-context";
import { canMutateWorkspaceDeal } from "@/lib/auth/workspace-permissions";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { getSupabaseServerClient } from "@/lib/supabase/server";

const dealIdSchema = z.string().uuid();

const updateDealSchema = z.object({
  name: z.string().trim().min(3),
  clientCompanyName: z.string().trim().min(2),
  clientContactName: z.string().trim().min(2),
  clientEmail: z.string().trim().email(),
  clientPhone: z.string().trim().optional(),
  transcript: z.string().trim().min(1),
  additionalContext: z.string().trim().optional(),
  emailInstructions: z.string().trim().optional(),
  clientCompanyInfo: z.string().trim().optional(),
  amountEstimate: z.number().min(0).nullable(),
  expectedCloseDate: z.string().trim().optional(),
  callSummary: z.string().trim().optional(),
  proposalContent: z.string().trim().optional(),
});

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

async function loadDealMutationContext(context: RouteContext) {
  const { id } = await context.params;
  const parsedDealId = dealIdSchema.safeParse(id);

  if (!parsedDealId.success) {
    return {
      error: jsonError("Dossier commercial invalide.", 400, "invalid_deal_id"),
    };
  }

  const supabase = await getSupabaseServerClient();

  if (!supabase) {
    return {
      error: jsonError("Opération indisponible.", 500, "supabase_unconfigured"),
    };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      error: jsonError("Session requise.", 401, "session_missing"),
    };
  }

  const adminSupabase = getSupabaseAdminClient();

  if (!adminSupabase) {
    return {
      error: jsonError(
        "Opération indisponible.",
        500,
        "service_role_unconfigured",
      ),
    };
  }

  const userContext = await loadUserOrganizationContextWithAdmin(
    user,
    adminSupabase,
  );

  if (!userContext.membership || !userContext.organization) {
    return {
      error: jsonError(
        "Aucun espace client associé.",
        403,
        "organization_context_missing",
      ),
    };
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
    return {
      error: jsonError(
        "Dossier commercial introuvable.",
        404,
        "deal_not_found",
      ),
    };
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
    return {
      error: jsonError(
        "Votre rôle ne permet pas de modifier ce dossier.",
        403,
        "insufficient_role",
      ),
    };
  }

  return {
    adminSupabase,
    dealId,
    organizationId,
    userId: user.id,
  };
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const mutationContext = await loadDealMutationContext(context);

  if ("error" in mutationContext) {
    return mutationContext.error;
  }

  const body: unknown = await request.json().catch(() => ({}));
  const parsedBody = updateDealSchema.safeParse(body);

  if (!parsedBody.success) {
    return jsonError(
      "Les informations du dossier sont incomplètes.",
      400,
      "invalid_payload",
    );
  }

  const values = parsedBody.data;
  const now = new Date().toISOString();

  const { error } = await mutationContext.adminSupabase
    .from("deals")
    .update({
      name: values.name,
      client_company_name: values.clientCompanyName,
      client_contact_name: values.clientContactName,
      client_email: values.clientEmail,
      transcript: values.transcript,
      additional_context: values.additionalContext || null,
      email_instructions: values.emailInstructions || null,
      client_phone: values.clientPhone || null,
      client_company_info: values.clientCompanyInfo || null,
      amount_estimate: values.amountEstimate,
      expected_close_date: values.expectedCloseDate || null,
      call_summary: values.callSummary?.trim() || null,
      proposal_content: values.proposalContent?.trim() || null,
      updated_at: now,
    })
    .eq("id", mutationContext.dealId)
    .eq("organization_id", mutationContext.organizationId);

  if (error) {
    return jsonError("Modification impossible.", 500, error.message);
  }

  await mutationContext.adminSupabase.from("audit_logs").insert({
    organization_id: mutationContext.organizationId,
    user_id: mutationContext.userId,
    action: "Dossier commercial modifié",
    entity_type: "deal",
    entity_id: mutationContext.dealId,
  });

  return NextResponse.json({
    success: true,
    dealId: mutationContext.dealId,
  });
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  const mutationContext = await loadDealMutationContext(context);

  if ("error" in mutationContext) {
    return mutationContext.error;
  }

  const relatedDeletes = await Promise.all([
    mutationContext.adminSupabase
      .from("documents")
      .delete()
      .eq("deal_id", mutationContext.dealId)
      .eq("organization_id", mutationContext.organizationId),
    mutationContext.adminSupabase
      .from("workflow_runs")
      .delete()
      .eq("deal_id", mutationContext.dealId)
      .eq("organization_id", mutationContext.organizationId),
    mutationContext.adminSupabase
      .from("audit_logs")
      .delete()
      .eq("entity_id", mutationContext.dealId)
      .eq("organization_id", mutationContext.organizationId),
  ]);

  const relatedDeleteError = relatedDeletes.find(
    (result) => result.error,
  )?.error;

  if (relatedDeleteError) {
    return jsonError(
      "Suppression impossible.",
      500,
      relatedDeleteError.message,
    );
  }

  const { error } = await mutationContext.adminSupabase
    .from("deals")
    .delete()
    .eq("id", mutationContext.dealId)
    .eq("organization_id", mutationContext.organizationId);

  if (error) {
    return jsonError("Suppression impossible.", 500, error.message);
  }

  return NextResponse.json({ success: true, dealId: mutationContext.dealId });
}
