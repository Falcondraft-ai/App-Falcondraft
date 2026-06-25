import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { canCreateWorkspaceRecords } from "@/lib/auth/workspace-permissions";
import { brokerClaimStatuses } from "@/lib/broker/claims";
import { logBrokerActivity, requireBrokerApiContext } from "@/lib/broker/server";

type RouteContext = { params: Promise<{ id: string }> };

const dateString = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Date invalide")
  .optional()
  .nullable();

const schema = z.object({
  contractId: z.string().uuid().optional().nullable(),
  insurerName: z.string().trim().max(160).optional().nullable(),
  claimType: z.string().trim().max(120).optional().nullable(),
  reference: z.string().trim().max(120).optional().nullable(),
  status: z.enum(brokerClaimStatuses).optional(),
  occurrenceDate: dateString,
  declarationDate: dateString,
  amountEstimate: z.number().nonnegative().optional().nullable(),
  amountSettled: z.number().nonnegative().optional().nullable(),
  currency: z.string().trim().max(8).optional(),
  description: z.string().trim().max(5000).optional().nullable(),
  notes: z.string().trim().max(5000).optional().nullable(),
});

function jsonError(message: string, status: number, reason: string) {
  return NextResponse.json({ success: false, message, reason }, { status });
}

export async function POST(request: NextRequest, ctx: RouteContext) {
  const auth = await requireBrokerApiContext();
  if (!auth.success) return jsonError(auth.message, auth.status, auth.reason);

  if (!canCreateWorkspaceRecords(auth.context.membership?.role)) {
    return jsonError(
      "Votre rôle ne permet pas de déclarer un sinistre.",
      403,
      "insufficient_role",
    );
  }

  const { id: clientId } = await ctx.params;

  const body: unknown = await request.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return jsonError("Requête invalide.", 400, "invalid_payload");
  }
  const values = parsed.data;

  const { data: client } = await auth.adminSupabase
    .from("broker_clients")
    .select("id")
    .eq("organization_id", auth.organizationId)
    .eq("id", clientId)
    .maybeSingle();

  if (!client) {
    return jsonError("Dossier introuvable.", 404, "client_not_found");
  }

  if (values.contractId) {
    const { data: contract } = await auth.adminSupabase
      .from("broker_contracts")
      .select("id")
      .eq("organization_id", auth.organizationId)
      .eq("client_id", clientId)
      .eq("id", values.contractId)
      .maybeSingle();
    if (!contract) {
      return jsonError("Contrat introuvable.", 404, "contract_not_found");
    }
  }

  const { data: claim, error } = await auth.adminSupabase
    .from("broker_claims")
    .insert({
      organization_id: auth.organizationId,
      client_id: clientId,
      contract_id: values.contractId ?? null,
      created_by: auth.user.id,
      insurer_name: values.insurerName?.trim() || null,
      claim_type: values.claimType?.trim() || null,
      reference: values.reference?.trim() || null,
      status: values.status ?? "declared",
      occurrence_date: values.occurrenceDate ?? null,
      declaration_date: values.declarationDate ?? null,
      amount_estimate: values.amountEstimate ?? null,
      amount_settled: values.amountSettled ?? null,
      currency: values.currency?.trim() || "EUR",
      description: values.description?.trim() || null,
      notes: values.notes?.trim() || null,
    })
    .select("id")
    .single();

  if (error || !claim) {
    return jsonError(
      "Déclaration du sinistre impossible.",
      500,
      error?.message ?? "insert_failed",
    );
  }

  await logBrokerActivity(auth.adminSupabase, {
    organizationId: auth.organizationId,
    clientId,
    userId: auth.user.id,
    type: "claim_declared",
    description: values.claimType?.trim()
      ? `Sinistre déclaré — ${values.claimType.trim()}.`
      : "Sinistre déclaré.",
    metadata: { claim_id: claim.id },
  });

  return NextResponse.json({ success: true, claimId: claim.id });
}
