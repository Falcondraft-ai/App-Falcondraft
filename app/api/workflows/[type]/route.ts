import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { loadUserOrganizationContextWithAdmin } from "@/lib/auth/organization-context";
import { canMutateWorkspaceDeal } from "@/lib/auth/workspace-permissions";
import type { CurrentUserContext } from "@/lib/auth/session";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { validateWebhookUrl } from "@/lib/security/validate-webhook-url";

const workflowRequestSchema = z.object({
  dealId: z.string().uuid("dealId invalide."),
  validationSource: z.enum(["initial_export", "uploaded_pdf"]).optional(),
});

const supportedWorkflowTypes = [
  "call_summary",
  "proposal_generation",
  "proposal_validation",
  "email_draft_generation",
] as const;
const proposalPdfDocumentTypes = [
  "proposal_pdf_initial",
  "proposal_pdf",
  "proposal_pdf_final_uploaded",
];
const selectedProposalPdfExternalId = "selected_proposal_pdf";

type SupportedWorkflowType = (typeof supportedWorkflowTypes)[number];

function isSupportedWorkflowType(
  workflowType: string,
): workflowType is SupportedWorkflowType {
  return supportedWorkflowTypes.includes(workflowType as SupportedWorkflowType);
}

type RouteContext = {
  params: Promise<{
    type: string;
  }>;
};

function normalizeWorkflowType(type: string) {
  const normalizedType = type.replaceAll("-", "_");

  if (normalizedType === "call_summary") {
    return "call_summary";
  }

  if (normalizedType === "proposal_generation") {
    return "proposal_generation";
  }

  if (normalizedType === "proposal_validation") {
    return "proposal_validation";
  }

  if (normalizedType === "email_draft_generation") {
    return "email_draft_generation";
  }

  return normalizedType;
}

type ContextErrorReason =
  | "service_role_unconfigured"
  | "active_membership_missing"
  | "organization_missing";

function contextDetails(
  context: CurrentUserContext,
  reason: ContextErrorReason,
) {
  return {
    hasSession: true,
    userId: context.user.id,
    membershipFound: Boolean(context.membership),
    organizationFound: Boolean(context.organization),
    reason,
  };
}

function jsonError(
  message: string,
  status: number,
  details?: Record<string, unknown>,
) {
  return NextResponse.json({ success: false, message, ...details }, { status });
}

export async function POST(request: NextRequest, context: RouteContext) {
  const { type } = await context.params;
  const workflowType = normalizeWorkflowType(type);

  if (!isSupportedWorkflowType(workflowType)) {
    return jsonError("Le workflow demandé n'est pas disponible.", 400);
  }

  const supabase = await getSupabaseServerClient();

  if (!supabase) {
    return jsonError("Configuration Supabase manquante.", 500);
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return jsonError("Authentification requise.", 401);
  }

  const adminSupabase = getSupabaseAdminClient();

  if (!adminSupabase) {
    return jsonError("Configuration Supabase manquante.", 500, {
      hasSession: true,
      userId: user.id,
      membershipFound: false,
      organizationFound: false,
      reason: "service_role_unconfigured",
    });
  }

  const body: unknown = await request.json().catch(() => ({}));
  const parsedBody = workflowRequestSchema.safeParse(body);

  if (!parsedBody.success) {
    return jsonError("La demande de génération est incomplète.", 400);
  }

  const organizationContext = await loadUserOrganizationContextWithAdmin(
    user,
    adminSupabase,
  );

  if (!organizationContext.membership) {
    return jsonError("Aucun espace client associé.", 403, {
      ...contextDetails(organizationContext, "active_membership_missing"),
    });
  }

  if (!organizationContext.organization) {
    return jsonError("Organisation introuvable.", 403, {
      ...contextDetails(organizationContext, "organization_missing"),
    });
  }

  const organizationId = organizationContext.organization.id;
  const { dealId, validationSource } = parsedBody.data;

  const { data: deal } = await adminSupabase
    .from("deals")
    .select("id, created_by")
    .eq("id", dealId)
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (!deal) {
    return jsonError("Dossier commercial introuvable.", 404);
  }

  if (
    !canMutateWorkspaceDeal(
      {
        userId: user.id,
        role: organizationContext.membership.role,
        allowMemberCompanyVisibility:
          organizationContext.organization.allow_member_company_visibility,
        scope: "organization",
      },
      deal.created_by,
    )
  ) {
    return jsonError("Votre rôle ne permet pas de modifier ce dossier.", 403);
  }

  if (workflowType === "proposal_validation") {
    if (!validationSource) {
      return jsonError("Source de validation manquante.", 400);
    }

    const validationDocumentTypes =
      validationSource === "initial_export"
        ? ["proposal_pdf_initial", "proposal_pdf"]
        : ["proposal_pdf_final_uploaded"];

    const { data: validationDocuments, error: validationDocumentError } =
      await adminSupabase
        .from("documents")
        .select("id, url, storage_path")
        .eq("organization_id", organizationId)
        .eq("deal_id", dealId)
        .in("type", validationDocumentTypes)
        .order("created_at", { ascending: false })
        .limit(1);

    if (validationDocumentError) {
      return jsonError("Vérification du PDF impossible.", 500);
    }

    const validationDocument = validationDocuments?.[0];

    if (!validationDocument) {
      const message =
        validationSource === "initial_export"
          ? "Aucune version PDF initiale disponible. Importez la dernière version PDF."
          : "Aucun PDF final importé pour ce dossier.";

      return jsonError(message, 404);
    }

    if (!validationDocument.url && !validationDocument.storage_path) {
      return jsonError("Le PDF de validation est incomplet.", 400);
    }

    const { error: clearSelectedProposalPdfError } = await adminSupabase
      .from("documents")
      .update({ external_id: null })
      .eq("organization_id", organizationId)
      .eq("deal_id", dealId)
      .in("type", proposalPdfDocumentTypes)
      .eq("external_id", selectedProposalPdfExternalId);

    if (clearSelectedProposalPdfError) {
      return jsonError("Sélection du PDF impossible.", 500);
    }

    const { error: markSelectedProposalPdfError } = await adminSupabase
      .from("documents")
      .update({ external_id: selectedProposalPdfExternalId })
      .eq("id", validationDocument.id)
      .eq("organization_id", organizationId)
      .eq("deal_id", dealId);

    if (markSelectedProposalPdfError) {
      return jsonError("Sélection du PDF impossible.", 500);
    }
  }

  if (workflowType === "email_draft_generation") {
    const { data: finalDocuments, error: finalDocumentError } =
      await adminSupabase
        .from("documents")
        .select("id, storage_path")
        .eq("organization_id", organizationId)
        .eq("deal_id", dealId)
        .eq("type", "final_document_pdf")
        .eq("status", "ready")
        .order("created_at", { ascending: false })
        .limit(1);

    if (finalDocumentError) {
      return jsonError("Vérification du document final impossible.", 500);
    }

    const finalDocument = finalDocuments?.[0];

    if (!finalDocument?.storage_path) {
      return jsonError(
        "Validez d’abord la proposition pour générer le document final.",
        409,
      );
    }

    const { data: emailConnection, error: emailConnectionError } =
      await adminSupabase
        .from("email_connections")
        .select("id")
        .eq("organization_id", organizationId)
        .eq("user_id", user.id)
        .eq("status", "connected")
        .maybeSingle();

    if (emailConnectionError) {
      return jsonError("Vérification de la connexion email impossible.", 500);
    }

    if (!emailConnection) {
      return jsonError("Connectez Gmail ou Outlook avant de créer un brouillon.", 409);
    }
  }

  const { data: workflowConfig } = await adminSupabase
    .from("workflow_configs")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("workflow_type", workflowType)
    .eq("status", "active")
    .maybeSingle();

  if (!workflowConfig) {
    return jsonError("Configuration du workflow introuvable.", 404);
  }

  const startedAt = new Date().toISOString();
  const { data: workflowRun, error: workflowRunError } = await adminSupabase
    .from("workflow_runs")
    .insert({
      organization_id: organizationId,
      deal_id: dealId,
      type: workflowType,
      status: "pending",
      started_at: startedAt,
    })
    .select("id")
    .single();

  if (workflowRunError || !workflowRun) {
    return jsonError("Impossible de créer l’exécution du workflow.", 500);
  }

  const webhookBody =
    workflowType === "email_draft_generation"
      ? {
          organization_id: organizationId,
          user_id: user.id,
          deal_id: dealId,
          workflow_run_id: workflowRun.id,
          workflowRunId: workflowRun.id,
        }
      : {
          organizationId,
          dealId,
          workflowType,
          workflowRunId: workflowRun.id,
          validationSource,
        };

  const urlCheck = validateWebhookUrl(workflowConfig.n8n_webhook_url);
  if (!urlCheck.valid) {
    console.error("[workflows] SSRF blocked:", urlCheck.reason);
    return jsonError("Configuration du workflow invalide.", 500);
  }

  const webhookResponse = await fetch(workflowConfig.n8n_webhook_url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-N8N-Secret": process.env.N8N_WEBHOOK_SECRET ?? "",
    },
    body: JSON.stringify(webhookBody),
  }).catch(() => null);

  if (!webhookResponse?.ok) {
    await adminSupabase
      .from("workflow_runs")
      .update({
        status: "failed",
        completed_at: new Date().toISOString(),
        error_message: "Le déclenchement du workflow a échoué.",
      })
      .eq("id", workflowRun.id)
      .eq("organization_id", organizationId);

    return jsonError("Le déclenchement du workflow a échoué.", 502);
  }

  if (workflowType === "email_draft_generation") {
    await adminSupabase.from("audit_logs").insert({
      organization_id: organizationId,
      user_id: user.id,
      action: "email_draft_workflow_started",
      entity_type: "deal",
      entity_id: dealId,
    });
  }

  return NextResponse.json({
    success: true,
    workflowRunId: workflowRun.id,
  });
}
