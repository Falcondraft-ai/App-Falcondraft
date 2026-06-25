import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { canCreateWorkspaceRecords } from "@/lib/auth/workspace-permissions";
import { brokerStatementStatuses } from "@/lib/broker/commissions";
import { requireBrokerApiContext } from "@/lib/broker/server";
import type { Database } from "@/types/database";

type StatementUpdate =
  Database["public"]["Tables"]["broker_commission_statements"]["Update"];

type RouteContext = { params: Promise<{ statementId: string }> };

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
  reconcile: z.boolean().optional(),
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
      "Votre rôle ne permet pas de modifier ce bordereau.",
      403,
      "insufficient_role",
    );
  }

  const { statementId } = await ctx.params;

  const body: unknown = await request.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return jsonError("Modification invalide.", 400, "invalid_payload");
  }
  const values = parsed.data;

  const { data: existing } = await auth.adminSupabase
    .from("broker_commission_statements")
    .select("id")
    .eq("organization_id", auth.organizationId)
    .eq("id", statementId)
    .maybeSingle();

  if (!existing) {
    return jsonError("Bordereau introuvable.", 404, "statement_not_found");
  }

  const update: StatementUpdate = { updated_at: new Date().toISOString() };

  if (values.insurerName !== undefined)
    update.insurer_name = trimmedOrNull(values.insurerName);
  if (values.periodLabel !== undefined)
    update.period_label = trimmedOrNull(values.periodLabel);
  if (values.periodStart !== undefined) update.period_start = values.periodStart;
  if (values.periodEnd !== undefined) update.period_end = values.periodEnd;
  if (values.totalAmount !== undefined) update.total_amount = values.totalAmount;
  if (values.currency !== undefined && values.currency)
    update.currency = values.currency.trim();
  if (values.notes !== undefined) update.notes = trimmedOrNull(values.notes);
  if (values.status !== undefined) update.status = values.status;

  if (values.reconcile) {
    update.status = "reconciled";
    update.reconciled_at = new Date().toISOString();
    update.reconciled_by = auth.user.id;
  }

  const { error } = await auth.adminSupabase
    .from("broker_commission_statements")
    .update(update)
    .eq("organization_id", auth.organizationId)
    .eq("id", statementId);

  if (error) {
    return jsonError("Modification impossible.", 500, error.message);
  }

  return NextResponse.json({ success: true });
}

export async function DELETE(_request: NextRequest, ctx: RouteContext) {
  const auth = await requireBrokerApiContext();
  if (!auth.success) return jsonError(auth.message, auth.status, auth.reason);

  if (auth.context.membership?.role !== "manager") {
    return jsonError(
      "Seul un gestionnaire peut supprimer un bordereau.",
      403,
      "insufficient_role",
    );
  }

  const { statementId } = await ctx.params;

  // Detach the lines (keep them as standalone commissions) before deleting.
  await auth.adminSupabase
    .from("broker_commissions")
    .update({ statement_id: null, updated_at: new Date().toISOString() })
    .eq("organization_id", auth.organizationId)
    .eq("statement_id", statementId);

  const { error } = await auth.adminSupabase
    .from("broker_commission_statements")
    .delete()
    .eq("organization_id", auth.organizationId)
    .eq("id", statementId);

  if (error) {
    return jsonError("Suppression impossible.", 500, error.message);
  }

  return NextResponse.json({ success: true });
}
