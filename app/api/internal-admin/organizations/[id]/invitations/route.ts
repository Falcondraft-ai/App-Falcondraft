import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { sendInvitationEmail } from "@/lib/invitations/email";
import {
  expirePendingInvitationsForEmail,
  getPendingInvitationByEmail,
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
import { requireInternalAdminContext } from "@/lib/internal-admin/server";

const organizationIdSchema = z.string().uuid();
const invitationSchema = z.object({
  email: z.string().trim().email(),
  role: z.enum(invitationRoles),
});

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

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

export async function POST(request: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  const parsedOrganizationId = organizationIdSchema.safeParse(id);

  if (!parsedOrganizationId.success) {
    return jsonError("Workspace invalide.", 400, "invalid_organization_id");
  }

  const internalAdmin = await requireInternalAdminContext();

  if (!internalAdmin.success) {
    return jsonError(
      internalAdmin.message,
      internalAdmin.status,
      internalAdmin.reason,
    );
  }

  const body: unknown = await request.json().catch(() => ({}));
  const parsedBody = invitationSchema.safeParse(body);

  if (!parsedBody.success) {
    return jsonError("Email et rôle requis.", 400, "invalid_payload");
  }

  const organizationId = parsedOrganizationId.data;
  const values = parsedBody.data;
  const email = normalizeEmail(values.email);
  const { data: organization, error: organizationError } =
    await internalAdmin.adminSupabase
      .from("organizations")
      .select("id, name")
      .eq("id", organizationId)
      .maybeSingle();

  if (organizationError) {
    return jsonError(
      "Lecture du workspace impossible.",
      500,
      organizationError.message,
    );
  }

  if (!organization) {
    return jsonError("Workspace introuvable.", 404, "organization_not_found");
  }

  const activeMemberCheck = await isActiveOrganizationMemberEmail(
    internalAdmin.adminSupabase,
    organizationId,
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
      "Cet email est déjà membre actif du workspace.",
      409,
      "already_active_member",
    );
  }

  await expirePendingInvitationsForEmail(
    internalAdmin.adminSupabase,
    organizationId,
    email,
  );

  const pendingInvitation = await getPendingInvitationByEmail(
    internalAdmin.adminSupabase,
    organizationId,
    email,
  );

  if (pendingInvitation.error) {
    return jsonError(
      "Lecture des invitations impossible.",
      500,
      pendingInvitation.error.message,
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

  const { data: invitation, error: insertError } =
    await internalAdmin.adminSupabase
      .from("organization_invitations")
      .insert({
        organization_id: organizationId,
        email,
        role: values.role,
        invited_by: internalAdmin.user.id,
        token_hash: tokenHash,
        status: "pending",
        expires_at: expiresAt,
        created_at: now,
        updated_at: now,
      })
      .select("id, email, role, status, expires_at, created_at")
      .single();

  if (insertError || !invitation) {
    return jsonError(
      "Création de l’invitation impossible.",
      500,
      insertError?.message ?? "insert_failed",
    );
  }

  const acceptUrl = `${getInvitationBaseUrl(request)}/invite/${encodeURIComponent(token)}`;
  const emailResult = await sendInvitationEmail({
    to: email,
    organizationName: organization.name,
    roleLabel: getWorkspaceRoleLabel(values.role),
    acceptUrl,
  });

  if (!emailResult.success) {
    const revokedAt = new Date().toISOString();

    await internalAdmin.adminSupabase
      .from("organization_invitations")
      .update({
        status: "revoked",
        revoked_at: revokedAt,
        updated_at: revokedAt,
      })
      .eq("id", invitation.id);

    return jsonError(
      "L’invitation n’a pas pu être envoyée.",
      500,
      emailResult.message ?? "email_failed",
    );
  }

  await internalAdmin.adminSupabase.from("audit_logs").insert({
    organization_id: organizationId,
    user_id: internalAdmin.user.id,
    action: "invitation_created",
    entity_type: "organization_invitation",
    entity_id: invitation.id,
  });

  return NextResponse.json({
    success: true,
    invitation: {
      id: invitation.id,
      email: invitation.email,
      role: invitation.role,
      status: invitation.status,
      expiresAt: invitation.expires_at,
      createdAt: invitation.created_at,
    },
  });
}
