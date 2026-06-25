import { NextResponse } from "next/server";
import { loadUserOrganizationContextWithAdmin } from "@/lib/auth/organization-context";
import {
  createMicrosoftOAuthState,
  getMicrosoftAuthorizationUrl,
  sanitizeReturnPath,
} from "@/lib/email/microsoft-oauth";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { getSupabaseServerClient } from "@/lib/supabase/server";

function settingsRedirect(
  requestUrl: string,
  status: string,
  basePath = "/dashboard/settings/integrations",
) {
  const url = new URL(basePath, requestUrl);
  url.searchParams.set("outlook", status);
  return NextResponse.redirect(url);
}

export async function GET(request: Request) {
  const returnTo = sanitizeReturnPath(
    new URL(request.url).searchParams.get("return"),
  );
  const basePath = returnTo ?? "/dashboard/settings/integrations";

  const supabase = await getSupabaseServerClient();

  if (!supabase) {
    return settingsRedirect(request.url, "unavailable", basePath);
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", basePath);
    return NextResponse.redirect(loginUrl);
  }

  const adminSupabase = getSupabaseAdminClient();

  if (!adminSupabase) {
    return settingsRedirect(request.url, "unavailable", basePath);
  }

  const context = await loadUserOrganizationContextWithAdmin(
    user,
    adminSupabase,
  );

  if (!context.organization || !context.membership) {
    return settingsRedirect(request.url, "forbidden", basePath);
  }

  try {
    const state = createMicrosoftOAuthState({
      organizationId: context.organization.id,
      userId: user.id,
      returnTo,
    });
    const authorizationUrl = getMicrosoftAuthorizationUrl({ state });

    return NextResponse.redirect(authorizationUrl);
  } catch {
    return settingsRedirect(request.url, "unavailable", basePath);
  }
}
