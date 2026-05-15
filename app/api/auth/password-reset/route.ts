import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { normalizeEmail } from "@/lib/invitations/shared";
import { sendPasswordResetEmail } from "@/lib/auth/password-reset-email";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

const resetPasswordSchema = z.object({
  email: z.string().trim().email(),
});

function jsonError(message: string, status: number, reason: string) {
  return NextResponse.json({ success: false, message, reason }, { status });
}

function firstName(value: string | null | undefined, fallback: string) {
  const cleanedValue = value?.trim();

  if (!cleanedValue) {
    return fallback;
  }

  return cleanedValue.split(/\s+/)[0] ?? fallback;
}

function getAppBaseUrl(request: NextRequest) {
  const configuredUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();

  if (configuredUrl) {
    return configuredUrl.replace(/\/$/, "");
  }

  return request.nextUrl.origin;
}

function getPasswordResetRedirectUrl(request: NextRequest) {
  const redirectUrl = new URL("/auth/confirm", getAppBaseUrl(request));
  redirectUrl.searchParams.set("next", "/update-password");
  return redirectUrl.toString();
}

function getPasswordResetUrl(request: NextRequest, tokenHash?: string | null) {
  if (!tokenHash) {
    return null;
  }

  const resetUrl = new URL("/auth/confirm", getAppBaseUrl(request));
  resetUrl.searchParams.set("token_hash", tokenHash);
  resetUrl.searchParams.set("type", "recovery");
  resetUrl.searchParams.set("next", "/update-password");
  return resetUrl.toString();
}

export async function POST(request: NextRequest) {
  const body: unknown = await request.json().catch(() => ({}));
  const parsedBody = resetPasswordSchema.safeParse(body);

  if (!parsedBody.success) {
    return jsonError("Email invalide.", 400, "invalid_payload");
  }

  const adminSupabase = getSupabaseAdminClient();

  if (!adminSupabase) {
    return jsonError(
      "Réinitialisation indisponible.",
      500,
      "service_role_unconfigured",
    );
  }

  const email = normalizeEmail(parsedBody.data.email);
  const { data: profile } = await adminSupabase
    .from("profiles")
    .select("*")
    .eq("email", email)
    .maybeSingle();

  if (!profile) {
    return NextResponse.json({ success: true });
  }

  const { data: linkData, error: linkError } =
    await adminSupabase.auth.admin.generateLink({
      type: "recovery",
      email,
      options: {
        redirectTo: getPasswordResetRedirectUrl(request),
      },
    });

  if (linkError || !linkData.properties?.action_link) {
    return jsonError(
      "La demande n’a pas pu être envoyée pour le moment.",
      500,
      linkError?.message ?? "recovery_link_failed",
    );
  }

  const resetUrl =
    getPasswordResetUrl(request, linkData.properties.hashed_token) ??
    linkData.properties.action_link;

  const emailResult = await sendPasswordResetEmail({
    to: email,
    name: firstName(profile?.full_name, email),
    resetUrl,
  });

  if (!emailResult.success) {
    return jsonError(
      "La demande n’a pas pu être envoyée pour le moment.",
      500,
      emailResult.message ?? "password_reset_email_failed",
    );
  }

  return NextResponse.json({ success: true });
}
