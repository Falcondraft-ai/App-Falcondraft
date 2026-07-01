import { NextResponse, type NextRequest } from "next/server";
import { requireBrokerApiContext } from "@/lib/broker/server";
import {
  getOutlookAccessForUser,
  searchMessagesByParticipant,
} from "@/lib/email/outlook-read";

export type ClientEmail = {
  id: string;
  subject: string;
  from: string;
  fromEmail: string;
  receivedAt: string;
  preview: string;
  hasAttachments: boolean;
  webLink: string;
};

type RouteContext = { params: Promise<{ id: string }> };

function jsonError(message: string, status: number, reason: string) {
  return NextResponse.json({ message, reason, emails: [] }, { status });
}

/**
 * Emails of a client dossier — fetched live from the courtier's connected
 * Outlook mailbox by matching the client's email address (sender/recipient/cc).
 * Optional `?q=` narrows with a free-text search. No storage: the rattachement
 * is purely the address match, always fresh.
 */
export async function GET(request: NextRequest, ctx: RouteContext) {
  const auth = await requireBrokerApiContext();
  if (!auth.success) return jsonError(auth.message, auth.status, auth.reason);

  const { id } = await ctx.params;
  const q = request.nextUrl.searchParams.get("q")?.trim() || undefined;

  const { data: client } = await auth.adminSupabase
    .from("broker_clients")
    .select("email")
    .eq("organization_id", auth.organizationId)
    .eq("id", id)
    .maybeSingle();

  if (!client) return jsonError("Dossier introuvable.", 404, "not_found");
  if (!client.email) {
    return NextResponse.json({ emails: [], reason: "no_email" });
  }

  const access = await getOutlookAccessForUser(auth.organizationId, auth.user.id);
  if (!access) {
    return NextResponse.json({ emails: [], reason: "not_connected" });
  }

  const messages = await searchMessagesByParticipant(
    access.accessToken,
    client.email,
    q,
  );

  const emails: ClientEmail[] = messages.map((m) => ({
    id: m.id,
    subject: m.subject,
    from: m.fromName || m.fromEmail,
    fromEmail: m.fromEmail,
    receivedAt: m.receivedDateTime,
    preview: m.bodyPreview,
    hasAttachments: m.hasAttachments,
    webLink: m.webLink,
  }));

  return NextResponse.json({ emails, mailbox: access.email });
}
