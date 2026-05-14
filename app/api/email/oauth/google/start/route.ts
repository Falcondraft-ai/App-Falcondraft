import { NextResponse } from "next/server";
import { loadUserOrganizationContextWithAdmin } from "@/lib/auth/organization-context";
import {
  createGoogleOAuthState,
  getGoogleAuthorizationUrl,
} from "@/lib/email/google-oauth";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { getSupabaseServerClient } from "@/lib/supabase/server";

function settingsRedirect(requestUrl: string, status: string) {
  const url = new URL("/dashboard/settings/integrations", requestUrl);
  url.searchParams.set("gmail", status);
  return NextResponse.redirect(url);
}

export async function GET(request: Request) {
  const supabase = await getSupabaseServerClient();

  if (!supabase) {
    return settingsRedirect(request.url, "unavailable");
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
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

  if (!context.organization || !context.membership) {
    return settingsRedirect(request.url, "forbidden");
  }

  try {
    const state = createGoogleOAuthState({
      organizationId: context.organization.id,
      userId: user.id,
    });
    const authorizationUrl = getGoogleAuthorizationUrl({
      state,
      loginHint: user.email,
    });

    return NextResponse.redirect(authorizationUrl);
  } catch {
    return settingsRedirect(request.url, "unavailable");
  }
}
