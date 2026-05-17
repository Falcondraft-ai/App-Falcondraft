import { NextResponse, type NextRequest } from "next/server";
import { loadUserOrganizationContextWithAdmin } from "@/lib/auth/organization-context";
import { googleOAuthProvider } from "@/lib/email/google-oauth";
import {
  exchangeMicrosoftOAuthCode,
  getMicrosoftProfileEmail,
  outlookOAuthProvider,
  verifyMicrosoftOAuthState,
} from "@/lib/email/microsoft-oauth";
import { encryptToken } from "@/lib/email/token-crypto";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { getSupabaseServerClient } from "@/lib/supabase/server";

function settingsRedirect(requestUrl: string, status: string) {
  const url = new URL("/dashboard/settings/integrations", requestUrl);
  url.searchParams.set("outlook", status);
  return NextResponse.redirect(url);
}

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const oauthError = request.nextUrl.searchParams.get("error");
  const state = verifyMicrosoftOAuthState(
    request.nextUrl.searchParams.get("state"),
  );

  if (oauthError) {
    return settingsRedirect(request.url, "denied");
  }

  if (!code || !state) {
    return settingsRedirect(request.url, "invalid");
  }

  const supabase = await getSupabaseServerClient();

  if (!supabase) {
    return settingsRedirect(request.url, "unavailable");
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || user.id !== state.userId) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", "/dashboard/settings/integrations");
    return NextResponse.redirect(loginUrl);
  }

  const adminSupabase = getSupabaseAdminClient();

  if (!adminSupabase) {
    return settingsRedirect(request.url, "unavailable");
  }

  const context = await loadUserOrganizationContextWithAdmin(
    user,
    adminSupabase,
  );

  if (
    !context.organization ||
    !context.membership ||
    context.organization.id !== state.organizationId
  ) {
    return settingsRedirect(request.url, "forbidden");
  }

  try {
    const tokenSet = await exchangeMicrosoftOAuthCode(code);
    const email = await getMicrosoftProfileEmail(tokenSet.accessToken);
    const now = new Date().toISOString();

    const { data: connection, error } = await adminSupabase
      .from("email_connections")
      .upsert(
        {
          organization_id: context.organization.id,
          user_id: user.id,
          provider: outlookOAuthProvider,
          email,
          access_token: encryptToken(tokenSet.accessToken),
          refresh_token: encryptToken(tokenSet.refreshToken),
          expires_at: tokenSet.expiresAt,
          status: "connected",
          updated_at: now,
        },
        {
          onConflict: "organization_id,user_id,provider",
        },
      )
      .select("id")
      .single();

    if (error || !connection) {
      return settingsRedirect(request.url, "error");
    }

    // Disconnect the competing provider when a new one is connected
    await adminSupabase
      .from("email_connections")
      .delete()
      .eq("organization_id", context.organization.id)
      .eq("user_id", user.id)
      .eq("provider", googleOAuthProvider);

    await adminSupabase.from("audit_logs").insert({
      organization_id: context.organization.id,
      user_id: user.id,
      action: "email_provider_connected",
      entity_type: "email_connection",
      entity_id: connection.id,
    });

    return settingsRedirect(request.url, "connected");
  } catch {
    return settingsRedirect(request.url, "error");
  }
}
