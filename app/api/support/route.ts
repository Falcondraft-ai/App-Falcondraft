import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { sendSupportRequestEmails } from "@/lib/support/email";

const supportRequestSchema = z.object({
  requestType: z.enum(["question", "bug", "feature"]),
  language: z.enum(["fr", "en"]).default("fr"),
  subject: z.string().trim().max(160).optional(),
  message: z.string().trim().min(10).max(5000),
});

function jsonError(message: string, status: number, reason: string) {
  return NextResponse.json(
    {
      success: false,
      message,
      reason,
    },
    { status },
  );
}

function defaultSubject(requestType: "question" | "bug" | "feature") {
  if (requestType === "bug") {
    return "Bug à corriger dans FalconDraft";
  }

  if (requestType === "feature") {
    return "Suggestion de fonctionnalité FalconDraft";
  }

  return "Question sur FalconDraft";
}

export async function POST(request: NextRequest) {
  const supabase = await getSupabaseServerClient();

  if (!supabase) {
    return jsonError("Service support indisponible.", 500, "supabase_missing");
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return jsonError("Session requise.", 401, "session_missing");
  }

  const body: unknown = await request.json().catch(() => ({}));
  const parsedBody = supportRequestSchema.safeParse(body);

  if (!parsedBody.success) {
    return jsonError(
      "La demande support est incomplète.",
      400,
      "invalid_payload",
    );
  }

  const [{ data: profile }, { data: membership }] = await Promise.all([
    supabase
      .from("profiles")
      .select("full_name")
      .eq("user_id", user.id)
      .maybeSingle(),
    supabase
      .from("organization_members")
      .select("organization_id, role, status")
      .eq("user_id", user.id)
      .eq("status", "active")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle(),
  ]);

  if (!membership) {
    return jsonError(
      "Workspace actif requis.",
      403,
      "active_membership_required",
    );
  }

  const { data: organization } = await supabase
    .from("organizations")
    .select("name")
    .eq("id", membership.organization_id)
    .maybeSingle();

  const values = parsedBody.data;
  const userEmail = user.email;

  if (!userEmail) {
    return jsonError("Email utilisateur manquant.", 400, "user_email_missing");
  }

  const emailResult = await sendSupportRequestEmails({
    requestType: values.requestType,
    language: values.language,
    subject: values.subject || defaultSubject(values.requestType),
    message: values.message,
    userName: profile?.full_name ?? userEmail,
    userEmail,
    organizationName: organization?.name ?? "Workspace FalconDraft",
    role: membership.role ?? "member",
  });

  if (!emailResult.success) {
    return jsonError(
      "La demande support n’a pas pu être envoyée.",
      500,
      emailResult.message ?? "support_email_failed",
    );
  }

  return NextResponse.json({
    success: true,
    confirmationSent: emailResult.confirmationSent,
  });
}
