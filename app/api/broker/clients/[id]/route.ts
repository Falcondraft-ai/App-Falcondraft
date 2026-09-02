import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { canCreateWorkspaceRecords } from "@/lib/auth/workspace-permissions";
import {
  brokerClientStatusLabels,
  brokerClientStatuses,
  isBrokerClientStatus,
} from "@/lib/broker/clients";
import { BROKER_FILES_BUCKET } from "@/lib/broker/documents";
import {
  adjustOrganizationStorage,
  logBrokerActivity,
  requireBrokerApiContext,
} from "@/lib/broker/server";
import type { Database } from "@/types/database";

type BrokerClientUpdate =
  Database["public"]["Tables"]["broker_clients"]["Update"];

type RouteContext = {
  params: Promise<{ id: string }>;
};

const updateClientSchema = z.object({
  status: z.enum(brokerClientStatuses).optional(),
  firstName: z.string().trim().max(120).optional().nullable(),
  lastName: z.string().trim().max(120).optional().nullable(),
  companyName: z.string().trim().max(160).optional().nullable(),
  email: z.string().trim().email().optional().or(z.literal("")),
  phone: z.string().trim().max(40).optional().nullable(),
  address: z.string().trim().max(240).optional().nullable(),
  postalCode: z.string().trim().max(20).optional().nullable(),
  city: z.string().trim().max(120).optional().nullable(),
  dateOfBirth: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .or(z.literal(""))
    .nullable(),
  birthCountry: z.string().trim().max(120).optional().nullable(),
  insuranceType: z.string().trim().max(40).optional().nullable(),
  introducerId: z.string().uuid().optional().nullable(),
  needs: z.string().trim().max(5000).optional().nullable(),
  structuredNeeds: z
    .record(
      z.string().max(80),
      z.union([z.string().max(2000), z.number(), z.boolean()]),
    )
    .optional(),
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
  if (!auth.success) {
    return jsonError(auth.message, auth.status, auth.reason);
  }

  if (!canCreateWorkspaceRecords(auth.context.membership?.role)) {
    return jsonError(
      "Votre rôle ne permet pas de modifier ce dossier.",
      403,
      "insufficient_role",
    );
  }

  const { id } = await ctx.params;

  const body: unknown = await request.json().catch(() => ({}));
  const parsed = updateClientSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(
      "Modification invalide.",
      400,
      "invalid_payload",
    );
  }

  const { data: existing } = await auth.adminSupabase
    .from("broker_clients")
    .select("*")
    .eq("organization_id", auth.organizationId)
    .eq("id", id)
    .maybeSingle();

  if (!existing) {
    return jsonError("Dossier introuvable.", 404, "not_found");
  }

  const values = parsed.data;

  if (values.introducerId) {
    const { data: intro } = await auth.adminSupabase
      .from("broker_introducers")
      .select("id")
      .eq("organization_id", auth.organizationId)
      .eq("id", values.introducerId)
      .maybeSingle();
    if (!intro) {
      return jsonError("Apporteur introuvable.", 404, "introducer_not_found");
    }
  }

  const update: BrokerClientUpdate = { updated_at: new Date().toISOString() };

  if (values.status !== undefined) update.status = values.status;
  if (values.firstName !== undefined)
    update.first_name = trimmedOrNull(values.firstName);
  if (values.lastName !== undefined)
    update.last_name = trimmedOrNull(values.lastName);
  if (values.companyName !== undefined)
    update.company_name = trimmedOrNull(values.companyName);
  if (values.email !== undefined) update.email = trimmedOrNull(values.email);
  if (values.phone !== undefined) update.phone = trimmedOrNull(values.phone);
  if (values.address !== undefined)
    update.address = trimmedOrNull(values.address);
  if (values.postalCode !== undefined)
    update.postal_code = trimmedOrNull(values.postalCode);
  if (values.city !== undefined) update.city = trimmedOrNull(values.city);
  if (values.dateOfBirth !== undefined)
    update.date_of_birth = trimmedOrNull(values.dateOfBirth);
  if (values.birthCountry !== undefined)
    update.birth_country = trimmedOrNull(values.birthCountry);
  if (values.insuranceType !== undefined)
    update.insurance_type = trimmedOrNull(values.insuranceType);
  if (values.introducerId !== undefined)
    update.introducer_id = values.introducerId;
  if (values.needs !== undefined) update.needs = trimmedOrNull(values.needs);
  if (values.structuredNeeds !== undefined)
    update.structured_needs = values.structuredNeeds;
  if (values.notes !== undefined) update.notes = trimmedOrNull(values.notes);

  const { error } = await auth.adminSupabase
    .from("broker_clients")
    .update(update)
    .eq("organization_id", auth.organizationId)
    .eq("id", id);

  if (error) {
    return jsonError("Modification impossible.", 500, error.message);
  }

  if (
    values.status &&
    values.status !== existing.status &&
    isBrokerClientStatus(values.status)
  ) {
    await logBrokerActivity(auth.adminSupabase, {
      organizationId: auth.organizationId,
      clientId: id,
      userId: auth.user.id,
      profileId: auth.profileId,
      type: "status_changed",
      description: `Statut mis à jour : ${brokerClientStatusLabels[values.status]}.`,
      metadata: { from: existing.status, to: values.status },
    });
  }

  return NextResponse.json({ success: true });
}

export async function DELETE(_request: NextRequest, ctx: RouteContext) {
  const auth = await requireBrokerApiContext();
  if (!auth.success) {
    return jsonError(auth.message, auth.status, auth.reason);
  }

  // Permanent deletion is a manager-level action.
  if (auth.context.membership?.role !== "manager") {
    return jsonError(
      "Seul un gestionnaire peut supprimer un dossier.",
      403,
      "insufficient_role",
    );
  }

  const { id } = await ctx.params;
  const admin = auth.adminSupabase;
  const orgId = auth.organizationId;

  const { data: existing } = await admin
    .from("broker_clients")
    .select("id")
    .eq("organization_id", orgId)
    .eq("id", id)
    .maybeSingle();
  if (!existing) {
    return jsonError("Dossier introuvable.", 404, "not_found");
  }

  // Remove the client's stored files first — DB rows cascade on delete, but the
  // Storage objects and the org storage counter must be cleaned up explicitly.
  const { data: documents } = await admin
    .from("broker_documents")
    .select("storage_path, size_bytes")
    .eq("organization_id", orgId)
    .eq("client_id", id);

  const paths = (documents ?? [])
    .map((d) => d.storage_path)
    .filter((p): p is string => Boolean(p));
  const freedBytes = (documents ?? []).reduce(
    (sum, d) => sum + (d.size_bytes ?? 0),
    0,
  );

  if (paths.length > 0) {
    const { error: storageError } = await admin.storage
      .from(BROKER_FILES_BUCKET)
      .remove(paths);
    if (storageError) {
      console.error(
        "[broker] client deletion — storage cleanup failed:",
        storageError.message,
      );
    }
  }

  // Cascade-deletes documents, contracts, quotes, advice, claims, commissions,
  // compliance and activity via the FK ON DELETE CASCADE constraints.
  const { error } = await admin
    .from("broker_clients")
    .delete()
    .eq("organization_id", orgId)
    .eq("id", id);

  if (error) {
    return jsonError("Suppression impossible.", 500, error.message);
  }

  if (freedBytes > 0) {
    await adjustOrganizationStorage(admin, orgId, -freedBytes);
  }

  return NextResponse.json({ success: true });
}
