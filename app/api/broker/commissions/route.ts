import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { canCreateWorkspaceRecords } from "@/lib/auth/workspace-permissions";
import { brokerCommissionStatuses } from "@/lib/broker/commissions";
import {
  type IntroducerLite,
  resolveRetrocession,
} from "@/lib/broker/introducers";
import { logBrokerActivity, requireBrokerApiContext } from "@/lib/broker/server";

const schema = z.object({
  statementId: z.string().uuid().optional().nullable(),
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

async function belongsToOrg(
  auth: Extract<
    Awaited<ReturnType<typeof requireBrokerApiContext>>,
    { success: true }
  >,
  table: "broker_commission_statements" | "broker_contracts" | "broker_clients",
  id: string,
): Promise<boolean> {
  const { data } = await auth.adminSupabase
    .from(table)
    .select("id")
    .eq("organization_id", auth.organizationId)
    .eq("id", id)
    .maybeSingle();
  return Boolean(data);
}

export async function POST(request: NextRequest) {
  const auth = await requireBrokerApiContext();
  if (!auth.success) return jsonError(auth.message, auth.status, auth.reason);

  if (!canCreateWorkspaceRecords(auth.context.membership?.role)) {
    return jsonError(
      "Votre rôle ne permet pas d’ajouter une commission.",
      403,
      "insufficient_role",
    );
  }

  const body: unknown = await request.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return jsonError("Requête invalide.", 400, "invalid_payload");
  }
  const values = parsed.data;

  if (
    values.statementId &&
    !(await belongsToOrg(auth, "broker_commission_statements", values.statementId))
  ) {
    return jsonError("Bordereau introuvable.", 404, "statement_not_found");
  }
  if (
    values.contractId &&
    !(await belongsToOrg(auth, "broker_contracts", values.contractId))
  ) {
    return jsonError("Contrat introuvable.", 404, "contract_not_found");
  }
  // Resolve the retrocession: when the client has an introducer, link it and
  // auto-compute the retrocession unless an amount was entered by hand.
  let resolvedRetro = resolveRetrocession({
    commissionAmount: values.commissionAmount ?? null,
    retrocessionAmount: values.retrocessionAmount ?? null,
    retrocessionRate: values.retrocessionRate ?? null,
    retrocessionBeneficiary: values.retrocessionBeneficiary ?? null,
    introducer: null,
  });
  if (values.clientId) {
    const { data: clientRow } = await auth.adminSupabase
      .from("broker_clients")
      .select("introducer_id")
      .eq("organization_id", auth.organizationId)
      .eq("id", values.clientId)
      .maybeSingle();
    if (!clientRow) {
      return jsonError("Dossier introuvable.", 404, "client_not_found");
    }
    let introducer: IntroducerLite | null = null;
    if (clientRow.introducer_id) {
      const { data: intro } = await auth.adminSupabase
        .from("broker_introducers")
        .select("id, name, retrocession_rate")
        .eq("organization_id", auth.organizationId)
        .eq("id", clientRow.introducer_id)
        .maybeSingle();
      if (intro) {
        introducer = {
          id: intro.id,
          name: intro.name,
          rate: intro.retrocession_rate,
        };
      }
    }
    resolvedRetro = resolveRetrocession({
      commissionAmount: values.commissionAmount ?? null,
      retrocessionAmount: values.retrocessionAmount ?? null,
      retrocessionRate: values.retrocessionRate ?? null,
      retrocessionBeneficiary: values.retrocessionBeneficiary ?? null,
      introducer,
    });
  }

  const { data: commission, error } = await auth.adminSupabase
    .from("broker_commissions")
    .insert({
      organization_id: auth.organizationId,
      created_by: auth.user.id,
      statement_id: values.statementId ?? null,
      contract_id: values.contractId ?? null,
      client_id: values.clientId ?? null,
      insurer_name: values.insurerName?.trim() || null,
      label: values.label?.trim() || null,
      base_amount: values.baseAmount ?? null,
      rate: values.rate ?? null,
      commission_amount: values.commissionAmount ?? null,
      retrocession_rate: resolvedRetro.retrocession_rate,
      retrocession_amount: resolvedRetro.retrocession_amount,
      retrocession_beneficiary: resolvedRetro.retrocession_beneficiary,
      introducer_id: resolvedRetro.introducer_id,
      period_label: values.periodLabel?.trim() || null,
      currency: values.currency?.trim() || "EUR",
      status: values.status ?? "expected",
      notes: values.notes?.trim() || null,
    })
    .select("id")
    .single();

  if (error || !commission) {
    return jsonError(
      "Création de la commission impossible.",
      500,
      error?.message ?? "insert_failed",
    );
  }

  if (values.clientId) {
    await logBrokerActivity(auth.adminSupabase, {
      organizationId: auth.organizationId,
      clientId: values.clientId,
      userId: auth.user.id,
      profileId: auth.profileId,
      type: "commission_added",
      description: "Commission enregistrée pour ce dossier.",
      metadata: { commission_id: commission.id },
    });
  }

  return NextResponse.json({ success: true, commissionId: commission.id });
}
