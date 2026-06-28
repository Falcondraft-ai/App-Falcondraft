"use client";

import { useRouter } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";

/**
 * Enables / disables the business-introducer (apporteurs) module for the
 * cabinet. Mirrors the compliance-module switch: writes broker_settings via
 * /api/courtier/settings. When off, apporteurs are hidden from client creation,
 * client detail and this page.
 */
export function IntroducerModuleToggle({
  initialEnabled,
  canEdit,
}: {
  initialEnabled: boolean;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [enabled, setEnabled] = React.useState(initialEnabled);
  const [toggling, setToggling] = React.useState(false);

  async function toggleModule(next: boolean) {
    if (toggling || !canEdit) return;
    setEnabled(next);
    setToggling(true);
    try {
      const res = await fetch("/api/courtier/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ introducersEnabled: next }),
      }).catch(() => null);
      if (!res?.ok) {
        setEnabled(!next);
        toast.error("Action impossible.");
        return;
      }
      toast.success(
        next ? "Module Apporteurs activé." : "Module Apporteurs désactivé.",
      );
      router.refresh();
    } finally {
      setToggling(false);
    }
  }

  return (
    <div
      className="flex items-center justify-between gap-4 rounded-lg border bg-[var(--bg-surface)] px-4 py-3.5"
      style={{ borderColor: "var(--border-1)", boxShadow: "var(--shadow-sm)" }}
    >
      <div className="min-w-0">
        <p className="text-[13.5px] font-semibold text-[var(--fg-1)]">
          Module Apporteurs d’affaires
        </p>
        <p className="mt-0.5 text-[12px] leading-5 text-[var(--fg-3)]">
          Gérez vos apporteurs et leur taux de rétrocession, et associez-les à
          vos dossiers clients. Désactivez-le si votre cabinet n’en a pas
          l’usage.
        </p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        aria-label="Activer le module Apporteurs d’affaires"
        disabled={!canEdit || toggling}
        onClick={() => toggleModule(!enabled)}
        className="relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors disabled:opacity-50"
        style={{
          background: enabled
            ? "var(--brand-navy-800)"
            : "var(--border-strong, #d4d0c8)",
        }}
      >
        <span
          className="inline-block size-4 rounded-full bg-white shadow-sm transition-transform"
          style={{ transform: enabled ? "translateX(22px)" : "translateX(3px)" }}
        />
      </button>
    </div>
  );
}
