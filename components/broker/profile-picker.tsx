"use client";

import { useRouter } from "next/navigation";
import * as React from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { profileInitials } from "@/lib/broker/profile-format";
import type { BrokerProfileRow } from "@/types/database";

/**
 * Écran d'accueil du cabinet : « Qui êtes-vous ? ».
 *
 * Volontairement dépouillé et large — c'est la première chose que voit le
 * cabinet chaque matin, elle doit se traverser d'un seul clic sans lecture.
 */
export function ProfilePicker({
  profiles,
  redirectTo,
}: {
  profiles: BrokerProfileRow[];
  /**
   * Où aller après le choix. Omis, on se contente de rafraîchir : le layout
   * relit le cookie et laisse passer vers la page déjà demandée, sans faire
   * perdre au courtier l'adresse sur laquelle il arrivait.
   */
  redirectTo?: string;
}) {
  const router = useRouter();
  const [pending, setPending] = React.useState<string | null>(null);

  async function choose(profile: BrokerProfileRow) {
    if (pending) return;
    setPending(profile.id);
    const res = await fetch("/api/broker/profiles/select", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ profileId: profile.id }),
    }).catch(() => null);

    if (!res?.ok) {
      setPending(null);
      toast.error("Profil non sélectionné.", {
        description: "Veuillez réessayer.",
      });
      return;
    }
    if (redirectTo) router.replace(redirectTo);
    router.refresh();
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-16">
      <div className="text-center">
        <h1
          className="text-[26px] font-semibold tracking-[-0.01em] text-[var(--fg-1)]"
          style={{ fontFamily: "var(--font-display, inherit)" }}
        >
          Qui êtes-vous&nbsp;?
        </h1>
        <p className="mt-1.5 text-[13.5px] text-[var(--fg-3)]">
          Choisissez votre profil pour retrouver vos emails et signer vos
          documents en votre nom.
        </p>
      </div>

      <ul className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {profiles.map((profile, i) => (
          <motion.li
            key={profile.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05, duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
          >
            <button
              type="button"
              onClick={() => void choose(profile)}
              disabled={pending !== null}
              className="group flex w-full flex-col items-center gap-3 rounded-xl border bg-[var(--bg-surface)] px-5 py-7 transition-all duration-150 hover:-translate-y-0.5 hover:shadow-[var(--shadow-md)] disabled:opacity-60"
              style={{
                borderColor: "var(--border-1)",
                boxShadow: "var(--shadow-sm)",
              }}
            >
              <span
                className="flex size-16 items-center justify-center rounded-[20px] text-[19px] font-semibold ring-1 ring-white/10"
                style={{
                  background: "linear-gradient(155deg, #283450, #181f31)",
                  color: "var(--accent)",
                }}
              >
                {pending === profile.id ? (
                  <Loader2 className="size-6 animate-spin" strokeWidth={1.75} />
                ) : (
                  profileInitials(profile.display_name)
                )}
              </span>
              <span className="min-w-0 text-center">
                <span className="block truncate text-[14px] font-semibold text-[var(--fg-1)]">
                  {profile.display_name}
                </span>
                {profile.role_label || profile.email ? (
                  <span className="mt-0.5 block truncate text-[12px] text-[var(--fg-3)]">
                    {profile.role_label || profile.email}
                  </span>
                ) : null}
              </span>
            </button>
          </motion.li>
        ))}
      </ul>

      <p className="mt-10 text-center text-[12px] text-[var(--fg-4)]">
        Vous pourrez changer de profil à tout moment depuis le bas du menu.
      </p>
    </div>
  );
}
