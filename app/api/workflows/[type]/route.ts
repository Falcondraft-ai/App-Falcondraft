import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getSupabaseServerClient } from "@/lib/supabase/server";

const callSummaryRequestSchema = z.object({
  dealId: z.string().uuid("dealId invalide."),
});

type RouteContext = {
  params: Promise<{
    type: string;
  }>;
};

function normalizeWorkflowType(type: string) {
  return type === "call-summary" ? "call_summary" : type;
}

function jsonError(message: string, status: number) {
  return NextResponse.json({ success: false, message }, { status });
}

export async function POST(request: NextRequest, context: RouteContext) {
  const { type } = await context.params;
  const workflowType = normalizeWorkflowType(type);

  if (workflowType !== "call_summary") {
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

  const body: unknown = await request.json().catch(() => ({}));
  const parsedBody = callSummaryRequestSchema.safeParse(body);

  if (!parsedBody.success) {
    return jsonError("La demande de génération est incomplète.", 400);
  }

  const { data: membership } = await supabase
    .from("organization_members")
    .select("*")
    .eq("profile_id", user.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!membership) {
    return jsonError("Aucun espace client associé.", 403);
  }

  const organizationId = membership.organization_id;
  const { dealId } = parsedBody.data;

  const { data: deal } = await supabase
    .from("deals")
    .select("id")
    .eq("id", dealId)
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (!deal) {
    return jsonError("Dossier commercial introuvable.", 404);
  }

  const startedAt = new Date().toISOString();
  const { data: workflowRun, error: workflowRunError } = await supabase
    .from("workflow_runs")
    .insert({
      organization_id: organizationId,
      deal_id: dealId,
      type: workflowType,
      status: "pending",
      started_at: startedAt,
      metadata: {},
    })
    .select("id")
    .single();

  if (workflowRunError || !workflowRun) {
    return jsonError("Impossible de créer l’exécution du workflow.", 500);
  }

  const { data: workflowConfig } = await supabase
    .from("workflow_configs")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("workflow_type", workflowType)
    .eq("status", "active")
    .maybeSingle();

  if (!workflowConfig) {
    return jsonError("Configuration du workflow introuvable.", 404);
  }

  const webhookResponse = await fetch(workflowConfig.n8n_webhook_url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      organizationId,
      dealId,
      workflowType,
      workflowRunId: workflowRun.id,
    }),
  }).catch(() => null);

  if (!webhookResponse?.ok) {
    await supabase
      .from("workflow_runs")
      .update({
        status: "failed",
        safe_status_message: "Le déclenchement du workflow a échoué.",
      })
      .eq("id", workflowRun.id)
      .eq("organization_id", organizationId);

    return jsonError("Le déclenchement du workflow a échoué.", 502);
  }

  return NextResponse.json({
    success: true,
    workflowRunId: workflowRun.id,
  });
}
