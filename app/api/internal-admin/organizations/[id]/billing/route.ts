import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { canViewInternalAdmin } from "@/lib/internal-access";
import { loadUserOrganizationContextWithAdmin } from "@/lib/auth/organization-context";
import { billingProviderConfigRequestSchema } from "@/lib/billing/validation";
import {
  testQontoConnection,
  storeQontoCredentials,
  setBillingProvider,
  loadBillingProviderConfig,
} from "@/lib/billing/credentials";

function jsonError(message: string, status: number, reason: string) {
  return NextResponse.json({ success: false, message, reason }, { status });
}

async function verifyInternalAdminAccess() {
  const supabase = await getSupabaseServerClient();
  if (!supabase) {
    return { authorized: false as const, response: jsonError("Operation indisponible.", 500, "supabase_unconfigured") };
  }

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { authorized: false as const, response: jsonError("Session requise.", 401, "session_missing") };
  }

  const adminSupabase = getSupabaseAdminClient();
  if (!adminSupabase) {
    return { authorized: false as const, response: jsonError("Operation indisponible.", 500, "service_role_unconfigured") };
  }

  const context = await loadUserOrganizationContextWithAdmin(user, adminSupabase);
  if (!canViewInternalAdmin(context)) {
    return { authorized: false as const, response: jsonError("Acces reserve a l'admin interne.", 403, "insufficient_role") };
  }

  return { authorized: true as const, adminSupabase };
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await verifyInternalAdminAccess();
  if (!auth.authorized) return auth.response;

  const { id: organizationId } = await params;

  const config = await loadBillingProviderConfig(
    auth.adminSupabase,
    organizationId,
  );

  return NextResponse.json({ success: true, ...config });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await verifyInternalAdminAccess();
  if (!auth.authorized) return auth.response;

  const { id: organizationId } = await params;

  const body: unknown = await request.json().catch(() => ({}));
  const parsedBody = billingProviderConfigRequestSchema.safeParse(body);

  if (!parsedBody.success) {
    return jsonError("Configuration invalide.", 400, "invalid_payload");
  }

  const { provider, qonto } = parsedBody.data;

  if (provider === "qonto" && qonto) {
    const baseUrl = qonto.api_base_url ?? undefined;

    const testResult = await testQontoConnection(
      qonto.api_login,
      qonto.api_secret_key,
      baseUrl,
    );

    if (!testResult.success) {
      return jsonError(
        `Échec du test de connexion Qonto: ${testResult.error}`,
        400,
        "qonto_test_failed",
      );
    }

    await storeQontoCredentials(
      auth.adminSupabase,
      organizationId,
      qonto.api_login,
      qonto.api_secret_key,
      baseUrl,
    );

    await setBillingProvider(auth.adminSupabase, organizationId, "qonto");
    const config = await loadBillingProviderConfig(auth.adminSupabase, organizationId);
    return NextResponse.json({ success: true, ...config });
  }

  if (provider === "none") {
    await setBillingProvider(auth.adminSupabase, organizationId, "none");
    const config = await loadBillingProviderConfig(auth.adminSupabase, organizationId);
    return NextResponse.json({ success: true, ...config });
  }

  return jsonError("Configuration invalide.", 400, "invalid_payload");
}
