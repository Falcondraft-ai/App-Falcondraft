import { AuthShell } from "@/components/auth/auth-shell";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";

export default function ForgotPasswordPage() {
  return (
    <AuthShell
      eyebrow="Mot de passe oublié"
      title="Recevoir un lien sécurisé"
      cardTitle="Réinitialisation"
      cardDescription="Indiquez l’email associé à votre compte FalconDraft."
      footer={
        <>
          <span>Lien valable temporairement.</span>
          <span className="hidden sm:inline">FalconDraft</span>
        </>
      }
    >
      <ForgotPasswordForm />
    </AuthShell>
  );
}
