import Link from "next/link";
import { AuthShell } from "@/components/auth/auth-shell";
import { NoAccessActions } from "@/components/auth/no-access-actions";
import { Button } from "@/components/ui/button";

export default function NoAccessPage() {
  return (
    <AuthShell
      eyebrow="Accès privé"
      title="Aucun workspace associé"
      cardTitle="Accès sur invitation uniquement"
      cardDescription="Votre compte existe, mais il n’est rattaché à aucun espace client FalconDraft actif."
      footer={
        <>
          <span>Demandez une invitation à votre gestionnaire.</span>
          <span className="hidden sm:inline">FalconDraft</span>
        </>
      }
    >
      <div className="space-y-4">
        <p className="text-muted-foreground text-sm leading-6">
          Pour accéder au dashboard, votre adresse doit être invitée puis
          rattachée à un workspace actif. Si vous avez reçu une invitation,
          ouvrez le lien présent dans l’email.
        </p>
        <NoAccessActions />
        <Button asChild variant="outline" className="w-full" size="lg">
          <Link href="/">Retour à l’accueil</Link>
        </Button>
      </div>
    </AuthShell>
  );
}
