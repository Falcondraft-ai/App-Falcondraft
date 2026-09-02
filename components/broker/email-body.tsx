"use client";

import * as React from "react";
import { ImageOff, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { MailboxMessageDetail } from "@/app/api/courtier/mailbox/message/route";

/**
 * Rendu du corps d'un email.
 *
 * Le HTML arrive déjà assaini du serveur ; il est malgré tout rendu dans une
 * iframe `sandbox` VIDE — pas de script, pas de formulaire, pas de navigation,
 * pas d'accès à la page qui l'entoure. Deux barrières plutôt qu'une : un email
 * est du contenu écrit par un inconnu.
 *
 * La hauteur s'ajuste au contenu une fois chargé, sinon un email court laisse
 * un grand vide et un email long est coupé.
 */
export function EmailBody({
  detail,
  onShowImages,
  loadingImages,
}: {
  detail: MailboxMessageDetail;
  onShowImages?: () => void;
  loadingImages?: boolean;
}) {
  const frameRef = React.useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = React.useState(320);

  const srcDoc = React.useMemo(() => {
    if (!detail.html) return null;
    // Feuille de style minimale : l'iframe n'hérite de rien, sans quoi le texte
    // s'affiche en Times 16px sur fond transparent.
    return `<!doctype html><html><head><meta charset="utf-8">
<style>
  :root { color-scheme: light; }
  body {
    margin: 0; padding: 0;
    font: 13px/1.6 -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    color: #1C1917; background: #fff; word-break: break-word;
  }
  img { max-width: 100%; height: auto; }
  table { max-width: 100%; }
  a { color: #1a2744; }
  blockquote {
    margin: 8px 0; padding-left: 12px;
    border-left: 2px solid #E8E6E0; color: #78716C;
  }
  pre { white-space: pre-wrap; }
</style></head><body>${detail.html}</body></html>`;
  }, [detail.html]);

  // Hauteur réelle du contenu, mesurée après rendu.
  const measure = React.useCallback(() => {
    const doc = frameRef.current?.contentDocument;
    if (!doc?.body) return;
    const h = Math.max(doc.body.scrollHeight, doc.documentElement.scrollHeight);
    setHeight(Math.min(Math.max(h + 16, 120), 4000));
  }, []);

  if (!srcDoc) {
    return (
      <p className="whitespace-pre-wrap text-[13px] leading-6 text-[var(--fg-1)]">
        {detail.body || "(Message sans texte)"}
      </p>
    );
  }

  return (
    <div>
      {detail.blockedImages > 0 && onShowImages ? (
        <div
          className="mb-3 flex flex-wrap items-center gap-2 rounded-lg border px-3 py-2"
          style={{
            borderColor: "var(--border-1)",
            background: "var(--bg-sunken)",
          }}
        >
          <ImageOff
            className="size-3.5 shrink-0 text-[var(--fg-3)]"
            strokeWidth={1.75}
          />
          <span className="text-[12px] text-[var(--fg-2)]">
            {detail.blockedImages} image
            {detail.blockedImages > 1 ? "s" : ""} bloquée
            {detail.blockedImages > 1 ? "s" : ""} — les afficher prévient
            l’expéditeur que vous avez ouvert son email.
          </span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onShowImages}
            disabled={loadingImages}
            className="ml-auto"
          >
            {loadingImages ? (
              <Loader2 className="size-3.5 animate-spin" strokeWidth={1.75} />
            ) : null}
            Afficher les images
          </Button>
        </div>
      ) : null}

      <iframe
        ref={frameRef}
        // sandbox sans valeur : tout est refusé (script, formulaires,
        // navigation, même origine). C'est le réglage le plus restrictif.
        sandbox=""
        srcDoc={srcDoc}
        onLoad={measure}
        title="Contenu de l’email"
        className="w-full rounded-lg border"
        style={{ height, borderColor: "var(--border-1)", background: "#fff" }}
      />
    </div>
  );
}
