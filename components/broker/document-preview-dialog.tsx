"use client";

import * as React from "react";
import { Download, FileText, Loader2, RotateCw, TriangleAlert } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

type Loaded = { url: string; fileName: string; mimeType: string };

type State =
  | { kind: "loading" }
  | { kind: "ready"; doc: Loaded }
  | { kind: "error"; message: string };

/**
 * Ouvre un document du dossier dans l'outil.
 *
 * Jusqu'ici un contrat scanné ou une pièce d'identité ne pouvait qu'être
 * TÉLÉCHARGÉ : pour vérifier une date de naissance sur une CNI, il fallait
 * sortir de l'application, ouvrir le fichier, revenir. Le devis, lui, avait sa
 * page — d'où l'impression que « ça marche pour les devis, pas pour le reste ».
 *
 * Le lien signé expire en deux minutes et n'est demandé qu'à l'ouverture : le
 * document n'est jamais exposé tant que personne ne le regarde.
 *
 * En cas d'échec, le dialogue RESTE ouvert et affiche la raison renvoyée par le
 * serveur, avec de quoi réessayer. Le faire disparaître derrière un message
 * fugace ne laissait aucune prise pour comprendre ce qui coinçait.
 */
export function DocumentPreviewDialog({
  clientId,
  documentId,
  title,
  open,
  onOpenChange,
}: {
  clientId: string;
  documentId: string;
  title: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [state, setState] = React.useState<State>({ kind: "loading" });
  const [attempt, setAttempt] = React.useState(0);

  React.useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setState({ kind: "loading" });

    void (async () => {
      const res = await fetch(
        `/api/broker/clients/${clientId}/documents/${documentId}/download?mode=inline`,
      ).catch(() => null);
      const data = (await res?.json().catch(() => null)) as
        | {
            success?: boolean;
            url?: string;
            fileName?: string;
            mimeType?: string;
            message?: string;
          }
        | null;
      if (cancelled) return;

      if (!res) {
        setState({
          kind: "error",
          message: "Le serveur n’a pas répondu. Vérifiez votre connexion.",
        });
        return;
      }
      if (!res.ok || !data?.success || !data.url) {
        setState({
          kind: "error",
          // Le message du serveur d'abord : il dit précisément ce qui manque
          // (document introuvable, lien indisponible, droits insuffisants).
          message:
            data?.message ??
            `Le document n’a pas pu être ouvert (erreur ${res.status}).`,
        });
        return;
      }
      setState({
        kind: "ready",
        doc: {
          url: data.url,
          fileName: data.fileName ?? title,
          mimeType: (data.mimeType ?? "").toLowerCase(),
        },
      });
    })();

    return () => {
      cancelled = true;
    };
    // `title` et `onOpenChange` sont volontairement absents : ce sont des
    // valeurs recréées à chaque rendu par les appelants, et les écouter
    // relancerait la requête pour rien.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, clientId, documentId, attempt]);

  const doc = state.kind === "ready" ? state.doc : null;
  // Type EXACT, jamais une approximation : c'est ce qui autorise l'iframe à
  // exécuter le visionneur PDF ci-dessous. Un fichier au type inattendu part
  // vers le téléchargement plutôt que d'être rendu.
  const isPdf = doc?.mimeType === "application/pdf";
  const isImage = Boolean(doc?.mimeType.startsWith("image/"));

  function download() {
    if (doc) window.open(doc.url, "_blank", "noopener,noreferrer");
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[92vh] flex-col sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle className="truncate pr-8">{title}</DialogTitle>
        </DialogHeader>

        <div
          className="flex min-h-[240px] flex-1 items-center justify-center overflow-hidden rounded-lg border"
          style={{
            borderColor: "var(--border-1)",
            background: "var(--bg-sunken)",
          }}
        >
          {state.kind === "loading" ? (
            <p className="flex items-center gap-2 text-[13px] text-[var(--fg-3)]">
              <Loader2 className="size-4 animate-spin" strokeWidth={1.75} />
              Ouverture du document…
            </p>
          ) : state.kind === "error" ? (
            <div className="flex flex-col items-center gap-3 px-6 py-10 text-center">
              <TriangleAlert
                className="size-7 text-[var(--destructive)]"
                strokeWidth={1.5}
              />
              <p className="max-w-sm text-[13px] leading-5 text-[var(--fg-2)]">
                {state.message}
              </p>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setAttempt((n) => n + 1)}
                className="gap-1.5"
              >
                <RotateCw className="size-3.5" strokeWidth={1.75} />
                Réessayer
              </Button>
            </div>
          ) : isPdf ? (
            <iframe
              src={doc!.url}
              title={title}
              className="h-[70vh] max-h-[70vh] w-full"
              /* Le visionneur PDF intégré du navigateur a besoin de ses propres
                 scripts : un `sandbox` vide affiche un cadre blanc. On les lui
                 rend, cantonnés à l'origine du stockage — le document ne peut
                 pas atteindre cette page. C'est sans risque ici parce que le
                 type MIME est vérifié juste au-dessus : seul un vrai PDF passe. */
              sandbox="allow-scripts allow-same-origin"
            />
          ) : isImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={doc!.url}
              alt={title}
              className="max-h-[70vh] w-auto max-w-full object-contain"
            />
          ) : (
            <div className="flex flex-col items-center gap-3 px-6 py-10 text-center">
              <FileText
                className="size-7 text-[var(--fg-4)]"
                strokeWidth={1.5}
              />
              <p className="text-[13px] text-[var(--fg-2)]">
                Ce format ne s’affiche pas dans l’outil.
              </p>
              <p className="text-[12px] text-[var(--fg-3)]">
                Téléchargez-le pour l’ouvrir avec votre logiciel habituel.
              </p>
            </div>
          )}
        </div>

        <div className="flex shrink-0 justify-end">
          <Button
            type="button"
            variant="ghost"
            disabled={!doc}
            onClick={download}
            className="gap-1.5"
          >
            <Download className="size-3.5" strokeWidth={1.75} />
            Télécharger
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
