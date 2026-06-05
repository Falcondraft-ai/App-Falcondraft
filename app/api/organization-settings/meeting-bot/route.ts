import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { loadUserOrganizationContextWithAdmin } from "@/lib/auth/organization-context";
import { canManageWorkspaceSettings } from "@/lib/auth/workspace-permissions";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { getSupabaseServerClient } from "@/lib/supabase/server";

const meetingBotSchema = z.object({
  meeting_bot_name: z
    .string()
    .trim()
    .min(2, "Nom trop court.")
    .max(60, "Nom trop long.")
    .refine((value) => !/[\r\n\t]/.test(value), {
      message: "Le nom doit tenir sur une seule ligne.",
    }),
});

function jsonError(message: string, status: number, reason: string) {
  return NextResponse.json({ success: false, message, reason }, { status });
}

export async function PATCH(request: NextRequest) {
  const supabase = await getSupabaseServerClient();

  if (!supabase) {
    return jsonError("Opération indisponible.", 500, "supabase_unconfigured");
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return jsonError("Session requise.", 401, "session_missing");
  }

  const adminSupabase = getSupabaseAdminClient();

  if (!adminSupabase) {
    return jsonError(
      "Opération indisponible.",
      500,
      "service_role_unconfigured",
    );
  }

  const context = await loadUserOrganizationContextWithAdmin(
    user,
    adminSupabase,
  );

  if (!context.membership || !context.organization) {
    return jsonError(
      "Aucun espace client associé.",
      403,
      "organization_context_missing",
    );
  }

  if (!canManageWorkspaceSettings(context.membership.role)) {
    return jsonError(
      "Accès réservé aux gestionnaires.",
      403,
      "insufficient_role",
    );
  }

  const body: unknown = await request.json().catch(() => ({}));
  const parsedBody = meetingBotSchema.safeParse(body);

  if (!parsedBody.success) {
    return jsonError("Nom d’assistant invalide.", 400, "invalid_payload");
  }

  const meetingBotName = parsedBody.data.meeting_bot_name;
  const { error } = await adminSupabase
    .from("organizations")
    .update({ meeting_bot_name: meetingBotName })
    .eq("id", context.organization.id);

  if (error) {
    console.error("[meeting-bot] update failed:", error.message);
    return jsonError("Mise à jour impossible.", 500, "db_error");
  }

  await adminSupabase.from("audit_logs").insert({
    organization_id: context.organization.id,
    user_id: user.id,
    action: "organization_meeting_bot_name_updated",
    entity_type: "organization",
    entity_id: context.organization.id,
  });

  return NextResponse.json({
    success: true,
    meeting_bot_name: meetingBotName,
  });
}
