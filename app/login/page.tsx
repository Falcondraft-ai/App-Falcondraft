import { AuthShell } from "@/components/auth/auth-shell";
import { LoginForm } from "@/components/auth/login-form";
import { T } from "@/components/i18n/translated-text";

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
      eyebrow={<T tx="auth.login.eyebrow" />}
      title={<T tx="auth.login.title" />}
      cardTitle={<T tx="auth.login.cardTitle" />}
      cardDescription={<T tx="auth.login.cardDescription" />}
      footer={
        <>
          <span>
            <T tx="auth.shell.invitedOnly" />
          </span>
          <span className="hidden sm:inline">FalconDraft</span>
        </>
      }
    >
      <LoginForm nextPath={nextPath} />
    </AuthShell>
  );
}
