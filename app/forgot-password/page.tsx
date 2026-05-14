import { AuthShell } from "@/components/auth/auth-shell";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";
import { T } from "@/components/i18n/translated-text";

export default function ForgotPasswordPage() {
  return (
    <AuthShell
      eyebrow={<T tx="auth.forgot.eyebrow" />}
      title={<T tx="auth.forgot.title" />}
      cardTitle={<T tx="auth.forgot.cardTitle" />}
      cardDescription={<T tx="auth.forgot.cardDescription" />}
      footer={
        <>
          <span>
            <T tx="auth.forgot.footer" />
          </span>
          <span className="hidden sm:inline">FalconDraft</span>
        </>
      }
    >
      <ForgotPasswordForm />
    </AuthShell>
  );
}
