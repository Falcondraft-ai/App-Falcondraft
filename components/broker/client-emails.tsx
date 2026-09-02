"use client";

import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  CornerUpRight,
  Loader2,
  MailOpen,
  Inbox,
  Mail,
  Paperclip,
  Search,
} from "lucide-react";
import { BrokerAvatar } from "@/components/broker/broker-avatar";
import {
  EmailReaderDialog,
  type EmailReaderTarget,
} from "@/components/broker/email-reader-dialog";
import { formatDateTime } from "@/lib/format";
import type { ClientEmail } from "@/app/api/broker/clients/[id]/emails/route";

type State =
  | { kind: "loading" }
  | { kind: "no_criteria" }
  | { kind: "not_connected" }
  | { kind: "ready"; emails: ClientEmail[] };

export function ClientEmails({ clientId }: { clientId: string }) {
  const [query, setQuery] = React.useState("");
  const [state, setState] = React.useState<State>({ kind: "loading" });

  const [searchingMailbox, setSearchingMailbox] = React.useState(false);
  const [reading, setReading] = React.useState<EmailReaderTarget | null>(null);
  const openReader = React.useCallback((email: ClientEmail) => {
    setReading({
      id: email.id,
      subject: email.subject || "(sans objet)",
      from:
        email.direction === "sent"
          ? `À ${email.to[0] ?? "destinataire"}`
          : email.from,
      fromEmail: email.fromEmail || null,
      receivedAt: email.receivedAt || null,
    });
  }, []);

  const load = React.useCallback(
    async (q: string, live = false) => {
      setState((prev) => (prev.kind === "ready" ? prev : { kind: "loading" }));
      if (live) setSearchingMailbox(true);
      const parts: string[] = [];
      if (q.trim()) parts.push(`q=${encodeURIComponent(q.trim())}`);
      if (live) parts.push("live=1");
      const res = await fetch(
        `/api/broker/clients/${clientId}/emails${parts.length ? `?${parts.join("&")}` : ""}`,
      ).catch(() => null);
      const data = (await res?.json().catch(() => null)) as
        | { emails?: ClientEmail[]; reason?: string }
        | null;
      setSearchingMailbox(false);
      if (data?.reason === "not_connected") {
        setState({ kind: "not_connected" });
        return;
      }
      if (data?.reason === "no_criteria") {
        setState({ kind: "no_criteria" });
        return;
      }
      setState({ kind: "ready", emails: data?.emails ?? [] });
    },
    [clientId],
  );

  // Au montage : uniquement les emails déjà rattachés, donc instantané. Une
  // recherche, elle, n'a de sens que si elle fouille vraiment les boîtes.
  React.useEffect(() => {
    const t = setTimeout(
      () => void load(query, Boolean(query.trim())),
      query ? 350 : 0,
    );
    return () => clearTimeout(t);
  }, [query, load]);

  const groups = React.useMemo(() => {
    if (state.kind !== "ready") return { linked: [], direct: [], mention: [] };
    const linked: ClientEmail[] = [];
    const direct: ClientEmail[] = [];
    const mention: ClientEmail[] = [];
    for (const e of state.emails) {
      if (e.matchType === "linked") linked.push(e);
      else if (e.matchType === "mention") mention.push(e);
      else direct.push(e);
    }
    return { linked, direct, mention };
  }, [state]);

  const multiGroup =
    [groups.linked, groups.direct, groups.mention].filter((g) => g.length > 0)
      .length > 1;

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
            Emails du dossier
          </h2>
        </div>
        <div className="flex w-full items-center gap-2 sm:w-auto">
          {/* Fouille des boîtes à la demande : trois connexions IMAP et
              plusieurs recherches chacune, ce serait long à chaque ouverture
              de dossier alors que les emails déjà rangés suffisent souvent. */}
          <button
            type="button"
            onClick={() => void load(query, true)}
            disabled={searchingMailbox}
            className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-md border px-3 text-[12.5px] font-medium text-[var(--fg-2)] transition-colors hover:bg-[var(--bg-sunken)] disabled:opacity-60"
            style={{ borderColor: "var(--border-1)" }}
            title="Chercher aussi dans les boîtes email du cabinet"
          >
            {searchingMailbox ? (
              <Loader2 className="size-3.5 animate-spin" strokeWidth={1.75} />
            ) : (
              <Search className="size-3.5" strokeWidth={1.75} />
            )}
            {searchingMailbox ? "Recherche…" : "Chercher dans les boîtes"}
          </button>
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
            className="h-9 w-full rounded-md border bg-[var(--bg-surface)] pl-9 pr-3 text-[13px] outline-none transition-colors focus:border-[var(--brand-navy-400)]"
            style={{ borderColor: "var(--border-1)", color: "var(--fg-1)" }}
          />
        </div>
        </div>
      </div>

      <div className="px-5 py-4">
        {state.kind === "no_criteria" ? (
          <Empty
            title="Rien à rechercher sur ce dossier"
            hint="Ajoutez l’email ou le nom du client pour retrouver automatiquement ses messages."
          />
        ) : state.kind === "not_connected" ? (
          <Empty
            title="Aucune boîte email connectée"
            hint="Connectez Outlook dans Paramètres → Intégrations pour voir les emails du dossier."
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
                : "Les messages concernant ce client apparaîtront ici : ce qu’il vous écrit, ce que vous lui envoyez, et les emails qui le citent."
            }
          />
        ) : (
          <div className="space-y-5">
            <EmailGroup
              label="Rattachés à ce dossier"
              hint="Emails à l’origine ou liés à ce dossier (création, mise à jour, pièce classée, note) — quel que soit l’expéditeur."
              emails={groups.linked}
              showHeader={multiGroup}
              onRead={openReader}
            />
            <EmailGroup
              label="Échangés avec le client"
              hint="Messages reçus du client comme ceux qui lui ont été envoyés."
              emails={groups.direct}
              showHeader={multiGroup}
              onRead={openReader}
            />
            <EmailGroup
              label="Concernent ce dossier"
              hint="Emails qui citent le client, son entreprise ou une de ses références (devis d’assureur, échanges internes…)."
              emails={groups.mention}
              showHeader={multiGroup}
              muted
              onRead={openReader}
            />
          </div>
        )}
      </div>

      <EmailReaderDialog target={reading} onClose={() => setReading(null)} />
    </section>
  );
}

function EmailGroup({
  label,
  hint,
  emails,
  showHeader,
  muted,
  onRead,
}: {
  label: string;
  hint: string;
  emails: ClientEmail[];
  showHeader: boolean;
  muted?: boolean;
  onRead: (email: ClientEmail) => void;
}) {
  if (emails.length === 0) return null;
  return (
    <div>
      {showHeader ? (
        <div className="mb-1.5 flex items-baseline gap-2">
          <span
            className="text-[10px] font-semibold uppercase tracking-[0.08em]"
            style={{ color: muted ? "var(--fg-4)" : "var(--brand-navy-700)" }}
            title={hint}
          >
            {label}
          </span>
          <span className="text-[11px] tabular-nums text-[var(--fg-4)]">
            {emails.length}
          </span>
        </div>
      ) : null}
      <AnimatePresence initial={false}>
        <ul className="space-y-1.5">
          {emails.map((email) => (
            <motion.li
              key={email.id}
              layout
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
            >
              {/* Bouton, pas lien : hors Microsoft un email n'a aucune URL,
                  et le lien restait mort. La lecture se fait dans l'outil. */}
              <button
                type="button"
                onClick={() => onRead(email)}
                className="group flex w-full items-start gap-3 rounded-lg border border-transparent px-2.5 py-2.5 text-left transition-colors hover:border-[var(--border-1)] hover:bg-[var(--bg-sunken)]"
              >
                <BrokerAvatar
                  name={
                    email.direction === "sent"
                      ? (email.to[0] ?? email.from)
                      : email.from
                  }
                  size={34}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    {email.direction === "sent" ? (
                      <CornerUpRight
                        className="size-3.5 shrink-0 text-[var(--fg-4)]"
                        strokeWidth={1.75}
                        aria-label="Email envoyé"
                      />
                    ) : null}
                    <p className="truncate text-[13px] font-semibold text-[var(--fg-1)]">
                      {email.direction === "sent"
                        ? `À ${email.to[0] ?? "destinataire"}`
                        : email.from}
                    </p>
                    {email.hasAttachments ? (
                      <Paperclip
                        className="size-3.5 shrink-0 text-[var(--fg-4)]"
                        strokeWidth={1.75}
                        aria-label="Pièce jointe"
                      />
                    ) : null}
                    <span className="ml-auto shrink-0 font-mono text-[11px] text-[var(--fg-4)]">
                      {email.receivedAt ? formatDateTime(email.receivedAt) : ""}
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
                <MailOpen
                  className="mt-0.5 size-3.5 shrink-0 text-[var(--fg-4)] opacity-0 transition-opacity group-hover:opacity-100"
                  strokeWidth={1.75}
                  aria-label="Lire l’email"
                />
              </button>
            </motion.li>
          ))}
        </ul>
      </AnimatePresence>
    </div>
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
