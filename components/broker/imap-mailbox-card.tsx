"use client";

import { useRouter } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";
import { CheckCircle2, Loader2, Mail, Plug, Unplug } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { profileInitials } from "@/lib/broker/profile-format";
import type { BrokerProfileRow } from "@/types/database";

/**
 * Réglages serveur des hébergeurs courants chez les cabinets français.
 *
 * Personne ne devrait avoir à connaître un nom de serveur IMAP : le courtier
 * choisit son hébergeur, saisit son adresse et son mot de passe, c'est tout.
 * « Autre » reste là pour les hébergements maison.
 */
const PRESETS = [
  {
    key: "ionos",
    label: "IONOS",
    imapHost: "imap.ionos.fr",
    imapPort: 993,
    smtpHost: "smtp.ionos.fr",
    smtpPort: 465,
  },
  {
    key: "ovh",
    label: "OVH",
    imapHost: "ssl0.ovh.net",
    imapPort: 993,
    smtpHost: "ssl0.ovh.net",
    smtpPort: 465,
  },
  {
    key: "gandi",
    label: "Gandi",
    imapHost: "mail.gandi.net",
    imapPort: 993,
    smtpHost: "mail.gandi.net",
    smtpPort: 465,
  },
  {
    key: "custom",
    label: "Autre",
    imapHost: "",
    imapPort: 993,
    smtpHost: "",
    smtpPort: 465,
  },
] as const;

export type MailboxSummary = {
  profileId: string;
  email: string;
  provider: string;
  lastVerifiedAt: string | null;
};

export function ImapMailboxCard({
  profiles,
  mailboxes,
}: {
  profiles: BrokerProfileRow[];
  mailboxes: MailboxSummary[];
}) {
  const router = useRouter();
  const byProfile = new Map(mailboxes.map((m) => [m.profileId, m]));
  const [editing, setEditing] = React.useState<string | null>(null);

  if (profiles.length === 0) {
    return (
      <p className="text-[13px] leading-6 text-[var(--fg-3)]">
        Créez d’abord les profils du cabinet dans{" "}
        <span className="font-medium text-[var(--fg-1)]">Réglages → Profils</span>{" "}
        : chaque boîte email se rattache à une personne.
      </p>
    );
  }

  return (
    <ul className="space-y-2.5">
      {profiles.map((profile) => (
        <li
          key={profile.id}
          className="rounded-lg border bg-[var(--bg-surface)]"
          style={{ borderColor: "var(--border-1)", boxShadow: "var(--shadow-sm)" }}
        >
          <MailboxRow
            profile={profile}
            mailbox={byProfile.get(profile.id) ?? null}
            open={editing === profile.id}
            onToggle={() =>
              setEditing((cur) => (cur === profile.id ? null : profile.id))
            }
            onDone={() => {
              setEditing(null);
              router.refresh();
            }}
          />
        </li>
      ))}
    </ul>
  );
}

function MailboxRow({
  profile,
  mailbox,
  open,
  onToggle,
  onDone,
}: {
  profile: BrokerProfileRow;
  mailbox: MailboxSummary | null;
  open: boolean;
  onToggle: () => void;
  onDone: () => void;
}) {
  const [busy, setBusy] = React.useState(false);
  const [preset, setPreset] = React.useState<string>("ionos");
  type MailboxForm = {
    email: string;
    password: string;
    imapHost: string;
    imapPort: number;
    smtpHost: string;
    smtpPort: number;
  };
  const [form, setForm] = React.useState<MailboxForm>({
    email: profile.email ?? "",
    password: "",
    imapHost: PRESETS[0].imapHost,
    imapPort: PRESETS[0].imapPort,
    smtpHost: PRESETS[0].smtpHost,
    smtpPort: PRESETS[0].smtpPort,
  });

  function applyPreset(key: string) {
    setPreset(key);
    const found = PRESETS.find((p) => p.key === key);
    if (!found) return;
    setForm((f) => ({
      ...f,
      imapHost: found.imapHost,
      imapPort: found.imapPort,
      smtpHost: found.smtpHost,
      smtpPort: found.smtpPort,
    }));
  }

  async function connect(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    const res = await fetch("/api/broker/mailboxes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        profileId: profile.id,
        email: form.email,
        password: form.password,
        imapHost: form.imapHost,
        imapPort: Number(form.imapPort),
        imapSecure: true,
        smtpHost: form.smtpHost,
        smtpPort: Number(form.smtpPort),
        smtpSecure: Number(form.smtpPort) === 465,
      }),
    }).catch(() => null);
    const data = (await res?.json().catch(() => null)) as
      | { success?: boolean; message?: string }
      | null;
    setBusy(false);

    if (!res?.ok || !data?.success) {
      toast.error("Boîte non connectée.", {
        description: data?.message ?? "Veuillez réessayer.",
      });
      return;
    }
    // Le mot de passe ne doit pas survivre en mémoire du formulaire.
    setForm((f) => ({ ...f, password: "" }));
    toast.success(`Boîte de ${profile.display_name} connectée.`);
    onDone();
  }

  async function disconnect() {
    if (busy) return;
    setBusy(true);
    const res = await fetch(
      `/api/broker/mailboxes?profileId=${encodeURIComponent(profile.id)}`,
      { method: "DELETE" },
    ).catch(() => null);
    setBusy(false);
    if (!res?.ok) {
      toast.error("Déconnexion impossible.");
      return;
    }
    toast.success("Boîte déconnectée.");
    onDone();
  }

  return (
    <>
      <div className="flex items-center gap-3 px-4 py-3.5">
        <span
          className="flex size-9 shrink-0 items-center justify-center rounded-[11px] text-[12px] font-semibold ring-1 ring-white/10"
          style={{
            background: "linear-gradient(155deg, #283450, #181f31)",
            color: "var(--accent)",
          }}
        >
          {profileInitials(profile.display_name)}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13.5px] font-semibold text-[var(--fg-1)]">
            {profile.display_name}
          </p>
          {mailbox ? (
            <p className="flex items-center gap-1.5 truncate text-[12px] text-[var(--success)]">
              <CheckCircle2 className="size-3.5 shrink-0" strokeWidth={1.75} />
              {mailbox.email}
            </p>
          ) : (
            <p className="flex items-center gap-1.5 truncate text-[12px] text-[var(--fg-3)]">
              <Mail className="size-3.5 shrink-0" strokeWidth={1.75} />
              Aucune boîte connectée
            </p>
          )}
        </div>
        {mailbox ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => void disconnect()}
            disabled={busy}
            className="inline-flex items-center gap-1.5"
          >
            <Unplug className="size-3.5" strokeWidth={1.75} />
            Déconnecter
          </Button>
        ) : (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onToggle}
            className="inline-flex items-center gap-1.5"
          >
            <Plug className="size-3.5" strokeWidth={1.75} />
            {open ? "Annuler" : "Connecter"}
          </Button>
        )}
      </div>

      {open && !mailbox ? (
        <form
          onSubmit={connect}
          className="grid gap-3 border-t px-4 py-4 sm:grid-cols-2"
          style={{ borderColor: "var(--border-1)", background: "var(--bg-sunken)" }}
        >
          <div className="space-y-1.5 sm:col-span-2">
            <Label className="text-[12px]">Hébergeur</Label>
            <div className="flex flex-wrap gap-1.5">
              {PRESETS.map((p) => (
                <button
                  key={p.key}
                  type="button"
                  onClick={() => applyPreset(p.key)}
                  className="rounded-md border px-2.5 py-1 text-[12px] transition-colors"
                  style={{
                    borderColor:
                      preset === p.key ? "var(--accent)" : "var(--border-1)",
                    background:
                      preset === p.key ? "var(--accent-soft)" : "var(--bg-surface)",
                    color:
                      preset === p.key ? "var(--accent-foreground)" : "var(--fg-2)",
                  }}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor={`email-${profile.id}`} className="text-[12px]">
              Adresse email
            </Label>
            <Input
              id={`email-${profile.id}`}
              type="email"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              placeholder="contact@cabinet.com"
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`password-${profile.id}`} className="text-[12px]">
              Mot de passe
            </Label>
            <Input
              id={`password-${profile.id}`}
              type="password"
              autoComplete="new-password"
              value={form.password}
              onChange={(e) =>
                setForm((f) => ({ ...f, password: e.target.value }))
              }
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor={`imap-${profile.id}`} className="text-[12px]">
              Serveur de réception (IMAP)
            </Label>
            <Input
              id={`imap-${profile.id}`}
              value={form.imapHost}
              onChange={(e) =>
                setForm((f) => ({ ...f, imapHost: e.target.value }))
              }
              placeholder="imap.exemple.fr"
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`smtp-${profile.id}`} className="text-[12px]">
              Serveur d’envoi (SMTP)
            </Label>
            <Input
              id={`smtp-${profile.id}`}
              value={form.smtpHost}
              onChange={(e) =>
                setForm((f) => ({ ...f, smtpHost: e.target.value }))
              }
              placeholder="smtp.exemple.fr"
              required
            />
          </div>

          <div className="sm:col-span-2">
            <Button type="submit" size="sm" disabled={busy}>
              {busy ? (
                <Loader2 className="size-3.5 animate-spin" strokeWidth={1.75} />
              ) : null}
              {busy ? "Vérification…" : "Connecter la boîte"}
            </Button>
            <p className="mt-2 text-[11.5px] leading-5 text-[var(--fg-4)]">
              Le mot de passe est chiffré avant d’être enregistré et n’est jamais
              réaffiché. Si votre hébergeur propose un mot de passe applicatif
              dédié, préférez-le au mot de passe principal.
            </p>
          </div>
        </form>
      ) : null}
    </>
  );
}
