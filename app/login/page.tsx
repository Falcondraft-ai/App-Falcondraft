import { AuthShell } from "@/components/auth/auth-shell";
import { LoginForm } from "@/components/auth/login-form";

type LoginPageProps = {
  searchParams: Promise<{
    next?: string | string[];
  }>;
};

function getSafeNextPath(value: string | string[] | undefined) {
  const nextPath = Array.isArray(value) ? value[0] : value;

  if (!nextPath || !nextPath.startsWith("/") || nextPath.startsWith("//")) {
    return undefined;
  }

  return nextPath;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const nextPath = getSafeNextPath(params.next);

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
      <LoginForm nextPath={nextPath} />
    </AuthShell>
  );
}
