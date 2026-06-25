import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { canCreateWorkspaceRecords } from "@/lib/auth/workspace-permissions";
import {
  brokerContractStatusLabels,
  brokerContractStatuses,
  brokerPremiumFrequencies,
  isBrokerContractStatus,
} from "@/lib/broker/contracts";
import { logBrokerActivity, requireBrokerApiContext } from "@/lib/broker/server";
import type { Database } from "@/types/database";

type BrokerContractUpdate =
  Database["public"]["Tables"]["broker_contracts"]["Update"];

type RouteContext = { params: Promise<{ id: string; contractId: string }> };

const dateString = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Date invalide")
  .optional()
  .nullable();

const schema = z.object({
  insurerName: z.string().trim().max(160).optional().nullable(),
  productName: z.string().trim().max(200).optional().nullable(),
  insuranceType: z.string().trim().max(40).optional().nullable(),
  policyNumber: z.string().trim().max(120).optional().nullable(),
  status: z.enum(brokerContractStatuses).optional(),
  effectiveDate: dateString,
  renewalDate: dateString,
  premiumAmount: z.number().nonnegative().optional().nullable(),
  premiumFrequency: z.enum(brokerPremiumFrequencies).optional(),
  currency: z.string().trim().max(8).optional(),
  tacitRenewal: z.boolean().optional(),
  commissionRate: z.number().min(0).max(100).optional().nullable(),
  documentId: z.string().uuid().optional().nullable(),
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
      "Votre rôle ne permet pas de modifier ce contrat.",
      403,
      "insufficient_role",
    );
  }

  const { id: clientId, contractId } = await ctx.params;

  const body: unknown = await request.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return jsonError("Modification invalide.", 400, "invalid_payload");
  }
  const values = parsed.data;

  const { data: existing } = await auth.adminSupabase
    .from("broker_contracts")
    .select("id, status")
    .eq("organization_id", auth.organizationId)
    .eq("client_id", clientId)
    .eq("id", contractId)
    .maybeSingle();

  if (!existing) {
    return jsonError("Contrat introuvable.", 404, "contract_not_found");
  }

  if (values.documentId) {
    const { data: doc } = await auth.adminSupabase
      .from("broker_documents")
      .select("id")
      .eq("organization_id", auth.organizationId)
      .eq("client_id", clientId)
      .eq("id", values.documentId)
      .maybeSingle();
    if (!doc) {
      return jsonError("Document source introuvable.", 404, "document_not_found");
    }
  }

  const update: BrokerContractUpdate = { updated_at: new Date().toISOString() };

  if (values.insurerName !== undefined)
    update.insurer_name = trimmedOrNull(values.insurerName);
  if (values.productName !== undefined)
    update.product_name = trimmedOrNull(values.productName);
  if (values.insuranceType !== undefined)
    update.insurance_type = trimmedOrNull(values.insuranceType);
  if (values.policyNumber !== undefined)
    update.policy_number = trimmedOrNull(values.policyNumber);
  if (values.status !== undefined) update.status = values.status;
  if (values.effectiveDate !== undefined)
    update.effective_date = values.effectiveDate;
  if (values.renewalDate !== undefined)
    update.renewal_date = values.renewalDate;
  if (values.premiumAmount !== undefined)
    update.premium_amount = values.premiumAmount;
  if (values.premiumFrequency !== undefined)
    update.premium_frequency = values.premiumFrequency;
  if (values.currency !== undefined && values.currency)
    update.currency = values.currency.trim();
  if (values.tacitRenewal !== undefined)
    update.tacit_renewal = values.tacitRenewal;
  if (values.commissionRate !== undefined)
    update.commission_rate = values.commissionRate;
  if (values.documentId !== undefined)
    update.document_id = values.documentId ?? null;
  if (values.notes !== undefined) update.notes = trimmedOrNull(values.notes);

  const { error } = await auth.adminSupabase
    .from("broker_contracts")
    .update(update)
    .eq("organization_id", auth.organizationId)
    .eq("id", contractId);

  if (error) {
    return jsonError("Modification impossible.", 500, error.message);
  }

  if (
    values.status &&
    values.status !== existing.status &&
    isBrokerContractStatus(values.status)
  ) {
    await logBrokerActivity(auth.adminSupabase, {
      organizationId: auth.organizationId,
      clientId,
      userId: auth.user.id,
      type:
        values.status === "terminated"
          ? "contract_terminated"
          : "contract_updated",
      description: `Contrat — statut : ${brokerContractStatusLabels[values.status]}.`,
      metadata: { contract_id: contractId, status: values.status },
    });
  }

  return NextResponse.json({ success: true });
}

export async function DELETE(_request: NextRequest, ctx: RouteContext) {
  const auth = await requireBrokerApiContext();
  if (!auth.success) return jsonError(auth.message, auth.status, auth.reason);

  if (auth.context.membership?.role !== "manager") {
    return jsonError(
      "Seul un gestionnaire peut supprimer un contrat.",
      403,
      "insufficient_role",
    );
  }

  const { id: clientId, contractId } = await ctx.params;

  const { error } = await auth.adminSupabase
    .from("broker_contracts")
    .delete()
    .eq("organization_id", auth.organizationId)
    .eq("client_id", clientId)
    .eq("id", contractId);

  if (error) {
    return jsonError("Suppression impossible.", 500, error.message);
  }

  return NextResponse.json({ success: true });
}
