"use client";

import * as React from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { formatDateTime } from "@/lib/format";
import type { ActivityEvent } from "@/types/activity";
import { useI18n } from "@/components/i18n/language-provider";
import type { TranslationKey } from "@/lib/i18n/translations";

const auditTitleKeys: Record<string, TranslationKey> = {
  invitation_created: "activity.audit.invitation_created",
  invitation_accepted: "activity.audit.invitation_accepted",
  invitation_revoked: "activity.audit.invitation_revoked",
  member_deactivated: "activity.audit.member_deactivated",
  organization_member_deactivated: "activity.audit.member_deactivated",
  organization_member_role_updated:
    "activity.audit.organization_member_role_updated",
  organization_visibility_updated:
    "activity.audit.organization_visibility_updated",
  email_provider_connected: "activity.audit.email_provider_connected",
  email_provider_disconnected: "activity.audit.email_provider_disconnected",
  email_draft_workflow_started: "activity.audit.email_draft_workflow_started",
  organization_created: "activity.audit.organization_created",
  workflow_config_created: "activity.audit.workflow_config_created",
  workflow_config_updated: "activity.audit.workflow_config_updated",
  first_manager_invited: "activity.audit.first_manager_invited",
  "Dossier commercial modifié": "activity.audit.deal_updated",
  "Proposition supprimée": "activity.audit.proposal_deleted",
  "Compte-rendu supprimé": "activity.audit.summary_deleted",
  "Dossier commercial archivé": "activity.audit.deal_archived",
  "Dossier commercial restauré": "activity.audit.deal_restored",
};

function workflowTitleKey(title: string): TranslationKey | null {
  if (title === "workflow:failed") {
    return "activity.workflow.failed";
  }

  if (title === "workflow:completed") {
    return "activity.workflow.completed";
  }

  if (title === "workflow:running") {
    return "activity.workflow.running";
  }

  return null;
}

export function ActivityLog({
  items,
  collapsible = false,
  initialCount = 3,
}: {
  items: ActivityEvent[];
  collapsible?: boolean;
  initialCount?: number;
}) {
  const { t } = useI18n();
  const [expanded, setExpanded] = React.useState(false);

  if (items.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        {t("common.empty.activity")}
      </p>
    );
  }

  const shouldCollapse = collapsible && items.length > initialCount;
  const visibleItems =
    shouldCollapse && !expanded ? items.slice(0, initialCount) : items;
  const hiddenCount = items.length - initialCount;

  function formatTitle(item: ActivityEvent) {
    const workflowKey = workflowTitleKey(item.title);

    if (workflowKey) {
      return t(workflowKey);
    }

    if (item.title.startsWith("audit:")) {
      const action = item.title.replace("audit:", "");
      return t(auditTitleKeys[action] ?? "activity.audit.generic");
    }

    return item.title;
  }

  function formatDescription(item: ActivityEvent) {
    if (item.description.startsWith("workflow:")) {
      const [, type, status] = item.description.split(":");
      return t("activity.workflow.description", { type, status });
    }

    if (item.description.startsWith("entity:")) {
      return t("activity.audit.generic");
    }

    return item.description;
  }

  function formatActor(actorName: string) {
    if (actorName === "team") {
      return t("activity.actor.team");
    }

    if (actorName === "system") {
      return t("activity.actor.system");
    }

    return actorName;
  }

  return (
    <div className="space-y-3">
      <ol className="divide-y">
        {visibleItems.map((item) => (
          <li
            key={item.id}
            className="hover:bg-muted/20 py-3 transition-colors first:pt-0 last:pb-0"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-medium">{formatTitle(item)}</p>
                <p className="text-muted-foreground mt-1 text-sm leading-5">
                  {formatDescription(item)}
                </p>
              </div>
              <time className="text-muted-foreground shrink-0 text-xs">
                {formatDateTime(item.createdAt)}
              </time>
            </div>
            <p className="text-muted-foreground mt-2 text-xs">
              {formatActor(item.actorName)}
            </p>
          </li>
        ))}
      </ol>
      {shouldCollapse ? (
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          className="inline-flex w-full items-center justify-center gap-1 rounded-md border px-3 py-2 text-[12.5px] font-semibold transition-colors"
          style={{
            background: "var(--brand-navy-50)",
            borderColor: "var(--border-1)",
            color: "var(--brand-navy-700)",
          }}
        >
          {expanded ? (
            <>
              Réduire
              <ChevronUp className="size-3.5" strokeWidth={2} />
            </>
          ) : (
            <>
              Voir {hiddenCount} événement{hiddenCount > 1 ? "s" : ""}{" "}
              de plus
              <ChevronDown className="size-3.5" strokeWidth={2} />
            </>
          )}
        </button>
      ) : null}
    </div>
  );
}
