import { Check } from "lucide-react";
import { redirect } from "next/navigation";
import { requireActiveWorkspaceContext } from "@/lib/auth/session";
import { canManageWorkspace } from "@/lib/auth/workspace-permissions";
import { BROKER_OFFERING_CUSTOM, getBrokerOffering } from "@/lib/broker/access";
import { getPlan, PLAN_CONFIG, type Feature } from "@/lib/billing/entitlements";
import { getPlanPricing } from "@/lib/billing/plans";
import { BillingManageButton } from "@/components/broker/billing-manage-button";
import { BillingSubscribe } from "@/components/broker/billing-subscribe";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const PLAN_LABELS: Record<string, string> = {
  essentiel: "Essentiel",
  cabinet: "Cabinet",
  performance: "Performance",
};

const FEATURE_LABELS: Record<Feature, string> = {
  outlook_briefing: "Briefing Outlook IA",
  commissions: "Commissions & rapprochement",
  commission_extraction: "Pointage IA des commissions",
  esign: "Signature électronique",
  copilot: "Copilote IA agentique",
  proposals: "Module Propositions commerciales",
};

const STATUS_META: Record<
  string,
  { label: string; bg: string; color: string }
> = {
  active: { label: "Actif", bg: "var(--success-soft)", color: "var(--success)" },
  trial: {
    label: "Période d'essai",
    bg: "var(--accent-soft)",
    color: "var(--accent-foreground)",
  },
  past_due: {
    label: "Paiement en attente",
    bg: "var(--warning-soft)",
    color: "var(--warning)",
  },
  cancelled: {
    label: "Résilié",
    bg: "var(--brand-navy-50)",
    color: "var(--fg-3)",
  },
  suspended: {
    label: "Suspendu",
    bg: "var(--destructive-soft)",
    color: "var(--destructive)",
  },
};

function formatDate(value: string | null | undefined): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export default async function CourtierBillingSettingsPage() {
  const context = await requireActiveWorkspaceContext();
  const organization = context.organization!;

  // Bespoke cabinets are billed manually off-platform — no Stripe billing here.
  if (getBrokerOffering(organization) === BROKER_OFFERING_CUSTOM) {
    redirect("/courtier/settings");
  }

  const canManage = canManageWorkspace(context.membership?.role);

  const plan = getPlan(organization);
  const pricing = plan ? getPlanPricing(plan) : undefined;
  const config = plan ? PLAN_CONFIG[plan] : undefined;
  const hasCustomer = Boolean(organization.stripe_customer_id);
  const status = organization.billing_status ?? (plan ? "active" : null);
  const statusMeta = status ? (STATUS_META[status] ?? STATUS_META.active) : null;
  const renewal = formatDate(organization.current_period_end);
  const trialEnds =
    status === "trial" ? formatDate(organization.trial_ends_at) : null;

  return (
    <div className="space-y-5">
      <section
        className="rounded-lg border bg-[var(--bg-surface)] p-5 sm:p-6"
        style={{ borderColor: "var(--border-1)", boxShadow: "var(--shadow-sm)" }}
      >
        <p className="fd-eyebrow">Abonnement</p>

        {hasCustomer && plan && config ? (
          <>
            <div className="mt-1 flex flex-wrap items-center gap-3">
              <h2 className="fd-serif text-[22px] font-semibold tracking-[-0.01em] text-[var(--fg-1)]">
                {PLAN_LABELS[plan] ?? plan}
              </h2>
              {statusMeta ? (
                <span
                  className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium"
                  style={{ background: statusMeta.bg, color: statusMeta.color }}
                >
                  {statusMeta.label}
                </span>
              ) : null}
            </div>

            {pricing ? (
              <p className="mt-1 text-[13px] text-[var(--fg-3)]">
                À partir de {pricing.amounts.month / 100} € HT / mois ·{" "}
                {config.seats} sièges inclus · {config.storageGb} Go
              </p>
            ) : null}

            {trialEnds ? (
              <p className="mt-1 text-[13px] text-[var(--fg-3)]">
                Essai gratuit jusqu’au {trialEnds}.
              </p>
            ) : renewal ? (
              <p className="mt-1 text-[13px] text-[var(--fg-3)]">
                {status === "cancelled"
                  ? `Accès jusqu’au ${renewal}.`
                  : `Prochain renouvellement le ${renewal}.`}
              </p>
            ) : null}

            <ul className="mt-4 grid gap-2 sm:grid-cols-2">
              {config.features.map((feature) => (
                <li
                  key={feature}
                  className="flex items-center gap-2 text-[13px] text-[var(--fg-2)]"
                >
                  <Check
                    className="size-4 shrink-0"
                    strokeWidth={2}
                    style={{ color: "var(--brand-navy-600)" }}
                    aria-hidden="true"
                  />
                  {FEATURE_LABELS[feature]}
                </li>
              ))}
            </ul>

            <div
              className="mt-5 border-t pt-4"
              style={{ borderColor: "var(--border-1)" }}
            >
              {canManage ? (
                <div className="flex flex-wrap items-center gap-3">
                  <BillingManageButton />
                  <p className="text-[12px] text-[var(--fg-3)]">
                    Moyen de paiement, factures, changement d’offre et
                    résiliation dans le portail sécurisé.
                  </p>
                </div>
              ) : (
                <p className="text-[13px] text-[var(--fg-3)]">
                  Seul le gestionnaire du cabinet peut gérer l’abonnement.
                </p>
              )}
            </div>
          </>
        ) : (
          <>
            <h2 className="fd-serif mt-1 text-[20px] font-semibold tracking-[-0.01em] text-[var(--fg-1)]">
              Activez votre offre
            </h2>
            <p className="mt-1 text-[13px] leading-6 text-[var(--fg-3)]">
              Souscrivez en quelques clics. La gestion (factures, moyen de
              paiement, changement d’offre, résiliation) se retrouvera ensuite
              ici.
            </p>
            <div className="mt-5">
              {canManage ? (
                <BillingSubscribe />
              ) : (
                <p className="text-[13px] text-[var(--fg-3)]">
                  Seul le gestionnaire du cabinet peut souscrire une offre.
                </p>
              )}
            </div>
          </>
        )}
      </section>
    </div>
  );
}
