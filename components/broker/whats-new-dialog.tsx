"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  changelogKindLabels,
  courtierChangelog,
  type ChangelogKind,
} from "@/lib/broker/changelog";

/** Reopens the dialog from anywhere (the account menu dispatches it). */
export const WHATS_NEW_EVENT = "courtier:whats-new";

const STORAGE_PREFIX = "courtier-whats-new-seen";

const kindStyle: Record<ChangelogKind, React.CSSProperties> = {
  new: {
    background: "var(--accent-soft)",
    color: "var(--accent-foreground)",
    border: "1px solid rgba(184,146,42,0.2)",
  },
  improved: {
    background: "var(--brand-navy-50)",
    color: "var(--brand-navy-700)",
    border: "1px solid var(--border-1)",
  },
  fixed: {
    background: "var(--success-soft)",
    color: "var(--success)",
    border: "1px solid rgba(21,128,61,0.2)",
  },
};

/**
 * « Quoi de neuf » — shown once per profile after an update. Several people
 * share one account (and sometimes one computer), so « seen » is remembered per
 * profile: Frank reading it doesn't hide it from Dominique.
 */
export function WhatsNewDialog({ profileId }: { profileId: string | null }) {
  const latest = courtierChangelog[0];
  const [open, setOpen] = React.useState(false);
  const storageKey = `${STORAGE_PREFIX}:${profileId ?? "account"}`;

  React.useEffect(() => {
    if (!latest) return;
    try {
      if (window.localStorage.getItem(storageKey) !== latest.id) setOpen(true);
    } catch {
      // Storage blocked (private window): showing it every time would nag, so
      // it only opens from the menu.
    }
  }, [latest, storageKey]);

  React.useEffect(() => {
    const reopen = () => setOpen(true);
    window.addEventListener(WHATS_NEW_EVENT, reopen);
    return () => window.removeEventListener(WHATS_NEW_EVENT, reopen);
  }, []);

  function close() {
    setOpen(false);
    try {
      if (latest) window.localStorage.setItem(storageKey, latest.id);
    } catch {
      // Nothing to remember it in — it will simply show again next time.
    }
  }

  if (!latest) return null;

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? setOpen(true) : close())}>
      <DialogContent className="max-h-[88vh] max-w-xl overflow-hidden p-0">
        <DialogHeader
          className="border-b px-6 pb-4 pt-6 text-left"
          style={{ borderColor: "var(--border-1)" }}
        >
          <p className="fd-eyebrow">Quoi de neuf · {latest.date}</p>
          <DialogTitle
            className="mt-1.5 text-[22px] font-semibold leading-tight tracking-[-0.01em] text-[var(--fg-1)]"
            style={{ fontFamily: "var(--font-heading)" }}
          >
            {latest.title}
          </DialogTitle>
          <DialogDescription className="mt-1 text-[13px] leading-5 text-[var(--fg-3)]">
            Ce qui change dans votre espace depuis votre dernière visite.
          </DialogDescription>
        </DialogHeader>

        <ul className="max-h-[56vh] space-y-4 overflow-y-auto px-6 py-5">
          {latest.items.map((item) => (
            <li key={item.title} className="flex gap-3">
              <span
                className="mt-[1px] h-fit shrink-0 rounded-[4px] px-1.5 py-[2px] text-[10px] font-semibold uppercase tracking-[0.05em]"
                style={kindStyle[item.kind]}
              >
                {changelogKindLabels[item.kind]}
              </span>
              <div className="min-w-0">
                <p className="text-[13.5px] font-semibold text-[var(--fg-1)]">
                  {item.title}
                </p>
                <p className="mt-0.5 text-[13px] leading-[1.6] text-[var(--fg-3)]">
                  {item.description}
                </p>
              </div>
            </li>
          ))}
        </ul>

        <div
          className="flex items-center justify-between gap-3 border-t px-6 py-4"
          style={{ borderColor: "var(--border-1)" }}
        >
          <p className="text-[12px] text-[var(--fg-3)]">
            Retrouvez ces nouveautés dans le menu de votre compte.
          </p>
          <Button type="button" onClick={close}>
            C’est noté
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
