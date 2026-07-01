"use client";

import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ExternalLink, Inbox, Mail, Paperclip, Search } from "lucide-react";
import { BrokerAvatar } from "@/components/broker/broker-avatar";
import { formatDateTime } from "@/lib/format";
import type { ClientEmail } from "@/app/api/broker/clients/[id]/emails/route";

type State =
  | { kind: "loading" }
  | { kind: "no_email" }
  | { kind: "not_connected" }
  | { kind: "ready"; emails: ClientEmail[] };

export function ClientEmails({
  clientId,
  hasEmail,
}: {
  clientId: string;
  hasEmail: boolean;
}) {
  const [query, setQuery] = React.useState("");
  const [state, setState] = React.useState<State>(
    hasEmail ? { kind: "loading" } : { kind: "no_email" },
  );

  const load = React.useCallback(
    async (q: string) => {
      if (!hasEmail) return;
      setState((prev) =>
        prev.kind === "ready" ? prev : { kind: "loading" },
      );
      const params = q.trim() ? `?q=${encodeURIComponent(q.trim())}` : "";
      const res = await fetch(
        `/api/broker/clients/${clientId}/emails${params}`,
      ).catch(() => null);
      const data = (await res?.json().catch(() => null)) as
        | { emails?: ClientEmail[]; reason?: string }
        | null;
      if (data?.reason === "not_connected") {
        setState({ kind: "not_connected" });
        return;
      }
      if (data?.reason === "no_email") {
        setState({ kind: "no_email" });
        return;
      }
      setState({ kind: "ready", emails: data?.emails ?? [] });
    },
    [clientId, hasEmail],
  );

  // Initial load + debounced search.
  React.useEffect(() => {
    const t = setTimeout(() => void load(query), query ? 350 : 0);
    return () => clearTimeout(t);
  }, [query, load]);

  return (
    <section
      className="rounded-xl border bg-[var(--bg-surface)]"
      style={{ borderColor: "var(--border-1)", boxShadow: "var(--shadow-sm)" }}
    >
      <div
        className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-3.5"
        style={{ borderColor: "var(--border-1)" }}
      >
        <div className="flex items-center gap-2">
          <Mail
            className="size-4 text-[var(--brand-navy-700)]"
            strokeWidth={1.75}
          />
          <h2 className="text-[14px] font-semibold tracking-[-0.005em] text-[var(--fg-1)]">
            Emails du client
          </h2>
        </div>
        <div className="relative w-full sm:w-64">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--fg-4)]"
            strokeWidth={1.75}
            aria-hidden="true"
          />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher dans les emails…"
            disabled={!hasEmail}
            className="h-9 w-full rounded-md border bg-[var(--bg-surface)] pl-9 pr-3 text-[13px] outline-none transition-colors focus:border-[var(--brand-navy-400)] disabled:opacity-50"
            style={{ borderColor: "var(--border-1)", color: "var(--fg-1)" }}
          />
        </div>
      </div>

      <div className="px-5 py-4">
        {state.kind === "no_email" ? (
          <Empty
            title="Aucune adresse email sur ce dossier"
            hint="Ajoutez l’email du client pour rattacher automatiquement ses messages."
          />
        ) : state.kind === "not_connected" ? (
          <Empty
            title="Boîte Outlook non connectée"
            hint="Connectez Outlook dans Paramètres → Intégrations pour voir les emails du client."
          />
        ) : state.kind === "loading" ? (
          <div className="space-y-2">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="h-14 animate-pulse rounded-lg"
                style={{ background: "var(--bg-sunken)" }}
              />
            ))}
          </div>
        ) : state.emails.length === 0 ? (
          <Empty
            title={query ? "Aucun email ne correspond" : "Aucun email rattaché"}
            hint={
              query
                ? "Essayez d’autres mots-clés."
                : "Les messages échangés avec ce client apparaîtront ici."
            }
          />
        ) : (
          <AnimatePresence initial={false}>
            <ul className="space-y-1.5">
              {state.emails.map((email) => (
                <motion.li
                  key={email.id}
                  layout
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                >
                  <a
                    href={email.webLink || undefined}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group flex items-start gap-3 rounded-lg border border-transparent px-2.5 py-2.5 transition-colors hover:border-[var(--border-1)] hover:bg-[var(--bg-sunken)]"
                  >
                    <BrokerAvatar name={email.from} size={34} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-[13px] font-semibold text-[var(--fg-1)]">
                          {email.from}
                        </p>
                        {email.hasAttachments ? (
                          <Paperclip
                            className="size-3.5 shrink-0 text-[var(--fg-4)]"
                            strokeWidth={1.75}
                            aria-label="Pièce jointe"
                          />
                        ) : null}
                        <span className="ml-auto shrink-0 font-mono text-[11px] text-[var(--fg-4)]">
                          {email.receivedAt
                            ? formatDateTime(email.receivedAt)
                            : ""}
                        </span>
                      </div>
                      <p className="mt-0.5 truncate text-[12.5px] text-[var(--fg-1)]">
                        {email.subject}
                      </p>
                      {email.preview ? (
                        <p className="mt-0.5 truncate text-[12px] text-[var(--fg-3)]">
                          {email.preview}
                        </p>
                      ) : null}
                    </div>
                    <ExternalLink
                      className="mt-0.5 size-3.5 shrink-0 text-[var(--fg-4)] opacity-0 transition-opacity group-hover:opacity-100"
                      strokeWidth={1.75}
                    />
                  </a>
                </motion.li>
              ))}
            </ul>
          </AnimatePresence>
        )}
      </div>
    </section>
  );
}

function Empty({ title, hint }: { title: string; hint: string }) {
  return (
    <div className="flex flex-col items-center justify-center px-4 py-8 text-center">
      <span
        className="flex size-10 items-center justify-center rounded-full"
        style={{
          background: "var(--brand-navy-50)",
          color: "var(--brand-navy-700)",
          border: "1px solid var(--border-1)",
        }}
      >
        <Inbox className="size-5" strokeWidth={1.5} />
      </span>
      <p className="mt-3 text-[13px] font-medium text-[var(--fg-1)]">{title}</p>
      <p className="mt-1 max-w-sm text-[12px] text-[var(--fg-3)]">{hint}</p>
    </div>
  );
}
