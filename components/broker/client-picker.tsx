"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Check, ChevronDown, FolderInput, Plus, Search } from "lucide-react";
import {
  QuickClientDialog,
  type CreatedClient,
} from "@/components/broker/quick-client-dialog";
import { cn } from "@/lib/utils";

export type ClientOption = { id: string; name: string; type?: string };

/** Largeur souhaitée du panneau ; réduite si l'écran est plus étroit. */
const PANEL_WIDTH = 288;
/** Marge minimale entre le panneau et les bords de l'écran. */
const VIEWPORT_MARGIN = 8;
/** En dessous, on préfère ouvrir vers le haut. */
const MIN_SPACE_BELOW = 240;

type PanelPosition = {
  left: number;
  top: number | null;
  bottom: number | null;
  width: number;
  maxHeight: number;
};

/**
 * Sélecteur de dossier, avec recherche — et création.
 *
 * Utilisé partout où l'on range quelque chose : une pièce jointe sur son
 * action, un email entier, une suggestion du briefing. `onOpen` laisse
 * l'appelant rafraîchir la liste pour que les dossiers créés depuis le
 * chargement de la page apparaissent.
 *
 * `onCreated` ouvre la porte de sortie qui manquait : quand la recherche ne
 * donne rien, le courtier n'a plus à quitter son écran pour créer le dossier
 * puis revenir. Il le crée ici, et ce qu'il rangeait y est classé dans la
 * foulée.
 *
 * Le panneau est rendu dans un PORTAIL, en position fixe : ses déclencheurs
 * vivent dans des conteneurs `overflow-hidden` (le volet de lecture des emails,
 * les cartes du briefing) qui le rognaient. Sa position est recalculée à chaque
 * ouverture, puis au défilement et au redimensionnement — il tient donc dans
 * l'écran quelle qu'en soit la taille, et bascule vers le haut quand le bas
 * manque de place.
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
  onCreated,
  createDefaults,
}: {
  clients: ClientOption[];
  value?: string | null;
  busy?: boolean;
  placeholder: string;
  tone?: "default" | "attention";
  subtle?: boolean;
  onPick: (clientId: string) => void;
  onOpen?: () => void;
  /**
   * Fourni ⇒ le sélecteur sait créer un dossier. L'appelant reçoit le dossier
   * créé pour l'ajouter à sa liste ; `onPick` est appelé juste après, si bien
   * que le rangement se fait sans clic supplémentaire.
   */
  onCreated?: (client: CreatedClient) => void;
  /** Contexte de départ du formulaire — typiquement l'expéditeur de l'email. */
  createDefaults?: { name?: string; email?: string };
}) {
  const [open, setOpen] = React.useState(false);
  const [creating, setCreating] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [position, setPosition] = React.useState<PanelPosition | null>(null);
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const panelRef = React.useRef<HTMLDivElement>(null);

  // Le portail n'existe qu'une fois monté côté client (SSR safe).
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);

  const place = React.useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    const width = Math.min(PANEL_WIDTH, vw - VIEWPORT_MARGIN * 2);
    // Aligné sur le déclencheur, puis ramené de force dans l'écran : sur mobile
    // le déclencheur peut être tout à droite, le panneau déborderait.
    const left = Math.min(
      Math.max(VIEWPORT_MARGIN, rect.left),
      Math.max(VIEWPORT_MARGIN, vw - width - VIEWPORT_MARGIN),
    );

    const spaceBelow = vh - rect.bottom;
    const spaceAbove = rect.top;
    const openUp = spaceBelow < MIN_SPACE_BELOW && spaceAbove > spaceBelow;

    setPosition({
      left,
      top: openUp ? null : rect.bottom + 6,
      bottom: openUp ? vh - rect.top + 6 : null,
      width,
      maxHeight: Math.max(
        180,
        (openUp ? spaceAbove : spaceBelow) - VIEWPORT_MARGIN * 2,
      ),
    });
  }, []);

  React.useEffect(() => {
    if (!open) return;
    place();

    function onDocPointerDown(e: MouseEvent) {
      const target = e.target as HTMLElement | null;
      // Le dialogue de création vit dans son propre portail : un clic dedans ne
      // doit pas refermer le sélecteur qui l'a ouvert.
      if (target?.closest("[role=dialog]")) return;
      if (triggerRef.current?.contains(target)) return;
      if (panelRef.current?.contains(target)) return;
      setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    // `capture` : le défilement d'un conteneur interne ne remonte pas jusqu'à
    // window, or c'est précisément dans ces conteneurs que vivent nos boutons.
    // Groupé sur la frame d'affichage : un défilement émet des dizaines
    // d'événements, un seul recalcul par frame suffit.
    let frame = 0;
    const onScrollOrResize = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        place();
      });
    };

    document.addEventListener("mousedown", onDocPointerDown);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onScrollOrResize, true);
    window.addEventListener("resize", onScrollOrResize);
    return () => {
      document.removeEventListener("mousedown", onDocPointerDown);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onScrollOrResize, true);
      window.removeEventListener("resize", onScrollOrResize);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [open, place]);

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

  const panel =
    open && position ? (
      <motion.div
        ref={panelRef}
        initial={{ opacity: 0, y: position.top !== null ? -4 : 4 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: position.top !== null ? -4 : 4 }}
        transition={{ duration: 0.15 }}
        className="fixed z-50 flex flex-col overflow-hidden rounded-lg border bg-[var(--bg-surface)] shadow-[var(--shadow-lg)]"
        style={{
          left: position.left,
          top: position.top ?? undefined,
          bottom: position.bottom ?? undefined,
          width: position.width,
          maxHeight: position.maxHeight,
          borderColor: "var(--border-1)",
        }}
      >
        <div
          className="flex shrink-0 items-center gap-2 border-b px-3 py-2"
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

        <ul className="min-h-0 flex-1 overflow-y-auto py-1">
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
                  <span className="min-w-0 flex-1 truncate">{c.name}</span>
                  {c.type === "carrier" ? (
                    <span
                      className="shrink-0 rounded px-1.5 py-[1px] text-[10px] font-medium uppercase tracking-[0.04em]"
                      style={{
                        background: "var(--bg-sunken)",
                        color: "var(--fg-4)",
                        border: "1px solid var(--border-1)",
                      }}
                    >
                      Compagnie
                    </span>
                  ) : null}
                </button>
              </li>
            ))
          ) : (
            <li className="px-3 py-2 text-[12px] text-[var(--fg-4)]">
              {onCreated
                ? "Aucun dossier ne correspond."
                : "Aucun dossier trouvé."}
            </li>
          )}
        </ul>

        {/* Toujours offerte, pas seulement quand la recherche échoue : le
            courtier sait souvent d'avance que le dossier n'existe pas. */}
        {onCreated ? (
          <div
            className="shrink-0 border-t p-1"
            style={{ borderColor: "var(--border-1)" }}
          >
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                setCreating(true);
              }}
              className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-[12.5px] font-medium transition-colors hover:bg-[var(--bg-sunken)]"
              style={{ color: "var(--accent-foreground)" }}
            >
              <Plus className="size-3.5 shrink-0" strokeWidth={2.25} />
              <span className="truncate">
                {query.trim()
                  ? `Créer le dossier « ${query.trim()} »`
                  : "Créer un dossier"}
              </span>
            </button>
          </div>
        ) : null}
      </motion.div>
    ) : null;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => {
          setOpen((v) => {
            if (!v) onOpen?.();
            return !v;
          });
        }}
        disabled={busy}
        aria-expanded={open}
        className={cn(
          "inline-flex max-w-full items-center gap-1.5 text-[12px] font-medium transition-colors disabled:opacity-50",
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

      {mounted
        ? createPortal(<AnimatePresence>{panel}</AnimatePresence>, document.body)
        : null}

      {onCreated ? (
        <QuickClientDialog
          open={creating}
          onOpenChange={setCreating}
          defaultName={query.trim() || createDefaults?.name}
          defaultEmail={createDefaults?.email}
          onCreated={(client) => {
            setQuery("");
            // L'appelant enregistre d'abord le dossier dans sa liste, sinon le
            // rangement qui suit afficherait un nom qu'il ne connaît pas encore.
            onCreated(client);
            onPick(client.id);
          }}
        />
      ) : null}
    </>
  );
}
