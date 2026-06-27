"use client";

import Link from "next/link";
import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, History } from "lucide-react";
import { brokerActivityLabel } from "@/lib/broker/activity";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { BrokerActivityRow } from "@/types/database";

const DEFAULT_VISIBLE = 3;
const EASE = [0.16, 1, 0.3, 1] as const;

function ActivityRow({ entry }: { entry: BrokerActivityRow }) {
  return (
    <Link
      href={`/courtier/clients/${entry.client_id}`}
      className="flex items-start gap-2.5 px-4 py-2.5 transition-colors hover:bg-[rgba(14,34,56,0.025)]"
    >
      <span
        aria-hidden
        className="mt-[7px] size-1.5 shrink-0 rounded-full"
        style={{ background: "var(--accent)" }}
      />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[12.5px] font-medium text-[var(--fg-1)]">
          {brokerActivityLabel(entry.type)}
        </p>
        {entry.description ? (
          <p className="truncate text-[11.5px] text-[var(--fg-3)]">
            {entry.description}
          </p>
        ) : null}
      </div>
      <span className="shrink-0 pt-px font-mono text-[10.5px] text-[var(--fg-4)]">
        {formatDateTime(entry.created_at)}
      </span>
    </Link>
  );
}

/**
 * Compact, collapsible activity feed. Shows the latest few entries and reveals
 * the rest with a fluid height animation so the dashboard never jumps.
 */
export function ActivityFeed({ activity }: { activity: BrokerActivityRow[] }) {
  const [expanded, setExpanded] = React.useState(false);
  const canExpand = activity.length > DEFAULT_VISIBLE;
  const head = activity.slice(0, DEFAULT_VISIBLE);
  const rest = activity.slice(DEFAULT_VISIBLE);

  return (
    <section
      className="overflow-hidden rounded-lg border bg-[var(--bg-surface)]"
      style={{ borderColor: "var(--border-1)", boxShadow: "var(--shadow-sm)" }}
    >
      <div
        className="flex items-center gap-2 border-b px-4 py-3"
        style={{ borderColor: "var(--border-1)" }}
      >
        <History
          className="size-4 text-[var(--brand-navy-700)]"
          strokeWidth={1.75}
        />
        <h3 className="text-[13.5px] font-semibold text-[var(--fg-1)]">
          Ce qui s’est passé
        </h3>
      </div>

      {activity.length > 0 ? (
        <>
          <ul className="divide-y" style={{ borderColor: "var(--border-1)" }}>
            {head.map((entry) => (
              <li key={entry.id}>
                <ActivityRow entry={entry} />
              </li>
            ))}
          </ul>

          <AnimatePresence initial={false}>
            {expanded && rest.length > 0 ? (
              <motion.div
                key="more"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.3, ease: EASE }}
                className="overflow-hidden"
              >
                <ul
                  className="divide-y border-t"
                  style={{ borderColor: "var(--border-1)" }}
                >
                  {rest.map((entry) => (
                    <li key={entry.id}>
                      <ActivityRow entry={entry} />
                    </li>
                  ))}
                </ul>
              </motion.div>
            ) : null}
          </AnimatePresence>

          {canExpand ? (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="flex w-full items-center justify-center gap-1.5 border-t px-4 py-2.5 text-[12px] font-medium text-[var(--fg-3)] transition-colors hover:bg-[var(--bg-sunken)] hover:text-[var(--fg-1)]"
              style={{ borderColor: "var(--border-1)" }}
            >
              {expanded ? "Voir moins" : `Voir tout (${activity.length})`}
              <ChevronDown
                className={cn(
                  "size-3.5 transition-transform duration-300",
                  expanded && "rotate-180",
                )}
                strokeWidth={2}
              />
            </button>
          ) : null}
        </>
      ) : (
        <div className="px-4 py-6 text-center">
          <p className="text-[12.5px] text-[var(--fg-3)]">
            L’activité de vos dossiers apparaîtra ici.
          </p>
        </div>
      )}
    </section>
  );
}
