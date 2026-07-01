"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  CalendarClock,
  Check,
  ListChecks,
  Paperclip,
  PenLine,
  ShieldAlert,
  UserCog,
  UserPlus,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { describeSuggestion, type SuggestionType } from "@/lib/broker/outlook";

export type ValidationItem = {
  id: string;
  type: string;
  payload: Record<string, unknown> | null;
  clientName: string | null;
  from: string;
  subject: string;
};

type LocalStatus = "pending" | "loading" | "done" | "rejected";

const icons: Record<string, React.ReactNode> = {
  attach_document: <Paperclip className="size-3.5" strokeWidth={1.75} />,
  draft_reply: <PenLine className="size-3.5" strokeWidth={1.75} />,
  create_client: <UserPlus className="size-3.5" strokeWidth={1.75} />,
  update_client: <UserCog className="size-3.5" strokeWidth={1.75} />,
  declare_claim: <ShieldAlert className="size-3.5" strokeWidth={1.75} />,
  flag_renewal: <CalendarClock className="size-3.5" strokeWidth={1.75} />,
};

export function ValidationQueue({ items }: { items: ValidationItem[] }) {
  const router = useRouter();
  const [statuses, setStatuses] = React.useState<Record<string, LocalStatus>>(
    {},
  );

  async function resolve(item: ValidationItem, action: "accept" | "reject") {
    if ((statuses[item.id] ?? "pending") !== "pending") return;
    setStatuses((m) => ({ ...m, [item.id]: "loading" }));
    const res = await fetch(`/api/courtier/outlook/suggestions/${item.id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    }).catch(() => null);
    const result = (await res?.json().catch(() => null)) as
      | { success?: boolean; message?: string }
      | null;
    if (!res?.ok || !result?.success) {
      setStatuses((m) => ({ ...m, [item.id]: "pending" }));
      toast.error(
        action === "accept" ? "Action impossible." : "Impossible d’ignorer.",
        { description: result?.message },
      );
      return;
    }
    setStatuses((m) => ({
      ...m,
      [item.id]: action === "accept" ? "done" : "rejected",
    }));
    if (action === "accept") router.refresh();
  }

  const visible = items.filter(
    (i) => (statuses[i.id] ?? "pending") !== "rejected",
  );

  return (
    <section
      className="overflow-hidden rounded-lg border bg-[var(--bg-surface)]"
      style={{ borderColor: "var(--border-1)", boxShadow: "var(--shadow-sm)" }}
    >
      <div
        className="flex items-center justify-between gap-3 border-b px-4 py-3"
        style={{ borderColor: "var(--border-1)" }}
      >
        <div className="flex items-center gap-2">
          <span style={{ color: "var(--brand-navy-700)" }}>
            <ListChecks className="size-4" strokeWidth={1.75} />
          </span>
          <h3 className="text-[13.5px] font-semibold text-[var(--fg-1)]">
            À valider
          </h3>
        </div>
        <Link
          href="/courtier/inbox"
          className="text-[12px] font-medium text-[var(--brand-navy-700)] transition-colors hover:text-[var(--brand-navy-800)]"
        >
          Assistant Outlook
        </Link>
      </div>

      {visible.length > 0 ? (
        <ul className="divide-y" style={{ borderColor: "var(--border-1)" }}>
          <AnimatePresence initial={false}>
            {visible.map((item) => {
              const status = statuses[item.id] ?? "pending";
              const done = status === "done";
              return (
                <motion.li
                  key={item.id}
                  layout
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0, height: 0 }}
                  className="px-4 py-3"
                >
                  <div className="flex items-start gap-2.5">
                    <span
                      className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md"
                      style={{
                        background: "var(--accent-soft)",
                        color: "var(--accent-foreground)",
                        border: "1px solid var(--accent-soft)",
                      }}
                    >
                      {icons[item.type] ?? (
                        <ListChecks className="size-3.5" strokeWidth={1.75} />
                      )}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[12.5px] font-medium text-[var(--fg-1)]">
                        {describeSuggestion(
                          item.type as SuggestionType,
                          item.payload,
                          item.clientName,
                        )}
                      </p>
                      <p className="mt-0.5 truncate text-[11.5px] text-[var(--fg-3)]">
                        {item.from} · {item.subject}
                      </p>
                    </div>
                  </div>

                  <div className="mt-2.5 flex items-center justify-end gap-1.5">
                    {done ? (
                      <span
                        className="inline-flex items-center gap-1 text-[11.5px] font-semibold"
                        style={{ color: "var(--success, #15803d)" }}
                      >
                        <Check className="size-3.5" strokeWidth={2.5} /> Fait
                      </span>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => resolve(item, "reject")}
                          disabled={status === "loading"}
                          className="inline-flex h-7 items-center gap-1 rounded-md border px-2.5 text-[12px] font-medium text-[var(--fg-3)] transition-colors hover:bg-[var(--bg-sunken)] disabled:opacity-50"
                          style={{ borderColor: "var(--border-1)" }}
                        >
                          <X className="size-3.5" strokeWidth={2} />
                          Ignorer
                        </button>
                        <button
                          type="button"
                          onClick={() => resolve(item, "accept")}
                          disabled={status === "loading"}
                          className="inline-flex h-7 items-center gap-1 rounded-md px-2.5 text-[12px] font-semibold text-white transition-colors disabled:opacity-50"
                          style={{ background: "var(--brand-navy-800)" }}
                        >
                          {status === "loading" ? (
                            "…"
                          ) : (
                            <>
                              <Check className="size-3.5" strokeWidth={2.25} />
                              Valider
                            </>
                          )}
                        </button>
                      </>
                    )}
                  </div>
                </motion.li>
              );
            })}
          </AnimatePresence>
        </ul>
      ) : (
        <div className="px-4 py-7 text-center">
          <p className="text-[13px] font-medium text-[var(--fg-1)]">
            Rien à valider
          </p>
          <p className="mt-1 text-[12px] text-[var(--fg-3)]">
            L’assistant vous proposera ici des actions à partir de vos emails
            (créer un dossier, ranger une pièce, préparer une réponse…).
          </p>
        </div>
      )}
    </section>
  );
}
