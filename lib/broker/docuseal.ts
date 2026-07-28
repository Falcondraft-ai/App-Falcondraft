import "server-only";

import { timingSafeEqual } from "node:crypto";

// DocuSeal REST API client (https://www.docuseal.com/docs/api).
//
// Flow: a one-off template is created from the generated PDF (the signature
// field is auto-detected from the invisible "{{…;type=signature}}" tag), then a
// submission with send_email:false — the broker transmits the signing link from
// their own mailbox, per the product rule "nothing goes out without you".
// Lifecycle updates then arrive on the webhook; reminders are re-sent by us.
//
// The provider name never surfaces in the client-facing UI (CLAUDE.md §2):
// user-visible copy says "signature électronique", not "DocuSeal".

const DEFAULT_BASE_URL = "https://api.docuseal.com";

/** Hosts we accept to download a signed document / audit log from. */
const DEFAULT_DOCUMENT_HOSTS = ["docuseal.com", "docuseal.eu", "docuseal.co"];

/** Must match the role in the PDF signature tag (lib/broker/pdf/render.tsx). */
export const CLIENT_ROLE = "Client";

/** Max size accepted when pulling a signed document back into the GED (25 MB). */
const MAX_DOCUMENT_BYTES = 26_214_400;

function baseUrl(): string {
  return (process.env.DOCUSEAL_BASE_URL || DEFAULT_BASE_URL).replace(/\/+$/, "");
}

/**
 * Web app origin matching the configured API region — api.docuseal.eu serves an
 * EU account whose signing links live on docuseal.eu, not docuseal.com. Only
 * used as a fallback: the API normally returns an explicit `embed_src`.
 */
function appOrigin(): string {
  try {
    const url = new URL(baseUrl());
    url.hostname = url.hostname.replace(/^api\./, "");
    url.pathname = "";
    return url.origin;
  } catch {
    return "https://docuseal.com";
  }
}

export function isDocusealConfigured(): boolean {
  return Boolean(process.env.DOCUSEAL_API_KEY);
}

function authHeaders(key: string): Record<string, string> {
  return { "Content-Type": "application/json", "X-Auth-Token": key };
}

export type DocusealFailure = {
  success: false;
  /** unconfigured | api_error | network */
  reason: string;
  message: string;
};

const UNCONFIGURED: DocusealFailure = {
  success: false,
  reason: "unconfigured",
  message:
    "La signature électronique n’est pas encore activée sur votre espace. Contactez le support.",
};

function apiFailure(message?: string): DocusealFailure {
  return {
    success: false,
    reason: "api_error",
    message:
      message ??
      "La création du lien de signature n’a pas abouti. Réessayez dans un instant.",
  };
}

function networkFailure(message?: string): DocusealFailure {
  return {
    success: false,
    reason: "network",
    message:
      message ??
      "Le service de signature est momentanément injoignable. Réessayez dans un instant.",
  };
}

/* -------------------------------------------------------------------------- */
/*  Create a signature request                                                */
/* -------------------------------------------------------------------------- */

export type DocusealSubmission = {
  submissionId: number;
  submitterId: number;
  signingUrl: string;
  expiresAt: string | null;
};

export type DocusealCreateResult =
  | ({ success: true } & DocusealSubmission)
  | DocusealFailure;

/**
 * Creates a signature request for a single signer from an already-rendered PDF.
 *
 * Document-agnostic on purpose: `metadata` is echoed back verbatim on every
 * webhook event, which is how we route an event to the right record. Today only
 * the devoir de conseil calls this; wiring the GED later means passing a
 * different `metadata.kind` — no change here.
 */
export async function createSignatureRequest(input: {
  pdfBase64: string;
  documentName: string;
  signerName: string;
  signerEmail: string;
  /**
   * Where the signature field goes, as page fractions with a top-left origin.
   * Explicit coordinates rather than a "{{…}}" text tag: a tag makes the field
   * inherit the tag text's bounding box, which is far too small to sign in.
   */
  signatureArea: { x: number; y: number; w: number; h: number; page: number };
  /** Echoed back on webhooks — must identify the record to update. */
  metadata: Record<string, string>;
  /** Days before the link stops working (null = no expiry). */
  expiresInDays?: number | null;
  /** Reply-To used on reminder emails sent by the provider. */
  replyTo?: string | null;
}): Promise<DocusealCreateResult> {
  const key = process.env.DOCUSEAL_API_KEY;
  if (!key) return UNCONFIGURED;

  // 1. One-off template from the PDF, with the signature field placed by hand.
  //    `fields` MUST sit inside `documents[]` — passed at the top level the API
  //    silently ignores it (and falls back to a default "First Party" role).
  let templateId: number;
  try {
    const res = await fetch(`${baseUrl()}/templates/pdf`, {
      method: "POST",
      headers: authHeaders(key),
      body: JSON.stringify({
        name: input.documentName,
        documents: [
          {
            name: input.documentName,
            file: input.pdfBase64,
            fields: [
              {
                name: "Signature",
                type: "signature",
                role: CLIENT_ROLE,
                required: true,
                areas: [input.signatureArea],
              },
            ],
          },
        ],
      }),
    });
    if (!res.ok) {
      console.error("[docuseal] templates/pdf failed:", res.status);
      return apiFailure();
    }
    const tpl = (await res.json().catch(() => null)) as { id?: number } | null;
    if (!tpl?.id) return apiFailure();
    templateId = tpl.id;
  } catch (error) {
    console.error("[docuseal] templates/pdf error:", error);
    return networkFailure();
  }

  // 2. Submission — no email from the provider on the first send.
  const expiresAt =
    input.expiresInDays && input.expiresInDays > 0
      ? new Date(Date.now() + input.expiresInDays * 86_400_000)
      : null;

  try {
    const res = await fetch(`${baseUrl()}/submissions`, {
      method: "POST",
      headers: authHeaders(key),
      body: JSON.stringify({
        template_id: templateId,
        send_email: false,
        ...(expiresAt
          ? { expire_at: expiresAt.toISOString().replace("T", " ").slice(0, 19) + " UTC" }
          : {}),
        ...(input.replyTo ? { reply_to: input.replyTo } : {}),
        submitters: [
          {
            role: CLIENT_ROLE,
            email: input.signerEmail,
            name: input.signerName,
            metadata: input.metadata,
          },
        ],
      }),
    });
    if (!res.ok) {
      console.error("[docuseal] submissions failed:", res.status);
      return apiFailure();
    }
    const submitters = (await res.json().catch(() => null)) as
      | { id?: number; submission_id?: number; slug?: string; embed_src?: string }[]
      | null;
    const first = submitters?.[0];
    if (!first?.submission_id || !first.id || !first.slug) return apiFailure();
    return {
      success: true,
      submissionId: first.submission_id,
      submitterId: first.id,
      signingUrl: first.embed_src || `${appOrigin()}/s/${first.slug}`,
      expiresAt: expiresAt?.toISOString() ?? null,
    };
  } catch (error) {
    console.error("[docuseal] submissions error:", error);
    return networkFailure();
  }
}

/* -------------------------------------------------------------------------- */
/*  Reminders                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Re-sends the signature request email to the signer. Used both by the manual
 * "Relancer" button and the daily reminder cron. Returns false on any failure —
 * a missed reminder is never worth failing the caller over.
 */
export async function resendSignatureRequest(
  submitterId: string | number,
  message?: { subject: string; body: string },
): Promise<boolean> {
  const key = process.env.DOCUSEAL_API_KEY;
  if (!key) return false;
  try {
    const res = await fetch(`${baseUrl()}/submitters/${submitterId}`, {
      method: "PUT",
      headers: authHeaders(key),
      body: JSON.stringify({ send_email: true, ...(message ? { message } : {}) }),
    });
    if (!res.ok) {
      console.error("[docuseal] resend failed:", res.status);
      return false;
    }
    return true;
  } catch (error) {
    console.error("[docuseal] resend error:", error);
    return false;
  }
}

/* -------------------------------------------------------------------------- */
/*  Status                                                                     */
/* -------------------------------------------------------------------------- */

export type DocusealSubmissionState = {
  /** pending | completed | declined | expired | … (raw provider status) */
  status: string;
  completed: boolean;
  declined: boolean;
  expired: boolean;
  sentAt: string | null;
  openedAt: string | null;
  completedAt: string | null;
  declinedAt: string | null;
  declineReason: string | null;
  expiresAt: string | null;
  /** Signed documents, available once every party has completed. */
  documents: { name: string; url: string }[];
  auditLogUrl: string | null;
};

type SubmissionPayload = {
  status?: string;
  expire_at?: string | null;
  audit_log_url?: string | null;
  documents?: { name?: string; url?: string }[] | null;
  submitters?: {
    sent_at?: string | null;
    opened_at?: string | null;
    completed_at?: string | null;
    declined_at?: string | null;
    decline_reason?: string | null;
  }[];
};

function toState(data: SubmissionPayload): DocusealSubmissionState {
  const status = data.status ?? "pending";
  const submitter = data.submitters?.[0] ?? {};
  return {
    status,
    completed: status === "completed",
    declined: status === "declined" || Boolean(submitter.declined_at),
    expired: status === "expired",
    sentAt: submitter.sent_at ?? null,
    openedAt: submitter.opened_at ?? null,
    completedAt: submitter.completed_at ?? null,
    declinedAt: submitter.declined_at ?? null,
    declineReason: submitter.decline_reason ?? null,
    expiresAt: data.expire_at ?? null,
    documents: (data.documents ?? [])
      .filter((d): d is { name?: string; url: string } => Boolean(d?.url))
      .map((d) => ({ name: d.name ?? "document", url: d.url })),
    auditLogUrl: data.audit_log_url ?? null,
  };
}

/** Reads a submission's authoritative state. Returns null when unavailable. */
export async function getSubmissionState(
  submissionId: string | number,
): Promise<DocusealSubmissionState | null> {
  const key = process.env.DOCUSEAL_API_KEY;
  if (!key) return null;
  try {
    const res = await fetch(`${baseUrl()}/submissions/${submissionId}`, {
      headers: { "X-Auth-Token": key },
    });
    if (!res.ok) {
      if (res.status !== 404) {
        console.error("[docuseal] submission fetch failed:", res.status);
      }
      return null;
    }
    const data = (await res.json().catch(() => null)) as SubmissionPayload | null;
    if (!data) return null;
    return toState(data);
  } catch (error) {
    console.error("[docuseal] submission fetch error:", error);
    return null;
  }
}

/**
 * Archives (cancels) a submission. Called when a broker regenerates a signature
 * link so the superseded one stops working instead of lingering.
 */
export async function archiveSubmission(
  submissionId: string | number,
): Promise<boolean> {
  const key = process.env.DOCUSEAL_API_KEY;
  if (!key) return false;
  try {
    const res = await fetch(`${baseUrl()}/submissions/${submissionId}`, {
      method: "DELETE",
      headers: { "X-Auth-Token": key },
    });
    return res.ok;
  } catch (error) {
    console.error("[docuseal] archive error:", error);
    return false;
  }
}

/* -------------------------------------------------------------------------- */
/*  Downloading signed documents                                               */
/* -------------------------------------------------------------------------- */

function allowedDocumentHosts(): string[] {
  const hosts = [...DEFAULT_DOCUMENT_HOSTS];
  // Self-hosted deployments serve blobs from their own host.
  try {
    hosts.push(new URL(baseUrl()).hostname);
  } catch {
    /* ignore a malformed base url — the defaults still apply */
  }
  return hosts;
}

/**
 * Downloads a signed document / audit log.
 *
 * The URL originates from the provider, so it is treated as untrusted input:
 * only https and only the provider's own hosts are accepted, which keeps a
 * tampered payload from turning this into an SSRF probe of our network.
 */
export async function downloadSignedDocument(
  url: string,
): Promise<{ bytes: Buffer; contentType: string } | null> {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (parsed.protocol !== "https:") return null;

  const host = parsed.hostname.toLowerCase();
  const allowed = allowedDocumentHosts().some(
    (h) => host === h || host.endsWith(`.${h}`),
  );
  if (!allowed) {
    console.error("[docuseal] refused document host:", host);
    return null;
  }

  try {
    const res = await fetch(parsed.toString(), { redirect: "follow" });
    if (!res.ok) {
      console.error("[docuseal] document download failed:", res.status);
      return null;
    }
    const length = Number(res.headers.get("content-length") ?? "0");
    if (length > MAX_DOCUMENT_BYTES) {
      console.error("[docuseal] document too large:", length);
      return null;
    }
    const buffer = Buffer.from(await res.arrayBuffer());
    if (buffer.byteLength > MAX_DOCUMENT_BYTES) {
      console.error("[docuseal] document too large:", buffer.byteLength);
      return null;
    }
    return {
      bytes: buffer,
      contentType: res.headers.get("content-type") ?? "application/pdf",
    };
  } catch (error) {
    console.error("[docuseal] document download error:", error);
    return null;
  }
}

/* -------------------------------------------------------------------------- */
/*  Webhook authentication                                                     */
/* -------------------------------------------------------------------------- */

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

/**
 * Authenticates an inbound webhook against `DOCUSEAL_WEBHOOK_SECRET`.
 *
 * DocuSeal signs nothing: it lets you attach an arbitrary secret header to the
 * webhook, so we accept the shared secret from a custom header or, failing
 * that, a `?token=` query param (some setups can only configure the URL).
 * Comparison is constant-time. Returns false when the secret isn't configured —
 * an unauthenticated webhook must never be trusted to mutate records.
 */
export function isAuthorizedDocusealWebhook(request: Request): boolean {
  const secret = process.env.DOCUSEAL_WEBHOOK_SECRET;
  if (!secret) return false;

  const header =
    request.headers.get("x-docuseal-secret") ??
    request.headers.get("x-webhook-secret") ??
    request.headers.get("x-falcondraft-signature");
  if (header && safeEqual(header, secret)) return true;

  try {
    const token = new URL(request.url).searchParams.get("token");
    if (token && safeEqual(token, secret)) return true;
  } catch {
    /* malformed url — fall through to reject */
  }
  return false;
}

/* -------------------------------------------------------------------------- */
/*  Webhook payload                                                            */
/* -------------------------------------------------------------------------- */

export const DOCUSEAL_EVENTS = [
  "form.viewed",
  "form.started",
  "form.completed",
  "form.declined",
] as const;

export type DocusealEventType = (typeof DOCUSEAL_EVENTS)[number];

export type DocusealWebhookEvent = {
  type: DocusealEventType;
  submissionId: string | null;
  submitterId: string | null;
  metadata: Record<string, string>;
  openedAt: string | null;
  completedAt: string | null;
  declinedAt: string | null;
  declineReason: string | null;
};

function stringField(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) return value.trim();
  return null;
}

/** Parses a webhook body, returning null when it isn't an event we handle. */
export function parseDocusealWebhook(body: unknown): DocusealWebhookEvent | null {
  if (!body || typeof body !== "object") return null;
  const root = body as Record<string, unknown>;
  const type = root.event_type;
  if (
    typeof type !== "string" ||
    !(DOCUSEAL_EVENTS as readonly string[]).includes(type)
  ) {
    return null;
  }

  const data = (root.data ?? {}) as Record<string, unknown>;
  const submission = (data.submission ?? {}) as Record<string, unknown>;

  const rawMetadata = data.metadata;
  const metadata: Record<string, string> = {};
  if (rawMetadata && typeof rawMetadata === "object") {
    for (const [k, v] of Object.entries(rawMetadata as Record<string, unknown>)) {
      if (typeof v === "string") metadata[k] = v;
    }
  }

  const submissionId =
    submission.id !== undefined && submission.id !== null
      ? String(submission.id)
      : null;

  return {
    type: type as DocusealEventType,
    submissionId,
    submitterId: data.id !== undefined && data.id !== null ? String(data.id) : null,
    metadata,
    openedAt: stringField(data.opened_at),
    completedAt: stringField(data.completed_at),
    declinedAt: stringField(data.declined_at),
    declineReason: stringField(data.decline_reason),
  };
}
