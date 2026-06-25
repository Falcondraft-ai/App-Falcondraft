import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { sendInvitationEmail } from "@/lib/invitations/email";
import {
  assertCanManageOrganization,
  expirePendingInvitationsForEmail,
  getPendingInvitationByEmail,
  insertInvitationAuditLog,
  isActiveOrganizationMemberEmail,
} from "@/lib/invitations/server";
import {
  getWorkspaceRoleLabel,
  invitationRoles,
  normalizeEmail,
} from "@/lib/invitations/shared";
import {
  generateInvitationToken,
  hashInvitationToken,
} from "@/lib/invitations/tokens";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { getSupabaseServerClient } from "@/lib/supabase/server";

const invitationCreateSchema = z.object({
  organization_id: z.string().uuid(),
  email: z.string().trim().email(),
  role: z.enum(invitationRoles),
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

function getInvitationBaseUrl(request: NextRequest) {
  const configuredUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();

  if (configuredUrl) {
    return configuredUrl.replace(/\/$/, "");
  }

  return request.nextUrl.origin;
}

export async function POST(request: NextRequest) {
  const supabase = await getSupabaseServerClient();

  if (!supabase) {
    return jsonError(
      "Service d’invitation indisponible.",
      500,
      "supabase_unconfigured",
    );
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
      "Service d’invitation indisponible.",
      500,
      "service_role_unconfigured",
    );
  }

  const body: unknown = await request.json().catch(() => ({}));
  const parsedBody = invitationCreateSchema.safeParse(body);

  if (!parsedBody.success) {
    return jsonError(
      "L’email, l’organisation et le rôle sont requis.",
      400,
      "invalid_payload",
    );
  }

  const values = parsedBody.data;
  const email = normalizeEmail(values.email);

  const permission = await assertCanManageOrganization(
    adminSupabase,
    user.id,
    values.organization_id,
  );

  if (!permission.success) {
    return jsonError(permission.message, permission.status, permission.reason);
  }

  const activeMemberCheck = await isActiveOrganizationMemberEmail(
    adminSupabase,
    values.organization_id,
    email,
  );

  if (!activeMemberCheck.success) {
    return jsonError(
      "Vérification du membre impossible.",
      500,
      activeMemberCheck.message ?? "member_lookup_failed",
    );
  }

  if (activeMemberCheck.isMember) {
    return jsonError(
      "Cet email est déjà membre actif de l’organisation.",
      409,
      "already_active_member",
    );
  }

  await expirePendingInvitationsForEmail(
    adminSupabase,
    values.organization_id,
    email,
  );

  const pendingInvitation = await getPendingInvitationByEmail(
    adminSupabase,
    values.organization_id,
    email,
  );

  if (pendingInvitation.error) {
    console.error("[invitations] pending check failed:", pendingInvitation.error.message);
    return jsonError(
      "La table des invitations est inaccessible. Vérifie que les migrations Supabase sont appliquées.",
      500,
      "db_error",
    );
  }

  if (pendingInvitation.invitation) {
    return jsonError(
      "Une invitation est déjà en attente pour cet email.",
      409,
      "pending_invitation_exists",
    );
  }

  if (!process.env.RESEND_API_KEY) {
    return jsonError(
      "Configuration email manquante : ajoute RESEND_API_KEY dans l’environnement serveur.",
      500,
      "resend_unconfigured",
    );
  }

  const token = generateInvitationToken();
  const tokenHash = hashInvitationToken(token);
  const expiresAt = new Date(
    Date.now() + 7 * 24 * 60 * 60 * 1000,
  ).toISOString();
  const now = new Date().toISOString();

  const { data: invitation, error: insertError } = await adminSupabase
    .from("organization_invitations")
    .insert({
      organization_id: values.organization_id,
      email,
      role: values.role,
      invited_by: user.id,
      token_hash: tokenHash,
      status: "pending",
      expires_at: expiresAt,
      created_at: now,
      updated_at: now,
    })
    .select("id, email, role, status, expires_at, created_at")
    .single();

  if (insertError || !invitation) {
    console.error("[invitations] insert failed:", insertError?.message);
    return jsonError(
      "Création de l’invitation impossible.",
      500,
      "insert_failed",
    );
  }

  const acceptUrl = `${getInvitationBaseUrl(request)}/invite/${encodeURIComponent(token)}`;
  const emailResult = await sendInvitationEmail({
    to: email,
    organizationName: permission.organization.name,
    roleLabel: getWorkspaceRoleLabel(values.role),
    acceptUrl,
    workspaceType: permission.organization.workspace_type,
  });

  if (!emailResult.success) {
    await adminSupabase
      .from("organization_invitations")
      .update({
        status: "revoked",
        revoked_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", invitation.id);

    return jsonError(
      "L’invitation n’a pas pu être envoyée.",
      500,
      emailResult.message ?? "email_failed",
    );
  }

  await insertInvitationAuditLog(adminSupabase, {
    organizationId: values.organization_id,
    userId: user.id,
    action: "invitation_created",
    invitationId: invitation.id,
  });

  return NextResponse.json({
    success: true,
    invitation: {
      id: invitation.id,
      email: invitation.email,
      role: invitation.role,
      status: invitation.status,
      expires_at: invitation.expires_at,
      created_at: invitation.created_at,
    },
  });
}
