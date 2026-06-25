import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { canCreateWorkspaceRecords } from "@/lib/auth/workspace-permissions";
import { logBrokerActivity, requireBrokerApiContext } from "@/lib/broker/server";
import type { Database } from "@/types/database";

type BrokerQuoteUpdate =
  Database["public"]["Tables"]["broker_quotes"]["Update"];

type RouteContext = { params: Promise<{ id: string; quoteId: string }> };

const schema = z.object({
  insurerName: z.string().trim().max(160).optional().nullable(),
  productName: z.string().trim().max(200).optional().nullable(),
  premiumMonthly: z.number().nonnegative().nullable().optional(),
  premiumAnnual: z.number().nonnegative().nullable().optional(),
  currency: z.string().trim().max(8).optional(),
  coverageSummary: z.string().trim().max(5000).optional().nullable(),
  deductible: z.string().trim().max(255).optional().nullable(),
  notes: z.string().trim().max(5000).optional().nullable(),
  validate: z.boolean().optional(),
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
      "Votre rôle ne permet pas de modifier ce devis.",
      403,
      "insufficient_role",
    );
  }

  const { id: clientId, quoteId } = await ctx.params;

  const body: unknown = await request.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return jsonError("Modification invalide.", 400, "invalid_payload");
  }
  const values = parsed.data;

  const { data: existing } = await auth.adminSupabase
    .from("broker_quotes")
    .select("id, extraction_status")
    .eq("organization_id", auth.organizationId)
    .eq("client_id", clientId)
    .eq("id", quoteId)
    .maybeSingle();

  if (!existing) {
    return jsonError("Devis introuvable.", 404, "quote_not_found");
  }

  const update: BrokerQuoteUpdate = { updated_at: new Date().toISOString() };

  if (values.insurerName !== undefined)
    update.insurer_name = trimmedOrNull(values.insurerName);
  if (values.productName !== undefined)
    update.product_name = trimmedOrNull(values.productName);
  if (values.premiumMonthly !== undefined)
    update.premium_monthly = values.premiumMonthly;
  if (values.premiumAnnual !== undefined)
    update.premium_annual = values.premiumAnnual;
  if (values.currency !== undefined && values.currency)
    update.currency = values.currency;
  if (values.coverageSummary !== undefined)
    update.coverage_summary = trimmedOrNull(values.coverageSummary);
  if (values.deductible !== undefined)
    update.deductible = trimmedOrNull(values.deductible);
  if (values.notes !== undefined) update.notes = trimmedOrNull(values.notes);

  if (values.validate) {
    update.extraction_status = "validated";
    update.validated_by = auth.user.id;
    update.validated_at = new Date().toISOString();
  }

  const { error } = await auth.adminSupabase
    .from("broker_quotes")
    .update(update)
    .eq("organization_id", auth.organizationId)
    .eq("id", quoteId);

  if (error) {
    return jsonError("Modification impossible.", 500, error.message);
  }

  if (values.validate && existing.extraction_status !== "validated") {
    await logBrokerActivity(auth.adminSupabase, {
      organizationId: auth.organizationId,
      clientId,
      userId: auth.user.id,
      type: "quote_validated",
      description: "Devis compagnie vérifié et validé.",
      metadata: { quote_id: quoteId },
    });
  }

  return NextResponse.json({ success: true });
}

export async function DELETE(_request: NextRequest, ctx: RouteContext) {
  const auth = await requireBrokerApiContext();
  if (!auth.success) return jsonError(auth.message, auth.status, auth.reason);

  if (auth.context.membership?.role !== "manager") {
    return jsonError(
      "Seul un gestionnaire peut supprimer un devis.",
      403,
      "insufficient_role",
    );
  }

  const { id: clientId, quoteId } = await ctx.params;

  const { error } = await auth.adminSupabase
    .from("broker_quotes")
    .delete()
    .eq("organization_id", auth.organizationId)
    .eq("client_id", clientId)
    .eq("id", quoteId);

  if (error) {
    return jsonError("Suppression impossible.", 500, error.message);
  }

  return NextResponse.json({ success: true });
}
