"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";
import { PasswordVisibilityToggle } from "@/components/auth/password-visibility-toggle";
import { useI18n } from "@/components/i18n/language-provider";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { normalizeWorkspaceRole } from "@/lib/auth/workspace-permissions";
import {
  normalizeEmail,
  type InvitationLookupResult,
} from "@/lib/invitations/shared";
import type { TranslationKey } from "@/lib/i18n/translations";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

type InviteOnboardingProps = {
  token: string;
  lookup: InvitationLookupResult;
  currentUserEmail: string | null;
};

type ApiResult =
  | {
      success: true;
      organization_id?: string;
      email?: string;
    }
  | {
      success: false;
      message?: string;
    };

function getInvalidInvitationCopy(state: InvitationLookupResult["state"]) {
  if (state === "expired") {
    return {
      title: "invite.invalid.expired.title",
      description: "invite.invalid.expired.description",
    };
  }

  if (state === "revoked") {
    return {
      title: "invite.invalid.revoked.title",
      description: "invite.invalid.revoked.description",
    };
  }

  if (state === "accepted") {
    return {
      title: "invite.invalid.accepted.title",
      description: "invite.invalid.accepted.description",
    };
  }

  return {
    title: "invite.invalid.default.title",
    description: "invite.invalid.default.description",
  };
}

async function parseApiResult(response: Response): Promise<ApiResult> {
  return (await response.json().catch(() => ({
    success: false,
    message: "Opération impossible.",
  }))) as ApiResult;
}

function getApiErrorMessage(result: ApiResult, fallback: string) {
  return result.success ? fallback : (result.message ?? fallback);
}

export function InviteOnboarding({
  token,
  lookup,
  currentUserEmail,
}: InviteOnboardingProps) {
  const router = useRouter();
  const { t } = useI18n();
  const invitation = lookup.invitation;
  const [fullName, setFullName] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [showPassword, setShowPassword] = React.useState(false);
  const [isCreatingAccount, setIsCreatingAccount] = React.useState(false);
  const [isAccepting, setIsAccepting] = React.useState(false);
  const [isSigningOut, setIsSigningOut] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  if (!lookup.valid || !invitation) {
    const copy = getInvalidInvitationCopy(lookup.state);

    return (
      <div className="space-y-5">
        <Alert
          variant={lookup.state === "accepted" ? "default" : "destructive"}
        >
          <AlertTitle>{t(copy.title as TranslationKey)}</AlertTitle>
          <AlertDescription>
            {t(copy.description as TranslationKey)}
          </AlertDescription>
        </Alert>
        <Button asChild className="w-full">
          <Link href="/login">{t("invite.goLogin")}</Link>
        </Button>
      </div>
    );
  }

  const invitedEmail = normalizeEmail(invitation.email);
  const currentEmail = currentUserEmail
    ? normalizeEmail(currentUserEmail)
    : null;
  const invitePath = `/invite/${encodeURIComponent(token)}`;
  const loginHref = `/login?next=${encodeURIComponent(invitePath)}`;
  const authenticatedEmailMatches = currentEmail === invitedEmail;

  async function acceptInvitation() {
    setError(null);
    setIsAccepting(true);

    const response = await fetch("/api/invitations/accept", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ token }),
    });
    const result = await parseApiResult(response);

    setIsAccepting(false);

    if (!response.ok || !result.success) {
      const message = getApiErrorMessage(result, t("invite.acceptFallback"));
      setError(message);
      toast.error(t("invite.acceptError"), {
        description: message,
      });
      return;
    }

    toast.success(t("invite.accepted"), {
      description: t("invite.acceptedDescription"),
    });
    router.replace("/dashboard");
    router.refresh();
  }

  async function createAccount(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsCreatingAccount(true);

    const signupResponse = await fetch("/api/invitations/signup", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        token,
        password,
        full_name: fullName,
      }),
    });
    const signupResult = await parseApiResult(signupResponse);

    if (!signupResponse.ok || !signupResult.success) {
      const message = getApiErrorMessage(
        signupResult,
        t("invite.createFallback"),
      );
      setError(message);
      setIsCreatingAccount(false);
      toast.error(t("invite.accountNotCreated"), {
        description: message,
      });
      return;
    }

    const supabase = getSupabaseBrowserClient();

    if (!supabase) {
      setError(t("invite.signInUnavailable"));
      setIsCreatingAccount(false);
      return;
    }

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: invitedEmail,
      password,
    });

    if (signInError) {
      setError(t("invite.createdSignIn"));
      setIsCreatingAccount(false);
      return;
    }

    setIsCreatingAccount(false);
    await acceptInvitation();
  }

  async function switchAccount() {
    const supabase = getSupabaseBrowserClient();

    if (!supabase) {
      router.replace(loginHref);
      return;
    }

    setIsSigningOut(true);
    await supabase.auth.signOut();
    setIsSigningOut(false);
    router.replace(loginHref);
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <div className="bg-background/70 rounded-xl border p-4">
        <p className="text-muted-foreground text-xs font-medium tracking-[0.14em] uppercase">
          {t("invite.guestSpace")}
        </p>
        <h2 className="mt-2 text-xl font-semibold tracking-[-0.04em]">
          {invitation.organizationName}
        </h2>
        <dl className="mt-4 grid gap-3 text-sm">
          <div className="flex items-center justify-between gap-4">
            <dt className="text-muted-foreground">
              {t("invite.invitedEmail")}
            </dt>
            <dd className="font-medium">{invitedEmail}</dd>
          </div>
          <div className="flex items-center justify-between gap-4">
            <dt className="text-muted-foreground">{t("invite.role")}</dt>
            <dd className="font-medium">
              {t(
                `roles.${normalizeWorkspaceRole(invitation.role) ?? "member"}` as TranslationKey,
              )}
            </dd>
          </div>
        </dl>
      </div>

      {error ? (
        <Alert variant="destructive">
          <AlertTitle>{t("invite.actionImpossible")}</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {!currentEmail ? (
        <div className="space-y-5">
          <form className="space-y-4" onSubmit={createAccount}>
            <div className="space-y-2">
              <Label htmlFor="invite-email">{t("invite.invitedEmail")}</Label>
              <Input
                id="invite-email"
                type="email"
                value={invitedEmail}
                readOnly
                aria-readonly="true"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="invite-full-name">{t("invite.fullName")}</Label>
              <Input
                id="invite-full-name"
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
                placeholder={t("invite.fullNamePlaceholder")}
                autoComplete="name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="invite-password">{t("invite.password")}</Label>
              <div className="relative">
                <Input
                  id="invite-password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="••••••••"
                  autoComplete="new-password"
                  className="pr-10"
                  minLength={8}
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
              disabled={isCreatingAccount || isAccepting}
            >
              {isCreatingAccount || isAccepting
                ? t("invite.preparing")
                : t("invite.createAndJoin")}
            </Button>
          </form>
          <div className="bg-card rounded-lg border px-4 py-3 text-sm">
            <p className="text-muted-foreground">
              {t("invite.existingAccount")}{" "}
              <Link
                href={loginHref}
                className="text-foreground font-medium underline underline-offset-4"
              >
                {t("invite.loginToAccept")}
              </Link>
            </p>
          </div>
        </div>
      ) : authenticatedEmailMatches ? (
        <div className="space-y-4">
          <Alert>
            <AlertTitle>{t("invite.accountRecognized")}</AlertTitle>
            <AlertDescription>
              {t("invite.accountRecognizedDescription", {
                email: currentEmail,
                organization: invitation.organizationName,
              })}
            </AlertDescription>
          </Alert>
          <Button
            type="button"
            className="w-full"
            size="lg"
            disabled={isAccepting}
            onClick={() => void acceptInvitation()}
          >
            {isAccepting ? t("invite.accepting") : t("invite.accept")}
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          <Alert variant="destructive">
            <AlertTitle>{t("invite.emailDifferent")}</AlertTitle>
            <AlertDescription>
              {t("invite.emailDifferentDescription", {
                invitedEmail,
                currentEmail: currentEmail ?? "",
              })}
            </AlertDescription>
          </Alert>
          <Button
            type="button"
            className="w-full"
            variant="outline"
            disabled={isSigningOut}
            onClick={() => void switchAccount()}
          >
            {isSigningOut ? t("invite.switching") : t("invite.switchAccount")}
          </Button>
        </div>
      )}
    </div>
  );
}
