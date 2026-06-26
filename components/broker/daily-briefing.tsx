import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  FileText,
  FileSignature,
  History,
  Mail,
} from "lucide-react";
import type { ReactNode } from "react";
import { brokerActivityLabel } from "@/lib/broker/activity";
import {
  brokerClientDisplayName,
  insuranceTypeLabel,
} from "@/lib/broker/clients";
import { formatDateTime } from "@/lib/format";
import type { BrokerActivityRow, BrokerClientRow } from "@/types/database";

const attentionMeta: Record<
  string,
  { label: string; icon: ReactNode }
> = {
  advice_ready: {
    label: "Devoir de conseil à valider",
    icon: <FileText className="size-4" strokeWidth={1.75} />,
  },
  awaiting_signature: {
    label: "Signature à relancer",
    icon: <FileSignature className="size-4" strokeWidth={1.75} />,
  },
};

function Panel({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`rounded-lg border bg-[var(--bg-surface)] ${className ?? ""}`}
      style={{ borderColor: "var(--border-1)", boxShadow: "var(--shadow-sm)" }}
    >
      {children}
    </section>
  );
}

function PanelHeader({
  icon,
  title,
  hint,
}: {
  icon: ReactNode;
  title: string;
  hint?: ReactNode;
}) {
  return (
    <div
      className="flex items-center justify-between gap-3 border-b px-4 py-3"
      style={{ borderColor: "var(--border-1)" }}
    >
      <div className="flex items-center gap-2">
        <span style={{ color: "var(--brand-navy-700)" }}>{icon}</span>
        <h3 className="text-[13.5px] font-semibold text-[var(--fg-1)]">
          {title}
        </h3>
      </div>
      {hint}
    </div>
  );
}

export type EmailBriefingSummary = {
  connected: boolean;
  hasDigest: boolean;
  narrative: string | null;
  toProcess: number;
  toConfirm: number;
  pendingActions: number;
  generatedAt: string | null;
  top: { id: string; from: string; subject: string; urgency: string }[];
};

function Figure({
  value,
  label,
  tone,
}: {
  value: number;
  label: string;
  tone?: "accent" | "amber";
}) {
  return (
    <span className="inline-flex items-baseline gap-1">
      <span
        className="text-[15px] font-semibold leading-none"
        style={{
          color:
            tone === "amber"
              ? "var(--brand-amber-800, #92610f)"
              : tone === "accent"
                ? "var(--brand-navy-800)"
                : "var(--fg-1)",
        }}
      >
        {value}
      </span>
      <span className="text-[12px] text-[var(--fg-3)]">{label}</span>
    </span>
  );
}

function PrimaryLink({ children }: { children: ReactNode }) {
  return (
    <Link
      href="/courtier/inbox"
      className="inline-flex items-center gap-2 rounded-md px-3.5 py-2 text-[13px] font-semibold transition-colors hover:opacity-95"
      style={{
        background: "var(--brand-navy-800)",
        color: "#FFFFFF",
        border: "1px solid var(--brand-navy-800)",
      }}
    >
      <Mail className="size-3.5" strokeWidth={1.75} />
      {children}
    </Link>
  );
}

function Dot() {
  return (
    <span aria-hidden className="text-[var(--fg-4)]">
      ·
    </span>
  );
}

function BriefingSummaryPanel({ summary }: { summary?: EmailBriefingSummary }) {
  const data = summary;
  const nothing =
    data?.hasDigest && data.toProcess === 0 && data.toConfirm === 0;

  return (
    <Panel>
      <PanelHeader
        icon={<Mail className="size-4" strokeWidth={1.75} />}
        title="Résumé de vos emails"
        hint={
          data?.hasDigest && data.pendingActions > 0 ? (
            <span
              className="rounded-full px-2 py-[2px] text-[10.5px] font-semibold"
              style={{
                background: "var(--brand-amber-50, #fdf7e8)",
                color: "var(--brand-amber-800, #92610f)",
                border: "1px solid var(--brand-amber-200, rgba(184,146,42,0.25))",
              }}
            >
              {data.pendingActions} action{data.pendingActions > 1 ? "s" : ""}
            </span>
          ) : null
        }
      />
      <div className="space-y-3.5 px-4 py-4">
        {!data || !data.connected ? (
          <>
            <p className="text-[13px] leading-6 text-[var(--fg-2)]">
              Connectez votre boîte Outlook : FalconDraft trie vos emails de
              courtage, résume l’essentiel et propose les bonnes actions à valider.
            </p>
            <PrimaryLink>Connecter Outlook</PrimaryLink>
          </>
        ) : !data.hasDigest ? (
          <>
            <p className="text-[13px] leading-6 text-[var(--fg-2)]">
              Votre boîte est connectée. Générez votre briefing du jour : vos
              emails de courtage, triés et prêts à traiter.
            </p>
            <PrimaryLink>Générer mon briefing</PrimaryLink>
          </>
        ) : (
          <>
            <p className="line-clamp-3 text-[13.5px] leading-6 text-[var(--fg-1)]">
              {data.narrative || "Votre briefing du jour est prêt."}
            </p>

            {nothing ? (
              <p className="text-[12.5px] text-[var(--fg-3)]">
                Rien à traiter côté courtage, boîte à jour.
              </p>
            ) : (
              <>
                <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                  <Figure value={data.toProcess} label="à traiter" tone="accent" />
                  {data.toConfirm > 0 ? (
                    <>
                      <Dot />
                      <Figure
                        value={data.toConfirm}
                        label="à confirmer"
                        tone="amber"
                      />
                    </>
                  ) : null}
                  <Dot />
                  <Figure value={data.pendingActions} label="actions" />
                </div>

                {data.top.length > 0 ? (
                  <ul
                    className="space-y-2 border-t pt-3"
                    style={{ borderColor: "var(--border-1)" }}
                  >
                    {data.top.map((t) => (
                      <li key={t.id} className="flex items-center gap-2.5">
                        <span
                          aria-hidden
                          className="size-1.5 shrink-0 rounded-full"
                          style={{
                            background:
                              t.urgency === "high"
                                ? "var(--destructive)"
                                : "var(--accent)",
                          }}
                        />
                        <span className="min-w-0 flex-1 truncate text-[12.5px]">
                          <span className="font-medium text-[var(--fg-1)]">
                            {t.from}
                          </span>
                          <span className="text-[var(--fg-3)]"> · {t.subject}</span>
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </>
            )}

            <div className="pt-0.5">
              <PrimaryLink>Ouvrir l’Assistant Outlook</PrimaryLink>
            </div>
          </>
        )}
      </div>
    </Panel>
  );
}

function AttentionPanel({ clients }: { clients: BrokerClientRow[] }) {
  return (
    <Panel>
      <PanelHeader
        icon={<CheckCircle2 className="size-4" strokeWidth={1.75} />}
        title="À valider"
      />
      {clients.length > 0 ? (
        <ul className="divide-y" style={{ borderColor: "var(--border-1)" }}>
          {clients.map((client) => {
            const meta = attentionMeta[client.status];
            return (
              <li key={client.id}>
                <Link
                  href={`/courtier/clients/${client.id}`}
                  className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-[rgba(14,34,56,0.025)]"
                >
                  <span
                    className="flex size-8 shrink-0 items-center justify-center rounded-lg"
                    style={{
                      background: "var(--brand-amber-50)",
                      border: "1px solid var(--brand-amber-200)",
                      color: "var(--brand-amber-800)",
                    }}
                  >
                    {meta?.icon ?? (
                      <FileText className="size-4" strokeWidth={1.75} />
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-semibold text-[var(--fg-1)]">
                      {brokerClientDisplayName(client)}
                    </p>
                    <p className="truncate text-[12px] text-[var(--fg-3)]">
                      {meta?.label ?? "À traiter"}
                      {client.insurance_type
                        ? ` · ${insuranceTypeLabel(client.insurance_type)}`
                        : ""}
                    </p>
                  </div>
                  <ArrowRight
                    className="size-4 shrink-0 text-[var(--fg-4)]"
                    strokeWidth={1.75}
                    aria-hidden="true"
                  />
                </Link>
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="px-4 py-6 text-center">
          <p className="text-[13px] font-medium text-[var(--fg-1)]">
            Tout est à jour
          </p>
          <p className="mt-1 text-[12px] text-[var(--fg-3)]">
            Aucun dossier en attente de validation ou de signature.
          </p>
        </div>
      )}
    </Panel>
  );
}

function ActivityPanel({ activity }: { activity: BrokerActivityRow[] }) {
  return (
    <Panel>
      <PanelHeader
        icon={<History className="size-4" strokeWidth={1.75} />}
        title="Ce qui s’est passé"
      />
      {activity.length > 0 ? (
        <ol className="px-4 py-4">
          {activity.map((entry, index) => (
            <li key={entry.id} className="flex gap-3">
              <div className="flex flex-col items-center">
                <span
                  aria-hidden
                  className="mt-1.5 size-2 shrink-0 rounded-full"
                  style={{ background: "var(--accent)" }}
                />
                {index < activity.length - 1 ? (
                  <span
                    aria-hidden
                    className="my-1 w-px flex-1"
                    style={{ background: "var(--border-1)" }}
                  />
                ) : null}
              </div>
              <Link
                href={`/courtier/clients/${entry.client_id}`}
                className="min-w-0 flex-1 pb-4"
              >
                <p className="text-[13px] font-medium text-[var(--fg-1)] transition-colors hover:text-[var(--brand-navy-800)]">
                  {brokerActivityLabel(entry.type)}
                </p>
                {entry.description ? (
                  <p className="mt-0.5 truncate text-[12px] text-[var(--fg-3)]">
                    {entry.description}
                  </p>
                ) : null}
                <p className="mt-0.5 font-mono text-[11px] text-[var(--fg-4)]">
                  {formatDateTime(entry.created_at)}
                </p>
              </Link>
            </li>
          ))}
        </ol>
      ) : (
        <div className="px-4 py-6 text-center">
          <p className="text-[12.5px] text-[var(--fg-3)]">
            L’activité de vos dossiers apparaîtra ici.
          </p>
        </div>
      )}
    </Panel>
  );
}

export function DailyBriefing({
  attentionClients,
  activity,
  emailSummary,
}: {
  attentionClients: BrokerClientRow[];
  activity: BrokerActivityRow[];
  emailSummary?: EmailBriefingSummary;
}) {
  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-[16px] font-semibold tracking-[-0.01em] text-[var(--fg-1)]">
          Votre briefing du jour
        </h2>
        <p className="mt-0.5 text-[12.5px] text-[var(--fg-3)]">
          Ce qui demande votre attention et ce qui s’est passé sur vos dossiers.
        </p>
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-[1.1fr_1fr]">
        <BriefingSummaryPanel summary={emailSummary} />
        <div className="grid gap-4">
          <AttentionPanel clients={attentionClients} />
          <ActivityPanel activity={activity} />
        </div>
      </div>
    </section>
  );
}
