import { NextResponse } from "next/server";
import { requireActiveWorkspaceContext } from "@/lib/auth/session";
import { isBrokerWorkspace } from "@/lib/broker/access";
import { getBrokerRecentActivity } from "@/lib/broker/data";

export async function GET() {
  try {
    const context = await requireActiveWorkspaceContext();
    const organizationId = context.organization?.id ?? null;

    if (!organizationId || !isBrokerWorkspace(context.organization)) {
      return NextResponse.json({ notifications: [] });
    }

    const activity = await getBrokerRecentActivity(organizationId, 10);

    return NextResponse.json({
      notifications: activity.map((e) => ({
        id: e.id,
        type: e.type,
        description: e.description,
        clientId: e.client_id,
        createdAt: e.created_at,
      })),
    });
  } catch (error) {
    console.error("[courtier-notifications] failed:", error);
    return NextResponse.json(
      { notifications: [], error: "fetch_failed" },
      { status: 500 },
    );
  }
}
