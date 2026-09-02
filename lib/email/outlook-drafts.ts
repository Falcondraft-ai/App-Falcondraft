import "server-only";

import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { decryptToken, encryptToken } from "@/lib/email/token-crypto";
import {
  outlookOAuthProvider,
  refreshOutlookAccessToken,
} from "@/lib/email/microsoft-oauth";

export type OutlookDraftAttachment = {
  filename: string;
  contentType: "application/pdf";
  contentBase64: string;
};

type OutlookDraftInput = {
  organizationId: string;
  userId: string;
  to: string;
  subject: string;
  body: string;
  cc?: string[];
  bcc?: string[];
  attachments?: OutlookDraftAttachment[];
};

type GraphMessageResponse = {
  id?: string;
  error?: {
    message?: string;
  };
};

type GraphAttachmentResponse = {
  id?: string;
  error?: {
    message?: string;
  };
};

async function getUsableAccessToken(input: {
  connectionId: string;
  encryptedAccessToken: string;
  encryptedRefreshToken: string;
  expiresAt: string;
}) {
  const expiresAtMs = new Date(input.expiresAt).getTime();

  if (expiresAtMs > Date.now() + 60_000) {
    return decryptToken(input.encryptedAccessToken);
  }

  const refreshToken = decryptToken(input.encryptedRefreshToken);
  const refreshedToken = await refreshOutlookAccessToken(refreshToken);
  const adminSupabase = getSupabaseAdminClient();

  if (!adminSupabase) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is required.");
  }

  await adminSupabase
    .from("email_connections")
    .update({
      access_token: encryptToken(refreshedToken.accessToken),
      expires_at: refreshedToken.expiresAt,
      status: "connected",
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.connectionId);

  return refreshedToken.accessToken;
}

function buildGraphMessageBody(input: OutlookDraftInput) {
  const message: Record<string, unknown> = {
    subject: input.subject,
    body: {
      contentType: "Text",
      content: input.body,
    },
    toRecipients: [
      {
        emailAddress: {
          address: input.to,
        },
      },
    ],
  };

  if (input.cc?.length) {
    message.ccRecipients = input.cc.map((address) => ({
      emailAddress: { address },
    }));
  }

  if (input.bcc?.length) {
    message.bccRecipients = input.bcc.map((address) => ({
      emailAddress: { address },
    }));
  }

  return message;
}

export async function createOutlookDraft(input: OutlookDraftInput) {
  const adminSupabase = getSupabaseAdminClient();

  if (!adminSupabase) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is required.");
  }

  const { data: membership } = await adminSupabase
    .from("organization_members")
    .select("id")
    .eq("organization_id", input.organizationId)
    .eq("user_id", input.userId)
    .eq("status", "active")
    .maybeSingle();

  if (!membership) {
    throw new Error("Utilisateur non autorisé pour ce workspace.");
  }

  const { data: connection } = await adminSupabase
    .from("email_connections")
    .select("*")
    .eq("organization_id", input.organizationId)
    .eq("user_id", input.userId)
    .eq("provider", outlookOAuthProvider)
    .eq("status", "connected")
    .maybeSingle();

  if (!connection) {
    throw new Error("Aucune connexion Outlook active pour cet utilisateur.");
  }

  if (!connection.refresh_token || !connection.expires_at) {
    // Colonnes rendues nullables pour les connexions IMAP ; une connexion OAuth
    // en a toujours. Mieux vaut un message clair qu'un cast silencieux.
    throw new Error("Connexion OAuth incomplète — reconnectez la boîte.");
  }

  const accessToken = await getUsableAccessToken({
    connectionId: connection.id,
    encryptedAccessToken: connection.access_token,
    encryptedRefreshToken: connection.refresh_token,
    expiresAt: connection.expires_at,
  });

  const response = await fetch("https://graph.microsoft.com/v1.0/me/messages", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(buildGraphMessageBody(input)),
  });
  const payload = (await response.json()) as GraphMessageResponse;

  if (!response.ok || !payload.id) {
    await adminSupabase
      .from("email_connections")
      .update({
        status: "error",
        updated_at: new Date().toISOString(),
      })
      .eq("id", connection.id);

    throw new Error(
      payload.error?.message ?? "Création du brouillon Outlook impossible.",
    );
  }

  const draftId = payload.id;

  for (const attachment of input.attachments ?? []) {
    const attachmentBody = {
      "@odata.type": "#microsoft.graph.fileAttachment",
      name: attachment.filename,
      contentType: attachment.contentType,
      contentBytes: attachment.contentBase64,
    };

    const attachResponse = await fetch(
      `https://graph.microsoft.com/v1.0/me/messages/${draftId}/attachments`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(attachmentBody),
      },
    );
    const attachPayload =
      (await attachResponse.json()) as GraphAttachmentResponse;

    if (!attachResponse.ok) {
      console.warn("Outlook draft attachment upload failed.", {
        organizationId: input.organizationId,
        userId: input.userId,
        filename: attachment.filename,
        reason: attachPayload.error?.message ?? "unknown",
      });
    }
  }

  return {
    draftId,
    messageId: draftId,
    email: connection.email,
  };
}
