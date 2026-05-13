import { AuthShell } from "@/components/auth/auth-shell";
import { UpdatePasswordForm } from "@/components/auth/update-password-form";

export default function UpdatePasswordPage() {
  return (
    <AuthShell
      eyebrow="Nouveau mot de passe"
      title="Sécuriser votre accès"
      cardTitle="Définir un nouveau mot de passe"
      cardDescription="Choisissez un mot de passe solide pour votre compte."
      footer={
        <>
          <span>Session de réinitialisation sécurisée.</span>
          <span className="hidden sm:inline">FalconDraft</span>
        </>
      }
    >
      <UpdatePasswordForm />
    </AuthShell>
  );
}
