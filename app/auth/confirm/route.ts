import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { getSupabaseServerClient } from "@/lib/supabase/server";

const supportedOtpTypes = new Set(["recovery", "email"]);

function getSafeNextPath(value: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return "/dashboard";
  }

  return value;
}

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const tokenHash = requestUrl.searchParams.get("token_hash");
  const type = requestUrl.searchParams.get("type");
  const nextPath = getSafeNextPath(requestUrl.searchParams.get("next"));
  const errorUrl = new URL("/auth/auth-code-error", request.url);

  if (!tokenHash || !type || !supportedOtpTypes.has(type)) {
    return NextResponse.redirect(errorUrl);
  }

  const supabase = await getSupabaseServerClient();

  if (!supabase) {
    return NextResponse.redirect(errorUrl);
  }

  const { error } = await supabase.auth.verifyOtp({
    token_hash: tokenHash,
    type: type as EmailOtpType,
  });

  if (error) {
    return NextResponse.redirect(errorUrl);
  }

  return NextResponse.redirect(new URL(nextPath, request.url));
}
