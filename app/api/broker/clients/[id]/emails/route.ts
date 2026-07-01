import { NextResponse, type NextRequest } from "next/server";
import { brokerClientDisplayName } from "@/lib/broker/clients";
import { requireBrokerApiContext } from "@/lib/broker/server";
import {
  companyEmailDomain,
  getOutlookAccessForUser,
  searchMessagesForClient,
  type ClientSearchCriteria,
  type OutlookMessage,
} from "@/lib/email/outlook-read";
import type { BrokerClientRow } from "@/types/database";

export type ClientEmail = {
  id: string;
  subject: string;
  from: string;
  fromEmail: string;
  receivedAt: string;
  preview: string;
  hasAttachments: boolean;
  webLink: string;
  /** "direct" = client is a participant; "mention" = concerns the client (name/ref). */
  matchType: "direct" | "mention";
};

type RouteContext = { params: Promise<{ id: string }> };

function jsonError(message: string, status: number, reason: string) {
  return NextResponse.json({ message, reason, emails: [] }, { status });
}

/**
 * Emails concerning a client dossier — not only mail exchanged with the client's
 * address, but everything that mentions them: their name / company, their company
 * email domain, and their contract & claim references (e.g. an insurer's quote
 * that cites the policy number but not the client's email). Fetched live from the
 * connected Outlook mailbox. Optional `?q=` narrows with free text. Each result is
 * tagged "direct" (client is a participant) or "mention" (concerns them).
 */
export async function GET(request: NextRequest, ctx: RouteContext) {
  const auth = await requireBrokerApiContext();
  if (!auth.success) return jsonError(auth.message, auth.status, auth.reason);

  const { id } = await ctx.params;
  const q = request.nextUrl.searchParams.get("q")?.trim() || undefined;
  const admin = auth.adminSupabase;
  const orgId = auth.organizationId;

  const { data: clientRow } = await admin
    .from("broker_clients")
    .select("id, client_type, first_name, last_name, company_name, email")
    .eq("organization_id", orgId)
    .eq("id", id)
    .maybeSingle();
  const client = clientRow as Pick<
    BrokerClientRow,
    "id" | "client_type" | "first_name" | "last_name" | "company_name" | "email"
  > | null;
  if (!client) return jsonError("Dossier introuvable.", 404, "not_found");

  const access = await getOutlookAccessForUser(orgId, auth.user.id);
  if (!access) {
    return NextResponse.json({ emails: [], reason: "not_connected" });
  }

  // Gather every signal that identifies this client.
  const [{ data: contracts }, { data: claims }] = await Promise.all([
    admin
      .from("broker_contracts")
      .select("policy_number")
      .eq("organization_id", orgId)
      .eq("client_id", id)
      .not("policy_number", "is", null)
      .limit(50),
    admin
      .from("broker_claims")
      .select("reference")
      .eq("organization_id", orgId)
      .eq("client_id", id)
      .not("reference", "is", null)
      .limit(50),
  ]);

  const displayName = brokerClientDisplayName(client);
  const names = [displayName];
  if (
    client.company_name?.trim() &&
    client.company_name.trim() !== displayName
  ) {
    names.push(client.company_name.trim());
  }

  const references = [
    ...(contracts ?? []).map((c) => (c as { policy_number: string | null }).policy_number),
    ...(claims ?? []).map((c) => (c as { reference: string | null }).reference),
  ].filter((r): r is string => Boolean(r && r.trim()));

  const domain = companyEmailDomain(client.email, client.client_type === "company");

  const criteria: ClientSearchCriteria = {
    emails: client.email ? [client.email.trim().toLowerCase()] : [],
    names,
    references,
    domain,
  };

  if (
    criteria.emails.length === 0 &&
    criteria.names.length === 0 &&
    criteria.references.length === 0 &&
    !criteria.domain
  ) {
    return NextResponse.json({ emails: [], reason: "no_criteria" });
  }

  const messages = await searchMessagesForClient(access.accessToken, criteria, q);

  // Classify: is the client an actual participant, or merely mentioned?
  const emailSet = new Set(criteria.emails);
  const isDirect = (m: OutlookMessage): boolean => {
    if (m.fromEmail && emailSet.has(m.fromEmail)) return true;
    if (m.recipients.some((r) => emailSet.has(r))) return true;
    if (criteria.domain) {
      const at = `@${criteria.domain}`;
      if (m.fromEmail.endsWith(at)) return true;
      if (m.recipients.some((r) => r.endsWith(at))) return true;
    }
    return false;
  };

  const emails: ClientEmail[] = messages.map((m) => ({
    id: m.id,
    subject: m.subject,
    from: m.fromName || m.fromEmail,
    fromEmail: m.fromEmail,
    receivedAt: m.receivedDateTime,
    preview: m.bodyPreview,
    hasAttachments: m.hasAttachments,
    webLink: m.webLink,
    matchType: isDirect(m) ? "direct" : "mention",
  }));

  return NextResponse.json({ emails, mailbox: access.email });
}
