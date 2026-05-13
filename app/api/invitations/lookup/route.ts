import { NextResponse, type NextRequest } from "next/server";
import { lookupInvitationByToken } from "@/lib/invitations/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");
  const adminSupabase = getSupabaseAdminClient();

  if (!adminSupabase) {
    return NextResponse.json(
      {
        success: false,
        message: "Service d’invitation indisponible.",
        reason: "service_role_unconfigured",
      },
      { status: 500 },
    );
  }

  const lookup = await lookupInvitationByToken(adminSupabase, token);

  return NextResponse.json({
    success: true,
    ...lookup,
  });
}
