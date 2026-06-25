import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { canCreateWorkspaceRecords } from "@/lib/auth/workspace-permissions";
import { brokerStatementStatuses } from "@/lib/broker/commissions";
import { requireBrokerApiContext } from "@/lib/broker/server";

const dateString = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Date invalide")
  .optional()
  .nullable();

const schema = z.object({
  insurerName: z.string().trim().max(160).optional().nullable(),
  periodLabel: z.string().trim().max(80).optional().nullable(),
  periodStart: dateString,
  periodEnd: dateString,
  totalAmount: z.number().nonnegative().optional().nullable(),
  currency: z.string().trim().max(8).optional(),
  status: z.enum(brokerStatementStatuses).optional(),
  notes: z.string().trim().max(5000).optional().nullable(),
});

function jsonError(message: string, status: number, reason: string) {
  return NextResponse.json({ success: false, message, reason }, { status });
}

export async function POST(request: NextRequest) {
  const auth = await requireBrokerApiContext();
  if (!auth.success) return jsonError(auth.message, auth.status, auth.reason);

  if (!canCreateWorkspaceRecords(auth.context.membership?.role)) {
    return jsonError(
      "Votre rôle ne permet pas d’ajouter un bordereau.",
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

  const { data: statement, error } = await auth.adminSupabase
    .from("broker_commission_statements")
    .insert({
      organization_id: auth.organizationId,
      created_by: auth.user.id,
      insurer_name: values.insurerName?.trim() || null,
      period_label: values.periodLabel?.trim() || null,
      period_start: values.periodStart ?? null,
      period_end: values.periodEnd ?? null,
      total_amount: values.totalAmount ?? null,
      currency: values.currency?.trim() || "EUR",
      status: values.status ?? "received",
      notes: values.notes?.trim() || null,
    })
    .select("id")
    .single();

  if (error || !statement) {
    return jsonError(
      "Création du bordereau impossible.",
      500,
      error?.message ?? "insert_failed",
    );
  }

  return NextResponse.json({ success: true, statementId: statement.id });
}
