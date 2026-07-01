import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { canCreateWorkspaceRecords } from "@/lib/auth/workspace-permissions";
import {
  brokerClientDisplayName,
} from "@/lib/broker/clients";
import { logBrokerActivity, requireBrokerApiContext } from "@/lib/broker/server";

const createClientSchema = z
  .object({
    clientType: z.enum(["individual", "company"]).default("individual"),
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
    insuranceType: z.string().trim().max(40).optional().nullable(),
    introducerId: z.string().uuid().optional().nullable(),
    needs: z.string().trim().max(5000).optional().nullable(),
    notes: z.string().trim().max(5000).optional().nullable(),
  })
  .superRefine((values, ctx) => {
    if (values.clientType === "company") {
      if (!values.companyName?.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Le nom de l'entreprise est requis.",
          path: ["companyName"],
        });
      }
    } else if (!values.lastName?.trim() && !values.firstName?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Le nom du client est requis.",
        path: ["lastName"],
      });
    }
  });

function jsonError(message: string, status: number, reason: string) {
  return NextResponse.json({ success: false, message, reason }, { status });
}

export async function POST(request: NextRequest) {
  const auth = await requireBrokerApiContext();
  if (!auth.success) {
    return jsonError(auth.message, auth.status, auth.reason);
  }

  if (!canCreateWorkspaceRecords(auth.context.membership?.role)) {
    return jsonError(
      "Votre rôle ne permet pas de créer un dossier client.",
      403,
      "insufficient_role",
    );
  }

  const body: unknown = await request.json().catch(() => ({}));
  const parsed = createClientSchema.safeParse(body);

  if (!parsed.success) {
    return jsonError(
      parsed.error.issues[0]?.message ??
        "Les informations du dossier sont incomplètes.",
      400,
      "invalid_payload",
    );
  }

  const values = parsed.data;
  const email = values.email?.trim() || null;

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

  const { data, error } = await auth.adminSupabase
    .from("broker_clients")
    .insert({
      organization_id: auth.organizationId,
      created_by: auth.user.id,
      client_type: values.clientType,
      first_name: values.firstName?.trim() || null,
      last_name: values.lastName?.trim() || null,
      company_name: values.companyName?.trim() || null,
      email,
      phone: values.phone?.trim() || null,
      address: values.address?.trim() || null,
      postal_code: values.postalCode?.trim() || null,
      city: values.city?.trim() || null,
      date_of_birth: values.dateOfBirth?.trim() || null,
      insurance_type: values.insuranceType?.trim() || null,
      introducer_id: values.introducerId ?? null,
      needs: values.needs?.trim() || null,
      notes: values.notes?.trim() || null,
      status: "new",
    })
    .select("*")
    .single();

  if (error || !data) {
    return jsonError(
      "Création du dossier impossible.",
      500,
      error?.message ?? "insert_failed",
    );
  }

  await logBrokerActivity(auth.adminSupabase, {
    organizationId: auth.organizationId,
    clientId: data.id,
    userId: auth.user.id,
    type: "client_created",
    description: `Dossier créé pour ${brokerClientDisplayName(data)}.`,
  });

  return NextResponse.json({ success: true, clientId: data.id });
}
