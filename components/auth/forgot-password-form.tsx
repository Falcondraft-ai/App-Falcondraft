"use client";

import Link from "next/link";
import * as React from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

export function ForgotPasswordForm() {
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [hasSentRequest, setHasSentRequest] = React.useState(false);

  return (
    <form
      className="space-y-5"
      onSubmit={async (event) => {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);
        const email = String(formData.get("email") ?? "").trim();
        const supabase = getSupabaseBrowserClient();

        if (!supabase) {
          toast.error("Réinitialisation indisponible", {
            description: "La configuration Supabase est manquante.",
          });
          return;
        }

        setIsSubmitting(true);
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/auth/confirm?next=/update-password`,
        });
        setIsSubmitting(false);

        if (error) {
          toast.error("Demande impossible", {
            description: "La demande n’a pas pu être envoyée pour le moment.",
          });
          return;
        }

        setHasSentRequest(true);
        toast.success("Email envoyé", {
          description:
            "Si un compte existe avec cet email, un lien de réinitialisation a été envoyé.",
        });
      }}
    >
      <div className="space-y-2">
        <Label htmlFor="email">Email professionnel</Label>
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
        <div className="rounded-lg border bg-secondary/35 p-3 text-sm leading-6">
          Si un compte existe avec cet email, un lien de réinitialisation a été
          envoyé.
        </div>
      ) : null}

      <Button type="submit" className="w-full" size="lg" disabled={isSubmitting}>
        {isSubmitting ? "Envoi..." : "Recevoir le lien"}
      </Button>

      <p className="text-center text-sm text-muted-foreground">
        <Link href="/login" className="hover:text-foreground font-medium transition-colors">
          Retour à la connexion
        </Link>
      </p>
    </form>
  );
}
