"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";
import { PasswordVisibilityToggle } from "@/components/auth/password-visibility-toggle";
import { useI18n } from "@/components/i18n/language-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

export function UpdatePasswordForm() {
  const router = useRouter();
  const { t } = useI18n();
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [showPassword, setShowPassword] = React.useState(false);
  const [hasRecoverySession, setHasRecoverySession] = React.useState<
    boolean | null
  >(null);

  React.useEffect(() => {
    const supabase = getSupabaseBrowserClient();

    if (!supabase) {
      setHasRecoverySession(false);
      return;
    }

    void supabase.auth.getSession().then(({ data }) => {
      setHasRecoverySession(Boolean(data.session));
    });
  }, []);

  return (
    <form
      className="space-y-5"
      onSubmit={async (event) => {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);
        const password = String(formData.get("password") ?? "");
        const confirmPassword = String(formData.get("confirmPassword") ?? "");
        const supabase = getSupabaseBrowserClient();

        if (password.length < 8) {
          toast.error(t("auth.update.tooShort"), {
            description: t("auth.update.tooShortDescription"),
          });
          return;
        }

        if (password !== confirmPassword) {
          toast.error(t("auth.update.mismatch"), {
            description: t("auth.update.mismatchDescription"),
          });
          return;
        }

        if (!supabase) {
          toast.error(t("auth.update.unavailable"), {
            description: t("auth.login.unavailableDescription"),
          });
          return;
        }

        const { data: sessionData } = await supabase.auth.getSession();

        if (!sessionData.session) {
          toast.error(t("auth.update.invalid"), {
            description: t("auth.update.invalidDescription"),
          });
          return;
        }

        setIsSubmitting(true);
        const { error } = await supabase.auth.updateUser({ password });
        setIsSubmitting(false);

        if (error) {
          toast.error(t("auth.update.error"), {
            description: t("auth.update.errorDescription"),
          });
          return;
        }

        toast.success(t("auth.update.success"), {
          description: t("auth.update.successDescription"),
        });
        router.replace("/dashboard");
        router.refresh();
      }}
    >
      <div className="space-y-2">
        <Label htmlFor="password">{t("auth.update.password")}</Label>
        <div className="relative">
          <Input
            id="password"
            name="password"
            type={showPassword ? "text" : "password"}
            placeholder="••••••••"
            autoComplete="new-password"
            className="pr-10"
            required
          />
          <PasswordVisibilityToggle
            visible={showPassword}
            onToggle={() => setShowPassword((current) => !current)}
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="confirmPassword">
          {t("auth.update.confirmPassword")}
        </Label>
        <Input
          id="confirmPassword"
          name="confirmPassword"
          type={showPassword ? "text" : "password"}
          placeholder="••••••••"
          autoComplete="new-password"
          required
        />
      </div>

      <Button
        type="submit"
        className="w-full"
        size="lg"
        disabled={isSubmitting || hasRecoverySession === false}
      >
        {isSubmitting ? t("auth.update.submitting") : t("auth.update.submit")}
      </Button>

      {hasRecoverySession === false ? (
        <div className="bg-secondary/35 rounded-lg border p-3 text-sm leading-6">
          {t("auth.update.invalidPanel")}
        </div>
      ) : null}

      <p className="text-muted-foreground text-center text-sm">
        <Link
          href="/forgot-password"
          className="hover:text-foreground font-medium transition-colors"
        >
          {t("auth.update.newLink")}
        </Link>
      </p>
    </form>
  );
}
