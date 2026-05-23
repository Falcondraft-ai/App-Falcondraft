import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { loadUserOrganizationContextWithAdmin } from "@/lib/auth/organization-context";
import { canCreateWorkspaceRecords } from "@/lib/auth/workspace-permissions";
import type { CurrentUserContext } from "@/lib/auth/session";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { getSupabaseServerClient } from "@/lib/supabase/server";

const createDealSchema = z.object({
  name: z.string().trim().min(3),
  clientCompanyName: z.string().trim().min(2),
  clientContactName: z.string().trim().min(2),
  clientEmail: z.string().trim().email(),
  phone: z.string().trim().optional(),
  transcript: z.string().trim().min(20),
  quotePriceHt: z.number().positive(),
  quoteTaxRate: z.number().refine((v) => [0, 5.5, 10, 20].includes(v), {
    message: "Taux de TVA invalide.",
  }),
  quoteClientType: z.enum(["company", "individual"]),
  expectedCloseDate: z.string().trim().optional(),
  additionalContext: z.string().trim().optional(),
  emailInstructions: z.string().trim().optional(),
  clientCompanyInfo: z.string().trim().optional(),
  linkedTranscriptId: z.string().uuid().optional(),
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
    return jsonError("Création indisponible.", 500, {
      reason: "supabase_unconfigured",
    });
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return jsonError("Session requise.", 401, {
      ...contextDetails(null, "session_missing"),
    });
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
    return jsonError("Aucun espace client associé.", 403, {
      ...contextDetails(context, "active_membership_missing"),
    });
  }

  if (!context.organization) {
    return jsonError("Organisation introuvable.", 403, {
      ...contextDetails(context, "organization_missing"),
    });
  }

  if (!canCreateWorkspaceRecords(context.membership.role)) {
    return jsonError("Votre rôle ne permet pas de créer un dossier.", 403, {
      reason: "insufficient_role",
    });
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

  const { data, error } = await adminSupabase
    .from("deals")
    .insert({
      organization_id: organizationId,
      name: values.name,
      client_company_name: values.clientCompanyName,
      client_contact_name: values.clientContactName,
      client_email: values.clientEmail,
      status: "draft",
      transcript: values.transcript,
      additional_context: values.additionalContext || null,
      email_instructions: values.emailInstructions || null,
      client_phone: values.phone || null,
      client_company_info: values.clientCompanyInfo || null,
      quote_price_ht: values.quotePriceHt,
      quote_tax_rate: values.quoteTaxRate,
      quote_client_type: values.quoteClientType,
      expected_close_date: values.expectedCloseDate || null,
      created_by: user.id,
    })
    .select("id")
    .single();

  if (error || !data) {
    return jsonError("Création impossible.", 500, {
      reason: error?.message ?? "insert_failed",
    });
  }

  if (values.linkedTranscriptId) {
    await adminSupabase
      .from("transcripts")
      .update({ deal_id: data.id, updated_at: new Date().toISOString() })
      .eq("id", values.linkedTranscriptId)
      .eq("organization_id", organizationId);
  }

  return NextResponse.json({
    success: true,
    dealId: data.id,
  });
}
