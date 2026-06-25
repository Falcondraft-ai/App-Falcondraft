import Link from "next/link";
import { CalendarClock } from "lucide-react";
import { EmptyState } from "@/components/common/empty-state";
import { PageHeader } from "@/components/common/page-header";
import { PageTransition } from "@/components/common/page-transition";
import { Button } from "@/components/ui/button";
import { requireActiveWorkspaceContext } from "@/lib/auth/session";
import {
  brokerClientDisplayName,
  insuranceTypeLabel,
} from "@/lib/broker/clients";
import {
  contractDisplayLabel,
  daysUntil,
  formatContractPremium,
  renewalUrgency,
  renewalUrgencyTone,
  type RenewalUrgency,
} from "@/lib/broker/contracts";
import { getBrokerClients, getBrokerUpcomingRenewals } from "@/lib/broker/data";
import { formatDate } from "@/lib/format";
import type { BrokerContractRow } from "@/types/database";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const groupOrder: { key: RenewalUrgency; title: string; hint: string }[] = [
  {
    key: "overdue",
    title: "Échéances dépassées",
    hint: "À traiter en priorité",
  },
  { key: "soon", title: "Sous 30 jours", hint: "Préparez la relance" },
  { key: "upcoming", title: "Sous 60 jours", hint: "À anticiper" },
];

function relativeLabel(date: string | null): string {
  const days = daysUntil(date);
  if (days === null) return "";
  if (days < 0) {
    const n = Math.abs(days);
    return `il y a ${n} jour${n > 1 ? "s" : ""}`;
  }
  if (days === 0) return "aujourd’hui";
  return `dans ${days} jour${days > 1 ? "s" : ""}`;
}

export default async function BrokerRenewalsPage() {
  const context = await requireActiveWorkspaceContext();
  const organizationId = context.organization!.id;

  const [renewals, clients] = await Promise.all([
    getBrokerUpcomingRenewals(organizationId, 60),
    getBrokerClients(organizationId, { limit: 2000, includeArchived: true }),
  ]);

  const clientNames = new Map(
    clients.map((c) => [c.id, brokerClientDisplayName(c)]),
  );

  const groups = new Map<RenewalUrgency, BrokerContractRow[]>();
  for (const contract of renewals) {
    const urgency = renewalUrgency(contract);
    if (urgency === "none" || urgency === "later") continue;
    const list = groups.get(urgency) ?? [];
    list.push(contract);
    groups.set(urgency, list);
  }

  const hasAny = groupOrder.some((g) => (groups.get(g.key)?.length ?? 0) > 0);

  return (
    <PageTransition>
      <div className="space-y-6">
        <PageHeader
          eyebrow="Contrats"
          title="Renouvellements"
          description="Les échéances de contrats à venir et dépassées, pour ne manquer aucun renouvellement."
          actions={
            <Button asChild variant="ghost" size="sm">
              <Link href="/courtier/contracts">Tous les contrats</Link>
            </Button>
          }
        />

        {hasAny ? (
          <div className="space-y-6">
            {groupOrder.map((group) => {
              const items = groups.get(group.key) ?? [];
              if (items.length === 0) return null;
              const tone = renewalUrgencyTone[group.key];
              return (
                <section key={group.key} className="space-y-3">
                  <div className="flex items-center gap-2.5">
                    <span
                      className="inline-flex h-6 min-w-6 items-center justify-center rounded-full border px-1.5 text-[11px] font-semibold"
                      style={{
                        color: tone.fg,
                        background: tone.bg,
                        borderColor: tone.bd,
                      }}
                    >
                      {items.length}
                    </span>
                    <h2 className="text-[14px] font-semibold tracking-[-0.005em] text-[var(--fg-1)]">
                      {group.title}
                    </h2>
                    <span className="text-[12px] text-[var(--fg-3)]">
                      · {group.hint}
                    </span>
                  </div>

                  <ul
                    className="divide-y overflow-hidden rounded-lg border bg-[var(--bg-surface)]"
                    style={{
                      borderColor: "var(--border-1)",
                      boxShadow: "var(--shadow-sm)",
                    }}
                  >
                    {items.map((contract) => (
                      <li key={contract.id}>
                        <Link
                          href={`/courtier/clients/${contract.client_id}/contracts/${contract.id}`}
                          className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-[rgba(14,34,56,0.025)]"
                        >
                          <span
                            className="flex size-9 shrink-0 items-center justify-center rounded-lg"
                            style={{
                              background: tone.bg,
                              border: `1px solid ${tone.bd}`,
                              color: tone.fg,
                            }}
                          >
                            <CalendarClock className="size-4" strokeWidth={1.75} />
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-[13px] font-semibold text-[var(--fg-1)]">
                              {clientNames.get(contract.client_id) ?? "Client"}
                            </p>
                            <p className="truncate text-[12px] text-[var(--fg-3)]">
                              {contractDisplayLabel(contract)} ·{" "}
                              {insuranceTypeLabel(contract.insurance_type)} ·{" "}
                              {formatContractPremium(contract)}
                            </p>
                          </div>
                          <div className="shrink-0 text-right">
                            <p
                              className="font-mono text-[12px] font-medium"
                              style={{ color: tone.fg }}
                            >
                              {contract.renewal_date
                                ? formatDate(contract.renewal_date)
                                : "—"}
                            </p>
                            <p className="text-[11px] text-[var(--fg-4)]">
                              {relativeLabel(contract.renewal_date)}
                            </p>
                          </div>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </section>
              );
            })}
          </div>
        ) : (
          <section
            className="rounded-lg border bg-[var(--bg-surface)] p-5"
            style={{
              borderColor: "var(--border-1)",
              boxShadow: "var(--shadow-sm)",
            }}
          >
            <EmptyState
              title="Aucun renouvellement à venir"
              description="Aucune échéance de contrat dans les 60 prochains jours. Renseignez les dates d’échéance de vos contrats pour les voir apparaître ici."
              action={
                <Button asChild>
                  <Link href="/courtier/contracts">Voir les contrats</Link>
                </Button>
              }
            />
          </section>
        )}
      </div>
    </PageTransition>
  );
}
