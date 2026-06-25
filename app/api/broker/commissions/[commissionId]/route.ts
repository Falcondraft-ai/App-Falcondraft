import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { canCreateWorkspaceRecords } from "@/lib/auth/workspace-permissions";
import { brokerCommissionStatuses } from "@/lib/broker/commissions";
import { requireBrokerApiContext } from "@/lib/broker/server";
import type { Database } from "@/types/database";

type CommissionUpdate =
  Database["public"]["Tables"]["broker_commissions"]["Update"];

type RouteContext = { params: Promise<{ commissionId: string }> };

const schema = z.object({
  contractId: z.string().uuid().optional().nullable(),
  clientId: z.string().uuid().optional().nullable(),
  insurerName: z.string().trim().max(160).optional().nullable(),
  label: z.string().trim().max(200).optional().nullable(),
  baseAmount: z.number().nonnegative().optional().nullable(),
  rate: z.number().min(0).max(100).optional().nullable(),
  commissionAmount: z.number().optional().nullable(),
  retrocessionRate: z.number().min(0).max(100).optional().nullable(),
  retrocessionAmount: z.number().optional().nullable(),
  retrocessionBeneficiary: z.string().trim().max(160).optional().nullable(),
  periodLabel: z.string().trim().max(80).optional().nullable(),
  currency: z.string().trim().max(8).optional(),
  status: z.enum(brokerCommissionStatuses).optional(),
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
      "Votre rôle ne permet pas de modifier cette commission.",
      403,
      "insufficient_role",
    );
  }

  const { commissionId } = await ctx.params;

  const body: unknown = await request.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return jsonError("Modification invalide.", 400, "invalid_payload");
  }
  const values = parsed.data;

  const { data: existing } = await auth.adminSupabase
    .from("broker_commissions")
    .select("id")
    .eq("organization_id", auth.organizationId)
    .eq("id", commissionId)
    .maybeSingle();

  if (!existing) {
    return jsonError("Commission introuvable.", 404, "commission_not_found");
  }

  const update: CommissionUpdate = { updated_at: new Date().toISOString() };

  if (values.contractId !== undefined)
    update.contract_id = values.contractId ?? null;
  if (values.clientId !== undefined) update.client_id = values.clientId ?? null;
  if (values.insurerName !== undefined)
    update.insurer_name = trimmedOrNull(values.insurerName);
  if (values.label !== undefined) update.label = trimmedOrNull(values.label);
  if (values.baseAmount !== undefined) update.base_amount = values.baseAmount;
  if (values.rate !== undefined) update.rate = values.rate;
  if (values.commissionAmount !== undefined)
    update.commission_amount = values.commissionAmount;
  if (values.retrocessionRate !== undefined)
    update.retrocession_rate = values.retrocessionRate;
  if (values.retrocessionAmount !== undefined)
    update.retrocession_amount = values.retrocessionAmount;
  if (values.retrocessionBeneficiary !== undefined)
    update.retrocession_beneficiary = trimmedOrNull(
      values.retrocessionBeneficiary,
    );
  if (values.periodLabel !== undefined)
    update.period_label = trimmedOrNull(values.periodLabel);
  if (values.currency !== undefined && values.currency)
    update.currency = values.currency.trim();
  if (values.status !== undefined) update.status = values.status;
  if (values.notes !== undefined) update.notes = trimmedOrNull(values.notes);

  const { error } = await auth.adminSupabase
    .from("broker_commissions")
    .update(update)
    .eq("organization_id", auth.organizationId)
    .eq("id", commissionId);

  if (error) {
    return jsonError("Modification impossible.", 500, error.message);
  }

  return NextResponse.json({ success: true });
}

export async function DELETE(_request: NextRequest, ctx: RouteContext) {
  const auth = await requireBrokerApiContext();
  if (!auth.success) return jsonError(auth.message, auth.status, auth.reason);

  if (!canCreateWorkspaceRecords(auth.context.membership?.role)) {
    return jsonError(
      "Votre rôle ne permet pas de supprimer cette commission.",
      403,
      "insufficient_role",
    );
  }

  const { commissionId } = await ctx.params;

  const { error } = await auth.adminSupabase
    .from("broker_commissions")
    .delete()
    .eq("organization_id", auth.organizationId)
    .eq("id", commissionId);

  if (error) {
    return jsonError("Suppression impossible.", 500, error.message);
  }

  return NextResponse.json({ success: true });
}
