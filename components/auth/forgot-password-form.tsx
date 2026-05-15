"use client";

import Link from "next/link";
import * as React from "react";
import { toast } from "sonner";
import { useI18n } from "@/components/i18n/language-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function ForgotPasswordForm() {
  const { t } = useI18n();
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [hasSentRequest, setHasSentRequest] = React.useState(false);

  return (
    <form
      className="space-y-5"
      onSubmit={async (event) => {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);
        const email = String(formData.get("email") ?? "").trim();
        setIsSubmitting(true);
        const response = await fetch("/api/auth/password-reset", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            email,
          }),
        }).catch(() => null);
        setIsSubmitting(false);

        if (!response?.ok) {
          toast.error(t("auth.forgot.error"), {
            description: t("auth.forgot.errorDescription"),
          });
          return;
        }

        setHasSentRequest(true);
        toast.success(t("auth.forgot.sent"), {
          description: t("auth.forgot.sentDescription"),
        });
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

      {hasSentRequest ? (
        <div className="bg-secondary/35 rounded-lg border p-3 text-sm leading-6">
          {t("auth.forgot.sentDescription")}
        </div>
      ) : null}

      <Button
        type="submit"
        className="w-full"
        size="lg"
        disabled={isSubmitting}
      >
        {isSubmitting ? t("auth.forgot.submitting") : t("auth.forgot.submit")}
      </Button>

      <p className="text-muted-foreground text-center text-sm">
        <Link
          href="/login"
          className="hover:text-foreground font-medium transition-colors"
        >
          {t("auth.forgot.back")}
        </Link>
      </p>
    </form>
  );
}
