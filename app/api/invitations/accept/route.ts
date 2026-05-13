import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import {
  ensureProfileForUser,
  findInvitationByToken,
  insertInvitationAuditLog,
  invitationCanBeAccepted,
} from "@/lib/invitations/server";
import { normalizeEmail } from "@/lib/invitations/shared";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { getSupabaseServerClient } from "@/lib/supabase/server";

const acceptInvitationSchema = z.object({
  token: z.string().trim().min(16),
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
    return jsonError("Acceptation indisponible.", 500, "supabase_unconfigured");
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
      "Acceptation indisponible.",
      500,
      "service_role_unconfigured",
    );
  }

  const body: unknown = await request.json().catch(() => ({}));
  const parsedBody = acceptInvitationSchema.safeParse(body);

  if (!parsedBody.success) {
    return jsonError("Jeton d’invitation requis.", 400, "invalid_payload");
  }

  const invitation = await findInvitationByToken(
    adminSupabase,
    parsedBody.data.token,
  );

  if (!invitation) {
    return jsonError("Invitation invalide.", 404, "invitation_not_found");
  }

  if (!invitationCanBeAccepted(invitation)) {
    if (invitation.status === "pending") {
      await adminSupabase
        .from("organization_invitations")
        .update({
          status: "expired",
          updated_at: new Date().toISOString(),
        })
        .eq("id", invitation.id)
        .eq("status", "pending");
    }

    return jsonError(
      "Cette invitation n’est plus valide.",
      409,
      "invitation_not_acceptable",
    );
  }

  const authenticatedEmail = normalizeEmail(user.email ?? "");

  if (
    !authenticatedEmail ||
    authenticatedEmail !== normalizeEmail(invitation.email)
  ) {
    return jsonError(
      "Cette invitation est associée à une autre adresse email.",
      403,
      "email_mismatch",
    );
  }

  const profileResult = await ensureProfileForUser(adminSupabase, user);

  if (!profileResult.success) {
    return jsonError(
      "Profil utilisateur impossible à préparer.",
      500,
      profileResult.message ?? "profile_upsert_failed",
    );
  }

  const { data: existingMembership, error: membershipLookupError } =
    await adminSupabase
      .from("organization_members")
      .select("id, organization_id, user_id, role, status, created_at")
      .eq("organization_id", invitation.organization_id)
      .eq("user_id", user.id)
      .maybeSingle();

  if (membershipLookupError) {
    return jsonError(
      "Vérification de l’accès impossible.",
      500,
      membershipLookupError.message,
    );
  }

  if (existingMembership?.status !== "active") {
    const { error: membershipError } = await adminSupabase
      .from("organization_members")
      .upsert(
        {
          organization_id: invitation.organization_id,
          user_id: user.id,
          role: invitation.role,
          status: "active",
        },
        {
          onConflict: "organization_id,user_id",
        },
      );

    if (membershipError) {
      return jsonError(
        "Création de l’accès impossible.",
        500,
        membershipError.message,
      );
    }
  }

  const now = new Date().toISOString();
  const { error: invitationUpdateError } = await adminSupabase
    .from("organization_invitations")
    .update({
      status: "accepted",
      accepted_at: now,
      updated_at: now,
    })
    .eq("id", invitation.id)
    .eq("status", "pending");

  if (invitationUpdateError) {
    return jsonError(
      "Mise à jour de l’invitation impossible.",
      500,
      invitationUpdateError.message,
    );
  }

  await insertInvitationAuditLog(adminSupabase, {
    organizationId: invitation.organization_id,
    userId: user.id,
    action: "invitation_accepted",
    invitationId: invitation.id,
  });

  return NextResponse.json({
    success: true,
    organization_id: invitation.organization_id,
  });
}
