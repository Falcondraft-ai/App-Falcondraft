"use client";

import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown } from "lucide-react";
import { brokerActivityLabel } from "@/lib/broker/activity";
import { formatDateTime } from "@/lib/format";

const EASE = [0.16, 1, 0.3, 1] as const;

type HistoryEntry = {
  id: string;
  type: string;
  description: string | null;
  created_at: string;
};

export function ClientHistory({ activity }: { activity: HistoryEntry[] }) {
  const [open, setOpen] = React.useState(false);

  return (
    <section
      className="rounded-xl border bg-[var(--bg-surface)]"
      style={{ borderColor: "var(--border-1)", boxShadow: "var(--shadow-sm)" }}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 px-5 py-3.5 text-left transition-colors hover:bg-[var(--bg-sunken)]"
      >
        <span className="text-[13px] font-semibold text-[var(--fg-2)]">
          Historique du dossier
        </span>
        <span className="flex items-center gap-2">
          <span className="text-[11.5px] text-[var(--fg-4)]">
            {activity.length} entrée{activity.length > 1 ? "s" : ""}
          </span>
          <ChevronDown
            className={`size-4 text-[var(--fg-4)] transition-transform duration-300 ${
              open ? "rotate-180" : ""
            }`}
            strokeWidth={1.75}
          />
        </span>
      </button>

      <AnimatePresence initial={false}>
        {open ? (
          <motion.div
            key="history-body"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.32, ease: EASE }}
            className="overflow-hidden"
          >
            <div
              className="border-t px-5 py-4"
              style={{ borderColor: "var(--border-1)" }}
            >
              {activity.length > 0 ? (
                <ol className="space-y-3.5">
                  {activity.map((entry, i) => (
                    <motion.li
                      key={entry.id}
                      initial={{ opacity: 0, x: -6 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.04 + i * 0.035, duration: 0.25 }}
                      className="flex gap-3"
                    >
                      <span
                        aria-hidden
                        className="mt-1.5 size-1.5 shrink-0 rounded-full"
                        style={{ background: "var(--border-strong)" }}
                      />
                      <div className="min-w-0">
                        <p className="text-[12.5px] font-medium text-[var(--fg-2)]">
                          {brokerActivityLabel(entry.type)}
                        </p>
                        {entry.description ? (
                          <p className="mt-0.5 text-[11.5px] leading-5 text-[var(--fg-3)]">
                            {entry.description}
                          </p>
                        ) : null}
                        <p className="mt-0.5 font-mono text-[10.5px] text-[var(--fg-4)]">
                          {formatDateTime(entry.created_at)}
                        </p>
                      </div>
                    </motion.li>
                  ))}
                </ol>
              ) : (
                <p className="text-[12.5px] text-[var(--fg-3)]">
                  Aucune action enregistrée pour le moment.
                </p>
              )}
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </section>
  );
}
