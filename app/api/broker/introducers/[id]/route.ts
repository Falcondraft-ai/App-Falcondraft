import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { canCreateWorkspaceRecords } from "@/lib/auth/workspace-permissions";
import { requireBrokerApiContext } from "@/lib/broker/server";
import type { Database } from "@/types/database";

type IntroducerUpdate =
  Database["public"]["Tables"]["broker_introducers"]["Update"];

type RouteContext = { params: Promise<{ id: string }> };

const updateSchema = z.object({
  name: z.string().trim().min(1).max(160).optional(),
  retrocessionRate: z.number().min(0).max(100).optional().nullable(),
  email: z.string().trim().email().optional().or(z.literal("")),
  phone: z.string().trim().max(40).optional().nullable(),
  notes: z.string().trim().max(2000).optional().nullable(),
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
      "Votre rôle ne permet pas de modifier un apporteur.",
      403,
      "insufficient_role",
    );
  }

  const { id } = await ctx.params;
  const body: unknown = await request.json().catch(() => ({}));
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError("Modification invalide.", 400, "invalid_payload");
  }

  const { data: existing } = await auth.adminSupabase
    .from("broker_introducers")
    .select("id")
    .eq("organization_id", auth.organizationId)
    .eq("id", id)
    .maybeSingle();
  if (!existing) return jsonError("Apporteur introuvable.", 404, "not_found");

  const values = parsed.data;
  const update: IntroducerUpdate = { updated_at: new Date().toISOString() };
  if (values.name !== undefined) update.name = values.name.trim();
  if (values.retrocessionRate !== undefined)
    update.retrocession_rate = values.retrocessionRate;
  if (values.email !== undefined) update.email = trimmedOrNull(values.email);
  if (values.phone !== undefined) update.phone = trimmedOrNull(values.phone);
  if (values.notes !== undefined) update.notes = trimmedOrNull(values.notes);

  const { error } = await auth.adminSupabase
    .from("broker_introducers")
    .update(update)
    .eq("organization_id", auth.organizationId)
    .eq("id", id);

  if (error) return jsonError("Modification impossible.", 500, error.message);
  return NextResponse.json({ success: true });
}

export async function DELETE(_request: NextRequest, ctx: RouteContext) {
  const auth = await requireBrokerApiContext();
  if (!auth.success) return jsonError(auth.message, auth.status, auth.reason);

  if (!canCreateWorkspaceRecords(auth.context.membership?.role)) {
    return jsonError(
      "Votre rôle ne permet pas de supprimer un apporteur.",
      403,
      "insufficient_role",
    );
  }

  const { id } = await ctx.params;

  // Soft-delete: archived introducers keep historical retrocession links intact.
  const { error } = await auth.adminSupabase
    .from("broker_introducers")
    .update({
      archived_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("organization_id", auth.organizationId)
    .eq("id", id);

  if (error) return jsonError("Suppression impossible.", 500, error.message);
  return NextResponse.json({ success: true });
}
