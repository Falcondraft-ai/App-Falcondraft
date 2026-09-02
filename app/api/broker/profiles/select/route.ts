import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { PROFILE_COOKIE, profileCookieOptions } from "@/lib/broker/profiles";
import { requireBrokerApiContext } from "@/lib/broker/server";

const schema = z.object({ profileId: z.string().uuid().nullable() });

function jsonError(message: string, status: number, reason: string) {
  return NextResponse.json({ success: false, message, reason }, { status });
}

/**
 * Choisit le profil actif (ou le quitte, avec `profileId: null`).
 *
 * Le profil est un réglage d'affichage et d'attribution, pas un droit : il ne
 * change rien à ce que la session peut lire. On vérifie tout de même qu'il
 * appartient bien à l'organisation, pour qu'un cookie bricolé ne puisse pas
 * faire apparaître le nom de quelqu'un d'un autre cabinet.
 */
export async function POST(request: NextRequest) {
  const auth = await requireBrokerApiContext();
  if (!auth.success) return jsonError(auth.message, auth.status, auth.reason);

  const body: unknown = await request.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  if (!parsed.success) return jsonError("Requête invalide.", 400, "invalid_input");

  const cookieStore = await cookies();

  if (parsed.data.profileId === null) {
    cookieStore.set(PROFILE_COOKIE, "", { ...profileCookieOptions, maxAge: 0 });
    return NextResponse.json({ success: true, profile: null });
  }

  const { data: profile } = await auth.adminSupabase
    .from("broker_profiles")
    .select("id, display_name, email, role_label")
    .eq("organization_id", auth.organizationId)
    .eq("id", parsed.data.profileId)
    .eq("is_active", true)
    .maybeSingle();

  if (!profile) return jsonError("Profil introuvable.", 404, "profile_not_found");

  cookieStore.set(PROFILE_COOKIE, profile.id, profileCookieOptions);
  return NextResponse.json({ success: true, profile });
}
