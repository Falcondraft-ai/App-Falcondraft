import { AuthShell } from "@/components/auth/auth-shell";
import { LoginForm } from "@/components/auth/login-form";

export default function LoginPage() {
  return (
    <AuthShell
      eyebrow="Connexion"
      title="Accéder à FalconDraft"
      cardTitle="Compte professionnel"
      cardDescription="Connectez-vous pour rejoindre votre espace de travail."
      footer={
        <>
          <span>Accès réservé aux utilisateurs invités.</span>
          <span className="hidden sm:inline">FalconDraft</span>
        </>
      }
    >
      <LoginForm />
    </AuthShell>
  );
}
