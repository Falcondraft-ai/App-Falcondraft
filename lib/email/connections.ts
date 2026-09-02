import "server-only";

import { googleOAuthProvider } from "@/lib/email/google-oauth";
import { outlookOAuthProvider } from "@/lib/email/microsoft-oauth";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

export type EmailConnectionStatus = {
  id: string;
  email: string;
  provider: string;
  status: string;
  /** Nul pour une connexion IMAP : un mot de passe n'expire pas. */
  expiresAt: string | null;
  updatedAt: string;
};

export async function getGmailConnectionForUser(input: {
  organizationId: string | null;
  userId: string;
}): Promise<EmailConnectionStatus | null> {
  if (!input.organizationId) {
    return null;
  }

  const adminSupabase = getSupabaseAdminClient();

  if (!adminSupabase) {
    return null;
  }

  const { data } = await adminSupabase
    .from("email_connections")
    .select("id, email, provider, status, expires_at, updated_at")
    .eq("organization_id", input.organizationId)
    .eq("user_id", input.userId)
    .eq("provider", googleOAuthProvider)
    .maybeSingle();

  return data
    ? {
        id: data.id,
        email: data.email,
        provider: data.provider,
        status: data.status,
        expiresAt: data.expires_at,
        updatedAt: data.updated_at,
      }
    : null;
}

export async function getOutlookConnectionForUser(input: {
  organizationId: string | null;
  userId: string;
}): Promise<EmailConnectionStatus | null> {
  if (!input.organizationId) {
    return null;
  }

  const adminSupabase = getSupabaseAdminClient();

  if (!adminSupabase) {
    return null;
  }

  const { data } = await adminSupabase
    .from("email_connections")
    .select("id, email, provider, status, expires_at, updated_at")
    .eq("organization_id", input.organizationId)
    .eq("user_id", input.userId)
    .eq("provider", outlookOAuthProvider)
    .maybeSingle();

  return data
    ? {
        id: data.id,
        email: data.email,
        provider: data.provider,
        status: data.status,
        expiresAt: data.expires_at,
        updatedAt: data.updated_at,
      }
    : null;
}
