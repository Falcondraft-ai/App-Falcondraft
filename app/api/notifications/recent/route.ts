import { NextResponse } from "next/server";
import { requireCurrentUserContext } from "@/lib/auth/session";
import { getRecentNotifications } from "@/lib/data/supabase-app-data";

export async function GET() {
  try {
    const context = await requireCurrentUserContext();
    const organizationId = context.organization?.id ?? null;

    if (!organizationId) {
      return NextResponse.json({ notifications: [] });
    }

    const notifications = await getRecentNotifications(organizationId, 8, {
      userId: context.user.id,
      role: context.membership?.role,
      allowMemberCompanyVisibility:
        context.organization?.allow_member_company_visibility ?? true,
      scope: "mine",
    });

    return NextResponse.json({ notifications });
  } catch (error) {
    console.error("[notifications] failed:", error);
    return NextResponse.json(
      { notifications: [], error: "fetch_failed" },
      { status: 500 },
    );
  }
}
