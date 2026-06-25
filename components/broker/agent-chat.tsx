"use client";

import Link from "next/link";
import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Activity,
  FilePlus2,
  FileSignature,
  ListChecks,
  Maximize2,
  Minimize2,
  RotateCcw,
  Send,
  Sparkle,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";

type ChatMessage = { role: "user" | "assistant"; content: string };

type Capability = {
  icon: React.ReactNode;
  title: string;
  prompt: string;
};

const CAPABILITIES: Capability[] = [
  {
    icon: <FileSignature className="size-4" strokeWidth={1.75} />,
    title: "Dossiers à signer",
    prompt: "Quels dossiers attendent une signature ?",
  },
  {
    icon: <Activity className="size-4" strokeWidth={1.75} />,
    title: "Activité du jour",
    prompt: "Résume-moi l’activité récente de mes dossiers.",
  },
  {
    icon: <ListChecks className="size-4" strokeWidth={1.75} />,
    title: "Point sur le portefeuille",
    prompt: "Combien de dossiers ai-je, par statut ?",
  },
  {
    icon: <FilePlus2 className="size-4" strokeWidth={1.75} />,
    title: "Créer un dossier",
    prompt: "Aide-moi à créer un nouveau dossier client.",
  },
];

const QUICK_ACTIONS = [
  { label: "À signer", prompt: "Quels dossiers attendent une signature ?" },
  { label: "Activité", prompt: "Résume-moi l’activité récente." },
  { label: "Portefeuille", prompt: "Combien de dossiers ai-je, par statut ?" },
];

/** Render assistant text: turn /courtier/... paths into links. */
function renderContent(content: string): React.ReactNode {
  const parts = content.split(/(\/courtier\/[\w/-]+)/g);
  return parts.map((part, i) =>
    part.startsWith("/courtier/") ? (
      <Link
        key={i}
        href={part}
        className="font-medium text-[var(--brand-navy-700)] underline underline-offset-2"
      >
        ouvrir le dossier
      </Link>
    ) : (
      <React.Fragment key={i}>{part}</React.Fragment>
    ),
  );
}

function LogoAvatar({ size = 28 }: { size?: number }) {
  return (
    <span
      className="flex shrink-0 items-center justify-center rounded-lg"
      style={{
        width: size,
        height: size,
        background: "rgba(255,255,255,.12)",
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/bimi/logo.svg"
        alt=""
        aria-hidden="true"
        className="object-contain"
        style={{ width: size * 0.62, height: size * 0.62 }}
      />
    </span>
  );
}

export function AgentChat() {
  const [open, setOpen] = React.useState(false);
  const [expanded, setExpanded] = React.useState(false);
  const [messages, setMessages] = React.useState<ChatMessage[]>([]);
  const [input, setInput] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [historyLoaded, setHistoryLoaded] = React.useState(false);
  const scrollRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (open && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, open, loading]);

  React.useEffect(() => {
    if (!open || historyLoaded) return;
    setHistoryLoaded(true);
    void fetch("/api/courtier/agent")
      .then((r) => r.json())
      .then((d: { messages?: ChatMessage[] }) => {
        if (Array.isArray(d?.messages) && d.messages.length) {
          setMessages(d.messages);
        }
      })
      .catch(() => {});
  }, [open, historyLoaded]);

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || loading) return;
    const next = [...messages, { role: "user" as const, content: trimmed }];
    setMessages(next);
    setInput("");
    setLoading(true);
    let started = false;
    try {
      const res = await fetch("/api/courtier/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next.slice(-20) }),
      });
      const reader = res.body?.getReader();
      if (!reader) throw new Error("no stream");
      const decoder = new TextDecoder();
      let acc = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        acc += decoder.decode(value, { stream: true });
        if (!started) {
          started = true;
          setMessages((cur) => [...cur, { role: "assistant", content: acc }]);
        } else {
          setMessages((cur) => {
            const copy = [...cur];
            copy[copy.length - 1] = { role: "assistant", content: acc };
            return copy;
          });
        }
      }
      if (!started) {
        setMessages((cur) => [
          ...cur,
          { role: "assistant", content: "Je n’ai pas de réponse à formuler." },
        ]);
      }
    } catch {
      setMessages((cur) => [
        ...cur,
        { role: "assistant", content: "Assistant indisponible pour le moment." },
      ]);
    } finally {
      setLoading(false);
    }
  }

  async function resetConversation() {
    if (loading) return;
    setMessages([]);
    await fetch("/api/courtier/agent", { method: "DELETE" }).catch(() => {});
  }

  return (
    <>
      {/* Launcher */}
      <AnimatePresence>
        {!open ? (
          <motion.button
            type="button"
            onClick={() => setOpen(true)}
            aria-label="Assistant IA"
            initial={{ opacity: 0, scale: 0.9, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 8 }}
            whileHover={{ y: -2 }}
            className="fixed bottom-5 right-5 z-50 flex items-center gap-2.5 rounded-full px-5"
            style={{
              height: 56,
              background: "var(--brand-navy-800)",
              color: "#FFFFFF",
              border: "1px solid var(--brand-navy-700)",
              boxShadow: "0 12px 32px -8px rgba(11,18,32,.5)",
            }}
          >
            <LogoAvatar size={28} />
            <span className="text-[14px] font-semibold">Assistant</span>
            <span
              className="ml-0.5 size-1.5 rounded-full"
              style={{ background: "var(--accent)" }}
              aria-hidden
            />
          </motion.button>
        ) : null}
      </AnimatePresence>

      {/* Backdrop */}
      <AnimatePresence>
        {open ? (
          <motion.div
            key="agent-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-40 bg-[rgba(6,12,22,.4)] backdrop-blur-[2px]"
          />
        ) : null}
      </AnimatePresence>

      {/* Right-docked drawer */}
      <AnimatePresence>
        {open ? (
          <motion.aside
            key="agent-drawer"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", stiffness: 260, damping: 30 }}
            className={cn(
              "fixed inset-y-0 right-0 z-50 flex w-full flex-col overflow-hidden border-l bg-white",
              expanded ? "sm:w-[680px]" : "sm:w-[440px]",
            )}
            style={{
              borderColor: "var(--border-1)",
              boxShadow: "-24px 0 60px -24px rgba(11,18,32,.35)",
            }}
            aria-label="Assistant FalconDraft"
          >
            {/* Header */}
            <div
              className="flex items-center justify-between gap-3 px-4 py-3.5"
              style={{ background: "var(--brand-navy-800)" }}
            >
              <div className="flex items-center gap-3">
                <LogoAvatar size={36} />
                <div>
                  <p className="text-[14px] font-semibold leading-tight text-white">
                    Assistant FalconDraft
                  </p>
                  <p className="flex items-center gap-1.5 text-[11.5px] text-white/65">
                    <span
                      className="size-1.5 rounded-full"
                      style={{ background: "#34D399" }}
                    />
                    Connecté à vos dossiers
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                {messages.length > 0 ? (
                  <button
                    type="button"
                    onClick={resetConversation}
                    aria-label="Nouvelle conversation"
                    title="Nouvelle conversation"
                    className="flex size-8 items-center justify-center rounded-md text-white/70 transition-colors hover:bg-white/10 hover:text-white"
                  >
                    <RotateCcw className="size-4" strokeWidth={2} />
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => setExpanded((v) => !v)}
                  aria-label={expanded ? "Réduire" : "Agrandir"}
                  title={expanded ? "Réduire" : "Agrandir"}
                  className="hidden size-8 items-center justify-center rounded-md text-white/70 transition-colors hover:bg-white/10 hover:text-white sm:flex"
                >
                  {expanded ? (
                    <Minimize2 className="size-4" strokeWidth={2} />
                  ) : (
                    <Maximize2 className="size-4" strokeWidth={2} />
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label="Fermer"
                  className="flex size-8 items-center justify-center rounded-md text-white/70 transition-colors hover:bg-white/10 hover:text-white"
                >
                  <X className="size-4" strokeWidth={2} />
                </button>
              </div>
            </div>

            {/* Messages */}
            <div
              ref={scrollRef}
              className="flex-1 overflow-y-auto px-4 py-5"
              style={{ background: "var(--brand-navy-50)" }}
            >
              <div
                className={cn(
                  "mx-auto flex flex-col gap-4",
                  expanded ? "max-w-[620px]" : "max-w-none",
                )}
              >
                {messages.length === 0 ? (
                  <motion.div
                    initial="hidden"
                    animate="show"
                    variants={{ show: { transition: { staggerChildren: 0.07 } } }}
                    className="space-y-4"
                  >
                    <motion.div
                      variants={{
                        hidden: { opacity: 0, y: 10 },
                        show: { opacity: 1, y: 0 },
                      }}
                      className="flex items-start gap-3"
                    >
                      <span
                        className="flex size-8 shrink-0 items-center justify-center rounded-lg"
                        style={{
                          background: "var(--brand-navy-800)",
                        }}
                      >
                        <Sparkle
                          className="size-4"
                          strokeWidth={2}
                          style={{ color: "var(--accent)" }}
                        />
                      </span>
                      <p className="pt-1 text-[13.5px] leading-6 text-[var(--fg-2)]">
                        Bonjour. Je connais vos dossiers, documents, devis et
                        devoirs de conseil. Demandez-moi une info, un point de
                        situation, ou une action.
                      </p>
                    </motion.div>

                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      {CAPABILITIES.map((cap) => (
                        <motion.button
                          key={cap.title}
                          type="button"
                          onClick={() => void send(cap.prompt)}
                          variants={{
                            hidden: { opacity: 0, y: 12 },
                            show: { opacity: 1, y: 0 },
                          }}
                          whileHover={{ y: -2 }}
                          className="flex items-center gap-3 rounded-xl border bg-[var(--bg-surface)] px-3.5 py-3 text-left transition-colors hover:border-[var(--brand-navy-300)]"
                          style={{ borderColor: "var(--border-1)" }}
                        >
                          <span
                            className="flex size-9 shrink-0 items-center justify-center rounded-lg"
                            style={{
                              background: "var(--brand-navy-50)",
                              color: "var(--brand-navy-700)",
                            }}
                          >
                            {cap.icon}
                          </span>
                          <span className="text-[12.5px] font-medium text-[var(--fg-1)]">
                            {cap.title}
                          </span>
                        </motion.button>
                      ))}
                    </div>
                  </motion.div>
                ) : (
                  messages.map((m, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                      className={cn(
                        "flex items-end gap-2",
                        m.role === "user" ? "justify-end" : "justify-start",
                      )}
                    >
                      {m.role === "assistant" ? (
                        <span
                          className="mb-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg"
                          style={{ background: "var(--brand-navy-800)" }}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src="/bimi/logo.svg"
                            alt=""
                            aria-hidden="true"
                            className="size-4 object-contain"
                          />
                        </span>
                      ) : null}
                      <div
                        className="max-w-[82%] whitespace-pre-wrap rounded-2xl px-3.5 py-2.5 text-[13px] leading-6"
                        style={
                          m.role === "user"
                            ? {
                                background: "var(--brand-navy-800)",
                                color: "#FFFFFF",
                                borderBottomRightRadius: 6,
                              }
                            : {
                                background: "var(--bg-surface)",
                                color: "var(--fg-1)",
                                border: "1px solid var(--border-1)",
                                borderBottomLeftRadius: 6,
                                boxShadow: "var(--shadow-sm)",
                              }
                        }
                      >
                        {m.role === "assistant"
                          ? renderContent(m.content)
                          : m.content}
                      </div>
                    </motion.div>
                  ))
                )}

                {loading && messages[messages.length - 1]?.role === "user" ? (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex items-end gap-2"
                  >
                    <span
                      className="mb-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg"
                      style={{ background: "var(--brand-navy-800)" }}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src="/bimi/logo.svg"
                        alt=""
                        aria-hidden="true"
                        className="size-4 object-contain"
                      />
                    </span>
                    <div
                      className="flex items-center gap-1 rounded-2xl px-3.5 py-3"
                      style={{
                        background: "var(--bg-surface)",
                        border: "1px solid var(--border-1)",
                      }}
                    >
                      {[0, 1, 2].map((d) => (
                        <motion.span
                          key={d}
                          className="size-1.5 rounded-full"
                          style={{ background: "var(--brand-navy-400)" }}
                          animate={{ y: [0, -4, 0] }}
                          transition={{
                            duration: 0.6,
                            repeat: Infinity,
                            delay: d * 0.15,
                          }}
                        />
                      ))}
                    </div>
                  </motion.div>
                ) : null}
              </div>
            </div>

            {/* Quick actions + input */}
            <div
              className="border-t bg-white px-3 pb-3 pt-2.5"
              style={{ borderColor: "var(--border-1)" }}
            >
              {messages.length > 0 ? (
                <div className="mb-2 flex gap-1.5 overflow-x-auto pb-1">
                  {QUICK_ACTIONS.map((a) => (
                    <button
                      key={a.label}
                      type="button"
                      onClick={() => void send(a.prompt)}
                      disabled={loading}
                      className="shrink-0 rounded-full border px-3 py-1 text-[12px] font-medium text-[var(--fg-2)] transition-colors hover:bg-[var(--brand-navy-50)] disabled:opacity-50"
                      style={{ borderColor: "var(--border-1)" }}
                    >
                      {a.label}
                    </button>
                  ))}
                </div>
              ) : null}

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void send(input);
                }}
                className="flex items-end gap-2"
              >
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      void send(input);
                    }
                  }}
                  rows={1}
                  placeholder="Posez votre question…"
                  className="max-h-32 flex-1 resize-none rounded-xl border bg-[var(--bg-surface)] px-3.5 py-2.5 text-[13px] outline-none transition-colors focus:border-[var(--border-focus)]"
                  style={{ borderColor: "var(--border-1)", color: "var(--fg-1)" }}
                />
                <motion.button
                  type="submit"
                  disabled={loading || !input.trim()}
                  aria-label="Envoyer"
                  whileTap={{ scale: 0.92 }}
                  className="flex size-10 shrink-0 items-center justify-center rounded-xl transition-colors disabled:opacity-50"
                  style={{ background: "var(--brand-navy-800)", color: "#FFFFFF" }}
                >
                  <Send className="size-4" strokeWidth={2} />
                </motion.button>
              </form>
            </div>
          </motion.aside>
        ) : null}
      </AnimatePresence>
    </>
  );
}
