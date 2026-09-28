"use client";

import * as React from "react";
import { toast } from "sonner";
import { FolderOpen, Loader2, X } from "lucide-react";
import { ClientPicker, type ClientOption } from "@/components/broker/client-picker";
import { Button } from "@/components/ui/button";
import type { MailboxMessage } from "@/app/api/courtier/mailbox/route";

/**
 * Range (ou retire, `clientId` nul) un email de la boîte dans un dossier, et le
 * dit au courtier. Partagé par le bouton ci-dessous et le glisser-déposer de la
 * boîte (components/broker/mailbox-view.tsx).
 */
export async function linkMailboxEmail(
  message: MailboxMessage,
  clientId: string | null,
): Promise<
  { ok: true; client: { id: string; name: string } | null } | { ok: false }
> {
  const res = await fetch("/api/courtier/mailbox/link", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      messageId: message.id,
      clientId,
      from: message.fromEmail || undefined,
      fromName: message.from || undefined,
      subject: message.subject || undefined,
      receivedAt: message.receivedAt || undefined,
      hasAttachments: message.hasAttachments,
      direction: message.direction,
      to: message.to,
    }),
  }).catch(() => null);
  const data = (await res?.json().catch(() => null)) as
    | { success?: boolean; message?: string; client?: { id: string; name: string } | null }
    | null;
  if (!res?.ok || !data?.success) {
    toast.error("Rattachement impossible.", {
      description: data?.message ?? "Veuillez réessayer.",
    });
    return { ok: false };
  }
  toast.success(
    data.client
      ? `Email rattaché à ${data.client.name}.`
      : "Email détaché du dossier.",
  );
  return { ok: true, client: data.client ?? null };
}

/**
 * Range un email dans un dossier client, depuis la boîte.
 *
 * Sans ça, seul le briefing pouvait classer du courrier : tout ce que
 * l'assistant n'avait pas analysé — ou avait écarté — restait sans rattachement
 * possible. Le courtier tranche lui-même, sans attendre une analyse.
 *
 * Le dossier peut aussi être créé ici, pré-rempli avec l'expéditeur : un email
 * d'un contact inconnu se classe sans quitter la boîte.
 */
export function LinkEmailButton({
  message,
  onLinked,
}: {
  message: MailboxMessage;
  onLinked: (client: { id: string; name: string } | null) => void;
}) {
  const [clients, setClients] = React.useState<ClientOption[]>([]);
  const [busy, setBusy] = React.useState(false);

  // Chargé à l'ouverture, pas au montage : la liste des dossiers ne doit pas
  // être récupérée pour chaque email affiché.
  const loadClients = React.useCallback(async () => {
    if (clients.length > 0) return;
    const res = await fetch("/api/broker/clients?limit=2000").catch(() => null);
    const data = (await res?.json().catch(() => null)) as
      | { clients?: { id: string; name: string }[] }
      | null;
    if (data?.clients) setClients(data.clients);
  }, [clients.length]);

  async function link(clientId: string | null) {
    if (busy) return;
    setBusy(true);
    const linked = await linkMailboxEmail(message, clientId);
    setBusy(false);
    if (linked.ok) onLinked(linked.client);
  }

  if (message.linkedClient) {
    return (
      <div className="flex items-center gap-1.5">
        <span
          className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[12px] font-medium"
          style={{
            background: "var(--accent-soft)",
            color: "var(--accent-foreground)",
            border: "1px solid rgba(184,146,42,0.2)",
          }}
        >
          <FolderOpen className="size-3.5" strokeWidth={1.75} />
          {message.linkedClient.name}
        </span>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={busy}
          onClick={() => void link(null)}
          title="Retirer du dossier"
        >
          {busy ? (
            <Loader2 className="size-3.5 animate-spin" strokeWidth={1.75} />
          ) : (
            <X className="size-3.5" strokeWidth={1.75} />
          )}
        </Button>
      </div>
    );
  }

  return (
    <ClientPicker
      clients={clients}
      busy={busy}
      subtle
      placeholder={
        message.knownSender
          ? `Ranger chez ${message.knownSender.name}…`
          : "Ranger dans un dossier…"
      }
      onOpen={() => void loadClients()}
      onPick={(clientId) => void link(clientId)}
      createDefaults={
        // Un envoi se range chez son destinataire, pas chez le cabinet.
        message.direction === "sent"
          ? { email: message.to[0] || undefined }
          : {
              name: message.from || undefined,
              email: message.fromEmail || undefined,
            }
      }
      onCreated={(client) =>
        setClients((prev) =>
          prev.some((c) => c.id === client.id) ? prev : [...prev, client],
        )
      }
    />
  );
}
