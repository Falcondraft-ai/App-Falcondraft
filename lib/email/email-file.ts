import "server-only";

import MsgReader from "@kenjiuno/msgreader";
import { simpleParser, type AddressObject } from "mailparser";

/**
 * An email saved as a file — dragged out of a mail client and dropped into a
 * dossier. Two formats cover what brokers have:
 *
 *   - .eml (RFC 822): Outlook for Mac, Thunderbird, Apple Mail, webmails ;
 *   - .msg (Outlook compound file): Outlook for Windows.
 *
 * Both are read into the same shape, so the dossier shows and opens them like
 * any email that came from a connected mailbox.
 */
export type EmailFileKind = "eml" | "msg";

export type ParsedEmailFile = {
  messageId: string | null;
  subject: string;
  fromName: string;
  fromEmail: string;
  /** To + Cc, lower-cased. */
  recipients: string[];
  /** ISO date the message was sent, when the file says. */
  date: string | null;
  text: string;
  /** Raw HTML — the caller sanitizes it before any rendering. */
  html: string | null;
  attachments: { name: string; contentType: string; content: Buffer }[];
};

export const EMAIL_FILE_MIME: Record<EmailFileKind, string> = {
  eml: "message/rfc822",
  msg: "application/vnd.ms-outlook",
};

/** OLE2 compound file signature — what every .msg starts with. */
const OLE_MAGIC = Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);

/** What the file really is: the bytes decide for .msg, the name for .eml. */
export function emailFileKind(name: string, bytes: Buffer): EmailFileKind | null {
  if (bytes.subarray(0, 8).equals(OLE_MAGIC)) return "msg";
  return /\.eml$/i.test(name) ? "eml" : null;
}

function isoDate(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function addresses(field: AddressObject | AddressObject[] | undefined): string[] {
  const list = Array.isArray(field) ? field : field ? [field] : [];
  return list
    .flatMap((group) => group.value)
    .map((a) => a.address?.trim().toLowerCase())
    .filter((a): a is string => Boolean(a));
}

/** An Exchange-internal sender ("/O=EXCHANGELABS/…") is not an address. */
function smtpOrNull(value: string | undefined): string | null {
  const v = value?.trim().toLowerCase();
  return v && v.includes("@") && !v.startsWith("/") ? v : null;
}

async function parseEml(bytes: Buffer): Promise<ParsedEmailFile> {
  const mail = await simpleParser(bytes, { skipTextToHtml: true, skipImageLinks: true });
  const from = mail.from?.value[0];
  return {
    messageId: mail.messageId?.trim() || null,
    subject: mail.subject?.trim() || "(sans objet)",
    fromName: from?.name?.trim() || "",
    fromEmail: from?.address?.trim().toLowerCase() || "",
    recipients: [...addresses(mail.to), ...addresses(mail.cc)],
    date: isoDate(mail.date),
    text: mail.text?.trim() ?? "",
    html: typeof mail.html === "string" ? mail.html : null,
    // Inline images of the body are part of the layout, not documents.
    attachments: mail.attachments
      .filter((a) => !a.related)
      .map((a) => ({
        name: a.filename || "piece-jointe",
        contentType: a.contentType || "application/octet-stream",
        content: a.content,
      })),
  };
}

function parseMsg(bytes: Buffer): ParsedEmailFile {
  const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
  const reader = new MsgReader(buffer as ArrayBuffer);
  const data = reader.getFileData();
  if (data.error) throw new Error("unreadable_msg");

  const messageId = data.headers?.match(/^message-id:\s*(<[^>]+>)/im)?.[1] ?? null;
  const recipients = (data.recipients ?? [])
    .filter((r) => r.recipType !== "bcc")
    .map((r) => smtpOrNull(r.smtpAddress) ?? smtpOrNull(r.email))
    .filter((a): a is string => Boolean(a));

  const attachments: ParsedEmailFile["attachments"] = [];
  for (const meta of data.attachments ?? []) {
    // An email attached to the email: listed by name, not unpacked.
    if (meta.innerMsgContent) continue;
    try {
      const file = reader.getAttachment(meta);
      attachments.push({
        name: file.fileName || meta.fileName || "piece-jointe",
        contentType: meta.attachMimeTag || "application/octet-stream",
        content: Buffer.from(file.content),
      });
    } catch {
      // One unreadable attachment must not lose the whole email.
    }
  }

  const html =
    data.bodyHtml ?? (data.html ? Buffer.from(data.html).toString("utf8") : null);

  return {
    messageId,
    subject: data.subject?.trim() || "(sans objet)",
    fromName: data.senderName?.trim() || "",
    fromEmail: smtpOrNull(data.senderSmtpAddress) ?? smtpOrNull(data.senderEmail) ?? "",
    recipients,
    date: isoDate(data.messageDeliveryTime ?? data.clientSubmitTime ?? null),
    text: data.body?.trim() ?? "",
    html,
    attachments,
  };
}

export async function parseEmailFile(
  bytes: Buffer,
  kind: EmailFileKind,
): Promise<ParsedEmailFile> {
  return kind === "msg" ? parseMsg(bytes) : parseEml(bytes);
}
