import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { requireInternalAdminContext } from "@/lib/internal-admin/server";
import {
  managedWorkflowTypes,
  workflowConfigStatuses,
} from "@/lib/internal-admin/workflows";

const billingStatuses = ["active", "pending", "trial", "suspended"] as const;
const workspaceTypes = ["sales_automation", "insurance_broker"] as const;
const brokerOfferings = ["saas", "custom"] as const;
const brokerPlans = ["essentiel", "cabinet", "performance"] as const;
const DEFAULT_STORAGE_LIMIT_GB = 250;
const GIGABYTE = 1024 * 1024 * 1024;

const meetingBotNameSchema = z
  .string()
  .trim()
  .min(2)
  .max(60)
  .refine((value) => !/[\r\n\t]/.test(value), {
    message: "Le nom doit tenir sur une seule ligne.",
  });

const organizationCreateSchema = z.object({
  name: z.string().trim().min(2).max(120),
  slug: z
    .string()
    .trim()
    .min(2)
    .max(80)
    .regex(
      /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
      "Le slug doit contenir uniquement lettres minuscules, chiffres et tirets.",
    ),
  billing_status: z.enum(billingStatuses),
  workspace_type: z.enum(workspaceTypes).default("sales_automation"),
  broker_offering: z.enum(brokerOfferings).default("saas"),
  plan: z.enum(brokerPlans).optional(),
  storage_limit_gb: z.coerce.number().min(1).max(10000).optional().nullable(),
  setup_amount: z.coerce.number().min(0).optional().nullable(),
  monthly_subscription_amount: z.coerce.number().min(0).optional().nullable(),
  allow_member_company_visibility: z.boolean().default(true),
  meeting_bot_name: meetingBotNameSchema.default("FalconDraft"),
  workflow_status: z.enum(workflowConfigStatuses).default("inactive"),
  workflow_configs: z
    .array(
      z.object({
        workflow_type: z.enum(managedWorkflowTypes),
        n8n_webhook_url: z
          .string()
          .trim()
          .url("URL invalide.")
          .refine((value) => value.startsWith("https://"), {
            message: "Le webhook doit commencer par https://.",
          }),
      }),
    )
    .default([]),
});

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

export async function POST(request: NextRequest) {
  const internalAdmin = await requireInternalAdminContext();

  if (!internalAdmin.success) {
    return jsonError(
      internalAdmin.message,
      internalAdmin.status,
      internalAdmin.reason,
    );
  }

  const body: unknown = await request.json().catch(() => ({}));
  const parsedBody = organizationCreateSchema.safeParse(body);

  if (!parsedBody.success) {
    return jsonError(
      "Nom, slug et statut de facturation sont requis.",
      400,
      "invalid_payload",
    );
  }

  const values = parsedBody.data;
  const { data: existingOrganization, error: existingOrganizationError } =
    await internalAdmin.adminSupabase
      .from("organizations")
      .select("id")
      .eq("slug", values.slug)
      .maybeSingle();

  if (existingOrganizationError) {
    return jsonError(
      "Vérification du slug impossible.",
      500,
      existingOrganizationError.message,
    );
  }

  if (existingOrganization) {
    return jsonError(
      "Ce slug est déjà utilisé par un workspace.",
      409,
      "slug_already_exists",
    );
  }

  const storageLimitBytes = Math.round(
    (values.storage_limit_gb ?? DEFAULT_STORAGE_LIMIT_GB) * GIGABYTE,
  );

  const { data: organization, error } = await internalAdmin.adminSupabase
    .from("organizations")
    .insert({
      name: values.name,
      slug: values.slug,
      billing_status: values.billing_status,
      workspace_type: values.workspace_type,
      broker_offering: values.broker_offering,
      plan:
        values.workspace_type === "insurance_broker" &&
        values.broker_offering === "saas"
          ? (values.plan ?? "performance")
          : null,
      storage_limit_bytes: storageLimitBytes,
      setup_amount: values.setup_amount ?? null,
      monthly_subscription_amount: values.monthly_subscription_amount ?? null,
      allow_member_company_visibility: values.allow_member_company_visibility,
      meeting_bot_name: values.meeting_bot_name,
    })
    .select(
      "id, name, slug, billing_status, workspace_type, storage_limit_bytes, storage_used_bytes, setup_amount, monthly_subscription_amount, allow_member_company_visibility, meeting_bot_name, created_at",
    )
    .single();

  if (error || !organization) {
    return jsonError(
      "Création du workspace impossible.",
      500,
      error?.message ?? "insert_failed",
    );
  }

  await internalAdmin.adminSupabase.from("audit_logs").insert({
    organization_id: organization.id,
    user_id: internalAdmin.user.id,
    action: "organization_created",
    entity_type: "organization",
    entity_id: organization.id,
  });

  // The insurance-broker module does not use the commercial n8n workflow
  // configs; only sales-automation workspaces wire those up at creation.
  const workflowConfigsToCreate =
    values.workspace_type === "insurance_broker" ? [] : values.workflow_configs;

  const workflowConfigRows = workflowConfigsToCreate.map((config) => ({
    organization_id: organization.id,
    workflow_type: config.workflow_type,
    n8n_webhook_url: config.n8n_webhook_url,
    n8n_workflow_id: null,
    status: values.workflow_status,
    updated_at: new Date().toISOString(),
  }));

  const { data: workflowConfigs, error: workflowConfigError } =
    workflowConfigRows.length > 0
      ? await internalAdmin.adminSupabase
          .from("workflow_configs")
          .insert(workflowConfigRows)
          .select("*")
      : { data: [], error: null };

  if (workflowConfigError) {
    return jsonError(
      "Workspace créé, mais configuration n8n impossible.",
      500,
      workflowConfigError.message,
    );
  }

  return NextResponse.json({
    success: true,
    organization: {
      id: organization.id,
      name: organization.name,
      slug: organization.slug,
      billingStatus: organization.billing_status,
      workspaceType: organization.workspace_type,
      storageLimitBytes: organization.storage_limit_bytes,
      storageUsedBytes: organization.storage_used_bytes,
      setupAmount: organization.setup_amount,
      monthlySubscriptionAmount: organization.monthly_subscription_amount,
      allowMemberCompanyVisibility:
        organization.allow_member_company_visibility,
      meetingBotName: organization.meeting_bot_name,
      createdAt: organization.created_at,
      isInternalWorkspace: false,
      activeMemberCount: 0,
      pendingInvitationCount: 0,
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
      accounts: [],
      pendingInvitations: [],
    },
  });
}
