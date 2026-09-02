import type { BrokerProfileRow } from "@/types/database";

/**
 * Helpers purs sur les profils de cabinet — pas de `server-only` ici : le
 * sélecteur et le menu de bascule sont des composants client.
 */

/** Initiales pour l'avatar d'un profil ("Frank Stephan" → "FS"). */
export function profileInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/**
 * Retrouve le profil correspondant à une adresse email — c'est ce qui permet de
 * reconnaître un email envoyé par un membre du cabinet et de l'attribuer.
 */
export function findProfileByEmail(
  profiles: BrokerProfileRow[],
  email: string | null | undefined,
): BrokerProfileRow | null {
  const needle = email?.trim().toLowerCase();
  if (!needle) return null;
  return profiles.find((p) => p.email?.trim().toLowerCase() === needle) ?? null;
}
