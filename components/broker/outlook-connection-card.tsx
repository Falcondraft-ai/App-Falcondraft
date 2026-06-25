"use client";

import Image from "next/image";
import * as React from "react";
import { useSearchParams } from "next/navigation";
import { motion, useReducedMotion } from "framer-motion";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { EmailConnectionStatus } from "@/lib/email/connections";

const RETURN_PATH = "/courtier/settings";

const statusMessages: Record<string, { ok?: boolean; message: string }> = {
  connected: { ok: true, message: "Boîte Outlook connectée." },
  denied: { message: "Connexion Outlook annulée." },
  invalid: { message: "La connexion Outlook a échoué. Réessayez." },
  forbidden: { message: "Connexion Outlook refusée." },
  unavailable: {
    message: "Service Outlook momentanément indisponible.",
  },
  error: { message: "Une erreur est survenue lors de la connexion Outlook." },
};

function ConnectionStatus({ connected }: { connected: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium",
        connected
          ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700"
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
      {connected ? "Connectée" : "Non connectée"}
    </span>
  );
}

export function OutlookConnectionCard({
  initialConnection,
}: {
  initialConnection: EmailConnectionStatus | null;
}) {
  const searchParams = useSearchParams();
  const shouldReduceMotion = useReducedMotion();
  const [connection, setConnection] = React.useState(initialConnection);
  const [isDisconnecting, setIsDisconnecting] = React.useState(false);
  const connected = connection?.status === "connected";

  React.useEffect(() => {
    const status = searchParams.get("outlook");
    if (!status) return;
    const entry = statusMessages[status];
    if (!entry) return;
    if (entry.ok) {
      toast.success(entry.message);
    } else {
      toast.error(entry.message);
    }
  }, [searchParams]);

  async function disconnect() {
    setIsDisconnecting(true);
    try {
      const response = await fetch("/api/email/connections/microsoft", {
        method: "DELETE",
      });
      const payload = (await response.json().catch(() => null)) as {
        success?: boolean;
        message?: string;
      } | null;

      if (!response.ok || !payload?.success) {
        throw new Error(payload?.message ?? "Déconnexion impossible.");
      }

      setConnection(null);
      toast.success("Boîte Outlook déconnectée.");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Déconnexion impossible.",
      );
    } finally {
      setIsDisconnecting(false);
    }
  }

  return (
    <motion.article
      initial={shouldReduceMotion ? false : { opacity: 0, y: 12 }}
      animate={shouldReduceMotion ? undefined : { opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      className={cn(
        "group bg-card/85 relative overflow-hidden rounded-2xl border p-5 shadow-sm transition-colors",
        connected ? "border-emerald-500/30" : "hover:border-primary/30",
      )}
    >
      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[#F25022] via-[#00A4EF] to-[#FFB900]" />
      <div className="flex min-h-[240px] flex-col">
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
                Suivi de vos emails et brouillons clients
              </p>
            </div>
          </div>
          <ConnectionStatus connected={connected} />
        </div>

        <div className="text-muted-foreground mt-5 space-y-3 text-sm leading-6">
          <p>
            Connectez votre boîte Outlook pour recevoir un résumé quotidien de
            vos emails importants et détecter les pièces jointes reçues.
          </p>
          <p>
            FalconDraft prépare des brouillons prêts à relire — aucun email
            n’est jamais envoyé automatiquement, vous gardez la main.
          </p>
        </div>

        {connected && connection ? (
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
              onClick={disconnect}
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
              <a
                href={`/api/email/oauth/microsoft/start?return=${encodeURIComponent(RETURN_PATH)}`}
              >
                Connecter Outlook
              </a>
            </Button>
          )}
        </div>
      </div>
    </motion.article>
  );
}
