"use client";

import * as React from "react";
import { Check } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { PLAN_PRICING } from "@/lib/billing/plans";

const META: Record<
  string,
  { label: string; seats: number; storageGb: number; highlight: string; featured?: boolean }
> = {
  essentiel: {
    label: "Essentiel",
    seats: 2,
    storageGb: 10,
    highlight: "CRM, conformité, devoir de conseil + Briefing Outlook IA.",
  },
  cabinet: {
    label: "Cabinet",
    seats: 5,
    storageGb: 50,
    highlight: "+ Commissions, pointage IA, signature, copilote IA.",
    featured: true,
  },
  performance: {
    label: "Performance",
    seats: 10,
    storageGb: 250,
    highlight: "+ Module Propositions commerciales, onboarding dédié.",
  },
};

export function BillingSubscribe() {
  const [interval, setInterval] = React.useState<"month" | "year">("month");
  const [loading, setLoading] = React.useState<string | null>(null);

  async function subscribe(plan: string) {
    setLoading(plan);
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan, interval }),
      });
      const data: { url?: string; message?: string } = await res
        .json()
        .catch(() => ({}));
      if (!res.ok || !data.url) {
        toast.error(data.message ?? "Souscription momentanément indisponible.");
        return;
      }
      window.location.href = data.url;
    } catch {
      toast.error("Une erreur est survenue. Réessayez.");
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="inline-flex rounded-md border p-0.5" style={{ borderColor: "var(--border-1)" }}>
        {(["month", "year"] as const).map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => setInterval(value)}
            className="rounded-[5px] px-3 py-1 text-[12px] font-medium transition-colors"
            style={
              interval === value
                ? { background: "var(--brand-navy-800)", color: "#fff" }
                : { color: "var(--fg-3)" }
            }
          >
            {value === "month" ? "Mensuel" : "Annuel — 2 mois offerts"}
          </button>
        ))}
      </div>

      <div className="grid gap-3 lg:grid-cols-3">
        {PLAN_PRICING.map((p) => {
          const meta = META[p.plan];
          const amount = p.amounts[interval] / 100;
          return (
            <div
              key={p.plan}
              className={cn(
                "flex flex-col rounded-lg border bg-[var(--bg-surface)] p-4",
              )}
              style={{
                borderColor: meta.featured
                  ? "var(--brand-navy-600)"
                  : "var(--border-1)",
                boxShadow: "var(--shadow-sm)",
              }}
            >
              <div className="flex items-center justify-between">
                <p className="text-[15px] font-semibold text-[var(--fg-1)]">
                  {meta.label}
                </p>
                {meta.featured ? (
                  <span
                    className="rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.04em]"
                    style={{ background: "var(--accent-soft)", color: "var(--accent-foreground)" }}
                  >
                    Recommandé
                  </span>
                ) : null}
              </div>
              <p className="mt-2">
                <span className="text-[24px] font-semibold tracking-[-0.01em] text-[var(--fg-1)]">
                  {amount} €
                </span>
                <span className="text-[12px] text-[var(--fg-3)]">
                  {" "}
                  HT /{interval === "month" ? "mois" : "an"}
                </span>
              </p>
              <p className="mt-1 flex items-center gap-1.5 text-[12px] text-[var(--fg-3)]">
                <Check className="size-3.5" strokeWidth={2} style={{ color: "var(--brand-navy-600)" }} />
                {meta.seats} sièges · {meta.storageGb} Go
              </p>
              <p className="mt-2 flex-1 text-[12px] leading-5 text-[var(--fg-2)]">
                {meta.highlight}
              </p>
              <button
                type="button"
                onClick={() => subscribe(p.plan)}
                disabled={loading !== null}
                className="mt-4 inline-flex items-center justify-center rounded-md px-4 py-2 text-[13px] font-medium transition-colors disabled:opacity-60"
                style={
                  meta.featured
                    ? { background: "var(--brand-navy-800)", color: "#fff" }
                    : {
                        background: "var(--brand-navy-50)",
                        color: "var(--brand-navy-800)",
                        border: "1px solid var(--border-1)",
                      }
                }
              >
                {loading === p.plan ? "Redirection…" : "Souscrire"}
              </button>
            </div>
          );
        })}
      </div>
      <p className="text-[12px] text-[var(--fg-3)]">
        Essai 14 jours · paiement sécurisé Stripe · résiliable à tout moment.
      </p>
    </div>
  );
}
