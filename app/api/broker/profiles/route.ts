import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { canCreateWorkspaceRecords } from "@/lib/auth/workspace-permissions";
import { PROFILE_COOKIE, profileCookieOptions } from "@/lib/broker/profiles";
import { requireBrokerApiContext } from "@/lib/broker/server";
import type { BrokerProfileRow } from "@/types/database";

/**
 * Champ facultatif saisi à la main : on ramène « vide », « que des espaces » et
 * `null` au même sens — non renseigné. Sans ça, une adresse effacée qui laisse
 * une espace derrière elle fait échouer tout l'enregistrement.
 */
const blankToUndefined = (value: unknown) =>
  typeof value === "string" ? value.trim() || undefined : (value ?? undefined);

const createSchema = z.object({
  displayName: z
    .string({ error: "Indiquez le nom du profil." })
    .trim()
    .min(1, "Indiquez le nom du profil.")
    .max(80, "Nom trop long (80 caractères maximum)."),
  email: z.preprocess(
    blankToUndefined,
    z
      .string()
      .email("Adresse email invalide.")
      .max(200, "Adresse email trop longue.")
      .optional(),
  ),
  roleLabel: z.preprocess(
    blankToUndefined,
    z.string().max(60, "Fonction trop longue (60 caractères maximum).").optional(),
  ),
});

const updateSchema = createSchema.partial().extend({
  id: z.string().uuid(),
  isActive: z.boolean().optional(),
  sortOrder: z.number().int().min(0).max(999).optional(),
});

function jsonError(message: string, status: number, reason: string) {
  return NextResponse.json({ success: false, message, reason }, { status });
}

/**
 * Reprend le message de la première règle enfreinte plutôt qu'un libellé
 * générique : « Nom de profil invalide » alors que c'est l'adresse qui coince
 * envoie le courtier corriger le mauvais champ.
 */
function validationMessage(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Champs du profil invalides.";
}

/** Profils du cabinet. */
export async function GET() {
  const auth = await requireBrokerApiContext();
  if (!auth.success) return jsonError(auth.message, auth.status, auth.reason);

  const { data } = await auth.adminSupabase
    .from("broker_profiles")
    .select("*")
    .eq("organization_id", auth.organizationId)
    .order("sort_order", { ascending: true })
    .order("display_name", { ascending: true });

  return NextResponse.json({ success: true, profiles: (data ?? []) as BrokerProfileRow[] });
}

/** Crée un profil. */
export async function POST(request: NextRequest) {
  const auth = await requireBrokerApiContext();
  if (!auth.success) return jsonError(auth.message, auth.status, auth.reason);
  if (!canCreateWorkspaceRecords(auth.context.membership?.role)) {
    return jsonError("Votre rôle ne permet pas cette action.", 403, "insufficient_role");
  }

  const body: unknown = await request.json().catch(() => ({}));
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(validationMessage(parsed.error), 400, "invalid_input");
  }

  const email = parsed.data.email?.trim().toLowerCase() || null;

  // L'adresse identifie la boîte du profil : deux profils ne peuvent pas la
  // partager, sinon le rattachement des emails devient ambigu.
  if (email) {
    const { data: clash } = await auth.adminSupabase
      .from("broker_profiles")
      .select("id")
      .eq("organization_id", auth.organizationId)
      .ilike("email", email)
      .maybeSingle();
    if (clash) {
      return jsonError(
        "Cette adresse est déjà associée à un autre profil.",
        409,
        "email_taken",
      );
    }
  }

  // Nouveau profil en fin de liste.
  const { data: last } = await auth.adminSupabase
    .from("broker_profiles")
    .select("sort_order")
    .eq("organization_id", auth.organizationId)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: created, error } = await auth.adminSupabase
    .from("broker_profiles")
    .insert({
      organization_id: auth.organizationId,
      display_name: parsed.data.displayName.trim(),
      email,
      role_label: parsed.data.roleLabel?.trim() || null,
      sort_order: ((last?.sort_order as number | undefined) ?? -1) + 1,
    })
    .select("*")
    .single();

  if (error || !created) {
    return jsonError(
      "Le profil n’a pas pu être créé. Vérifiez que la migration 0057 est appliquée.",
      500,
      "insert_failed",
    );
  }

  return NextResponse.json({ success: true, profile: created as BrokerProfileRow });
}

/** Met à jour un profil (renommage, adresse, ordre, désactivation). */
export async function PATCH(request: NextRequest) {
  const auth = await requireBrokerApiContext();
  if (!auth.success) return jsonError(auth.message, auth.status, auth.reason);
  if (!canCreateWorkspaceRecords(auth.context.membership?.role)) {
    return jsonError("Votre rôle ne permet pas cette action.", 403, "insufficient_role");
  }

  const body: unknown = await request.json().catch(() => ({}));
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(validationMessage(parsed.error), 400, "invalid_input");
  }

  const { id, displayName, email, roleLabel, isActive, sortOrder } = parsed.data;
  const normalizedEmail =
    email === undefined ? undefined : email.trim().toLowerCase() || null;

  if (normalizedEmail) {
    const { data: clash } = await auth.adminSupabase
      .from("broker_profiles")
      .select("id")
      .eq("organization_id", auth.organizationId)
      .ilike("email", normalizedEmail)
      .neq("id", id)
      .maybeSingle();
    if (clash) {
      return jsonError(
        "Cette adresse est déjà associée à un autre profil.",
        409,
        "email_taken",
      );
    }
  }

  const { error } = await auth.adminSupabase
    .from("broker_profiles")
    .update({
      ...(displayName !== undefined ? { display_name: displayName.trim() } : {}),
      ...(normalizedEmail !== undefined ? { email: normalizedEmail } : {}),
      ...(roleLabel !== undefined ? { role_label: roleLabel.trim() || null } : {}),
      ...(isActive !== undefined ? { is_active: isActive } : {}),
      ...(sortOrder !== undefined ? { sort_order: sortOrder } : {}),
      updated_at: new Date().toISOString(),
    })
    .eq("organization_id", auth.organizationId)
    .eq("id", id);

  if (error) return jsonError("Mise à jour impossible.", 500, "update_failed");
  return NextResponse.json({ success: true });
}

/**
 * Supprime un profil.
 *
 * Ce qui a été fait sous ce profil n'est pas effacé : les dossiers, documents et
 * devoirs de conseil restent, leur `profile_id` retombe simplement à null
 * (`on delete set null`). Seule sa boîte email part avec lui, elle n'a plus de
 * propriétaire. Le dernier profil n'est pas supprimable : un cabinet en garde
 * toujours un.
 */
export async function DELETE(request: NextRequest) {
  const auth = await requireBrokerApiContext();
  if (!auth.success) return jsonError(auth.message, auth.status, auth.reason);
  if (!canCreateWorkspaceRecords(auth.context.membership?.role)) {
    return jsonError("Votre rôle ne permet pas cette action.", 403, "insufficient_role");
  }

  const id = request.nextUrl.searchParams.get("id");
  if (!id) return jsonError("Profil manquant.", 400, "invalid_input");

  const { data: profiles } = await auth.adminSupabase
    .from("broker_profiles")
    .select("id")
    .eq("organization_id", auth.organizationId);

  const list = profiles ?? [];
  if (!list.some((p) => p.id === id)) {
    return jsonError("Profil introuvable.", 404, "profile_not_found");
  }
  if (list.length <= 1) {
    return jsonError(
      "Impossible de supprimer le dernier profil du cabinet.",
      409,
      "last_profile",
    );
  }

  const { error } = await auth.adminSupabase
    .from("broker_profiles")
    .delete()
    .eq("organization_id", auth.organizationId)
    .eq("id", id);

  if (error) {
    console.error("[broker] profile delete failed:", error.message);
    return jsonError("Suppression impossible.", 500, "delete_failed");
  }

  // Le profil supprimé était peut-être celui en cours : sans ça, le cabinet
  // resterait bloqué sur un cookie qui ne désigne plus personne.
  const cookieStore = await cookies();
  if (cookieStore.get(PROFILE_COOKIE)?.value === id) {
    cookieStore.set(PROFILE_COOKIE, "", { ...profileCookieOptions, maxAge: 0 });
  }

  return NextResponse.json({ success: true });
}
