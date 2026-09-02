import "server-only";

import { cookies } from "next/headers";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { BrokerProfileRow } from "@/types/database";

/**
 * Profils de cabinet — plusieurs personnes partagent un compte.
 *
 * Le profil actif vit dans un cookie, pas dans la session Supabase : il ne
 * confère aucun droit. Toute la sécurité reste portée par l'authentification du
 * compte et les politiques RLS de l'organisation ; changer de profil ne donne
 * accès à rien de plus, ça change seulement l'identité sous laquelle on
 * travaille et la boîte email qu'on consulte. C'est aussi pour ça qu'un cookie
 * falsifié est sans conséquence sur le cloisonnement des données — mais on
 * vérifie quand même que le profil appartient bien à l'organisation, pour ne
 * jamais afficher le nom d'un cabinet voisin.
 */
export const PROFILE_COOKIE = "courtier_profile";

/** Un an : le profil est un réglage de poste de travail, pas une session. */
const PROFILE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export const profileCookieOptions = {
  httpOnly: true,
  sameSite: "lax",
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: PROFILE_COOKIE_MAX_AGE,
} as const;

/**
 * Profils du cabinet, dans l'ordre d'affichage choisi. Actifs seulement par
 * défaut — l'écran de réglages, lui, doit aussi montrer les profils désactivés
 * pour pouvoir les réactiver.
 */
export async function getBrokerProfiles(
  organizationId: string,
  options?: { includeInactive?: boolean },
): Promise<BrokerProfileRow[]> {
  const supabase = await getSupabaseServerClient();
  if (!supabase) return [];

  let query = supabase
    .from("broker_profiles")
    .select("*")
    .eq("organization_id", organizationId);
  if (!options?.includeInactive) query = query.eq("is_active", true);

  const { data } = await query
    .order("sort_order", { ascending: true })
    .order("display_name", { ascending: true });

  return (data ?? []) as BrokerProfileRow[];
}

/**
 * Profil actif, résolu depuis le cookie et VALIDÉ contre l'organisation.
 *
 * Renvoie null quand le cabinet n'a pas encore de profils (cas normal : la
 * fonctionnalité est optionnelle, un cabinet d'une personne n'en a pas besoin)
 * ou quand le cookie désigne un profil supprimé, désactivé, ou appartenant à
 * une autre organisation.
 */
export async function getActiveBrokerProfile(
  organizationId: string,
  profiles?: BrokerProfileRow[],
): Promise<BrokerProfileRow | null> {
  const list = profiles ?? (await getBrokerProfiles(organizationId));
  if (list.length === 0) return null;

  const cookieStore = await cookies();
  const selected = cookieStore.get(PROFILE_COOKIE)?.value;
  if (!selected) return null;

  return list.find((p) => p.id === selected) ?? null;
}

// Helpers purs (initiales, rapprochement par email) : voir profile-format.ts,
// importable depuis les composants client.
export { findProfileByEmail, profileInitials } from "@/lib/broker/profile-format";
