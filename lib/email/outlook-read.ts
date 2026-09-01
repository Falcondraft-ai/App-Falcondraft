import "server-only";

import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { decryptToken, encryptToken } from "@/lib/email/token-crypto";
import {
  outlookOAuthProvider,
  refreshOutlookAccessToken,
} from "@/lib/email/microsoft-oauth";

const GRAPH = "https://graph.microsoft.com/v1.0";

export type OutlookAccess = {
  accessToken: string;
  email: string;
  connectionId: string;
};

/**
 * Resolves a usable Graph access token for the user's connected Outlook mailbox,
 * refreshing it if it is about to expire. Returns null (never throws) when the
 * user has no active Outlook connection. Mail.ReadWrite (already granted for
 * drafts) also covers reading the mailbox — no extra scope needed.
 */
export async function getOutlookAccessForUser(
  organizationId: string,
  userId: string,
): Promise<OutlookAccess | null> {
  const adminSupabase = getSupabaseAdminClient();
  if (!adminSupabase) return null;

  const { data: connection } = await adminSupabase
    .from("email_connections")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("user_id", userId)
    .eq("provider", outlookOAuthProvider)
    .eq("status", "connected")
    .maybeSingle();

  if (!connection) return null;

  try {
    const expiresAtMs = new Date(connection.expires_at).getTime();
    if (expiresAtMs > Date.now() + 60_000) {
      return {
        accessToken: decryptToken(connection.access_token),
        email: connection.email,
        connectionId: connection.id,
      };
    }

    const refreshed = await refreshOutlookAccessToken(
      decryptToken(connection.refresh_token),
    );
    await adminSupabase
      .from("email_connections")
      .update({
        access_token: encryptToken(refreshed.accessToken),
        expires_at: refreshed.expiresAt,
        status: "connected",
        updated_at: new Date().toISOString(),
      })
      .eq("id", connection.id);

    return {
      accessToken: refreshed.accessToken,
      email: connection.email,
      connectionId: connection.id,
    };
  } catch (error) {
    console.error("[outlook] access token resolution failed:", error);
    return null;
  }
}

export type OutlookMessage = {
  id: string;
  subject: string;
  fromName: string;
  fromEmail: string;
  receivedDateTime: string;
  bodyPreview: string;
  hasAttachments: boolean;
  webLink: string;
  conversationId: string;
  /** Lowercased To/Cc addresses — used to detect which mailbox alias received it. */
  recipients: string[];
};

type GraphRecipient = { emailAddress?: { name?: string; address?: string } };

type GraphMessage = {
  id?: string;
  subject?: string;
  from?: { emailAddress?: { name?: string; address?: string } };
  toRecipients?: GraphRecipient[];
  ccRecipients?: GraphRecipient[];
  receivedDateTime?: string;
  bodyPreview?: string;
  hasAttachments?: boolean;
  webLink?: string;
  conversationId?: string;
};

function recipientAddresses(message: GraphMessage): string[] {
  const out: string[] = [];
  for (const r of [
    ...(message.toRecipients ?? []),
    ...(message.ccRecipients ?? []),
  ]) {
    const addr = r.emailAddress?.address?.trim().toLowerCase();
    if (addr) out.push(addr);
  }
  return out;
}

/**
 * Lists the SMTP addresses owned by the connected mailbox (primary + aliases).
 * The bespoke broker aggregates several SMTP addresses inside a single Outlook
 * account; `proxyAddresses` exposes them all (entries prefixed `SMTP:`/`smtp:`).
 * Falls back to the primary `mail`/`userPrincipalName` when proxies are
 * unavailable (e.g. personal accounts). Never throws — returns [] on failure.
 */
export async function getMailboxAddresses(
  accessToken: string,
): Promise<string[]> {
  const params = new URLSearchParams({
    $select: "mail,userPrincipalName,proxyAddresses",
  });
  const res = await fetch(`${GRAPH}/me?${params.toString()}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  }).catch(() => null);

  if (!res || !res.ok) return [];

  const me = (await res.json().catch(() => null)) as {
    mail?: string;
    userPrincipalName?: string;
    proxyAddresses?: string[];
  } | null;
  if (!me) return [];

  const set = new Set<string>();
  for (const proxy of me.proxyAddresses ?? []) {
    const addr = proxy.replace(/^smtp:/i, "").trim().toLowerCase();
    if (addr.includes("@")) set.add(addr);
  }
  for (const primary of [me.mail, me.userPrincipalName]) {
    const addr = primary?.trim().toLowerCase();
    if (addr?.includes("@")) set.add(addr);
  }
  return [...set];
}

/**
 * Resolves which of the mailbox's own addresses an email was delivered to
 * (the alias the sender used). Returns null when none of the To/Cc addresses
 * belong to the mailbox (e.g. forwarded/BCC-only mail).
 */
export function resolveMailboxAddress(
  message: Pick<OutlookMessage, "recipients">,
  mailboxAddresses: Set<string>,
): string | null {
  for (const addr of message.recipients) {
    if (mailboxAddresses.has(addr)) return addr;
  }
  return null;
}

/** Page size accepted by Graph on `/messages` — the hard per-request ceiling. */
const GRAPH_PAGE_SIZE = 100;
/** Safety bound so a runaway mailbox can't loop forever on `@odata.nextLink`. */
const MAX_PAGES = 30;

export type InboxPage = {
  messages: OutlookMessage[];
  /**
   * True when the cap was reached and Graph still had more to give. The caller
   * must then remember where it stopped, otherwise the rest of the window is
   * lost for good.
   */
  truncated: boolean;
};

/**
 * Lists inbox messages received since `sinceIso`, **oldest first**, following
 * Graph's pagination up to `max`.
 *
 * Chronological order is the default and is deliberate: a mailbox can receive
 * far more than one
 * batch can process (100+/day for a busy broker), so a capped run must keep the
 * OLDEST unprocessed emails — those are the ones the caller has never seen. It
 * then resumes from the newest message it did process, and walks forward. The
 * reverse silently drops the beginning of the window. Pass `order: "desc"` only
 * when you genuinely want "the N latest" and nothing is resumed afterwards.
 */
export async function listRecentInboxMessages(
  accessToken: string,
  sinceIso: string,
  max = 40,
  options?: { order?: "asc" | "desc" },
): Promise<InboxPage> {
  const limit = Math.max(max, 1);
  const order = options?.order ?? "asc";
  const params = new URLSearchParams({
    $select:
      "id,subject,from,toRecipients,ccRecipients,receivedDateTime,bodyPreview,hasAttachments,webLink,conversationId",
    $top: String(Math.min(limit, GRAPH_PAGE_SIZE)),
    $orderby: `receivedDateTime ${order}`,
    $filter: `receivedDateTime ge ${sinceIso}`,
  });

  let url: string | null =
    `${GRAPH}/me/mailFolders/inbox/messages?${params.toString()}`;
  const collected: OutlookMessage[] = [];
  let truncated = false;

  for (let page = 0; page < MAX_PAGES && url; page += 1) {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    }).catch(() => null);

    if (!res || !res.ok) {
      console.error("[outlook] list messages failed:", res?.status);
      // Keep what we already have: a partial window the caller can resume from
      // is far better than losing the whole run.
      return { messages: collected, truncated: collected.length > 0 };
    }

    const payload = (await res.json().catch(() => null)) as {
      value?: GraphMessage[];
      "@odata.nextLink"?: string;
    } | null;

    collected.push(...(payload?.value ?? []).flatMap(toOutlookMessage));

    if (collected.length >= limit) {
      truncated = Boolean(payload?.["@odata.nextLink"]);
      return { messages: collected.slice(0, limit), truncated };
    }

    url = payload?.["@odata.nextLink"] ?? null;
    // Hit the page ceiling with more to come: report it rather than pretend the
    // window is complete.
    if (url && page === MAX_PAGES - 1) truncated = true;
  }

  return { messages: collected, truncated };
}

function toOutlookMessage(m: GraphMessage): OutlookMessage[] {
  if (!m.id) return [];
  return [
    {
      id: m.id,
      subject: m.subject?.trim() || "(sans objet)",
      fromName: m.from?.emailAddress?.name?.trim() || "",
      fromEmail: m.from?.emailAddress?.address?.trim().toLowerCase() || "",
      receivedDateTime: m.receivedDateTime ?? "",
      bodyPreview: (m.bodyPreview ?? "").slice(0, 800),
      hasAttachments: Boolean(m.hasAttachments),
      webLink: m.webLink ?? "",
      conversationId: m.conversationId ?? "",
      recipients: recipientAddresses(m),
    },
  ];
}

/**
 * Searches the whole mailbox for messages involving a participant email (as
 * sender, recipient or cc). Covers the bespoke broker's multi-address setup: a
 * single Outlook account aggregating several SMTP addresses is read in full via
 * `/me/messages`. Optional free-text `query` narrows further. Uses KQL `$search`
 * (cannot be combined with `$orderby`, so results come back by relevance).
 */
export async function searchMessagesByParticipant(
  accessToken: string,
  email: string,
  query?: string,
  max = 25,
): Promise<OutlookMessage[]> {
  const trimmed = email.trim().toLowerCase();
  if (!trimmed) return [];

  // KQL: participants covers from/to/cc. Escape double quotes defensively.
  const safe = (s: string) => s.replace(/"/g, "");
  const q = query?.trim();
  const kql = q
    ? `participants:${safe(trimmed)} AND "${safe(q)}"`
    : `participants:${safe(trimmed)}`;

  const params = new URLSearchParams({
    $select:
      "id,subject,from,toRecipients,ccRecipients,receivedDateTime,bodyPreview,hasAttachments,webLink,conversationId",
    $top: String(Math.min(Math.max(max, 1), 50)),
    $search: `"${kql}"`,
  });

  const res = await fetch(`${GRAPH}/me/messages?${params.toString()}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ConsistencyLevel: "eventual",
    },
  }).catch(() => null);

  if (!res || !res.ok) {
    console.error("[outlook] search messages failed:", res?.status);
    return [];
  }

  const payload = (await res.json().catch(() => null)) as {
    value?: GraphMessage[];
  } | null;

  const messages = (payload?.value ?? []).flatMap((m) => {
    if (!m.id) return [];
    return [
      {
        id: m.id,
        subject: m.subject?.trim() || "(sans objet)",
        fromName: m.from?.emailAddress?.name?.trim() || "",
        fromEmail: m.from?.emailAddress?.address?.trim().toLowerCase() || "",
        receivedDateTime: m.receivedDateTime ?? "",
        bodyPreview: (m.bodyPreview ?? "").slice(0, 800),
        hasAttachments: Boolean(m.hasAttachments),
        webLink: m.webLink ?? "",
        conversationId: m.conversationId ?? "",
        recipients: recipientAddresses(m),
      },
    ];
  });

  // $search returns by relevance; present newest first for a mailbox feel.
  return messages.sort((a, b) =>
    (b.receivedDateTime ?? "").localeCompare(a.receivedDateTime ?? ""),
  );
}

// ---------------------------------------------------------------------------
// Client-centric search — everything that CONCERNS a client, not just mail
// exchanged with their address. An insurer's quote/contract about a client
// rarely carries the client's own email, but cites their name or policy/claim
// reference; a company's correspondence spans many addresses at its domain.
// ---------------------------------------------------------------------------

/** Consumer mail providers whose domain must NOT be used to match a "company". */
const PUBLIC_EMAIL_DOMAINS = new Set<string>([
  "gmail.com", "googlemail.com", "outlook.com", "outlook.fr", "hotmail.com",
  "hotmail.fr", "live.com", "live.fr", "msn.com", "yahoo.com", "yahoo.fr",
  "icloud.com", "me.com", "aol.com", "proton.me", "protonmail.com", "gmx.com",
  "gmx.fr", "orange.fr", "wanadoo.fr", "free.fr", "sfr.fr", "laposte.net",
  "bbox.fr", "numericable.fr", "neuf.fr", "aliceadsl.fr",
]);

/** The company email domain worth matching on (null for individuals / webmail). */
export function companyEmailDomain(
  email: string | null | undefined,
  isCompany: boolean,
): string | null {
  if (!isCompany || !email) return null;
  const domain = email.split("@")[1]?.trim().toLowerCase();
  if (!domain || !domain.includes(".") || PUBLIC_EMAIL_DOMAINS.has(domain)) {
    return null;
  }
  return domain;
}

export type ClientSearchCriteria = {
  /** The client's own address(es) — participant matches. */
  emails: string[];
  /** Full name / company name — matched as phrases across subject/body/participants. */
  names: string[];
  /** Policy numbers, claim references — matched as phrases. */
  references: string[];
  /** Company email domain (non-webmail) — participant match. */
  domain: string | null;
};

function mapGraphMessage(m: GraphMessage): OutlookMessage | null {
  if (!m.id) return null;
  return {
    id: m.id,
    subject: m.subject?.trim() || "(sans objet)",
    fromName: m.from?.emailAddress?.name?.trim() || "",
    fromEmail: m.from?.emailAddress?.address?.trim().toLowerCase() || "",
    receivedDateTime: m.receivedDateTime ?? "",
    bodyPreview: (m.bodyPreview ?? "").slice(0, 800),
    hasAttachments: Boolean(m.hasAttachments),
    webLink: m.webLink ?? "",
    conversationId: m.conversationId ?? "",
    recipients: recipientAddresses(m),
  };
}

/** One mailbox-wide KQL `$search` (kqlInner without Graph's outer quotes). */
async function runKqlSearch(
  accessToken: string,
  kqlInner: string,
  max: number,
): Promise<OutlookMessage[]> {
  const params = new URLSearchParams({
    $select:
      "id,subject,from,toRecipients,ccRecipients,receivedDateTime,bodyPreview,hasAttachments,webLink,conversationId",
    $top: String(Math.min(Math.max(max, 1), 50)),
    $search: `"${kqlInner}"`,
  });
  const res = await fetch(`${GRAPH}/me/messages?${params.toString()}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ConsistencyLevel: "eventual",
    },
  }).catch(() => null);
  if (!res || !res.ok) {
    console.error("[outlook] client search failed:", res?.status);
    return [];
  }
  const payload = (await res.json().catch(() => null)) as {
    value?: GraphMessage[];
  } | null;
  return (payload?.value ?? []).flatMap((m) => {
    const mapped = mapGraphMessage(m);
    return mapped ? [mapped] : [];
  });
}

/**
 * Searches the mailbox for everything concerning a client: participant matches
 * on their address(es)/company domain PLUS phrase matches on their name and
 * contract/claim references. Runs one search per signal and merges by id —
 * simpler and more reliable than one deeply-nested KQL, and reuses the
 * mailbox-wide read already granted. Optional `query` narrows each signal.
 */
export async function searchMessagesForClient(
  accessToken: string,
  criteria: ClientSearchCriteria,
  query?: string,
  max = 30,
  maxUnits = 10,
): Promise<OutlookMessage[]> {
  const safe = (s: string) => s.replace(/"/g, "").trim();
  const units: string[] = [];
  for (const e of criteria.emails) {
    const v = safe(e);
    if (v.includes("@")) units.push(`participants:${v}`);
  }
  if (criteria.domain) {
    const v = safe(criteria.domain);
    if (v) units.push(`participants:${v}`);
  }
  for (const n of criteria.names) {
    const v = safe(n);
    if (v.length >= 3) units.push(`"${v}"`);
  }
  for (const r of criteria.references) {
    const v = safe(r);
    if (v.length >= 4) units.push(`"${v}"`);
  }

  const unique = [...new Set(units)].slice(0, Math.max(1, maxUnits));
  if (unique.length === 0) return [];

  const q = query?.trim() ? safe(query) : "";
  const perUnit = Math.max(10, Math.ceil(max / Math.min(unique.length, 3)));
  const lists = await Promise.all(
    unique.map((u) => runKqlSearch(accessToken, q ? `${u} AND "${q}"` : u, perUnit)),
  );

  const byId = new Map<string, OutlookMessage>();
  for (const list of lists) {
    for (const m of list) if (!byId.has(m.id)) byId.set(m.id, m);
  }
  return [...byId.values()]
    .sort((a, b) =>
      (b.receivedDateTime ?? "").localeCompare(a.receivedDateTime ?? ""),
    )
    .slice(0, max);
}

export type OutlookAttachmentMeta = {
  id: string;
  name: string;
  contentType: string;
  size: number;
};

type GraphAttachment = {
  "@odata.type"?: string;
  id?: string;
  name?: string;
  contentType?: string;
  size?: number;
  contentBytes?: string;
};

/** File-attachment metadata for a message (skips inline/item attachments). */
export async function getMessageAttachmentsMeta(
  accessToken: string,
  messageId: string,
): Promise<OutlookAttachmentMeta[]> {
  const params = new URLSearchParams({
    $select: "id,name,contentType,size",
    $top: "20",
  });
  const res = await fetch(
    `${GRAPH}/me/messages/${messageId}/attachments?${params.toString()}`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  ).catch(() => null);

  if (!res || !res.ok) return [];

  const payload = (await res.json().catch(() => null)) as {
    value?: GraphAttachment[];
  } | null;

  return (payload?.value ?? []).flatMap((a) => {
    if (!a.id || !a.name) return [];
    // Only true file attachments can be downloaded as bytes.
    if (
      a["@odata.type"] &&
      a["@odata.type"] !== "#microsoft.graph.fileAttachment"
    ) {
      return [];
    }
    return [
      {
        id: a.id,
        name: a.name,
        contentType: a.contentType || "application/octet-stream",
        size: a.size ?? 0,
      },
    ];
  });
}

/** Downloads a single file attachment (base64 contentBytes) for execution. */
export async function getFileAttachmentBytes(
  accessToken: string,
  messageId: string,
  attachmentId: string,
): Promise<{ name: string; contentType: string; contentBase64: string } | null> {
  const res = await fetch(
    `${GRAPH}/me/messages/${messageId}/attachments/${attachmentId}`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  ).catch(() => null);

  if (!res || !res.ok) return null;

  const a = (await res.json().catch(() => null)) as GraphAttachment | null;
  if (!a?.contentBytes || !a.name) return null;

  return {
    name: a.name,
    contentType: a.contentType || "application/octet-stream",
    contentBase64: a.contentBytes,
  };
}

export type OutlookMessageBody = {
  subject: string;
  fromName: string;
  fromEmail: string;
  receivedDateTime: string;
  body: string;
};

/** Reads a single message with its full body (HTML stripped to plain text). */
export async function getOutlookMessageBody(
  accessToken: string,
  messageId: string,
): Promise<OutlookMessageBody | null> {
  const params = new URLSearchParams({
    $select: "id,subject,from,receivedDateTime,body",
  });
  const res = await fetch(
    `${GRAPH}/me/messages/${encodeURIComponent(messageId)}?${params.toString()}`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  ).catch(() => null);

  if (!res || !res.ok) return null;

  const m = (await res.json().catch(() => null)) as
    | (GraphMessage & { body?: { contentType?: string; content?: string } })
    | null;
  if (!m) return null;

  const raw = m.body?.content ?? "";
  const text =
    m.body?.contentType?.toLowerCase() === "html"
      ? raw
          .replace(/<style[\s\S]*?<\/style>/gi, "")
          .replace(/<script[\s\S]*?<\/script>/gi, "")
          .replace(/<[^>]+>/g, " ")
          .replace(/&nbsp;/g, " ")
          .replace(/&amp;/g, "&")
          .replace(/\s+/g, " ")
          .trim()
      : raw.trim();

  return {
    subject: m.subject?.trim() || "(sans objet)",
    fromName: m.from?.emailAddress?.name?.trim() || "",
    fromEmail: m.from?.emailAddress?.address?.trim().toLowerCase() || "",
    receivedDateTime: m.receivedDateTime ?? "",
    body: text.slice(0, 6000),
  };
}
