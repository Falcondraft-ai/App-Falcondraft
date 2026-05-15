import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { requireInternalAdminContext } from "@/lib/internal-admin/server";
import { workflowConfigStatuses } from "@/lib/internal-admin/workflows";

const workflowConfigIdSchema = z.string().uuid();
const workflowConfigUpdateSchema = z.object({
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
  const parsedId = workflowConfigIdSchema.safeParse(id);

  if (!parsedId.success) {
    return jsonError("Configuration invalide.", 400, "invalid_config_id");
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
  const parsedBody = workflowConfigUpdateSchema.safeParse(body);

  if (!parsedBody.success) {
    return jsonError(
      "URL https et statut sont requis.",
      400,
      "invalid_payload",
    );
  }

  const { data: existingConfig, error: existingConfigError } =
    await internalAdmin.adminSupabase
      .from("workflow_configs")
      .select("id, organization_id")
      .eq("id", parsedId.data)
      .maybeSingle();

  if (existingConfigError) {
    return jsonError(
      "Lecture de la configuration impossible.",
      500,
      existingConfigError.message,
    );
  }

  if (!existingConfig) {
    return jsonError("Configuration introuvable.", 404, "config_not_found");
  }

  const values = parsedBody.data;
  const now = new Date().toISOString();
  const { data: workflowConfig, error } = await internalAdmin.adminSupabase
    .from("workflow_configs")
    .update({
      n8n_webhook_url: values.n8n_webhook_url,
      n8n_workflow_id: values.n8n_workflow_id?.trim() || null,
      status: values.status,
      updated_at: now,
    })
    .eq("id", existingConfig.id)
    .select("*")
    .single();

  if (error || !workflowConfig) {
    return jsonError(
      "Mise à jour de la configuration impossible.",
      500,
      error?.message ?? "update_failed",
    );
  }

  await internalAdmin.adminSupabase.from("audit_logs").insert({
    organization_id: workflowConfig.organization_id,
    user_id: internalAdmin.user.id,
    action: "workflow_config_updated",
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
