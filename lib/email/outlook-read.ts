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
};

type GraphMessage = {
  id?: string;
  subject?: string;
  from?: { emailAddress?: { name?: string; address?: string } };
  receivedDateTime?: string;
  bodyPreview?: string;
  hasAttachments?: boolean;
  webLink?: string;
  conversationId?: string;
};

/** Lists inbox messages received since `sinceIso`, newest first (capped). */
export async function listRecentInboxMessages(
  accessToken: string,
  sinceIso: string,
  max = 40,
): Promise<OutlookMessage[]> {
  const params = new URLSearchParams({
    $select:
      "id,subject,from,receivedDateTime,bodyPreview,hasAttachments,webLink,conversationId",
    $top: String(Math.min(Math.max(max, 1), 100)),
    $orderby: "receivedDateTime desc",
    $filter: `receivedDateTime ge ${sinceIso}`,
  });

  const res = await fetch(
    `${GRAPH}/me/mailFolders/inbox/messages?${params.toString()}`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  ).catch(() => null);

  if (!res || !res.ok) {
    console.error("[outlook] list messages failed:", res?.status);
    return [];
  }

  const payload = (await res.json().catch(() => null)) as {
    value?: GraphMessage[];
  } | null;

  return (payload?.value ?? []).flatMap((m) => {
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
      },
    ];
  });
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
