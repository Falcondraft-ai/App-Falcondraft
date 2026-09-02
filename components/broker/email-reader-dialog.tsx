"use client";

import * as React from "react";
import { toast } from "sonner";
import { Download, Loader2, Paperclip } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatDateTime } from "@/lib/format";
import type { MailboxMessageDetail } from "@/app/api/courtier/mailbox/message/route";

export type EmailReaderTarget = {
  id: string;
  subject: string;
  from: string;
  fromEmail: string | null;
  receivedAt: string | null;
};

/**
 * Lecture d'un email sans quitter l'outil.
 *
 * Indispensable hors Microsoft : une boîte IMAP n'expose aucune URL de message,
 * donc « ouvrir dans Outlook » n'existe pas. Le courtier doit pouvoir lire le
 * message en entier là où il décide — un résumé ne suffit pas pour trancher sur
 * un sinistre ou une échéance.
 *
 * Le corps est affiché en texte : rendre le HTML d'un email arbitraire dans
 * l'application exposerait au script injecté et aux pixels de suivi.
 */
export function EmailReaderDialog({
  target,
  onClose,
}: {
  target: EmailReaderTarget | null;
  onClose: () => void;
}) {
  const [detail, setDetail] = React.useState<MailboxMessageDetail | null>(null);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    if (!target) {
      setDetail(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setDetail(null);
    void (async () => {
      const res = await fetch(
        `/api/courtier/mailbox/message?id=${encodeURIComponent(target.id)}`,
      ).catch(() => null);
      const data = (await res?.json().catch(() => null)) as
        | (MailboxMessageDetail & { message?: string })
        | null;
      if (cancelled) return;
      setLoading(false);
      if (!res?.ok || !data) {
        toast.error("Email illisible.", {
          description: data?.message ?? "Réessayez dans un instant.",
        });
        return;
      }
      setDetail(data);
    })();
    return () => {
      cancelled = true;
    };
  }, [target]);

  return (
    <Dialog open={Boolean(target)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-hidden p-0">
        {target ? (
          <>
            <DialogHeader
              className="border-b px-6 py-4 text-left"
              style={{ borderColor: "var(--border-1)" }}
            >
              <DialogTitle className="text-[15px] leading-snug">
                {target.subject}
              </DialogTitle>
              <DialogDescription className="text-[12.5px]">
                {target.from}
                {target.fromEmail ? ` · ${target.fromEmail}` : ""}
                {target.receivedAt
                  ? ` — ${formatDateTime(target.receivedAt)}`
                  : ""}
              </DialogDescription>
            </DialogHeader>

            <div className="max-h-[60vh] overflow-y-auto px-6 py-4">
              {loading ? (
                <p className="flex items-center gap-2 text-[13px] text-[var(--fg-3)]">
                  <Loader2 className="size-3.5 animate-spin" strokeWidth={1.75} />
                  Chargement du message…
                </p>
              ) : detail ? (
                <>
                  <p className="whitespace-pre-wrap text-[13px] leading-6 text-[var(--fg-1)]">
                    {detail.body || "(Message sans texte)"}
                  </p>
                  {detail.attachments.length > 0 ? (
                    <div
                      className="mt-5 border-t pt-4"
                      style={{ borderColor: "var(--border-1)" }}
                    >
                      <p className="fd-eyebrow mb-2">Pièces jointes</p>
                      <ul className="space-y-1.5">
                        {detail.attachments.map((a) => (
                          <li key={a.id}>
                            <a
                              href={`/api/courtier/mailbox/attachment?id=${encodeURIComponent(target.id)}&attachment=${encodeURIComponent(a.id)}`}
                              className="flex items-center gap-2 rounded-lg border px-3 py-2 text-[12.5px] transition-colors hover:bg-[var(--bg-sunken)]"
                              style={{ borderColor: "var(--border-1)" }}
                            >
                              <Paperclip
                                className="size-3.5 shrink-0 text-[var(--fg-4)]"
                                strokeWidth={1.75}
                              />
                              <span className="min-w-0 flex-1 truncate text-[var(--fg-1)]">
                                {a.name}
                              </span>
                              <Download
                                className="size-3.5 shrink-0 text-[var(--fg-4)]"
                                strokeWidth={1.75}
                              />
                            </a>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </>
              ) : (
                <p className="text-[13px] text-[var(--fg-3)]">
                  Ce message n’a pas pu être chargé depuis la boîte.
                </p>
              )}
            </div>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
