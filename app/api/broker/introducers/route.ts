import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { canCreateWorkspaceRecords } from "@/lib/auth/workspace-permissions";
import { requireBrokerApiContext } from "@/lib/broker/server";

const schema = z.object({
  name: z.string().trim().min(1).max(160),
  retrocessionRate: z.number().min(0).max(100).optional().nullable(),
  email: z.string().trim().email().optional().or(z.literal("")),
  phone: z.string().trim().max(40).optional().nullable(),
  notes: z.string().trim().max(2000).optional().nullable(),
});

function jsonError(message: string, status: number, reason: string) {
  return NextResponse.json({ success: false, message, reason }, { status });
}

export async function POST(request: NextRequest) {
  const auth = await requireBrokerApiContext();
  if (!auth.success) return jsonError(auth.message, auth.status, auth.reason);

  if (!canCreateWorkspaceRecords(auth.context.membership?.role)) {
    return jsonError(
      "Votre rôle ne permet pas d’ajouter un apporteur.",
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

  const { data, error } = await auth.adminSupabase
    .from("broker_introducers")
    .insert({
      organization_id: auth.organizationId,
      created_by: auth.user.id,
      name: values.name.trim(),
      retrocession_rate: values.retrocessionRate ?? null,
      email: values.email?.trim() || null,
      phone: values.phone?.trim() || null,
      notes: values.notes?.trim() || null,
    })
    .select("id")
    .single();

  if (error || !data) {
    return jsonError(
      "Création de l’apporteur impossible.",
      500,
      error?.message ?? "insert_failed",
    );
  }

  return NextResponse.json({ success: true, introducerId: data.id });
}
