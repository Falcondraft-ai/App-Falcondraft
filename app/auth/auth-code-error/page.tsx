import Link from "next/link";
import { AuthShell } from "@/components/auth/auth-shell";
import { Button } from "@/components/ui/button";

export default function AuthCodeErrorPage() {
  return (
    <AuthShell
      eyebrow="Lien expiré"
      title="Impossible de vérifier ce lien"
      cardTitle="Lien invalide ou expiré"
      cardDescription="Demandez un nouveau lien de réinitialisation pour continuer."
      footer={
        <>
          <span>Accès sécurisé FalconDraft.</span>
          <span className="hidden sm:inline">FalconDraft</span>
        </>
      }
    >
      <div className="space-y-4">
        <p className="text-muted-foreground text-sm leading-6">
          Le lien utilisé n’est plus valide. Cela peut arriver si le lien a déjà
          été utilisé ou si sa durée de validité est dépassée.
        </p>
        <Button asChild className="w-full" size="lg">
          <Link href="/forgot-password">Recevoir un nouveau lien</Link>
        </Button>
        <Button asChild variant="outline" className="w-full" size="lg">
          <Link href="/login">Retour à la connexion</Link>
        </Button>
      </div>
    </AuthShell>
  );
}
