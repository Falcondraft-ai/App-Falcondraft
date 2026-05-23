import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { createQuoteRequestSchema } from "@/lib/billing/validation";
import { createQontoQuote } from "@/lib/billing/providers/qonto";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/types/database";
import type { SupabaseClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

function jsonError(
  message: string,
  status: number,
  reason?: string,
  details?: Record<string, unknown>,
) {
  return NextResponse.json(
    { success: false, message, reason, ...details },
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

function isValidSecret(requestSecret: string, configuredSecret: string): boolean {
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

async function verifyOrganizationExists(
  adminSupabase: SupabaseClient<Database>,
  organizationId: string,
): Promise<void> {
  const { data, error } = await adminSupabase
    .from("organizations")
    .select("id")
    .eq("id", organizationId)
    .maybeSingle();

  if (error || !data) {
    throw Object.assign(
      new Error("Organisation introuvable."),
      { status: 404, reason: "organization_not_found" },
    );
  }
}

async function verifyDealBelongsToOrg(
  adminSupabase: SupabaseClient<Database>,
  dealId: string,
  organizationId: string,
): Promise<void> {
  const { data, error } = await adminSupabase
    .from("deals")
    .select("id")
    .eq("id", dealId)
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (error || !data) {
    throw Object.assign(
      new Error("Deal introuvable ou n'appartient pas à cette organisation."),
      { status: 404, reason: "deal_not_found" },
    );
  }
}

async function verifyWorkflowRunBelongsToOrg(
  adminSupabase: SupabaseClient<Database>,
  workflowRunId: string,
  organizationId: string,
): Promise<void> {
  const { data, error } = await adminSupabase
    .from("workflow_runs")
    .select("id")
    .eq("id", workflowRunId)
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (error || !data) {
    throw Object.assign(
      new Error(
        "Workflow run introuvable ou n'appartient pas à cette organisation.",
      ),
      { status: 404, reason: "workflow_run_not_found" },
    );
  }
}

export async function POST(request: NextRequest) {
  const configuredSecret = getConfiguredSecret();

  if (!configuredSecret) {
    console.error("N8N_BILLING_SECRET is not configured.");
    return jsonError(
      "Le endpoint de création de devis n'est pas configuré.",
      500,
      "endpoint_unconfigured",
    );
  }

  if (!isValidSecret(getRequestSecret(request), configuredSecret)) {
    console.warn("Rejected unauthorized n8n create-quote request.");
    return jsonError("Non autorisé.", 401, "unauthorized");
  }

  const adminSupabase = getSupabaseAdminClient();

  if (!adminSupabase) {
    return jsonError(
      "Le endpoint de création de devis n'est pas configuré.",
      500,
      "service_role_unconfigured",
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("Corps de requête JSON invalide.", 400, "invalid_json");
  }

  const parsed = createQuoteRequestSchema.safeParse(body);

  if (!parsed.success) {
    console.warn("Rejected invalid n8n create-quote payload.", {
      issues: parsed.error.issues.map((i) => i.message),
    });

    return jsonError(
      "Payload de création de devis invalide.",
      400,
      "invalid_payload",
      {
        validation_errors: parsed.error.issues.map((i) => ({
          path: i.path.join("."),
          message: i.message,
        })),
      },
    );
  }

  try {
    await verifyOrganizationExists(
      adminSupabase,
      parsed.data.organization_id,
    );

    if (parsed.data.deal_id) {
      await verifyDealBelongsToOrg(
        adminSupabase,
        parsed.data.deal_id,
        parsed.data.organization_id,
      );
    }

    if (parsed.data.workflow_run_id) {
      await verifyWorkflowRunBelongsToOrg(
        adminSupabase,
        parsed.data.workflow_run_id,
        parsed.data.organization_id,
      );
    }

    const result = await createQontoQuote(adminSupabase, body);

    console.info("Qonto quote created via n8n.", {
      organization_id: parsed.data.organization_id,
      deal_id: parsed.data.deal_id ?? null,
      workflow_run_id: parsed.data.workflow_run_id ?? null,
      quote_id: result.quote_id,
      quote_number: result.quote_number,
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Erreur interne.";

    console.error("Failed to create Qonto quote.", {
      organization_id: parsed.data.organization_id,
      deal_id: parsed.data.deal_id ?? null,
      reason: message,
    });

    if (error instanceof Error && "status" in error) {
      const err = error as Error & { status?: number; reason?: string };
      return jsonError(message, err.status ?? 500, err.reason);
    }

    return jsonError(
      "Erreur lors de la création du devis.",
      502,
      "quote_creation_failed",
    );
  }
}
