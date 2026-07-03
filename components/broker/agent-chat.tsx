"use client";

import Link from "next/link";
import * as React from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  Activity,
  ArrowUp,
  ArrowUpRight,
  CalendarClock,
  ChartNoAxesColumn,
  Check,
  ChevronDown,
  FileCheck,
  FileInput,
  FileSearch,
  FileText,
  FolderCog,
  FolderOpen,
  FolderPlus,
  FolderSearch,
  HandCoins,
  Inbox,
  LoaderCircle,
  MailOpen,
  MailSearch,
  Maximize2,
  Minimize2,
  Paperclip,
  PenLine,
  RefreshCw,
  RotateCcw,
  ShieldAlert,
  Signature,
  Sparkles,
  UserSearch,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { documentUploadAccept } from "@/lib/broker/documents";
import { cn } from "@/lib/utils";

type MessageAttachment = { fileName: string };

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
  attachments?: MessageAttachment[];
};

/** A file staged for the next message via /api/courtier/agent/upload. */
type PendingAttachment = {
  tempId: string;
  fileName: string;
  status: "uploading" | "ready" | "error";
  uploadId?: string;
  storagePath?: string;
  mimeType?: string;
  sizeBytes?: number;
};

const EASE = [0.16, 1, 0.3, 1] as const;

// ---------------------------------------------------------------------------
// Stream parsing — the API interleaves plain text with UI-only markers:
//   [[tool:tool_name]]        emitted live while the agent works
//   [[suggestions: a | b]]    quick-reply chips, always at the very end
// ---------------------------------------------------------------------------

type ParsedAssistant = {
  text: string;
  tools: string[];
  suggestions: string[];
  /** Visible text arrived after the last tool marker → the answer is underway. */
  answerStarted: boolean;
};

function parseAssistant(raw: string): ParsedAssistant {
  const tools: string[] = [];
  let suggestions: string[] = [];
  let text = "";
  let tail = "";
  let i = 0;
  while (i < raw.length) {
    const open = raw.indexOf("[[", i);
    if (open === -1) {
      const chunk = raw.slice(i);
      text += chunk;
      tail += chunk;
      break;
    }
    const chunk = raw.slice(i, open);
    text += chunk;
    tail += chunk;
    const close = raw.indexOf("]]", open + 2);
    if (close === -1) break; // marker still streaming — hold the rest back
    const inner = raw.slice(open + 2, close);
    if (inner.startsWith("tool:")) {
      tools.push(inner.slice(5).trim());
      tail = "";
      // Text from separate tool rounds must not glue together.
      if (text && !text.endsWith("\n")) text += "\n\n";
    } else if (inner.startsWith("suggestions:")) {
      suggestions = inner
        .slice("suggestions:".length)
        .split("|")
        .map((s) => s.trim())
        .filter(Boolean)
        .slice(0, 4);
    } else {
      const literal = raw.slice(open, close + 2);
      text += literal;
      tail += literal;
    }
    i = close + 2;
  }
  return {
    text: text.replace(/\n{3,}/g, "\n\n").trim(),
    tools,
    suggestions,
    answerStarted: tail.trim().length > 0,
  };
}

/** Strip UI markers before echoing history back to the API. */
function cleanForModel(content: string): string {
  const stripped = content
    .replace(/\[\[tool:[\w-]*\]\]/g, "")
    .replace(/\n?\[\[suggestions:[\s\S]*?\]\]\s*$/, "")
    .trim();
  return stripped || content;
}

// ---------------------------------------------------------------------------
// Tool activity — every backend tool gets a French label + icon so the user
// sees what the assistant is actually doing, in his language, never the tech.
// ---------------------------------------------------------------------------

type ToolMeta = { label: string; icon: React.ComponentType<{ className?: string; strokeWidth?: number; style?: React.CSSProperties }> };

const TOOL_META: Record<string, ToolMeta> = {
  list_clients: { label: "Recherche dans vos dossiers", icon: FolderSearch },
  get_client: { label: "Lecture d'un dossier", icon: FolderOpen },
  find_client_by_email: { label: "Identification du client", icon: UserSearch },
  list_client_emails: { label: "Parcours des échanges", icon: MailSearch },
  get_stats: { label: "Point sur le portefeuille", icon: ChartNoAxesColumn },
  get_recent_activity: { label: "Revue de l'activité récente", icon: Activity },
  list_contracts: { label: "Vérification des contrats", icon: FileCheck },
  list_email_attachments: { label: "Inventaire des pièces jointes", icon: Paperclip },
  inspect_email_attachment: { label: "Lecture d'une pièce jointe", icon: FileSearch },
  inspect_uploaded_file: { label: "Analyse du document", icon: FileSearch },
  get_upcoming_renewals: { label: "Contrôle des échéances", icon: CalendarClock },
  get_commission_summary: { label: "Synthèse des commissions", icon: HandCoins },
  get_open_claims: { label: "Suivi des sinistres", icon: ShieldAlert },
  list_recent_emails: { label: "Lecture de la boîte de réception", icon: Inbox },
  read_email: { label: "Lecture d'un email", icon: MailOpen },
  draft_email: { label: "Préparation du brouillon", icon: PenLine },
  create_client: { label: "Création du dossier", icon: FolderPlus },
  update_client_status: { label: "Mise à jour du statut", icon: RefreshCw },
  update_client: { label: "Mise à jour du dossier", icon: FolderCog },
  attach_email_attachment_to_client: { label: "Classement de la pièce jointe", icon: FileInput },
  attach_uploaded_file_to_client: { label: "Classement du document", icon: FileInput },
  generate_advice: { label: "Rédaction du devoir de conseil", icon: Signature },
};

const DEFAULT_TOOL_META: ToolMeta = {
  label: "Consultation de vos données",
  icon: Sparkles,
};

function toolMeta(name: string): ToolMeta {
  return TOOL_META[name] ?? DEFAULT_TOOL_META;
}

/** Collapse consecutive repeats ("Lecture d'un dossier" ×3 → one step). */
function toSteps(tools: string[]): ToolMeta[] {
  const steps: ToolMeta[] = [];
  for (const name of tools) {
    const meta = toolMeta(name);
    if (steps[steps.length - 1]?.label !== meta.label) steps.push(meta);
  }
  return steps;
}

// ---------------------------------------------------------------------------
// Rich text — lightweight renderer for the assistant's markdown subset:
// **bold**, [label](/courtier/...) links, bare /courtier/... paths, - bullets.
// ---------------------------------------------------------------------------

const INLINE_RE =
  /\[([^\]]+)\]\((\/courtier\/[\w/?=&-]+)\)|(\/courtier\/[\w/-]+)|\*\*([^*]+?)\*\*/g;

function DossierLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="mx-0.5 inline-flex max-w-full items-center gap-1 rounded-md border px-1.5 py-px align-[-2px] text-[12px] font-medium transition-colors hover:border-[var(--brand-navy-300)] hover:bg-[var(--brand-navy-100)]"
      style={{
        borderColor: "var(--border-1)",
        background: "var(--brand-navy-50)",
        color: "var(--brand-navy-700)",
      }}
    >
      <FolderOpen className="size-3 shrink-0" strokeWidth={1.75} />
      <span className="truncate">{label}</span>
    </Link>
  );
}

function renderInline(text: string, keyBase: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  const re = new RegExp(INLINE_RE.source, "g");
  let last = 0;
  let k = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    if (m.index > last) nodes.push(text.slice(last, m.index));
    if (m[1] && m[2]) {
      nodes.push(<DossierLink key={`${keyBase}-${k++}`} href={m[2]} label={m[1]} />);
    } else if (m[3]) {
      nodes.push(
        <DossierLink key={`${keyBase}-${k++}`} href={m[3]} label="Ouvrir le dossier" />,
      );
    } else if (m[4]) {
      nodes.push(
        <strong key={`${keyBase}-${k++}`} className="font-semibold">
          {m[4]}
        </strong>,
      );
    }
    last = re.lastIndex;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

function renderRich(text: string): React.ReactNode {
  const lines = text.split("\n");
  const blocks: React.ReactNode[] = [];
  let paragraph: string[] = [];
  let bullets: string[] = [];
  let key = 0;

  const flushParagraph = () => {
    if (!paragraph.length) return;
    const content = paragraph;
    paragraph = [];
    blocks.push(
      <p key={`p-${key++}`} className="my-1.5 first:mt-0 last:mb-0">
        {content.map((l, i) => (
          <React.Fragment key={i}>
            {i > 0 ? <br /> : null}
            {renderInline(l, `l-${key}-${i}`)}
          </React.Fragment>
        ))}
      </p>,
    );
  };

  const flushBullets = () => {
    if (!bullets.length) return;
    const items = bullets;
    bullets = [];
    blocks.push(
      <ul key={`ul-${key++}`} className="my-1.5 space-y-1 first:mt-0 last:mb-0">
        {items.map((item, i) => (
          <li key={i} className="flex gap-2">
            <span
              aria-hidden
              className="mt-[9px] size-1 shrink-0 rounded-full"
              style={{ background: "var(--accent)" }}
            />
            <span className="min-w-0 flex-1">{renderInline(item, `li-${key}-${i}`)}</span>
          </li>
        ))}
      </ul>,
    );
  };

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    const bullet = line.match(/^\s*(?:[-•]|\d+[.)])\s+(.*)$/);
    if (bullet) {
      flushParagraph();
      bullets.push(bullet[1]);
    } else if (!line.trim()) {
      flushParagraph();
      flushBullets();
    } else {
      flushBullets();
      paragraph.push(line);
    }
  }
  flushParagraph();
  flushBullets();
  return blocks;
}

// ---------------------------------------------------------------------------
// Small pieces
// ---------------------------------------------------------------------------

function LogoAvatar({ size = 28, ring = false }: { size?: number; ring?: boolean }) {
  return (
    <span
      className="flex shrink-0 items-center justify-center rounded-xl"
      style={{
        width: size,
        height: size,
        background: "rgba(255,255,255,.1)",
        boxShadow: ring ? "0 0 0 1px rgba(184,146,42,.4)" : undefined,
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/bimi/logo.svg"
        alt=""
        aria-hidden="true"
        className="object-contain"
        style={{ width: size * 0.58, height: size * 0.58 }}
      />
    </span>
  );
}

function AssistantAvatar() {
  return (
    <span
      className="mt-0.5 flex size-[26px] shrink-0 items-center justify-center rounded-lg"
      style={{
        background: "linear-gradient(150deg, var(--brand-navy-700), var(--brand-navy-900))",
        boxShadow: "0 0 0 1px rgba(184,146,42,.25)",
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/bimi/logo.svg"
        alt=""
        aria-hidden="true"
        className="size-3.5 object-contain"
      />
    </span>
  );
}

/** Text with a soft light sweep — "the assistant is working". */
function Shimmer({ text, reduced }: { text: string; reduced: boolean }) {
  if (reduced) {
    return (
      <span className="text-[12px] font-medium" style={{ color: "var(--fg-3)" }}>
        {text}
      </span>
    );
  }
  return (
    <motion.span
      className="text-[12px] font-medium"
      style={{
        backgroundImage:
          "linear-gradient(90deg, var(--fg-4) 0%, var(--brand-navy-800) 50%, var(--fg-4) 100%)",
        backgroundSize: "200% 100%",
        WebkitBackgroundClip: "text",
        backgroundClip: "text",
        color: "transparent",
      }}
      animate={{ backgroundPosition: ["150% 0", "-150% 0"] }}
      transition={{ duration: 1.8, repeat: Infinity, ease: "linear" }}
    >
      {text}
    </motion.span>
  );
}

/** Green presence dot with a slow ping. */
function PresenceDot({ reduced }: { reduced: boolean }) {
  return (
    <span className="relative flex size-1.5 shrink-0">
      {!reduced ? (
        <motion.span
          className="absolute inset-0 rounded-full"
          style={{ background: "#34D399" }}
          animate={{ scale: [1, 2.4], opacity: [0.5, 0] }}
          transition={{ duration: 2.2, repeat: Infinity, ease: "easeOut" }}
        />
      ) : null}
      <span className="relative size-1.5 rounded-full" style={{ background: "#34D399" }} />
    </span>
  );
}

/**
 * Live trace of what the agent is doing. While working: a step list with the
 * current action shimmering. Once the answer starts: collapses to a discreet,
 * expandable one-liner.
 */
function ActivityTrace({
  tools,
  working,
  reduced,
}: {
  tools: string[];
  working: boolean;
  reduced: boolean;
}) {
  const [expanded, setExpanded] = React.useState(false);
  const steps = toSteps(tools);
  if (steps.length === 0) return null;

  if (working) {
    return (
      <motion.div
        layout
        className="mb-2.5 overflow-hidden rounded-xl border px-3 py-1.5"
        style={{ borderColor: "var(--border-1)", background: "var(--bg-surface)" }}
      >
        {steps.map((step, i) => {
          const active = i === steps.length - 1;
          const Icon = step.icon;
          return (
            <motion.div
              key={`${step.label}-${i}`}
              initial={{ opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.25, ease: EASE }}
              className="flex items-center gap-2.5 py-1"
            >
              <span className="relative flex size-5 shrink-0 items-center justify-center">
                {active ? (
                  <>
                    {!reduced ? (
                      <motion.span
                        className="absolute inset-0 rounded-full"
                        style={{ border: "1px solid var(--accent)" }}
                        animate={{ scale: [0.9, 1.5], opacity: [0.7, 0] }}
                        transition={{ duration: 1.4, repeat: Infinity, ease: "easeOut" }}
                      />
                    ) : null}
                    <Icon
                      className="size-3.5"
                      strokeWidth={1.75}
                      style={{ color: "var(--accent-foreground)" }}
                    />
                  </>
                ) : (
                  <span
                    className="flex size-4 items-center justify-center rounded-full"
                    style={{ background: "var(--brand-navy-100)" }}
                  >
                    <Check
                      className="size-2.5"
                      strokeWidth={3}
                      style={{ color: "var(--brand-navy-700)" }}
                    />
                  </span>
                )}
              </span>
              {active ? (
                <Shimmer text={`${step.label}…`} reduced={reduced} />
              ) : (
                <span className="text-[12px]" style={{ color: "var(--fg-3)" }}>
                  {step.label}
                </span>
              )}
            </motion.div>
          );
        })}
      </motion.div>
    );
  }

  const unique = [...new Set(steps.map((s) => s.label))];
  const summary =
    unique.length <= 2 ? unique.join(" · ") : `${unique.slice(0, 2).join(" · ")}…`;

  return (
    <motion.div layout className="mb-1.5">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex items-center gap-1.5 rounded-md py-0.5 text-[11.5px] transition-colors hover:text-[var(--fg-2)]"
        style={{ color: "var(--fg-4)" }}
        aria-expanded={expanded}
      >
        <span
          className="flex size-3.5 shrink-0 items-center justify-center rounded-full"
          style={{ background: "var(--accent-soft)" }}
        >
          <Check
            className="size-2.5"
            strokeWidth={3}
            style={{ color: "var(--accent-foreground)" }}
          />
        </span>
        <span className="truncate">{summary}</span>
        <ChevronDown
          className={cn("size-3 shrink-0 transition-transform duration-200", expanded && "rotate-180")}
          strokeWidth={2}
        />
      </button>
      <AnimatePresence initial={false}>
        {expanded ? (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.24, ease: EASE }}
            className="overflow-hidden"
          >
            <div className="mt-1 space-y-1 border-l pl-3" style={{ borderColor: "var(--border-1)" }}>
              {steps.map((step, i) => {
                const Icon = step.icon;
                return (
                  <div key={i} className="flex items-center gap-2">
                    <Icon
                      className="size-3 shrink-0"
                      strokeWidth={1.75}
                      style={{ color: "var(--brand-navy-400)" }}
                    />
                    <span className="text-[11.5px]" style={{ color: "var(--fg-3)" }}>
                      {step.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Empty state — a real welcome, then guided starting points.
// ---------------------------------------------------------------------------

type Capability = {
  icon: ToolMeta["icon"];
  title: string;
  hint: string;
  prompt: string;
};

const CAPABILITIES: Capability[] = [
  {
    icon: Inbox,
    title: "Mes emails du jour",
    hint: "Le tri de ce qui compte",
    prompt: "Qu'ai-je reçu d'important dans mes emails récemment ?",
  },
  {
    icon: Signature,
    title: "Dossiers à signer",
    hint: "En attente de signature",
    prompt: "Quels dossiers attendent une signature ?",
  },
  {
    icon: ChartNoAxesColumn,
    title: "Point portefeuille",
    hint: "Vos dossiers par statut",
    prompt: "Combien de dossiers ai-je, par statut ?",
  },
  {
    icon: CalendarClock,
    title: "Échéances à venir",
    hint: "Contrats à renouveler",
    prompt: "Quels contrats arrivent à échéance prochainement ?",
  },
  {
    icon: FolderPlus,
    title: "Créer un dossier",
    hint: "Je vous guide pas à pas",
    prompt: "Aide-moi à créer un nouveau dossier client.",
  },
  {
    icon: PenLine,
    title: "Rédiger une réponse",
    hint: "Un brouillon prêt à relire",
    prompt: "Aide-moi à rédiger une réponse à un email reçu.",
  },
];

function EmptyState({
  firstName,
  onPick,
}: {
  firstName?: string;
  onPick: (prompt: string) => void;
}) {
  return (
    <motion.div
      initial="hidden"
      animate="show"
      variants={{ show: { transition: { staggerChildren: 0.06 } } }}
      className="pt-2"
    >
      <motion.div
        variants={{ hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: EASE } } }}
      >
        <span
          className="flex size-11 items-center justify-center rounded-2xl"
          style={{
            background: "linear-gradient(150deg, var(--brand-navy-700), var(--brand-navy-900))",
            boxShadow: "0 0 0 1px rgba(184,146,42,.3), 0 8px 20px -8px rgba(6,20,39,.4)",
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/bimi/logo.svg" alt="" aria-hidden="true" className="size-6 object-contain" />
        </span>
        <h2
          className="mt-4 text-[22px] font-semibold leading-tight"
          style={{ fontFamily: "var(--font-heading)", color: "var(--fg-1)" }}
        >
          Bonjour{firstName ? `, ${firstName}` : ""}.
        </h2>
        <p
          className="mt-1.5 max-w-[42ch] text-[13.5px] leading-relaxed"
          style={{ color: "var(--fg-3)" }}
        >
          Je connais vos dossiers, contrats, devis et votre boîte email. Posez une
          question ou confiez-moi une action — je vous montre ce que je fais.
        </p>
      </motion.div>

      <motion.p
        variants={{ hidden: { opacity: 0 }, show: { opacity: 1 } }}
        className="mb-2 mt-6 text-[10px] font-semibold uppercase tracking-[0.08em]"
        style={{ color: "var(--fg-4)" }}
      >
        Pour commencer
      </motion.p>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {CAPABILITIES.map((cap) => {
          const Icon = cap.icon;
          return (
            <motion.button
              key={cap.title}
              type="button"
              onClick={() => onPick(cap.prompt)}
              variants={{
                hidden: { opacity: 0, y: 12 },
                show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: EASE } },
              }}
              whileHover={{ y: -2 }}
              whileTap={{ scale: 0.98 }}
              className="group flex items-center gap-3 rounded-xl border bg-[var(--bg-surface)] p-3 text-left transition-[border-color,box-shadow] duration-150 hover:border-[var(--brand-navy-300)] hover:shadow-[0_4px_14px_-6px_rgba(6,20,39,.18)]"
              style={{ borderColor: "var(--border-1)" }}
            >
              <span
                className="flex size-8 shrink-0 items-center justify-center rounded-lg transition-colors duration-150 group-hover:bg-[var(--accent-soft)] group-hover:text-[var(--accent-foreground)]"
                style={{ background: "var(--brand-navy-50)", color: "var(--brand-navy-700)" }}
              >
                <Icon className="size-4" strokeWidth={1.75} />
              </span>
              <span className="min-w-0">
                <span className="block truncate text-[12.5px] font-semibold" style={{ color: "var(--fg-1)" }}>
                  {cap.title}
                </span>
                <span className="block truncate text-[11.5px]" style={{ color: "var(--fg-3)" }}>
                  {cap.hint}
                </span>
              </span>
            </motion.button>
          );
        })}
      </div>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Composer — single rounded container: attachments, auto-growing textarea,
// rotating placeholder, attach + send controls.
// ---------------------------------------------------------------------------

const IDLE_PLACEHOLDERS = [
  "Où en est le dossier Martin ?",
  "Résume l'activité de la semaine",
  "Quels contrats expirent ce trimestre ?",
  "Range cette pièce jointe dans le bon dossier",
  "Rédige une réponse au dernier email reçu",
];

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function AgentChat({ userName }: { userName?: string }) {
  const [open, setOpen] = React.useState(false);
  const [expanded, setExpanded] = React.useState(false);
  const [messages, setMessages] = React.useState<ChatMessage[]>([]);
  const [input, setInput] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [historyLoaded, setHistoryLoaded] = React.useState(false);
  const [attachments, setAttachments] = React.useState<PendingAttachment[]>([]);
  const [placeholderIndex, setPlaceholderIndex] = React.useState(0);
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);
  const reduced = useReducedMotion() ?? false;

  const firstName = userName?.trim().split(/\s+/)[0];
  const uploading = attachments.some((a) => a.status === "uploading");
  const hasReadyAttachment = attachments.some((a) => a.status === "ready");

  function adjustTextarea() {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = `${Math.min(el.scrollHeight, 128)}px`;
  }

  async function uploadFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    for (const file of Array.from(files)) {
      const tempId = crypto.randomUUID();
      setAttachments((cur) => [
        ...cur,
        { tempId, fileName: file.name, status: "uploading" },
      ]);
      try {
        const form = new FormData();
        form.append("file", file);
        const res = await fetch("/api/courtier/agent/upload", {
          method: "POST",
          body: form,
        }).catch(() => null);
        const data = (await res?.json().catch(() => null)) as
          | {
              success?: boolean;
              uploadId?: string;
              storagePath?: string;
              mimeType?: string;
              sizeBytes?: number;
              message?: string;
            }
          | null;
        if (!res?.ok || !data?.success || !data.uploadId) {
          toast.error(data?.message ?? "Envoi du fichier impossible.");
          setAttachments((cur) => cur.filter((a) => a.tempId !== tempId));
          continue;
        }
        setAttachments((cur) =>
          cur.map((a) =>
            a.tempId === tempId
              ? {
                  ...a,
                  status: "ready",
                  uploadId: data.uploadId,
                  storagePath: data.storagePath,
                  mimeType: data.mimeType,
                  sizeBytes: data.sizeBytes,
                }
              : a,
          ),
        );
      } catch {
        toast.error("Envoi du fichier impossible.");
        setAttachments((cur) => cur.filter((a) => a.tempId !== tempId));
      }
    }
  }

  function removeAttachment(tempId: string) {
    setAttachments((cur) => cur.filter((a) => a.tempId !== tempId));
  }

  React.useEffect(() => {
    if (open && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, open, loading, expanded]);

  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (expanded) setExpanded(false);
        else setOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, expanded]);

  React.useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(() => textareaRef.current?.focus(), 120);
    return () => window.clearTimeout(t);
  }, [open, expanded]);

  // Rotating placeholder — only on a fresh conversation, and not for users
  // who prefer reduced motion.
  React.useEffect(() => {
    if (!open || reduced || messages.length > 0) return;
    const id = window.setInterval(
      () => setPlaceholderIndex((i) => (i + 1) % IDLE_PLACEHOLDERS.length),
      4000,
    );
    return () => window.clearInterval(id);
  }, [open, reduced, messages.length]);

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
    if (loading || uploading) return;
    const ready = attachments.filter((a) => a.status === "ready");
    const trimmed = text.trim();
    // Allow sending with only an attachment (default the ask).
    const content =
      trimmed || (ready.length ? "Range cette pièce jointe dans le bon dossier." : "");
    if (!content) return;

    const userMessage: ChatMessage = {
      role: "user",
      content,
      attachments: ready.length
        ? ready.map((a) => ({ fileName: a.fileName }))
        : undefined,
    };
    const next = [...messages, userMessage];
    setMessages(next);
    setInput("");
    setAttachments([]);
    setLoading(true);
    requestAnimationFrame(adjustTextarea);
    let started = false;
    try {
      const res = await fetch("/api/courtier/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: next.slice(-20).map((m) => ({
            role: m.role,
            content: m.role === "assistant" ? cleanForModel(m.content) : m.content,
          })),
          attachments: ready.map((a) => ({
            uploadId: a.uploadId,
            storagePath: a.storagePath,
            fileName: a.fileName,
            mimeType: a.mimeType,
            sizeBytes: a.sizeBytes,
          })),
        }),
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

  const lastMessage = messages[messages.length - 1];
  const suggestions =
    !loading && lastMessage?.role === "assistant"
      ? parseAssistant(lastMessage.content).suggestions
      : [];

  const canSend = !loading && !uploading && (input.trim().length > 0 || hasReadyAttachment);

  const panel = (
    <>
      {/* Header */}
      <div
        className="relative flex items-center justify-between gap-3 overflow-hidden px-4 py-3.5"
        style={{
          background: "linear-gradient(160deg, var(--brand-navy-900) 0%, var(--brand-navy-800) 100%)",
        }}
      >
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(120% 150% at 100% 0%, rgba(184,146,42,.15), transparent 55%)",
          }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-0 h-px"
          style={{
            background:
              "linear-gradient(90deg, transparent, rgba(184,146,42,.55), transparent)",
          }}
        />
        <div className="relative flex items-center gap-3">
          <LogoAvatar size={36} ring />
          <div>
            <p
              className="text-[15px] font-semibold leading-tight text-white"
              style={{ fontFamily: "var(--font-heading)" }}
            >
              Assistant
            </p>
            <p className="mt-0.5 flex items-center gap-1.5 text-[11.5px] text-white/60">
              <PresenceDot reduced={reduced} />
              Connecté à vos dossiers et vos emails
            </p>
          </div>
        </div>
        <div className="relative flex items-center gap-1">
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
        role="log"
        aria-live="polite"
        className="flex-1 overflow-y-auto px-4 py-5"
        style={{
          background:
            "linear-gradient(180deg, rgba(255,255,255,.6), rgba(255,255,255,0) 140px), var(--brand-navy-50)",
        }}
      >
        <div
          className={cn(
            "mx-auto flex flex-col gap-4",
            expanded ? "max-w-[640px]" : "max-w-none",
          )}
        >
          {messages.length === 0 ? (
            <EmptyState firstName={firstName} onPick={(p) => void send(p)} />
          ) : (
            messages.map((m, i) => {
              if (m.role === "user") {
                return (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, ease: EASE }}
                    className="flex justify-end"
                  >
                    <div
                      className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-md px-3.5 py-2.5 text-[13.5px] leading-relaxed"
                      style={{
                        background: "var(--brand-navy-800)",
                        color: "#FFFFFF",
                        boxShadow: "0 2px 8px -2px rgba(6,20,39,.25)",
                      }}
                    >
                      {m.content}
                      {m.attachments?.length ? (
                        <span className="mt-2 flex flex-col gap-1.5">
                          {m.attachments.map((a, ai) => (
                            <span
                              key={ai}
                              className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-[11.5px]"
                              style={{ background: "rgba(255,255,255,.14)" }}
                            >
                              <FileText className="size-3.5 shrink-0" strokeWidth={1.75} />
                              <span className="truncate">{a.fileName}</span>
                            </span>
                          ))}
                        </span>
                      ) : null}
                    </div>
                  </motion.div>
                );
              }

              const parsed = parseAssistant(m.content);
              const isStreaming = loading && i === messages.length - 1;
              if (!parsed.text && parsed.tools.length === 0) return null;
              return (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, ease: EASE }}
                  className="flex gap-2.5"
                >
                  <AssistantAvatar />
                  <div className="min-w-0 flex-1 pt-0.5">
                    {parsed.tools.length > 0 ? (
                      <ActivityTrace
                        tools={parsed.tools}
                        working={isStreaming && !parsed.answerStarted}
                        reduced={reduced}
                      />
                    ) : null}
                    {parsed.text ? (
                      <div
                        className="text-[13.5px] leading-[1.65]"
                        style={{ color: "var(--fg-1)" }}
                      >
                        {renderRich(parsed.text)}
                        {isStreaming && parsed.answerStarted && !reduced ? (
                          <motion.span
                            aria-hidden
                            className="ml-0.5 inline-block h-[13px] w-[2px] rounded-full align-[-2px]"
                            style={{ background: "var(--accent)" }}
                            animate={{ opacity: [1, 0.2, 1] }}
                            transition={{ duration: 1, repeat: Infinity }}
                          />
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                </motion.div>
              );
            })
          )}

          {loading && lastMessage?.role === "user" ? (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, ease: EASE }}
              className="flex items-center gap-2.5"
            >
              <AssistantAvatar />
              <Shimmer text="Réflexion…" reduced={reduced} />
            </motion.div>
          ) : null}
        </div>
      </div>

      {/* Suggestions + composer */}
      <div
        className="border-t px-3 pb-2.5 pt-2.5"
        style={{ borderColor: "var(--border-1)", background: "var(--bg-surface)" }}
      >
        <div className={cn("mx-auto", expanded ? "max-w-[640px]" : "max-w-none")}>
          <AnimatePresence initial={false}>
            {suggestions.length > 0 ? (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.22, ease: EASE }}
                className="overflow-hidden"
              >
                <p
                  className="mb-1.5 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.08em]"
                  style={{ color: "var(--fg-4)" }}
                >
                  <Sparkles className="size-3" strokeWidth={2} style={{ color: "var(--accent)" }} />
                  Suites possibles
                </p>
                <div className="mb-2.5 flex flex-wrap gap-1.5">
                  {suggestions.map((s, i) => (
                    <motion.button
                      key={s}
                      type="button"
                      onClick={() => void send(s)}
                      disabled={loading}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.25, delay: i * 0.05, ease: EASE }}
                      className="inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-[12px] font-medium transition-colors hover:border-[rgba(184,146,42,.45)] hover:bg-[var(--accent-soft)] disabled:opacity-50"
                      style={{
                        borderColor: "var(--border-1)",
                        background: "var(--bg-surface)",
                        color: "var(--brand-navy-700)",
                      }}
                    >
                      {s}
                      <ArrowUpRight
                        className="size-3"
                        strokeWidth={2}
                        style={{ color: "var(--accent)" }}
                      />
                    </motion.button>
                  ))}
                </div>
              </motion.div>
            ) : null}
          </AnimatePresence>

          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept={documentUploadAccept}
            className="hidden"
            onChange={(e) => {
              void uploadFiles(e.target.files);
              e.target.value = "";
            }}
          />

          <form
            onSubmit={(e) => {
              e.preventDefault();
              void send(input);
            }}
            className="rounded-2xl border transition-[border-color,box-shadow] duration-150 focus-within:border-[var(--border-focus)] focus-within:shadow-[0_0_0_3px_rgba(35,68,104,.08)]"
            style={{ borderColor: "var(--border-1)", background: "var(--bg-surface)" }}
          >
            {attachments.length > 0 ? (
              <div className="flex flex-wrap gap-1.5 px-3 pt-2.5">
                {attachments.map((a) => (
                  <span
                    key={a.tempId}
                    className="inline-flex max-w-[220px] items-center gap-1.5 rounded-lg border px-2 py-1 text-[12px]"
                    style={{
                      borderColor: "var(--border-1)",
                      background: "var(--brand-navy-50)",
                      color: "var(--fg-2)",
                    }}
                  >
                    {a.status === "uploading" ? (
                      <LoaderCircle className="size-3.5 shrink-0 animate-spin" strokeWidth={2} />
                    ) : (
                      <FileText
                        className="size-3.5 shrink-0 text-[var(--brand-navy-700)]"
                        strokeWidth={1.75}
                      />
                    )}
                    <span className="truncate">{a.fileName}</span>
                    <button
                      type="button"
                      onClick={() => removeAttachment(a.tempId)}
                      aria-label="Retirer le fichier"
                      className="shrink-0 rounded p-0.5 text-[var(--fg-4)] transition-colors hover:bg-[var(--bg-sunken)] hover:text-[var(--fg-1)]"
                    >
                      <X className="size-3" strokeWidth={2.25} />
                    </button>
                  </span>
                ))}
              </div>
            ) : null}

            <div className="relative">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => {
                  setInput(e.target.value);
                  adjustTextarea();
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void send(input);
                  }
                }}
                rows={1}
                placeholder={messages.length > 0 || reduced ? "Posez votre question…" : ""}
                aria-label="Votre message"
                className="max-h-32 w-full resize-none bg-transparent px-3.5 pb-1 pt-3 text-[13.5px] outline-none"
                style={{ color: "var(--fg-1)" }}
              />
              {!input && messages.length === 0 && !reduced ? (
                <div className="pointer-events-none absolute inset-x-3.5 top-3 overflow-hidden">
                  <AnimatePresence mode="wait" initial={false}>
                    <motion.span
                      key={placeholderIndex}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      transition={{ duration: 0.25, ease: EASE }}
                      className="block truncate text-[13.5px]"
                      style={{ color: "var(--fg-4)" }}
                    >
                      {IDLE_PLACEHOLDERS[placeholderIndex]}
                    </motion.span>
                  </AnimatePresence>
                </div>
              ) : null}
            </div>

            <div className="flex items-center justify-between px-2 pb-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={loading}
                aria-label="Joindre un fichier"
                title="Joindre un fichier"
                className="flex size-8 items-center justify-center rounded-lg transition-colors hover:bg-[var(--brand-navy-50)] disabled:opacity-50"
                style={{ color: "var(--fg-3)" }}
              >
                <Paperclip className="size-4" strokeWidth={1.75} />
              </button>
              <div className="flex items-center gap-2.5">
                <span className="hidden text-[10.5px] sm:block" style={{ color: "var(--fg-4)" }}>
                  Entrée pour envoyer
                </span>
                <motion.button
                  type="submit"
                  disabled={!canSend}
                  aria-label="Envoyer"
                  whileTap={{ scale: 0.9 }}
                  className="flex size-8 items-center justify-center rounded-lg transition-all duration-150 disabled:opacity-35"
                  style={{ background: "var(--brand-navy-800)", color: "#FFFFFF" }}
                >
                  {loading ? (
                    <LoaderCircle className="size-4 animate-spin" strokeWidth={2} />
                  ) : (
                    <ArrowUp className="size-4" strokeWidth={2.25} />
                  )}
                </motion.button>
              </div>
            </div>
          </form>

          <p className="mt-1.5 text-center text-[10.5px]" style={{ color: "var(--fg-4)" }}>
            L’assistant peut se tromper — vérifiez les informations importantes.
          </p>
        </div>
      </div>
    </>
  );

  return (
    <>
      {/* Launcher */}
      <AnimatePresence>
        {!open ? (
          <motion.button
            type="button"
            onClick={() => setOpen(true)}
            aria-label="Ouvrir l’assistant IA"
            initial={{ opacity: 0, scale: 0.9, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 8 }}
            whileHover={{ y: -2 }}
            whileTap={{ scale: 0.97 }}
            className="fixed bottom-5 right-5 z-50 flex h-14 items-center gap-2.5 rounded-full pl-2 pr-5"
            style={{
              background:
                "linear-gradient(150deg, var(--brand-navy-700), var(--brand-navy-900) 75%)",
              color: "#FFFFFF",
              border: "1px solid rgba(184,146,42,.35)",
              boxShadow: "0 14px 36px -10px rgba(6,20,39,.55)",
            }}
          >
            <LogoAvatar size={40} ring />
            <span className="text-[13.5px] font-semibold">Assistant</span>
            <span className="relative flex size-1.5">
              {!reduced ? (
                <motion.span
                  className="absolute inset-0 rounded-full"
                  style={{ background: "var(--accent)" }}
                  animate={{ scale: [1, 2.4], opacity: [0.6, 0] }}
                  transition={{ duration: 2.4, repeat: Infinity, ease: "easeOut" }}
                />
              ) : null}
              <span
                className="relative size-1.5 rounded-full"
                style={{ background: "var(--accent)" }}
                aria-hidden
              />
            </span>
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
            onClick={() => (expanded ? setExpanded(false) : setOpen(false))}
            className="fixed inset-0 z-40 bg-[rgba(6,12,22,.45)] backdrop-blur-[2px]"
          />
        ) : null}
      </AnimatePresence>

      {/* Panel — drawer (compact) or centered modal (grand) */}
      <AnimatePresence mode="wait">
        {open && !expanded ? (
          <motion.aside
            key="agent-drawer"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", stiffness: 300, damping: 34 }}
            className="fixed inset-y-0 right-0 z-50 flex w-full flex-col overflow-hidden border-l sm:w-[460px]"
            style={{
              borderColor: "var(--border-1)",
              background: "var(--bg-surface)",
              boxShadow: "-24px 0 60px -24px rgba(11,18,32,.35)",
            }}
            aria-label="Assistant FalconDraft"
          >
            {panel}
          </motion.aside>
        ) : null}

        {open && expanded ? (
          <motion.div
            key="agent-modal"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6"
          >
            <motion.aside
              initial={{ opacity: 0, scale: 0.96, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.97, y: 8 }}
              transition={{ duration: 0.24, ease: EASE }}
              className="pointer-events-auto flex h-[86vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border"
              style={{
                borderColor: "var(--border-1)",
                background: "var(--bg-surface)",
                boxShadow: "0 32px 80px -24px rgba(11,18,32,.5)",
              }}
              aria-label="Assistant FalconDraft"
            >
              {panel}
            </motion.aside>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </>
  );
}
