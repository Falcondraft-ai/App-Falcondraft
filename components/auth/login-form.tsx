"use client";

import { useRouter } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";
import { PasswordVisibilityToggle } from "@/components/auth/password-visibility-toggle";
import { useI18n } from "@/components/i18n/language-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

function getSafeNextPath(value: string | undefined) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return "/dashboard";
  }

  return value;
}

export function LoginForm({ nextPath }: { nextPath?: string }) {
  const router = useRouter();
  const { t } = useI18n();
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [showPassword, setShowPassword] = React.useState(false);
  const safeNextPath = getSafeNextPath(nextPath);

  return (
    <form
      className="space-y-5"
      onSubmit={async (event) => {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);
        const email = String(formData.get("email") ?? "").trim();
        const password = String(formData.get("password") ?? "");
        const supabase = getSupabaseBrowserClient();

        if (!supabase) {
          toast.error(t("auth.login.unavailable"), {
            description: t("auth.login.unavailableDescription"),
          });
          return;
        }

        setIsSubmitting(true);

        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        setIsSubmitting(false);

        if (error) {
          toast.error(t("auth.login.refused"), {
            description: t("auth.login.refusedDescription"),
          });
          return;
        }

        toast.success(t("auth.login.success"), {
          description: t("auth.login.successDescription"),
        });
        router.replace(safeNextPath);
        router.refresh();
      }}
    >
      <div className="space-y-2">
        <Label htmlFor="email">{t("auth.login.email")}</Label>
        <Input
          id="email"
          name="email"
          type="email"
          placeholder="vous@entreprise.com"
          autoComplete="email"
          required
        />
      </div>
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-3">
          <Label htmlFor="password">{t("auth.login.password")}</Label>
          <a
            href="/forgot-password"
            className="text-muted-foreground hover:text-foreground text-xs font-medium transition-colors"
          >
            {t("auth.login.forgotPassword")}
          </a>
        </div>
        <div className="relative">
          <Input
            id="password"
            name="password"
            type={showPassword ? "text" : "password"}
            placeholder="••••••••"
            autoComplete="current-password"
            className="pr-10"
            required
          />
          <PasswordVisibilityToggle
            visible={showPassword}
            onToggle={() => setShowPassword((current) => !current)}
          />
        </div>
      </div>
      <Button
        type="submit"
        className="w-full"
        size="lg"
        disabled={isSubmitting}
      >
        {isSubmitting ? t("auth.login.submitting") : t("auth.login.submit")}
      </Button>
    </form>
  );
}
