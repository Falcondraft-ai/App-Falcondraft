"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";
import { PasswordVisibilityToggle } from "@/components/auth/password-visibility-toggle";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  getWorkspaceRoleLabel,
  normalizeEmail,
  type InvitationLookupResult,
} from "@/lib/invitations/shared";
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
      title: "Invitation expirée",
      description:
        "Ce lien n’est plus actif. Demandez à un propriétaire ou gestionnaire de l’espace d’envoyer une nouvelle invitation.",
    };
  }

  if (state === "revoked") {
    return {
      title: "Invitation révoquée",
      description:
        "Cette invitation a été annulée. Contactez votre interlocuteur FalconDraft si vous pensez qu’il s’agit d’une erreur.",
    };
  }

  if (state === "accepted") {
    return {
      title: "Invitation déjà acceptée",
      description:
        "Ce lien a déjà été utilisé. Connectez-vous avec le compte associé pour accéder à votre espace.",
    };
  }

  return {
    title: "Invitation invalide",
    description:
      "Ce lien d’invitation est introuvable ou incomplet. Vérifiez l’email reçu ou demandez une nouvelle invitation.",
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
          <AlertTitle>{copy.title}</AlertTitle>
          <AlertDescription>{copy.description}</AlertDescription>
        </Alert>
        <Button asChild className="w-full">
          <Link href="/login">Aller à la connexion</Link>
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
      const message = getApiErrorMessage(
        result,
        "Invitation impossible à accepter.",
      );
      setError(message);
      toast.error("Invitation non acceptée", {
        description: message,
      });
      return;
    }

    toast.success("Invitation acceptée", {
      description: "Votre accès à l’espace FalconDraft est prêt.",
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
        "Création impossible. Connectez-vous si votre compte existe déjà.",
      );
      setError(message);
      setIsCreatingAccount(false);
      toast.error("Compte non créé", {
        description: message,
      });
      return;
    }

    const supabase = getSupabaseBrowserClient();

    if (!supabase) {
      setError(
        "Connexion indisponible. La configuration Supabase est manquante.",
      );
      setIsCreatingAccount(false);
      return;
    }

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: invitedEmail,
      password,
    });

    if (signInError) {
      setError(
        "Compte créé. Connectez-vous avec votre email et votre mot de passe pour accepter l’invitation.",
      );
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
          Espace invité
        </p>
        <h2 className="mt-2 text-xl font-semibold tracking-[-0.04em]">
          {invitation.organizationName}
        </h2>
        <dl className="mt-4 grid gap-3 text-sm">
          <div className="flex items-center justify-between gap-4">
            <dt className="text-muted-foreground">Email</dt>
            <dd className="font-medium">{invitedEmail}</dd>
          </div>
          <div className="flex items-center justify-between gap-4">
            <dt className="text-muted-foreground">Rôle</dt>
            <dd className="font-medium">
              {getWorkspaceRoleLabel(invitation.role)}
            </dd>
          </div>
        </dl>
      </div>

      {error ? (
        <Alert variant="destructive">
          <AlertTitle>Action impossible</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {!currentEmail ? (
        <div className="space-y-5">
          <form className="space-y-4" onSubmit={createAccount}>
            <div className="space-y-2">
              <Label htmlFor="invite-email">Email invité</Label>
              <Input
                id="invite-email"
                type="email"
                value={invitedEmail}
                readOnly
                aria-readonly="true"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="invite-full-name">Nom complet</Label>
              <Input
                id="invite-full-name"
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
                placeholder="Votre nom"
                autoComplete="name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="invite-password">Mot de passe</Label>
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
                ? "Préparation de l’accès..."
                : "Créer mon compte et rejoindre"}
            </Button>
          </form>
          <div className="bg-card rounded-lg border px-4 py-3 text-sm">
            <p className="text-muted-foreground">
              Vous avez déjà un compte FalconDraft ?{" "}
              <Link
                href={loginHref}
                className="text-foreground font-medium underline underline-offset-4"
              >
                Connectez-vous pour accepter l’invitation.
              </Link>
            </p>
          </div>
        </div>
      ) : authenticatedEmailMatches ? (
        <div className="space-y-4">
          <Alert>
            <AlertTitle>Compte reconnu</AlertTitle>
            <AlertDescription>
              Vous êtes connecté avec {currentEmail}. Vous pouvez maintenant
              rejoindre l’espace {invitation.organizationName}.
            </AlertDescription>
          </Alert>
          <Button
            type="button"
            className="w-full"
            size="lg"
            disabled={isAccepting}
            onClick={() => void acceptInvitation()}
          >
            {isAccepting ? "Acceptation..." : "Accepter l’invitation"}
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          <Alert variant="destructive">
            <AlertTitle>Email différent</AlertTitle>
            <AlertDescription>
              Cette invitation est destinée à {invitedEmail}. Vous êtes connecté
              avec {currentEmail}. Déconnectez-vous pour utiliser le bon compte.
            </AlertDescription>
          </Alert>
          <Button
            type="button"
            className="w-full"
            variant="outline"
            disabled={isSigningOut}
            onClick={() => void switchAccount()}
          >
            {isSigningOut ? "Déconnexion..." : "Changer de compte"}
          </Button>
        </div>
      )}
    </div>
  );
}
