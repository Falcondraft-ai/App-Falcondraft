import { NextResponse } from "next/server";
import { z } from "zod";
import { requireInternalAdminContext } from "@/lib/internal-admin/server";

const organizationIdSchema = z.string().uuid();
const invitationIdSchema = z.string().uuid();

type RouteContext = {
  params: Promise<{
    id: string;
    invitationId: string;
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

export async function DELETE(_request: Request, context: RouteContext) {
  const { id, invitationId } = await context.params;
  const parsedOrganizationId = organizationIdSchema.safeParse(id);
  const parsedInvitationId = invitationIdSchema.safeParse(invitationId);

  if (!parsedOrganizationId.success || !parsedInvitationId.success) {
    return jsonError("Invitation invalide.", 400, "invalid_invitation_id");
  }

  const internalAdmin = await requireInternalAdminContext();

  if (!internalAdmin.success) {
    return jsonError(
      internalAdmin.message,
      internalAdmin.status,
      internalAdmin.reason,
    );
  }

  const organizationId = parsedOrganizationId.data;
  const now = new Date().toISOString();
  const { data: invitation, error } = await internalAdmin.adminSupabase
    .from("organization_invitations")
    .update({
      status: "revoked",
      revoked_at: now,
      updated_at: now,
    })
    .eq("id", parsedInvitationId.data)
    .eq("organization_id", organizationId)
    .eq("status", "pending")
    .select("id, email")
    .maybeSingle();

  if (error) {
    return jsonError(
      "Suppression de l’invitation impossible.",
      500,
      error.message,
    );
  }

  if (!invitation) {
    return jsonError(
      "Invitation introuvable ou déjà traitée.",
      404,
      "invitation_not_found",
    );
  }

  await internalAdmin.adminSupabase.from("audit_logs").insert({
    organization_id: organizationId,
    user_id: internalAdmin.user.id,
    action: "invitation_revoked",
    entity_type: "organization_invitation",
    entity_id: invitation.id,
  });

  return NextResponse.json({
    success: true,
    invitationId: invitation.id,
    email: invitation.email,
  });
}
