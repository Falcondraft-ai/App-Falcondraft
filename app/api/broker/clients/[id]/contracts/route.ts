import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { canCreateWorkspaceRecords } from "@/lib/auth/workspace-permissions";
import {
  brokerContractStatuses,
  brokerPremiumFrequencies,
} from "@/lib/broker/contracts";
import { logBrokerActivity, requireBrokerApiContext } from "@/lib/broker/server";

type RouteContext = { params: Promise<{ id: string }> };

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

export async function POST(request: NextRequest, ctx: RouteContext) {
  const auth = await requireBrokerApiContext();
  if (!auth.success) return jsonError(auth.message, auth.status, auth.reason);

  if (!canCreateWorkspaceRecords(auth.context.membership?.role)) {
    return jsonError(
      "Votre rôle ne permet pas d’ajouter un contrat.",
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

  const { data: contract, error } = await auth.adminSupabase
    .from("broker_contracts")
    .insert({
      organization_id: auth.organizationId,
      client_id: clientId,
      created_by: auth.user.id,
      document_id: values.documentId ?? null,
      insurer_name: values.insurerName?.trim() || null,
      product_name: values.productName?.trim() || null,
      insurance_type: values.insuranceType?.trim() || null,
      policy_number: values.policyNumber?.trim() || null,
      status: values.status ?? "active",
      effective_date: values.effectiveDate ?? null,
      renewal_date: values.renewalDate ?? null,
      premium_amount: values.premiumAmount ?? null,
      premium_frequency: values.premiumFrequency ?? "annual",
      currency: values.currency?.trim() || "EUR",
      tacit_renewal: values.tacitRenewal ?? true,
      commission_rate: values.commissionRate ?? null,
      notes: values.notes?.trim() || null,
    })
    .select("id")
    .single();

  if (error || !contract) {
    return jsonError(
      "Création du contrat impossible.",
      500,
      error?.message ?? "insert_failed",
    );
  }

  await logBrokerActivity(auth.adminSupabase, {
    organizationId: auth.organizationId,
    clientId,
    userId: auth.user.id,
    type: "contract_created",
    description: values.insurerName?.trim()
      ? `Contrat ajouté — ${values.insurerName.trim()}.`
      : "Contrat ajouté au dossier.",
    metadata: { contract_id: contract.id },
  });

  return NextResponse.json({ success: true, contractId: contract.id });
}
