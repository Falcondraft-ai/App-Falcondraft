"use client";

import * as React from "react";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Download,
  ExternalLink,
  FileQuestion,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { BrokerAvatar } from "@/components/broker/broker-avatar";
import {
  ClientPicker,
  type ClientOption,
} from "@/components/broker/client-picker";
import { formatDateTime } from "@/lib/format";
import type {
  BrokerEmailItemRow,
  BrokerEmailSuggestionRow,
} from "@/types/database";

export type AttachmentStatus =
  | "pending"
  | "loading"
  | "done"
  | "rejected"
  | "failed";

function pstr(payload: Record<string, unknown>, key: string): string | null {
  const v = payload[key];
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

function formatSize(bytes: number | null): string | null {
  if (!bytes || bytes <= 0) return null;
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}

/** Renders the document itself — PDF and images only, anything else downloads. */
function Viewer({
  src,
  fileName,
  contentType,
}: {
  src: string;
  fileName: string;
  contentType: string;
}) {
  const type = contentType.toLowerCase();
  const name = fileName.toLowerCase();
  const isPdf = type.includes("pdf") || name.endsWith(".pdf");
  const isImage =
    !type.includes("svg") &&
    (type.startsWith("image/") || /\.(png|jpe?g|webp|gif)$/.test(name));

  if (isPdf) {
    return (
      <iframe
        src={src}
        title={fileName}
        className="size-full border-0"
        style={{ background: "var(--bg-sunken)" }}
      />
    );
  }

  if (isImage) {
    return (
      <div className="flex size-full items-center justify-center p-4">
        {/* eslint-disable-next-line @next/next/no-img-element -- private, no-store binary served by our API */}
        <img
          src={src}
          alt={fileName}
          className="max-h-full max-w-full rounded-md object-contain"
        />
      </div>
    );
  }

  return (
    <div className="flex size-full flex-col items-center justify-center gap-3 p-6 text-center">
      <span
        className="flex size-12 items-center justify-center rounded-full"
        style={{
          background: "var(--brand-navy-50)",
          color: "var(--brand-navy-700)",
          border: "1px solid var(--border-1)",
        }}
      >
        <FileQuestion className="size-6" strokeWidth={1.5} />
      </span>
      <p className="text-[13px] font-semibold text-[var(--fg-1)]">
        Aperçu indisponible pour ce format
      </p>
      <p className="max-w-xs text-[12.5px] text-[var(--fg-3)]">
        Téléchargez le fichier pour le consulter, puis revenez choisir son
        dossier.
      </p>
      <a
        href={src}
        download={fileName}
        className="inline-flex h-8 items-center gap-1.5 rounded-md border px-3 text-[12.5px] font-medium transition-colors hover:bg-[var(--bg-sunken)]"
        style={{ borderColor: "var(--border-1)", color: "var(--fg-2)" }}
      >
        <Download className="size-3.5" strokeWidth={1.75} />
        Télécharger
      </a>
    </div>
  );
}

/**
 * Full-size look at an email attachment, next to the email it came from, so the
 * broker can decide where it belongs without leaving the briefing — and file it
 * right there.
 */
export function AttachmentPreview({
  open,
  onOpenChange,
  item,
  attachments,
  index,
  onIndexChange,
  statuses,
  clientOptions,
  clientIdFor,
  onPickClient,
  onClientsOpen,
  onAccept,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: BrokerEmailItemRow;
  attachments: BrokerEmailSuggestionRow[];
  index: number;
  onIndexChange: (index: number) => void;
  statuses: Record<string, AttachmentStatus>;
  clientOptions: ClientOption[];
  clientIdFor: (s: BrokerEmailSuggestionRow) => string | null;
  onPickClient: (s: BrokerEmailSuggestionRow, clientId: string) => void;
  onClientsOpen: () => void;
  onAccept: (s: BrokerEmailSuggestionRow) => void;
}) {
  const current = attachments[index];
  if (!current) return null;

  const payload = current.payload ?? {};
  const fileName = pstr(payload, "file_name") ?? "Pièce jointe";
  const contentType = pstr(payload, "content_type") ?? "";
  const detectedLabel = pstr(payload, "detected_label");
  const size = formatSize(
    typeof payload.size === "number" ? payload.size : null,
  );
  const src = `/api/courtier/outlook/suggestions/${current.id}/attachment`;

  const status = statuses[current.id] ?? "pending";
  const clientId = clientIdFor(current);
  const filed = status === "done";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="w-[calc(100%-2rem)] gap-0 overflow-hidden p-0 sm:max-w-5xl"
        style={{ borderColor: "var(--border-1)" }}
      >
        <DialogHeader
          className="border-b px-4 py-3 pr-12"
          style={{ borderColor: "var(--border-1)" }}
        >
          <DialogTitle className="truncate text-[14px]">{fileName}</DialogTitle>
          <DialogDescription className="text-[12px]">
            {[detectedLabel, size].filter(Boolean).join(" · ") ||
              "Pièce jointe de l’email"}
          </DialogDescription>
        </DialogHeader>

        <div className="grid h-[70vh] md:grid-cols-[minmax(0,1fr)_320px]">
          <div
            className="relative min-h-0 overflow-hidden"
            style={{ background: "var(--bg-sunken)" }}
          >
            <Viewer src={src} fileName={fileName} contentType={contentType} />

            {attachments.length > 1 ? (
              <div className="pointer-events-none absolute inset-x-0 bottom-3 flex items-center justify-center">
                <div
                  className="pointer-events-auto flex items-center gap-1 rounded-full border px-1.5 py-1 shadow-[var(--shadow-md)]"
                  style={{
                    borderColor: "var(--border-1)",
                    background: "var(--bg-surface)",
                  }}
                >
                  <button
                    type="button"
                    onClick={() => onIndexChange(index - 1)}
                    disabled={index === 0}
                    aria-label="Pièce jointe précédente"
                    className="inline-flex size-6 items-center justify-center rounded-full transition-colors hover:bg-[var(--bg-sunken)] disabled:opacity-40"
                    style={{ color: "var(--fg-3)" }}
                  >
                    <ChevronLeft className="size-4" strokeWidth={2} />
                  </button>
                  <span className="px-1 text-[11.5px] font-medium text-[var(--fg-3)]">
                    {index + 1} / {attachments.length}
                  </span>
                  <button
                    type="button"
                    onClick={() => onIndexChange(index + 1)}
                    disabled={index === attachments.length - 1}
                    aria-label="Pièce jointe suivante"
                    className="inline-flex size-6 items-center justify-center rounded-full transition-colors hover:bg-[var(--bg-sunken)] disabled:opacity-40"
                    style={{ color: "var(--fg-3)" }}
                  >
                    <ChevronRight className="size-4" strokeWidth={2} />
                  </button>
                </div>
              </div>
            ) : null}
          </div>

          <aside
            className="flex min-h-0 flex-col overflow-y-auto border-t md:border-t-0 md:border-l"
            style={{
              borderColor: "var(--border-1)",
              background: "var(--bg-surface)",
            }}
          >
            <div className="space-y-3 p-4">
              <p className="fd-eyebrow">Email d’origine</p>
              <div className="flex items-start gap-2.5">
                <BrokerAvatar
                  name={item.from_name || item.from_email || "Expéditeur"}
                  size={32}
                />
                <div className="min-w-0">
                  <p className="truncate text-[12.5px] font-semibold text-[var(--fg-1)]">
                    {item.from_name || item.from_email || "Expéditeur"}
                  </p>
                  {item.from_email ? (
                    <p className="truncate text-[11.5px] text-[var(--fg-4)]">
                      {item.from_email}
                    </p>
                  ) : null}
                </div>
              </div>
              <p className="text-[12.5px] leading-5 text-[var(--fg-1)]">
                {item.subject}
              </p>
              {item.summary ? (
                <p className="text-[12px] leading-5 text-[var(--fg-3)]">
                  {item.summary}
                </p>
              ) : null}
              <p className="font-mono text-[11px] text-[var(--fg-4)]">
                {item.received_at ? formatDateTime(item.received_at) : ""}
              </p>

              <div className="flex flex-wrap gap-1.5">
                {item.web_link ? (
                  <a
                    href={item.web_link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex h-7 items-center gap-1.5 rounded-md border px-2.5 text-[12px] font-medium transition-colors hover:bg-[var(--bg-sunken)]"
                    style={{
                      borderColor: "var(--border-1)",
                      color: "var(--fg-2)",
                    }}
                  >
                    <ExternalLink className="size-3.5" strokeWidth={1.75} />
                    Ouvrir l’email
                  </a>
                ) : null}
                <a
                  href={src}
                  download={fileName}
                  className="inline-flex h-7 items-center gap-1.5 rounded-md border px-2.5 text-[12px] font-medium transition-colors hover:bg-[var(--bg-sunken)]"
                  style={{
                    borderColor: "var(--border-1)",
                    color: "var(--fg-2)",
                  }}
                >
                  <Download className="size-3.5" strokeWidth={1.75} />
                  Télécharger
                </a>
              </div>
            </div>

            <div
              className="mt-auto space-y-2.5 border-t p-4"
              style={{
                borderColor: "var(--border-1)",
                background: "var(--bg-sunken)",
              }}
            >
              <p className="fd-eyebrow">Classer dans</p>
              {filed ? (
                <p
                  className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold"
                  style={{ color: "var(--success, #15803d)" }}
                >
                  <Check className="size-3.5" strokeWidth={2.5} />
                  Rangée dans le dossier
                </p>
              ) : (
                <>
                  <ClientPicker
                    clients={clientOptions}
                    value={clientId}
                    placeholder="Choisir un dossier"
                    tone="attention"
                    onPick={(id) => onPickClient(current, id)}
                    onOpen={onClientsOpen}
                  />
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => onAccept(current)}
                    disabled={!clientId || status === "loading"}
                    className="h-8 w-full gap-1.5 text-[12.5px]"
                  >
                    {status === "loading" ? (
                      "…"
                    ) : (
                      <>
                        <Check className="size-3.5" strokeWidth={2.25} />
                        Ranger la pièce jointe
                      </>
                    )}
                  </Button>
                  <p className="text-[11px] leading-4 text-[var(--fg-4)]">
                    Le fichier n’est enregistré dans la GED qu’une fois rangé.
                  </p>
                </>
              )}
            </div>
          </aside>
        </div>
      </DialogContent>
    </Dialog>
  );
}
