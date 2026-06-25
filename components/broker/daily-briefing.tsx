import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  FileText,
  FileSignature,
  History,
  Inbox,
  Mail,
  Paperclip,
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

function EmailSummaryPanel() {
  return (
    <Panel className="flex flex-col">
      <PanelHeader
        icon={<Mail className="size-4" strokeWidth={1.75} />}
        title="Résumé de vos emails"
      />
      <div className="flex flex-1 flex-col px-4 py-4">
        <p className="text-[13px] leading-6 text-[var(--fg-2)]">
          Votre Assistant Outlook trie vos emails de courtage, résume
          l’essentiel et vous propose les bonnes actions — à valider une par une.
        </p>

        <ul className="mt-4 space-y-2.5">
          {[
            {
              icon: <Inbox className="size-4" strokeWidth={1.75} />,
              text: "Les emails importants de la journée, résumés en un coup d’œil",
            },
            {
              icon: <Paperclip className="size-4" strokeWidth={1.75} />,
              text: "Les pièces jointes reçues (devis, contrats, RIB) détectées automatiquement",
            },
            {
              icon: <ArrowRight className="size-4" strokeWidth={1.75} />,
              text: "Le rattachement suggéré au bon dossier client",
            },
          ].map((item) => (
            <li key={item.text} className="flex items-start gap-3">
              <span
                className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg"
                style={{
                  background: "var(--brand-navy-50)",
                  border: "1px solid var(--border-1)",
                  color: "var(--brand-navy-700)",
                }}
              >
                {item.icon}
              </span>
              <span className="text-[12.5px] leading-5 text-[var(--fg-2)]">
                {item.text}
              </span>
            </li>
          ))}
        </ul>

        <div className="mt-5">
          <Link
            href="/courtier/inbox"
            className="inline-flex items-center gap-2 rounded-md px-3.5 py-2 text-[13px] font-semibold transition-colors"
            style={{
              background: "var(--brand-navy-800)",
              color: "#FFFFFF",
              border: "1px solid var(--brand-navy-800)",
            }}
          >
            <Mail className="size-3.5" strokeWidth={1.75} />
            Ouvrir l’Assistant Outlook
          </Link>
        </div>
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
}: {
  attentionClients: BrokerClientRow[];
  activity: BrokerActivityRow[];
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

      <div className="grid gap-4 lg:grid-cols-[1.1fr_1fr]">
        <EmailSummaryPanel />
        <div className="grid gap-4">
          <AttentionPanel clients={attentionClients} />
          <ActivityPanel activity={activity} />
        </div>
      </div>
    </section>
  );
}
