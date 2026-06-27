"use client";

import * as React from "react";
import { ExternalLink } from "lucide-react";
import { toast } from "sonner";

/**
 * Opens the Stripe Customer Portal so a manager can update payment method,
 * change plan, download invoices or cancel — subscription management lives
 * in-app, while the initial souscription happens on the marketing site.
 */
export function BillingManageButton() {
  const [loading, setLoading] = React.useState(false);

  async function openPortal() {
    setLoading(true);
    try {
      const res = await fetch("/api/billing/portal", { method: "POST" });
      const data: { url?: string; message?: string } = await res
        .json()
        .catch(() => ({}));
      if (!res.ok || !data.url) {
        toast.error(
          data.message ?? "Impossible d'ouvrir la gestion de l'abonnement.",
        );
        return;
      }
      window.location.href = data.url;
    } catch {
      toast.error("Une erreur est survenue. Réessayez.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={openPortal}
      disabled={loading}
      className="inline-flex items-center gap-2 rounded-md px-4 py-2 text-[13px] font-medium text-white transition-colors hover:opacity-95 disabled:opacity-60"
      style={{ background: "var(--brand-navy-800)" }}
    >
      {loading ? "Ouverture…" : "Gérer mon abonnement"}
      <ExternalLink className="size-4" strokeWidth={1.75} aria-hidden="true" />
    </button>
  );
}
