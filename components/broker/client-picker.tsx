"use client";

import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, ChevronDown, FolderInput, Search } from "lucide-react";
import { cn } from "@/lib/utils";

export type ClientOption = { id: string; name: string };

/**
 * Searchable dossier picker. Used twice: to file an attachment on the action
 * itself, and to link a whole email to a dossier. `onOpen` lets the caller
 * refresh the list so dossiers created since the page loaded show up.
 */
export function ClientPicker({
  clients,
  value,
  busy,
  placeholder,
  tone = "default",
  subtle,
  onPick,
  onOpen,
}: {
  clients: ClientOption[];
  value?: string | null;
  busy?: boolean;
  placeholder: string;
  tone?: "default" | "attention";
  subtle?: boolean;
  onPick: (clientId: string) => void;
  onOpen?: () => void;
}) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  const selected = value ? (clients.find((c) => c.id === value) ?? null) : null;

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q
      ? clients.filter((c) => c.name.toLowerCase().includes(q))
      : clients;
    return list.slice(0, 60);
  }, [clients, query]);

  const triggerStyle: React.CSSProperties = subtle
    ? { color: "var(--fg-4)" }
    : tone === "attention" && !selected
      ? {
          borderColor: "var(--brand-amber-200, rgba(184,146,42,0.35))",
          background: "var(--brand-amber-50, #fdf7e8)",
          color: "var(--brand-amber-800, #92610f)",
        }
      : { borderColor: "var(--border-1)", color: "var(--fg-2)" };

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => {
          setOpen((v) => {
            if (!v) onOpen?.();
            return !v;
          });
        }}
        disabled={busy}
        className={cn(
          "inline-flex items-center gap-1.5 text-[12px] font-medium transition-colors disabled:opacity-50",
          subtle
            ? "h-6 rounded-md px-1 underline-offset-2 hover:text-[var(--fg-2)] hover:underline"
            : "h-7 max-w-[240px] rounded-md border px-2.5 hover:bg-[var(--bg-sunken)]",
        )}
        style={triggerStyle}
      >
        <FolderInput className="size-3.5 shrink-0" strokeWidth={1.75} />
        <span className="truncate">
          {busy ? "Rattachement…" : (selected?.name ?? placeholder)}
        </span>
        <ChevronDown className="size-3 shrink-0" strokeWidth={2} />
      </button>

      <AnimatePresence>
        {open ? (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 z-20 mt-1.5 w-72 overflow-hidden rounded-lg border bg-[var(--bg-surface)] shadow-[var(--shadow-md)]"
            style={{ borderColor: "var(--border-1)" }}
          >
            <div
              className="flex items-center gap-2 border-b px-3 py-2"
              style={{ borderColor: "var(--border-1)" }}
            >
              <Search
                className="size-3.5 shrink-0 text-[var(--fg-4)]"
                strokeWidth={1.75}
              />
              <input
                autoFocus
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Rechercher un dossier…"
                className="w-full bg-transparent text-[12.5px] outline-none placeholder:text-[var(--fg-4)]"
                style={{ color: "var(--fg-1)" }}
              />
            </div>
            <ul className="max-h-64 overflow-y-auto py-1">
              {filtered.length > 0 ? (
                filtered.map((c) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setOpen(false);
                        onPick(c.id);
                      }}
                      className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[12.5px] text-[var(--fg-2)] transition-colors hover:bg-[var(--bg-sunken)]"
                    >
                      <Check
                        className={cn(
                          "size-3.5 shrink-0",
                          c.id === value ? "opacity-100" : "opacity-0",
                        )}
                        strokeWidth={2.25}
                      />
                      <span className="truncate">{c.name}</span>
                    </button>
                  </li>
                ))
              ) : (
                <li className="px-3 py-2 text-[12px] text-[var(--fg-4)]">
                  Aucun dossier trouvé.
                </li>
              )}
            </ul>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
