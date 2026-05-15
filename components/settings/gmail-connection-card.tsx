"use client";

import Image from "next/image";
import * as React from "react";
import { useSearchParams } from "next/navigation";
import { motion, useReducedMotion } from "framer-motion";
import { toast } from "sonner";
import { useI18n } from "@/components/i18n/language-provider";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { EmailConnectionStatus } from "@/lib/email/connections";

type GmailConnectionCardProps = {
  initialConnection: EmailConnectionStatus | null;
};

function getToastKey(status: string | null) {
  if (status === "connected") {
    return "integrations.gmail.connectedToast" as const;
  }

  if (status === "denied") {
    return "integrations.gmail.denied" as const;
  }

  if (status === "invalid" || status === "forbidden") {
    return "integrations.gmail.refused" as const;
  }

  if (status === "unavailable") {
    return "integrations.gmail.unavailable" as const;
  }

  if (status === "error") {
    return "integrations.gmail.error" as const;
  }

  return null;
}

function ConnectionStatus({ connected }: { connected: boolean }) {
  const { t } = useI18n();

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
      {connected
        ? t("integrations.gmail.connected")
        : t("integrations.gmail.disconnected")}
    </span>
  );
}

export function GmailConnectionCard({
  initialConnection,
}: GmailConnectionCardProps) {
  const searchParams = useSearchParams();
  const { t } = useI18n();
  const [connection, setConnection] = React.useState(initialConnection);
  const [isDisconnecting, setIsDisconnecting] = React.useState(false);
  const shouldReduceMotion = useReducedMotion();
  const connected = connection?.status === "connected";

  React.useEffect(() => {
    const messageKey = getToastKey(searchParams.get("gmail"));

    if (!messageKey) {
      return;
    }

    if (searchParams.get("gmail") === "connected") {
      toast.success(t(messageKey));
    } else {
      toast.error(t(messageKey));
    }
  }, [searchParams, t]);

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
        throw new Error(payload.message ?? t("integrations.gmail.disconnectError"));
      }

      setConnection(null);
      toast.success(t("integrations.gmail.disconnectedToast"));
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("integrations.gmail.disconnectError"),
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
                    {t("integrations.gmail.personal")}
                  </p>
                </div>
              </div>
              <ConnectionStatus connected={connected} />
            </div>

            <div className="text-muted-foreground mt-5 space-y-3 text-sm leading-6">
              <p>
                {t("integrations.gmail.body1")}
              </p>
              <p>
                {t("integrations.gmail.body2")}
              </p>
            </div>

            {connected ? (
              <div className="bg-background/70 mt-5 rounded-xl border p-3">
                <p className="text-muted-foreground text-xs font-medium tracking-[0.08em] uppercase">
                  {t("integrations.gmail.connectedAccount")}
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
                  {isDisconnecting
                    ? t("integrations.gmail.disconnecting")
                    : t("integrations.gmail.disconnect")}
                </Button>
              ) : (
                <Button
                  asChild
                  size="default"
                  className="min-w-44 shadow-sm transition-transform hover:-translate-y-0.5"
                >
                  <a href="/api/email/oauth/google/start">
                    {t("integrations.gmail.connect")}
                  </a>
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
                    {t("integrations.microsoft.subtitle")}
                  </p>
                </div>
              </div>
              <span className="bg-secondary/60 text-muted-foreground rounded-full border px-2.5 py-1 text-xs font-medium">
                {t("integrations.microsoft.comingSoon")}
              </span>
            </div>

            <div className="text-muted-foreground mt-5 space-y-3 text-sm leading-6">
              <p>
                {t("integrations.microsoft.body1")}
              </p>
              <p>
                {t("integrations.microsoft.body2")}
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
                {t("integrations.microsoft.cta")}
              </Button>
            </div>
          </div>
        </motion.article>
      </div>
    </div>
  );
}
