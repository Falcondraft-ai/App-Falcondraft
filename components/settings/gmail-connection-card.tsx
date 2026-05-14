"use client";

import Image from "next/image";
import * as React from "react";
import { useSearchParams } from "next/navigation";
import { motion, useReducedMotion } from "framer-motion";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { EmailConnectionStatus } from "@/lib/email/connections";

type GmailConnectionCardProps = {
  initialConnection: EmailConnectionStatus | null;
};

function getToastMessage(status: string | null) {
  if (status === "connected") {
    return "Gmail est connecté à FalconDraft.";
  }

  if (status === "denied") {
    return "Connexion Gmail annulée.";
  }

  if (status === "invalid" || status === "forbidden") {
    return "Connexion Gmail refusée pour ce workspace.";
  }

  if (status === "unavailable") {
    return "Configuration Gmail indisponible.";
  }

  if (status === "error") {
    return "Connexion Gmail impossible. Réessayez depuis les paramètres.";
  }

  return null;
}

function ConnectionStatus({ connected }: { connected: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium",
        connected
          ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
          : "border-border bg-secondary/60 text-muted-foreground",
      )}
    >
      <span
        className={cn(
          "size-1.5 rounded-full",
          connected ? "bg-emerald-600" : "bg-muted-foreground/50",
        )}
        aria-hidden="true"
      />
      {connected ? "Connecté" : "Non connecté"}
    </span>
  );
}

export function GmailConnectionCard({
  initialConnection,
}: GmailConnectionCardProps) {
  const searchParams = useSearchParams();
  const [connection, setConnection] = React.useState(initialConnection);
  const [isDisconnecting, setIsDisconnecting] = React.useState(false);
  const shouldReduceMotion = useReducedMotion();
  const connected = connection?.status === "connected";

  React.useEffect(() => {
    const message = getToastMessage(searchParams.get("gmail"));

    if (!message) {
      return;
    }

    if (searchParams.get("gmail") === "connected") {
      toast.success(message);
    } else {
      toast.error(message);
    }
  }, [searchParams]);

  async function disconnectGmail() {
    setIsDisconnecting(true);

    try {
      const response = await fetch("/api/email/connections/google", {
        method: "DELETE",
      });
      const payload = (await response.json()) as {
        success?: boolean;
        message?: string;
      };

      if (!response.ok || !payload.success) {
        throw new Error(payload.message ?? "Déconnexion impossible.");
      }

      setConnection(null);
      toast.success("Gmail est déconnecté.");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Déconnexion impossible.",
      );
    } finally {
      setIsDisconnecting(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-2">
        <motion.article
          initial={shouldReduceMotion ? false : { opacity: 0, y: 12 }}
          animate={shouldReduceMotion ? undefined : { opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: "easeOut" }}
          className={cn(
            "group bg-card/85 relative overflow-hidden rounded-2xl border p-5 shadow-sm transition-colors",
            connected ? "border-emerald-500/30" : "hover:border-primary/30",
          )}
        >
          <div className="pointer-events-none absolute -top-24 -right-20 size-52 rounded-full bg-[#EA4335]/10 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-24 left-8 size-48 rounded-full bg-[#4285F4]/10 blur-3xl" />
          <div className="flex min-h-[260px] flex-col">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="relative flex size-16 shrink-0 items-center justify-center rounded-2xl border bg-white shadow-[0_12px_30px_rgba(15,23,42,0.08)]">
                  <Image
                    src="/gmail_logo_2Cns2We (1).jpeg"
                    width={52}
                    height={39}
                    alt="Gmail"
                    className="h-11 w-11 object-contain mix-blend-multiply"
                  />
                </div>
                <div>
                  <h2 className="text-lg font-semibold tracking-[-0.03em]">
                    Gmail
                  </h2>
                  <p className="text-muted-foreground mt-1 text-sm">
                    Compte Google personnel ou professionnel
                  </p>
                </div>
              </div>
              <ConnectionStatus connected={connected} />
            </div>

            <div className="text-muted-foreground mt-5 space-y-3 text-sm leading-6">
              <p>
                FalconDraft crée uniquement des brouillons dans votre Gmail.
                Aucun email n’est envoyé automatiquement.
              </p>
              <p>
                Vous gardez toujours le contrôle : relisez, modifiez puis
                envoyez depuis Gmail quand vous êtes prêt.
              </p>
            </div>

            {connected ? (
              <div className="bg-background/70 mt-5 rounded-xl border p-3">
                <p className="text-muted-foreground text-xs font-medium tracking-[0.08em] uppercase">
                  Compte connecté
                </p>
                <p className="mt-1 truncate text-sm font-medium">
                  {connection.email}
                </p>
              </div>
            ) : null}

            <div className="mt-auto flex flex-wrap items-center gap-2 pt-5">
              {connected ? (
                <Button
                  type="button"
                  variant="outline"
                  size="default"
                  disabled={isDisconnecting}
                  onClick={disconnectGmail}
                  className="min-w-36"
                >
                  {isDisconnecting ? "Déconnexion…" : "Déconnecter"}
                </Button>
              ) : (
                <Button
                  asChild
                  size="default"
                  className="min-w-44 shadow-sm transition-transform hover:-translate-y-0.5"
                >
                  <a href="/api/email/oauth/google/start">Connecter Gmail</a>
                </Button>
              )}
            </div>
          </div>
        </motion.article>

        <motion.article
          initial={shouldReduceMotion ? false : { opacity: 0, y: 12 }}
          animate={shouldReduceMotion ? undefined : { opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.06, ease: "easeOut" }}
          className="bg-card/65 relative overflow-hidden rounded-2xl border p-5 opacity-90 shadow-sm"
        >
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[#F25022] via-[#00A4EF] to-[#FFB900]" />
          <div className="flex min-h-[260px] flex-col">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="bg-background flex size-16 shrink-0 items-center justify-center rounded-2xl border shadow-[0_12px_30px_rgba(15,23,42,0.08)]">
                  <Image
                    src="/microsoft-365-logo.svg"
                    width={40}
                    height={40}
                    alt="Microsoft 365"
                  />
                </div>
                <div>
                  <h2 className="text-lg font-semibold tracking-[-0.03em]">
                    Outlook / Microsoft 365
                  </h2>
                  <p className="text-muted-foreground mt-1 text-sm">
                    Connexion Microsoft à venir
                  </p>
                </div>
              </div>
              <span className="bg-secondary/60 text-muted-foreground rounded-full border px-2.5 py-1 text-xs font-medium">
                Bientôt
              </span>
            </div>

            <div className="text-muted-foreground mt-5 space-y-3 text-sm leading-6">
              <p>
                Cette option suivra la même logique que Gmail : préparation de
                brouillons uniquement.
              </p>
              <p>
                Elle sera activée lorsque la connexion Microsoft 365 sera
                ajoutée à FalconDraft.
              </p>
            </div>

            <div className="mt-auto pt-5">
              <Button
                type="button"
                variant="outline"
                size="default"
                disabled
                className="min-w-44"
              >
                Connexion à venir
              </Button>
            </div>
          </div>
        </motion.article>
      </div>
    </div>
  );
}
