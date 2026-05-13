"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";
import { PasswordVisibilityToggle } from "@/components/auth/password-visibility-toggle";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

export function UpdatePasswordForm() {
  const router = useRouter();
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
          toast.error("Mot de passe trop court", {
            description: "Utilisez au moins 8 caractères.",
          });
          return;
        }

        if (password !== confirmPassword) {
          toast.error("Confirmation différente", {
            description: "Les deux mots de passe doivent être identiques.",
          });
          return;
        }

        if (!supabase) {
          toast.error("Mise à jour indisponible", {
            description: "La configuration Supabase est manquante.",
          });
          return;
        }

        const { data: sessionData } = await supabase.auth.getSession();

        if (!sessionData.session) {
          toast.error("Lien invalide ou expiré", {
            description: "Demandez un nouveau lien de réinitialisation.",
          });
          return;
        }

        setIsSubmitting(true);
        const { error } = await supabase.auth.updateUser({ password });
        setIsSubmitting(false);

        if (error) {
          toast.error("Mise à jour impossible", {
            description: "Le lien a peut-être expiré. Demandez un nouveau lien.",
          });
          return;
        }

        toast.success("Mot de passe modifié", {
          description: "Vous pouvez accéder à votre espace FalconDraft.",
        });
        router.replace("/dashboard");
        router.refresh();
      }}
    >
      <div className="space-y-2">
        <Label htmlFor="password">Nouveau mot de passe</Label>
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
        <Label htmlFor="confirmPassword">Confirmer le mot de passe</Label>
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
        {isSubmitting ? "Mise à jour..." : "Enregistrer le mot de passe"}
      </Button>

      {hasRecoverySession === false ? (
        <div className="rounded-lg border bg-secondary/35 p-3 text-sm leading-6">
          Le lien de réinitialisation est invalide ou expiré. Demandez un
          nouveau lien pour définir votre mot de passe.
        </div>
      ) : null}

      <p className="text-center text-sm text-muted-foreground">
        <Link href="/forgot-password" className="hover:text-foreground font-medium transition-colors">
          Demander un nouveau lien
        </Link>
      </p>
    </form>
  );
}
