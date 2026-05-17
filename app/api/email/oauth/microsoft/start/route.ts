import { NextResponse } from "next/server";
import { loadUserOrganizationContextWithAdmin } from "@/lib/auth/organization-context";
import {
  createMicrosoftOAuthState,
  getMicrosoftAuthorizationUrl,
} from "@/lib/email/microsoft-oauth";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { getSupabaseServerClient } from "@/lib/supabase/server";

function settingsRedirect(requestUrl: string, status: string) {
  const url = new URL("/dashboard/settings/integrations", requestUrl);
  url.searchParams.set("outlook", status);
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
    const state = createMicrosoftOAuthState({
      organizationId: context.organization.id,
      userId: user.id,
    });
    const authorizationUrl = getMicrosoftAuthorizationUrl({ state });

    return NextResponse.redirect(authorizationUrl);
  } catch {
    return settingsRedirect(request.url, "unavailable");
  }
}
