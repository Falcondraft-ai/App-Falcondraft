import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import {
  assertCanManageOrganization,
  insertInvitationAuditLog,
} from "@/lib/invitations/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { getSupabaseServerClient } from "@/lib/supabase/server";

const revokeInvitationSchema = z.object({
  invitation_id: z.string().uuid(),
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

export async function POST(request: NextRequest) {
  const supabase = await getSupabaseServerClient();

  if (!supabase) {
    return jsonError("Révocation indisponible.", 500, "supabase_unconfigured");
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
      "Révocation indisponible.",
      500,
      "service_role_unconfigured",
    );
  }

  const body: unknown = await request.json().catch(() => ({}));
  const parsedBody = revokeInvitationSchema.safeParse(body);

  if (!parsedBody.success) {
    return jsonError("Invitation requise.", 400, "invalid_payload");
  }

  const { data: invitation, error: invitationError } = await adminSupabase
    .from("organization_invitations")
    .select("id, organization_id, email, role, status, expires_at")
    .eq("id", parsedBody.data.invitation_id)
    .maybeSingle();

  if (invitationError) {
    return jsonError(
      "Lecture de l’invitation impossible.",
      500,
      invitationError.message,
    );
  }

  if (!invitation) {
    return jsonError("Invitation introuvable.", 404, "invitation_not_found");
  }

  const permission = await assertCanManageOrganization(
    adminSupabase,
    user.id,
    invitation.organization_id,
  );

  if (!permission.success) {
    return jsonError(permission.message, permission.status, permission.reason);
  }

  if (invitation.status !== "pending") {
    return jsonError(
      "Seules les invitations en attente peuvent être révoquées.",
      409,
      "invitation_not_pending",
    );
  }

  const now = new Date().toISOString();
  const { error: updateError } = await adminSupabase
    .from("organization_invitations")
    .update({
      status: "revoked",
      revoked_at: now,
      updated_at: now,
    })
    .eq("id", invitation.id)
    .eq("status", "pending");

  if (updateError) {
    return jsonError("Révocation impossible.", 500, updateError.message);
  }

  await insertInvitationAuditLog(adminSupabase, {
    organizationId: invitation.organization_id,
    userId: user.id,
    action: "invitation_revoked",
    invitationId: invitation.id,
  });

  return NextResponse.json({
    success: true,
  });
}
