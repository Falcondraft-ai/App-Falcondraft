import { redirect } from "next/navigation";
import { ProfilePicker } from "@/components/broker/profile-picker";
import { requireActiveWorkspaceContext } from "@/lib/auth/session";
import { isBrokerWorkspace } from "@/lib/broker/access";
import { getBrokerProfiles } from "@/lib/broker/profiles";

export const dynamic = "force-dynamic";

/**
 * Écran de choix du profil. Hors du layout courtier : tant que personne n'est
 * identifié, afficher la navigation complète du cabinet n'aurait pas de sens.
 */
export default async function CourtierProfilesPage() {
  const context = await requireActiveWorkspaceContext();
  if (!isBrokerWorkspace(context.organization)) redirect("/dashboard");

  const profiles = await getBrokerProfiles(context.organization!.id);

  // Cabinet sans profils : la fonctionnalité est optionnelle, on ne bloque
  // personne sur un écran vide.
  if (profiles.length === 0) redirect("/courtier");

  return (
    <main className="min-h-screen" style={{ background: "var(--bg-canvas)" }}>
      <ProfilePicker profiles={profiles} />
    </main>
  );
}
