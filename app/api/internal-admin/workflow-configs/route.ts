import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { requireInternalAdminContext } from "@/lib/internal-admin/server";
import {
  managedWorkflowTypes,
  workflowConfigStatuses,
} from "@/lib/internal-admin/workflows";

const workflowConfigCreateSchema = z.object({
  organization_id: z.string().uuid(),
  workflow_type: z.enum(managedWorkflowTypes),
  n8n_webhook_url: z
    .string()
    .trim()
    .url("URL invalide.")
    .refine((value) => value.startsWith("https://"), {
      message: "Le webhook doit commencer par https://.",
    }),
  n8n_workflow_id: z.string().trim().max(180).optional().nullable(),
  status: z.enum(workflowConfigStatuses),
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
  const parsedBody = workflowConfigCreateSchema.safeParse(body);

  if (!parsedBody.success) {
    return jsonError(
      "Workflow, URL https et statut sont requis.",
      400,
      "invalid_payload",
    );
  }

  const values = parsedBody.data;
  const { data: organization, error: organizationError } =
    await internalAdmin.adminSupabase
      .from("organizations")
      .select("id")
      .eq("id", values.organization_id)
      .maybeSingle();

  if (organizationError) {
    return jsonError(
      "Vérification du workspace impossible.",
      500,
      organizationError.message,
    );
  }

  if (!organization) {
    return jsonError("Workspace introuvable.", 404, "organization_not_found");
  }

  const now = new Date().toISOString();
  const { data: workflowConfig, error } = await internalAdmin.adminSupabase
    .from("workflow_configs")
    .insert({
      organization_id: values.organization_id,
      workflow_type: values.workflow_type,
      n8n_webhook_url: values.n8n_webhook_url,
      n8n_workflow_id: values.n8n_workflow_id?.trim() || null,
      status: values.status,
      updated_at: now,
    })
    .select("*")
    .single();

  if (error || !workflowConfig) {
    return jsonError(
      "Création de la configuration workflow impossible.",
      error?.code === "23505" ? 409 : 500,
      error?.message ?? "insert_failed",
    );
  }

  await internalAdmin.adminSupabase.from("audit_logs").insert({
    organization_id: values.organization_id,
    user_id: internalAdmin.user.id,
    action: "workflow_config_created",
    entity_type: "workflow_config",
    entity_id: workflowConfig.id,
  });

  return NextResponse.json({
    success: true,
    workflowConfig: {
      id: workflowConfig.id,
      organizationId: workflowConfig.organization_id,
      workflowType: workflowConfig.workflow_type,
      n8nWebhookUrl: workflowConfig.n8n_webhook_url,
      n8nWorkflowId: workflowConfig.n8n_workflow_id,
      status: workflowConfig.status,
      createdAt: workflowConfig.created_at,
      updatedAt: workflowConfig.updated_at,
    },
  });
}
