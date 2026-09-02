import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { canCreateWorkspaceRecords } from "@/lib/auth/workspace-permissions";
import {
  brokerClaimStatusLabels,
  brokerClaimStatuses,
  isBrokerClaimStatus,
} from "@/lib/broker/claims";
import { logBrokerActivity, requireBrokerApiContext } from "@/lib/broker/server";
import type { Database } from "@/types/database";

type BrokerClaimUpdate =
  Database["public"]["Tables"]["broker_claims"]["Update"];

type RouteContext = { params: Promise<{ id: string; claimId: string }> };

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

function trimmedOrNull(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export async function PATCH(request: NextRequest, ctx: RouteContext) {
  const auth = await requireBrokerApiContext();
  if (!auth.success) return jsonError(auth.message, auth.status, auth.reason);

  if (!canCreateWorkspaceRecords(auth.context.membership?.role)) {
    return jsonError(
      "Votre rôle ne permet pas de modifier ce sinistre.",
      403,
      "insufficient_role",
    );
  }

  const { id: clientId, claimId } = await ctx.params;

  const body: unknown = await request.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return jsonError("Modification invalide.", 400, "invalid_payload");
  }
  const values = parsed.data;

  const { data: existing } = await auth.adminSupabase
    .from("broker_claims")
    .select("id, status")
    .eq("organization_id", auth.organizationId)
    .eq("client_id", clientId)
    .eq("id", claimId)
    .maybeSingle();

  if (!existing) {
    return jsonError("Sinistre introuvable.", 404, "claim_not_found");
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

  const now = new Date().toISOString();
  const update: BrokerClaimUpdate = { updated_at: now };

  if (values.contractId !== undefined)
    update.contract_id = values.contractId ?? null;
  if (values.insurerName !== undefined)
    update.insurer_name = trimmedOrNull(values.insurerName);
  if (values.claimType !== undefined)
    update.claim_type = trimmedOrNull(values.claimType);
  if (values.reference !== undefined)
    update.reference = trimmedOrNull(values.reference);
  if (values.occurrenceDate !== undefined)
    update.occurrence_date = values.occurrenceDate;
  if (values.declarationDate !== undefined)
    update.declaration_date = values.declarationDate;
  if (values.amountEstimate !== undefined)
    update.amount_estimate = values.amountEstimate;
  if (values.amountSettled !== undefined)
    update.amount_settled = values.amountSettled;
  if (values.currency !== undefined && values.currency)
    update.currency = values.currency.trim();
  if (values.description !== undefined)
    update.description = trimmedOrNull(values.description);
  if (values.notes !== undefined) update.notes = trimmedOrNull(values.notes);

  if (values.status !== undefined) {
    update.status = values.status;
    if (values.status === "settled") update.settled_at = now;
    if (values.status === "closed") update.closed_at = now;
  }

  const { error } = await auth.adminSupabase
    .from("broker_claims")
    .update(update)
    .eq("organization_id", auth.organizationId)
    .eq("id", claimId);

  if (error) {
    return jsonError("Modification impossible.", 500, error.message);
  }

  if (
    values.status &&
    values.status !== existing.status &&
    isBrokerClaimStatus(values.status)
  ) {
    const type =
      values.status === "settled"
        ? "claim_settled"
        : values.status === "closed"
          ? "claim_closed"
          : "claim_updated";
    await logBrokerActivity(auth.adminSupabase, {
      organizationId: auth.organizationId,
      clientId,
      userId: auth.user.id,
      profileId: auth.profileId,
      type,
      description: `Sinistre — statut : ${brokerClaimStatusLabels[values.status]}.`,
      metadata: { claim_id: claimId, status: values.status },
    });
  }

  return NextResponse.json({ success: true });
}

export async function DELETE(_request: NextRequest, ctx: RouteContext) {
  const auth = await requireBrokerApiContext();
  if (!auth.success) return jsonError(auth.message, auth.status, auth.reason);

  if (auth.context.membership?.role !== "manager") {
    return jsonError(
      "Seul un gestionnaire peut supprimer un sinistre.",
      403,
      "insufficient_role",
    );
  }

  const { id: clientId, claimId } = await ctx.params;

  const { error } = await auth.adminSupabase
    .from("broker_claims")
    .delete()
    .eq("organization_id", auth.organizationId)
    .eq("client_id", clientId)
    .eq("id", claimId);

  if (error) {
    return jsonError("Suppression impossible.", 500, error.message);
  }

  return NextResponse.json({ success: true });
}
