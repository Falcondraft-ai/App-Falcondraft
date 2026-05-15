import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { normalizeWorkspaceRole } from "@/lib/auth/workspace-permissions";
import { ensureProfileForUser } from "@/lib/invitations/server";
import { invitationRoles, normalizeEmail } from "@/lib/invitations/shared";
import { requireInternalAdminContext } from "@/lib/internal-admin/server";

const organizationIdSchema = z.string().uuid();
const memberCreateSchema = z.object({
  email: z.string().trim().email(),
  first_name: z.string().trim().max(80).optional(),
  last_name: z.string().trim().max(80).optional(),
  password: z.string().min(8),
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

function fullName(firstName?: string, lastName?: string) {
  return [firstName?.trim(), lastName?.trim()].filter(Boolean).join(" ");
}

function mapMember(input: {
  membership: {
    id: string;
    user_id: string;
    role: string;
    status: string;
    created_at: string;
  };
  email: string;
  name: string | null;
}) {
  return {
    id: input.membership.id,
    userId: input.membership.user_id,
    name: input.name ?? input.email,
    email: input.email,
    role: normalizeWorkspaceRole(input.membership.role) ?? "member",
    status: input.membership.status,
    createdAt: input.membership.created_at,
  };
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
  const parsedBody = memberCreateSchema.safeParse(body);

  if (!parsedBody.success) {
    return jsonError(
      "Email, rôle et mot de passe temporaire sont requis.",
      400,
      "invalid_payload",
    );
  }

  const organizationId = parsedOrganizationId.data;
  const values = parsedBody.data;
  const email = normalizeEmail(values.email);
  const name = fullName(values.first_name, values.last_name) || null;
  const { data: organization, error: organizationError } =
    await internalAdmin.adminSupabase
      .from("organizations")
      .select("id")
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

  const { data: existingProfile, error: existingProfileError } =
    await internalAdmin.adminSupabase
      .from("profiles")
      .select("*")
      .eq("email", email)
      .maybeSingle();

  if (existingProfileError) {
    return jsonError(
      "Vérification du compte existant impossible.",
      500,
      existingProfileError.message,
    );
  }

  let userId = existingProfile?.user_id ?? null;
  let memberName = name ?? existingProfile?.full_name ?? null;

  if (!userId) {
    const { data: authResult, error: createUserError } =
      await internalAdmin.adminSupabase.auth.admin.createUser({
        email,
        password: values.password,
        email_confirm: true,
        user_metadata: name ? { full_name: name } : undefined,
      });

    if (createUserError || !authResult.user) {
      return jsonError(
        "Création du compte impossible. Vérifie si un compte existe déjà pour cet email.",
        409,
        createUserError?.message ?? "user_create_failed",
      );
    }

    const profileResult = await ensureProfileForUser(
      internalAdmin.adminSupabase,
      authResult.user,
      name,
    );

    if (!profileResult.success) {
      return jsonError(
        "Compte créé, mais profil impossible à préparer.",
        500,
        profileResult.message ?? "profile_upsert_failed",
      );
    }

    userId = authResult.user.id;
    memberName = name ?? email;
  } else if (name && name !== existingProfile?.full_name) {
    await internalAdmin.adminSupabase
      .from("profiles")
      .update({ full_name: name })
      .eq("user_id", userId);
    memberName = name;
  }

  const { data: existingMembership, error: existingMembershipError } =
    await internalAdmin.adminSupabase
      .from("organization_members")
      .select("id, organization_id, user_id, role, status, created_at")
      .eq("organization_id", organizationId)
      .eq("user_id", userId)
      .maybeSingle();

  if (existingMembershipError) {
    return jsonError(
      "Vérification du rattachement existant impossible.",
      500,
      existingMembershipError.message,
    );
  }

  if (existingMembership?.status === "active") {
    return jsonError(
      "Ce compte est déjà actif dans ce workspace.",
      409,
      "member_already_active",
    );
  }

  const { data: membership, error: membershipError } =
    await internalAdmin.adminSupabase
      .from("organization_members")
      .upsert(
        {
          organization_id: organizationId,
          user_id: userId,
          role: values.role,
          status: "active",
        },
        {
          onConflict: "organization_id,user_id",
        },
      )
      .select("id, organization_id, user_id, role, status, created_at")
      .single();

  if (membershipError || !membership) {
    return jsonError(
      "Compte créé, mais rattachement au workspace impossible.",
      500,
      membershipError?.message ?? "membership_create_failed",
    );
  }

  await internalAdmin.adminSupabase.from("audit_logs").insert({
    organization_id: organizationId,
    user_id: internalAdmin.user.id,
    action: "organization_member_created",
    entity_type: "organization_member",
    entity_id: membership.id,
  });

  return NextResponse.json({
    success: true,
    member: mapMember({
      membership,
      email,
      name: memberName,
    }),
  });
}
