"use client";

import Link from "next/link";
import * as React from "react";
import {
  AlertTriangle,
  Bell,
  CheckCircle2,
  FileText,
  Loader2,
  Mail,
  PenLine,
  PhoneCall,
  Signature,
  Sparkles,
} from "lucide-react";
import { useI18n } from "@/components/i18n/language-provider";
import type { ActivityEvent } from "@/types/activity";

type NotificationKind =
  | "call_summary"
  | "proposal"
  | "validation"
  | "final_document"
  | "signature"
  | "email_draft"
  | "deal_update"
  | "team"
  | "error"
  | "default";

type FormattedNotification = {
  id: string;
  href: string;
  title: string;
  description: string;
  createdAt: string;
  tone: "default" | "amber" | "success" | "danger";
  kind: NotificationKind;
};

const iconByKind: Record<NotificationKind, React.ElementType> = {
  call_summary: PhoneCall,
  proposal: FileText,
  validation: PenLine,
  final_document: CheckCircle2,
  signature: Signature,
  email_draft: Mail,
  deal_update: Sparkles,
  team: Sparkles,
  error: AlertTriangle,
  default: Bell,
};

const toneStyles: Record<
  FormattedNotification["tone"],
  { bg: string; border: string; icon: string }
> = {
  default: {
    bg: "var(--brand-navy-50)",
    border: "var(--brand-navy-100)",
    icon: "var(--brand-navy-700)",
  },
  amber: {
    bg: "var(--brand-amber-50)",
    border: "var(--brand-amber-200)",
    icon: "var(--brand-amber-800)",
  },
  success: {
    bg: "var(--status-signed-bg)",
    border: "var(--status-signed-bd)",
    icon: "var(--status-signed-fg)",
  },
  danger: {
    bg: "var(--status-error-bg)",
    border: "var(--status-error-bd)",
    icon: "var(--status-error-fg)",
  },
};

function formatRelativeTime(iso: string): string {
  const now = Date.now();
  const then = new Date(iso).getTime();
  const diffMs = now - then;
  const diffMin = Math.round(diffMs / 60000);
  if (diffMin < 1) return "à l'instant";
  if (diffMin < 60) return `il y a ${diffMin} min`;
  const diffH = Math.round(diffMin / 60);
  if (diffH < 24) return `il y a ${diffH} h`;
  const diffD = Math.round(diffH / 24);
  if (diffD < 7) return `il y a ${diffD} j`;
  return new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "short",
  }).format(new Date(iso));
}

function classify(event: ActivityEvent): FormattedNotification {
  const isAudit = event.title.startsWith("audit:");
  const auditAction = isAudit ? event.title.replace("audit:", "") : "";
  const isWorkflow = event.title.startsWith("workflow:");
  const workflowStatus = isWorkflow ? event.title.replace("workflow:", "") : "";
  const [, workflowType] = event.description.startsWith("workflow:")
    ? event.description.split(":")
    : [undefined, undefined];

  let kind: NotificationKind = "default";
  let tone: FormattedNotification["tone"] = "default";
  let title = event.title;
  let description = event.description;

  if (isWorkflow) {
    if (workflowStatus === "failed") {
      kind = "error";
      tone = "danger";
      title = "Génération en échec";
      description = `Le workflow ${workflowType ?? ""} n'a pas pu aboutir.`;
    } else if (workflowStatus === "completed") {
      if (workflowType === "call_summary") {
        kind = "call_summary";
        tone = "success";
        title = "Compte-rendu prêt";
        description = "La synthèse de l'appel est disponible.";
      } else if (workflowType === "proposal_generation") {
        kind = "proposal";
        tone = "amber";
        title = "Proposition prête";
        description = "Le brouillon a été généré.";
      } else if (workflowType === "proposal_validation") {
        kind = "validation";
        tone = "success";
        title = "Proposition validée";
        description = "Le document final est prêt.";
      } else if (workflowType === "final_document_generation") {
        kind = "final_document";
        tone = "success";
        title = "Document final disponible";
        description = "Le PDF est consultable depuis le dossier.";
      } else if (workflowType === "email_draft_generation") {
        kind = "email_draft";
        tone = "amber";
        title = "Brouillon email prêt";
        description = "Le brouillon Gmail est disponible.";
      } else {
        kind = "default";
        title = "Action terminée";
        description = `Workflow ${workflowType ?? ""}.`;
      }
    } else if (workflowStatus === "running") {
      kind = "default";
      tone = "default";
      title = "Traitement en cours";
      description = `Workflow ${workflowType ?? ""}.`;
    }
  } else if (isAudit) {
    switch (auditAction) {
      case "Dossier commercial modifié":
        kind = "deal_update";
        title = "Dossier modifié";
        description = "Les informations du dossier ont été mises à jour.";
        break;
      case "Dossier commercial archivé":
        kind = "deal_update";
        title = "Dossier archivé";
        description = "Retiré du pipeline actif.";
        break;
      case "Dossier commercial restauré":
        kind = "deal_update";
        title = "Dossier restauré";
        description = "Réintégré au pipeline.";
        break;
      case "Email envoyé (statut manuel)":
        kind = "email_draft";
        tone = "success";
        title = "Email marqué comme envoyé";
        description = "Le dossier est passé en statut terminé.";
        break;
      case "invitation_created":
        kind = "team";
        title = "Invitation envoyée";
        description = "Un nouveau collaborateur a été invité.";
        break;
      case "invitation_accepted":
        kind = "team";
        tone = "success";
        title = "Invitation acceptée";
        description = "Un membre a rejoint l'espace.";
        break;
      case "email_provider_connected":
        kind = "email_draft";
        tone = "success";
        title = "Messagerie connectée";
        description = "Les brouillons peuvent maintenant être créés.";
        break;
      case "email_provider_disconnected":
        kind = "email_draft";
        tone = "danger";
        title = "Messagerie déconnectée";
        description = "Reconnectez Gmail ou Outlook depuis les paramètres.";
        break;
      default:
        title = auditAction || "Mise à jour";
        description = "Activité enregistrée.";
    }
  }

  return {
    id: event.id,
    href: event.dealId ? `/dashboard/deals/${event.dealId}` : "/dashboard",
    title,
    description,
    createdAt: event.createdAt,
    tone,
    kind,
  };
}

export function NotificationsPanel({ label }: { label: string }) {
  const { t } = useI18n();
  const [items, setItems] = React.useState<FormattedNotification[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const response = await fetch("/api/notifications/recent", {
          cache: "no-store",
        });
        if (!response.ok) {
          if (!cancelled) setError("Chargement impossible.");
          return;
        }
        const data = (await response.json()) as {
          notifications: ActivityEvent[];
        };
        if (cancelled) return;
        setItems(data.notifications.map(classify));
      } catch {
        if (!cancelled) setError("Chargement impossible.");
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="flex max-h-[480px] flex-col">
      <div
        className="border-b px-4 py-3"
        style={{ borderColor: "var(--border-1)" }}
      >
        <p className="fd-eyebrow">{label}</p>
        <p className="mt-0.5 text-[13.5px] font-semibold text-[var(--fg-1)]">
          Derniers événements
        </p>
      </div>
      <div className="flex-1 overflow-y-auto">
        {items === null && !error ? (
          <div className="flex items-center justify-center py-10 text-[var(--fg-3)]">
            <Loader2 className="size-4 animate-spin" />
          </div>
        ) : error ? (
          <p className="px-4 py-6 text-center text-[13px] text-[var(--fg-3)]">
            {error}
          </p>
        ) : items && items.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 px-6 py-8 text-center">
            <span
              className="flex h-10 w-10 items-center justify-center rounded-xl"
              style={{
                background: "var(--brand-navy-50)",
                border: "1px solid var(--brand-navy-100)",
                color: "var(--brand-navy-700)",
              }}
            >
              <Bell className="size-4" strokeWidth={1.75} />
            </span>
            <p className="mt-1 text-[13px] font-semibold text-[var(--fg-1)]">
              {t("common.empty.activity")}
            </p>
            <p className="text-[12px] leading-5 text-[var(--fg-3)]">
              Les comptes-rendus, propositions et signatures s&apos;afficheront ici.
            </p>
          </div>
        ) : (
          <ul>
            {(items ?? []).map((item) => {
              const Icon = iconByKind[item.kind];
              const styles = toneStyles[item.tone];
              return (
                <li
                  key={item.id}
                  className="border-b last:border-b-0"
                  style={{ borderColor: "var(--border-1)" }}
                >
                  <Link
                    href={item.href}
                    className="flex items-start gap-3 px-4 py-3 transition-colors hover:bg-[var(--brand-navy-50)]"
                  >
                    <span
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md"
                      style={{
                        background: styles.bg,
                        border: `1px solid ${styles.border}`,
                        color: styles.icon,
                      }}
                    >
                      <Icon className="size-3.5" strokeWidth={1.75} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-semibold text-[var(--fg-1)]">
                        {item.title}
                      </p>
                      <p className="mt-0.5 line-clamp-2 text-[12px] leading-[1.4] text-[var(--fg-3)]">
                        {item.description}
                      </p>
                    </div>
                    <span className="shrink-0 font-mono text-[10.5px] text-[var(--fg-4)]">
                      {formatRelativeTime(item.createdAt)}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
