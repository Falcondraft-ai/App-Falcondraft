import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import {
  ensureProfileForUser,
  findInvitationByToken,
  invitationCanBeAccepted,
} from "@/lib/invitations/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

const invitationSignupSchema = z.object({
  token: z.string().trim().min(16),
  password: z.string().min(8),
  full_name: z.string().trim().max(120).optional(),
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
  const adminSupabase = getSupabaseAdminClient();

  if (!adminSupabase) {
    return jsonError(
      "Création de compte indisponible.",
      500,
      "service_role_unconfigured",
    );
  }

  const body: unknown = await request.json().catch(() => ({}));
  const parsedBody = invitationSignupSchema.safeParse(body);

  if (!parsedBody.success) {
    return jsonError(
      "Invitation et mot de passe requis.",
      400,
      "invalid_payload",
    );
  }

  const values = parsedBody.data;
  const invitation = await findInvitationByToken(adminSupabase, values.token);

  if (!invitation) {
    return jsonError("Invitation invalide.", 404, "invitation_not_found");
  }

  if (!invitationCanBeAccepted(invitation)) {
    return jsonError(
      "Cette invitation n’est plus valide.",
      409,
      "invitation_not_acceptable",
    );
  }

  const fullName = values.full_name?.trim() || null;
  const { data, error } = await adminSupabase.auth.admin.createUser({
    email: invitation.email,
    password: values.password,
    email_confirm: true,
    user_metadata: fullName ? { full_name: fullName } : undefined,
  });

  if (error || !data.user) {
    return jsonError(
      "Création impossible. Si un compte existe déjà, connectez-vous avec votre mot de passe.",
      409,
      "account_create_failed",
    );
  }

  const profileResult = await ensureProfileForUser(
    adminSupabase,
    data.user,
    fullName,
  );

  if (!profileResult.success) {
    return jsonError(
      "Compte créé, mais profil impossible à préparer.",
      500,
      profileResult.message ?? "profile_upsert_failed",
    );
  }

  return NextResponse.json({
    success: true,
    email: invitation.email,
  });
}
