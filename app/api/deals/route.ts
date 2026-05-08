import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { loadUserOrganizationContextWithAdmin } from "@/lib/auth/organization-context";
import type { CurrentUserContext } from "@/lib/auth/session";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { getSupabaseServerClient } from "@/lib/supabase/server";

const createDealSchema = z.object({
  name: z.string().min(3),
  clientCompanyName: z.string().min(2),
  clientContactName: z.string().min(2),
  clientEmail: z.string().email(),
  phone: z.string().optional(),
  transcript: z.string().min(20),
  amountEstimate: z.number().optional(),
  additionalContext: z.string().optional(),
  emailInstructions: z.string().optional(),
});

type ContextErrorReason =
  | "supabase_unconfigured"
  | "service_role_unconfigured"
  | "session_missing"
  | "active_membership_missing"
  | "organization_missing"
  | "invalid_payload"
  | "insert_failed";

function contextDetails(
  context: CurrentUserContext | null,
  reason: ContextErrorReason,
) {
  return {
    hasSession: Boolean(context?.user),
    userId: context?.user.id ?? null,
    membershipFound: Boolean(context?.membership),
    organizationFound: Boolean(context?.organization),
    reason,
  };
}

function jsonError(
  message: string,
  status: number,
  details: Record<string, unknown>,
) {
  return NextResponse.json(
    {
      success: false,
      message,
      ...details,
    },
    { status },
  );
}

export async function POST(request: NextRequest) {
  const supabase = await getSupabaseServerClient();

  if (!supabase) {
    return jsonError(
      "Création indisponible.",
      500,
      {
        reason: "supabase_unconfigured",
      },
    );
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return jsonError(
      "Session requise.",
      401,
      {
        ...contextDetails(null, "session_missing"),
      },
    );
  }

  const adminSupabase = getSupabaseAdminClient();

  if (!adminSupabase) {
    return jsonError("Création indisponible.", 500, {
      hasSession: true,
      userId: user.id,
      membershipFound: false,
      organizationFound: false,
      reason: "service_role_unconfigured",
    });
  }

  const context = await loadUserOrganizationContextWithAdmin(
    user,
    adminSupabase,
  );

  if (!context.membership) {
    return jsonError(
      "Aucun espace client associé.",
      403,
      {
        ...contextDetails(context, "active_membership_missing"),
      },
    );
  }

  if (!context.organization) {
    return jsonError(
      "Organisation introuvable.",
      403,
      {
        ...contextDetails(context, "organization_missing"),
      },
    );
  }

  const organizationId = context.organization.id;

  const body: unknown = await request.json().catch(() => ({}));
  const parsedBody = createDealSchema.safeParse(body);

  if (!parsedBody.success) {
    return jsonError("Les informations du dossier sont incomplètes.", 400, {
      reason: "invalid_payload",
    });
  }

  const values = parsedBody.data;
  const fullTranscript = [
    values.transcript,
    values.additionalContext
      ? `\n\nContexte complémentaire :\n${values.additionalContext}`
      : "",
    values.emailInstructions
      ? `\n\nInstructions email :\n${values.emailInstructions}`
      : "",
    values.phone ? `\n\nTéléphone client :\n${values.phone}` : "",
  ]
    .filter(Boolean)
    .join("");

  const { data, error } = await adminSupabase
    .from("deals")
    .insert({
      organization_id: organizationId,
      name: values.name,
      client_company_name: values.clientCompanyName,
      client_contact_name: values.clientContactName,
      client_email: values.clientEmail,
      status: "draft",
      transcript: fullTranscript,
      amount_estimate: values.amountEstimate ?? null,
      created_by: user.id,
    })
    .select("id")
    .single();

  if (error || !data) {
    return jsonError(
      "Création impossible.",
      500,
      {
        reason: error?.message ?? "insert_failed",
      },
    );
  }

  return NextResponse.json({
    success: true,
    dealId: data.id,
  });
}
