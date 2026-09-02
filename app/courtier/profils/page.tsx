import { redirect } from "next/navigation";
import { ProfilePicker } from "@/components/broker/profile-picker";
import { requireActiveWorkspaceContext } from "@/lib/auth/session";
import { isBrokerWorkspace } from "@/lib/broker/access";
import { getBrokerProfiles } from "@/lib/broker/profiles";

export const dynamic = "force-dynamic";

/**
 * Entrée explicite « changer de profil ».
 *
 * Le choix à l'arrivée, lui, est rendu par le layout courtier : tant que
 * personne n'est identifié, il affiche le sélecteur à la place du contenu.
 * Rediriger vers cette page depuis ce même layout bouclerait.
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
      <ProfilePicker profiles={profiles} redirectTo="/courtier" />
    </main>
  );
}
