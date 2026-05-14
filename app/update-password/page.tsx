import { AuthShell } from "@/components/auth/auth-shell";
import { UpdatePasswordForm } from "@/components/auth/update-password-form";
import { T } from "@/components/i18n/translated-text";

export default function UpdatePasswordPage() {
  return (
    <AuthShell
      eyebrow={<T tx="auth.update.eyebrow" />}
      title={<T tx="auth.update.title" />}
      cardTitle={<T tx="auth.update.cardTitle" />}
      cardDescription={<T tx="auth.update.cardDescription" />}
      footer={
        <>
          <span>
            <T tx="auth.update.footer" />
          </span>
          <span className="hidden sm:inline">FalconDraft</span>
        </>
      }
    >
      <UpdatePasswordForm />
    </AuthShell>
  );
}
