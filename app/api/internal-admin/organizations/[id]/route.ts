import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { requireInternalAdminContext } from "@/lib/internal-admin/server";
import {
  managedWorkflowTypes,
  workflowConfigStatuses,
} from "@/lib/internal-admin/workflows";

const organizationIdSchema = z.string().uuid();
const billingStatuses = ["active", "pending", "trial", "suspended"] as const;

const organizationUpdateSchema = z.object({
  billing_status: z.enum(billingStatuses),
  setup_amount: z.coerce.number().min(0).optional().nullable(),
  monthly_subscription_amount: z.coerce.number().min(0).optional().nullable(),
  allow_member_company_visibility: z.boolean(),
  workflow_status: z.enum(workflowConfigStatuses).default("active"),
  workflow_configs: z.array(
    z.object({
      workflow_type: z.enum(managedWorkflowTypes),
      n8n_webhook_url: z
        .string()
        .trim()
        .url("URL invalide.")
        .refine((value) => value.startsWith("https://"), {
          message: "Le webhook doit commencer par https://.",
        }),
      status: z.enum(workflowConfigStatuses).optional(),
    }),
  ),
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

export async function PATCH(request: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  const parsedOrganizationId = organizationIdSchema.safeParse(id);

  if (!parsedOrganizationId.success) {
    return jsonError("Workspace invalide.", 400, "invalid_organization_id");
  }

  const internalAdmin = await requireInternalAdminContext();

  if (!internalAdmin.success) {
    return jsonError(
      internalAdmin.message,
      internalAdmin.status,
      internalAdmin.reason,
    );
  }

  const body: unknown = await request.json().catch(() => ({}));
  const parsedBody = organizationUpdateSchema.safeParse(body);

  if (!parsedBody.success) {
    return jsonError(
      "Facturation et webhooks valides sont requis.",
      400,
      "invalid_payload",
    );
  }

  const organizationId = parsedOrganizationId.data;
  const values = parsedBody.data;
  const { data: organization, error: organizationError } =
    await internalAdmin.adminSupabase
      .from("organizations")
      .update({
        billing_status: values.billing_status,
        setup_amount: values.setup_amount ?? null,
        monthly_subscription_amount: values.monthly_subscription_amount ?? null,
        allow_member_company_visibility: values.allow_member_company_visibility,
      })
      .eq("id", organizationId)
      .select(
        "id, name, slug, billing_status, setup_amount, monthly_subscription_amount, allow_member_company_visibility, created_at",
      )
      .single();

  if (organizationError || !organization) {
    return jsonError(
      "Mise à jour du workspace impossible.",
      organizationError?.code === "PGRST116" ? 404 : 500,
      organizationError?.message ?? "organization_update_failed",
    );
  }

  const now = new Date().toISOString();

  for (const config of values.workflow_configs) {
    const { data: existingConfig, error: existingConfigError } =
      await internalAdmin.adminSupabase
        .from("workflow_configs")
        .select("id, status")
        .eq("organization_id", organizationId)
        .eq("workflow_type", config.workflow_type)
        .maybeSingle();

    if (existingConfigError) {
      return jsonError(
        "Lecture des webhooks impossible.",
        500,
        existingConfigError.message,
      );
    }

    const upsertResult = existingConfig
      ? await internalAdmin.adminSupabase
          .from("workflow_configs")
          .update({
            n8n_webhook_url: config.n8n_webhook_url,
            status: config.status ?? values.workflow_status,
            updated_at: now,
          })
          .eq("id", existingConfig.id)
      : await internalAdmin.adminSupabase.from("workflow_configs").insert({
          organization_id: organizationId,
          workflow_type: config.workflow_type,
          n8n_webhook_url: config.n8n_webhook_url,
          n8n_workflow_id: null,
          status: config.status ?? values.workflow_status,
          updated_at: now,
        });

    if (upsertResult.error) {
      return jsonError(
        "Enregistrement des webhooks impossible.",
        500,
        upsertResult.error.message,
      );
    }
  }

  if (values.workflow_configs.length === 0) {
    const { error: workflowStatusError } = await internalAdmin.adminSupabase
      .from("workflow_configs")
      .update({
        status: values.workflow_status,
        updated_at: now,
      })
      .eq("organization_id", organizationId);

    if (workflowStatusError) {
      return jsonError(
        "Mise à jour du statut n8n impossible.",
        500,
        workflowStatusError.message,
      );
    }
  }

  const { data: workflowConfigs, error: workflowConfigsError } =
    await internalAdmin.adminSupabase
      .from("workflow_configs")
      .select("*")
      .eq("organization_id", organizationId)
      .order("workflow_type", { ascending: true });

  if (workflowConfigsError) {
    return jsonError(
      "Relecture des webhooks impossible.",
      500,
      workflowConfigsError.message,
    );
  }

  await internalAdmin.adminSupabase.from("audit_logs").insert({
    organization_id: organizationId,
    user_id: internalAdmin.user.id,
    action: "organization_updated",
    entity_type: "organization",
    entity_id: organizationId,
  });

  return NextResponse.json({
    success: true,
    organization: {
      id: organization.id,
      name: organization.name,
      slug: organization.slug,
      billingStatus: organization.billing_status,
      setupAmount: organization.setup_amount,
      monthlySubscriptionAmount: organization.monthly_subscription_amount,
      allowMemberCompanyVisibility:
        organization.allow_member_company_visibility,
      createdAt: organization.created_at,
      isInternalWorkspace:
        organization.id === internalAdmin.context.organization?.id,
      workflowConfigs: (workflowConfigs ?? []).map((config) => ({
        id: config.id,
        organizationId: config.organization_id,
        workflowType: config.workflow_type,
        n8nWebhookUrl: config.n8n_webhook_url,
        n8nWorkflowId: config.n8n_workflow_id,
        status: config.status,
        createdAt: config.created_at,
        updatedAt: config.updated_at,
      })),
    },
  });
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  const parsedOrganizationId = organizationIdSchema.safeParse(id);

  if (!parsedOrganizationId.success) {
    return jsonError("Workspace invalide.", 400, "invalid_organization_id");
  }

  const internalAdmin = await requireInternalAdminContext();

  if (!internalAdmin.success) {
    return jsonError(
      internalAdmin.message,
      internalAdmin.status,
      internalAdmin.reason,
    );
  }

  const organizationId = parsedOrganizationId.data;

  if (organizationId === internalAdmin.context.organization?.id) {
    return jsonError(
      "Le workspace interne FalconDraft ne peut pas être supprimé.",
      403,
      "internal_workspace_protected",
    );
  }

  const { data: organization, error: organizationLookupError } =
    await internalAdmin.adminSupabase
      .from("organizations")
      .select("id, name")
      .eq("id", organizationId)
      .maybeSingle();

  if (organizationLookupError) {
    return jsonError(
      "Lecture du workspace impossible.",
      500,
      organizationLookupError.message,
    );
  }

  if (!organization) {
    return jsonError("Workspace introuvable.", 404, "organization_not_found");
  }

  await internalAdmin.adminSupabase.from("audit_logs").insert({
    organization_id: organizationId,
    user_id: internalAdmin.user.id,
    action: "organization_deleted",
    entity_type: "organization",
    entity_id: organizationId,
  });

  const { error: deleteError } = await internalAdmin.adminSupabase
    .from("organizations")
    .delete()
    .eq("id", organizationId);

  if (deleteError) {
    return jsonError(
      "Suppression du workspace impossible.",
      500,
      deleteError.message,
    );
  }

  return NextResponse.json({
    success: true,
    organizationId,
  });
}
