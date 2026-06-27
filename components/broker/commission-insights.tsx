import Link from "next/link";
import { AlertTriangle, ChevronRight, SearchX, TrendingUp } from "lucide-react";
import { InfoHint } from "@/components/broker/info-hint";
import { formatEuro } from "@/lib/broker/commissions";

export type InsightItem = {
  contractId: string;
  clientId: string;
  label: string;
  clientName: string;
  expectedAnnual: number;
  received12m?: number;
};

const FORECAST_HINT =
  "Estimation = prime annualisée de chaque contrat actif × son taux de commission. Les contrats sans taux ou à prime unique ne sont pas comptés.";
const MISSING_HINT =
  "Contrats actifs avec un taux de commission mais aucune commission enregistrée à ce jour : la compagnie ne vous a peut-être jamais payé.";
const GAP_HINT =
  "Contrats dont la commission reçue sur les 12 derniers mois est inférieure à 80 % de l’attendu annuel (prime annualisée × taux).";

const MAX_ITEMS = 5;

function ItemRow({ item, currency }: { item: InsightItem; currency: string }) {
  return (
    <Link
      href={`/courtier/clients/${item.clientId}/contracts/${item.contractId}`}
      className="flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-[rgba(14,34,56,0.025)]"
    >
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-medium text-[var(--fg-1)]">
          {item.label}
        </p>
        <p className="truncate text-[11.5px] text-[var(--fg-3)]">
          {item.clientName}
        </p>
      </div>
      <div className="shrink-0 text-right">
        <p className="text-[12.5px] font-semibold text-[var(--fg-1)]">
          {formatEuro(item.expectedAnnual, currency)}
          <span className="font-normal text-[var(--fg-3)]"> / an attendu</span>
        </p>
        {item.received12m !== undefined ? (
          <p className="text-[11px] text-[var(--fg-3)]">
            Reçu 12 mois : {formatEuro(item.received12m, currency)}
          </p>
        ) : null}
      </div>
      <ChevronRight
        className="size-4 shrink-0 text-[var(--fg-4)]"
        strokeWidth={1.75}
        aria-hidden="true"
      />
    </Link>
  );
}

function StatTile({
  icon,
  label,
  value,
  detail,
  hint,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  detail?: string;
  hint: string;
  tone?: "default" | "warning";
}) {
  return (
    <div
      className="rounded-lg border p-4"
      style={{
        borderColor: "var(--border-1)",
        background: "var(--bg-surface)",
        boxShadow: "var(--shadow-sm)",
      }}
    >
      <div className="flex items-center justify-between">
        <span
          className="flex size-7 items-center justify-center rounded-md"
          style={{
            background:
              tone === "warning"
                ? "var(--brand-amber-50, #fdf7e8)"
                : "var(--brand-navy-50)",
            color:
              tone === "warning" ? "#92610f" : "var(--brand-navy-700)",
          }}
        >
          {icon}
        </span>
        <InfoHint text={hint} />
      </div>
      <p className="mt-3 fd-eyebrow">{label}</p>
      <p className="mt-1 text-[20px] font-semibold tracking-[-0.015em] text-[var(--fg-1)]">
        {value}
      </p>
      {detail ? (
        <p className="mt-0.5 text-[11.5px] text-[var(--fg-3)]">{detail}</p>
      ) : null}
    </div>
  );
}

function Panel({
  title,
  count,
  hint,
  items,
  currency,
  emptyLabel,
}: {
  title: string;
  count: number;
  hint: string;
  items: InsightItem[];
  currency: string;
  emptyLabel: string;
}) {
  return (
    <div
      className="overflow-hidden rounded-lg border"
      style={{ borderColor: "var(--border-1)", background: "var(--bg-surface)" }}
    >
      <div
        className="flex items-center justify-between gap-2 px-4 py-3"
        style={{ borderBottom: "1px solid var(--border-1)" }}
      >
        <div className="flex items-center gap-2">
          <h3 className="text-[13px] font-semibold text-[var(--fg-1)]">
            {title}
          </h3>
          <InfoHint text={hint} />
        </div>
        <span
          className="rounded-full px-2 py-0.5 text-[11px] font-semibold"
          style={{
            background:
              count > 0
                ? "var(--brand-amber-50, #fdf7e8)"
                : "var(--success-soft, #f0fdf4)",
            color: count > 0 ? "#92610f" : "#15803D",
          }}
        >
          {count}
        </span>
      </div>
      {items.length > 0 ? (
        <div className="divide-y" style={{ borderColor: "var(--border-1)" }}>
          {items.slice(0, MAX_ITEMS).map((item) => (
            <ItemRow key={item.contractId} item={item} currency={currency} />
          ))}
          {count > MAX_ITEMS ? (
            <p className="px-4 py-2 text-[11.5px] text-[var(--fg-3)]">
              + {count - MAX_ITEMS} autre{count - MAX_ITEMS > 1 ? "s" : ""}
            </p>
          ) : null}
        </div>
      ) : (
        <p className="px-4 py-5 text-[12.5px] text-[var(--fg-3)]">{emptyLabel}</p>
      )}
    </div>
  );
}

export function CommissionInsights({
  forecast,
  missing,
  gaps,
  currency,
}: {
  forecast: { annual: number; monthly: number; contractsCounted: number };
  missing: InsightItem[];
  gaps: InsightItem[];
  currency: string;
}) {
  return (
    <section className="space-y-3">
      <h2 className="text-[15px] font-semibold tracking-[-0.005em] text-[var(--fg-1)]">
        Pilotage du revenu
      </h2>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatTile
          icon={<TrendingUp className="size-3.5" strokeWidth={1.75} />}
          label="Prévisionnel annuel"
          value={formatEuro(forecast.annual, currency)}
          detail={`${formatEuro(forecast.monthly, currency)} / mois · ${forecast.contractsCounted} contrat${forecast.contractsCounted > 1 ? "s" : ""}`}
          hint={FORECAST_HINT}
        />
        <StatTile
          icon={<SearchX className="size-3.5" strokeWidth={1.75} />}
          label="Commissions manquantes"
          value={String(missing.length)}
          detail="Contrats actifs jamais payés"
          hint={MISSING_HINT}
          tone={missing.length > 0 ? "warning" : "default"}
        />
        <StatTile
          icon={<AlertTriangle className="size-3.5" strokeWidth={1.75} />}
          label="Écarts détectés"
          value={String(gaps.length)}
          detail="Sous-paiements potentiels"
          hint={GAP_HINT}
          tone={gaps.length > 0 ? "warning" : "default"}
        />
      </div>

      {missing.length > 0 || gaps.length > 0 ? (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          <Panel
            title="Commissions manquantes"
            count={missing.length}
            hint={MISSING_HINT}
            items={missing}
            currency={currency}
            emptyLabel="Aucune commission manquante détectée."
          />
          <Panel
            title="Écarts à vérifier"
            count={gaps.length}
            hint={GAP_HINT}
            items={gaps}
            currency={currency}
            emptyLabel="Aucun écart détecté."
          />
        </div>
      ) : null}
    </section>
  );
}
