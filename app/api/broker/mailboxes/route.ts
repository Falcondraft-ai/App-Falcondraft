import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { canCreateWorkspaceRecords } from "@/lib/auth/workspace-permissions";
import { requireBrokerApiContext } from "@/lib/broker/server";
import { verifyImapCredentials } from "@/lib/email/imap-client";
import { IMAP_PROVIDER } from "@/lib/email/mailbox-resolver";
import { encryptToken } from "@/lib/email/token-crypto";

export const runtime = "nodejs";
export const maxDuration = 60;

const schema = z.object({
  profileId: z.string().uuid(),
  email: z.string().trim().email().max(200),
  password: z.string().min(1).max(500),
  /** Identifiant de connexion s'il diffère de l'adresse (rare). */
  username: z.string().trim().max(200).optional(),
  imapHost: z.string().trim().min(1).max(200),
  imapPort: z.number().int().min(1).max(65535).default(993),
  imapSecure: z.boolean().default(true),
  smtpHost: z.string().trim().min(1).max(200),
  smtpPort: z.number().int().min(1).max(65535).default(465),
  smtpSecure: z.boolean().default(true),
});

function jsonError(message: string, status: number, reason: string) {
  return NextResponse.json({ success: false, message, reason }, { status });
}

/**
 * Connecte une boîte IMAP/SMTP à un profil de cabinet.
 *
 * Les identifiants sont VÉRIFIÉS avant d'être enregistrés : un mot de passe
 * accepté puis refusé au premier briefing serait incompréhensible pour le
 * courtier. Le mot de passe est ensuite chiffré (AES-256-GCM) et n'est jamais
 * renvoyé, ni au navigateur ni dans les journaux.
 */
export async function POST(request: NextRequest) {
  const auth = await requireBrokerApiContext();
  if (!auth.success) return jsonError(auth.message, auth.status, auth.reason);
  if (!canCreateWorkspaceRecords(auth.context.membership?.role)) {
    return jsonError("Votre rôle ne permet pas cette action.", 403, "insufficient_role");
  }

  const body: unknown = await request.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return jsonError("Réglages de messagerie incomplets.", 400, "invalid_input");
  }
  const input = parsed.data;

  // Le profil doit appartenir à l'organisation : sans ce contrôle, une requête
  // forgée rattacherait une boîte au cabinet d'à côté.
  const { data: profile } = await auth.adminSupabase
    .from("broker_profiles")
    .select("id")
    .eq("organization_id", auth.organizationId)
    .eq("id", input.profileId)
    .maybeSingle();
  if (!profile) return jsonError("Profil introuvable.", 404, "profile_not_found");

  const verification = await verifyImapCredentials({
    host: input.imapHost,
    port: input.imapPort,
    secure: input.imapSecure,
    user: input.username || input.email,
    password: input.password,
    address: input.email,
  });
  if (!verification.ok) {
    return jsonError(verification.message, 400, "verification_failed");
  }

  const now = new Date().toISOString();
  const { error } = await auth.adminSupabase.from("email_connections").upsert(
    {
      organization_id: auth.organizationId,
      user_id: auth.user.id,
      profile_id: input.profileId,
      provider: IMAP_PROVIDER,
      email: input.email.toLowerCase(),
      access_token: encryptToken(input.password),
      refresh_token: null,
      expires_at: null,
      status: "connected",
      imap_host: input.imapHost,
      imap_port: input.imapPort,
      imap_secure: input.imapSecure,
      smtp_host: input.smtpHost,
      smtp_port: input.smtpPort,
      smtp_secure: input.smtpSecure,
      username: input.username || null,
      last_verified_at: now,
      updated_at: now,
    },
    { onConflict: "organization_id,user_id,provider,profile_id" },
  );

  if (error) {
    console.error("[imap] connection upsert failed:", error.message);
    return jsonError(
      "La boîte n’a pas pu être enregistrée. Vérifiez que la migration 0058 est appliquée.",
      500,
      "persist_failed",
    );
  }

  return NextResponse.json({ success: true, email: input.email.toLowerCase() });
}

/** Déconnecte la boîte d'un profil. */
export async function DELETE(request: NextRequest) {
  const auth = await requireBrokerApiContext();
  if (!auth.success) return jsonError(auth.message, auth.status, auth.reason);
  if (!canCreateWorkspaceRecords(auth.context.membership?.role)) {
    return jsonError("Votre rôle ne permet pas cette action.", 403, "insufficient_role");
  }

  const profileId = request.nextUrl.searchParams.get("profileId");
  if (!profileId) return jsonError("Profil manquant.", 400, "invalid_input");

  await auth.adminSupabase
    .from("email_connections")
    .delete()
    .eq("organization_id", auth.organizationId)
    .eq("user_id", auth.user.id)
    .eq("provider", IMAP_PROVIDER)
    .eq("profile_id", profileId);

  return NextResponse.json({ success: true });
}
