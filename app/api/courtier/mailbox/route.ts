import { NextResponse, type NextRequest } from "next/server";
import { brokerClientDisplayName } from "@/lib/broker/clients";
import { getActiveBrokerProfile } from "@/lib/broker/profiles";
import { requireBrokerApiContext } from "@/lib/broker/server";
import { getMailboxClient } from "@/lib/email/mailbox-resolver";
import type { BrokerClientRow } from "@/types/database";

export const runtime = "nodejs";
export const maxDuration = 120;

/** Fenêtre par défaut : de quoi couvrir une semaine de courrier. */
const DEFAULT_DAYS = 14;
const MAX_DAYS = 180;
const DEFAULT_LIMIT = 80;
const MAX_LIMIT = 300;

export type MailboxMessage = {
  id: string;
  from: string;
  fromEmail: string;
  subject: string;
  receivedAt: string;
  preview: string;
  hasAttachments: boolean;
  /** Dossier auquel cet email est rattaché, s'il l'est. */
  linkedClient: { id: string; name: string } | null;
  /**
   * L'expéditeur correspond à un dossier du portefeuille, sans que l'email
   * lui-même ait été rattaché. Distinction utile : « on connaît la personne »
   * n'est pas « c'est classé ».
   */
  knownSender: { id: string; name: string } | null;
  /** L'assistant a déjà passé cet email en revue. */
  reviewed: boolean;
};

function jsonError(message: string, status: number, reason: string) {
  return NextResponse.json({ message, reason, messages: [] }, { status });
}

/**
 * La boîte email du profil actif, telle quelle.
 *
 * Lecture IMAP pure : AUCUN appel à l'IA, donc aucun coût par consultation. Le
 * courtier voit tout son courrier, y compris ce que le briefing a écarté, et
 * distingue d'un coup d'œil ce qui est rattaché à un dossier de ce qui ne l'est
 * pas. C'est le complément du briefing, qui lui ne montre que ce qui mérite une
 * action.
 */
export async function GET(request: NextRequest) {
  const auth = await requireBrokerApiContext();
  if (!auth.success) return jsonError(auth.message, auth.status, auth.reason);

  const params = request.nextUrl.searchParams;
  const days = Math.min(
    Math.max(Number(params.get("days")) || DEFAULT_DAYS, 1),
    MAX_DAYS,
  );
  const limit = Math.min(
    Math.max(Number(params.get("limit")) || DEFAULT_LIMIT, 1),
    MAX_LIMIT,
  );
  const query = params.get("q")?.trim().toLowerCase() || "";

  const profile = await getActiveBrokerProfile(auth.organizationId);
  const mailbox = await getMailboxClient({
    organizationId: auth.organizationId,
    userId: auth.user.id,
    profileId: profile?.id ?? null,
    adminSupabase: auth.adminSupabase,
  });
  if (!mailbox) {
    return NextResponse.json({ messages: [], reason: "not_connected" });
  }

  let raw;
  try {
    const since = new Date(Date.now() - days * 86_400_000).toISOString();
    // Ordre décroissant : une boîte mail se lit du plus récent au plus ancien.
    // Rien ne reprend derrière, donc pas besoin de l'ordre chronologique.
    const page = await mailbox.listInbox(since, limit, { order: "desc" });
    raw = page.messages;
  } catch (error) {
    console.error("[mailbox] lecture impossible:", error);
    return jsonError(
      "La boîte email n’a pas répondu. Réessayez dans un instant.",
      502,
      "mailbox_unavailable",
    );
  } finally {
    await mailbox.close();
  }

  // Rattachements déjà connus : un email vu par le briefing porte le dossier
  // qu'il concerne. On lit à l'échelle de l'organisation — un dossier est
  // commun au cabinet, peu importe qui a reçu l'email.
  const ids = raw.map((m) => m.id);
  const linkedByMessage = new Map<string, string>();
  const reviewed = new Set<string>();
  if (ids.length > 0) {
    const { data: items } = await auth.adminSupabase
      .from("broker_email_items")
      .select("graph_message_id, suggested_client_id")
      .eq("organization_id", auth.organizationId)
      .in("graph_message_id", ids);
    for (const item of items ?? []) {
      reviewed.add(item.graph_message_id);
      if (item.suggested_client_id) {
        linkedByMessage.set(item.graph_message_id, item.suggested_client_id);
      }
    }
  }

  const { data: clientRows } = await auth.adminSupabase
    .from("broker_clients")
    .select("id, client_type, first_name, last_name, company_name, email")
    .eq("organization_id", auth.organizationId)
    .is("archived_at", null)
    .limit(2000);

  const clients = (clientRows ?? []) as Pick<
    BrokerClientRow,
    "id" | "client_type" | "first_name" | "last_name" | "company_name" | "email"
  >[];
  const nameById = new Map<string, string>();
  const clientByEmail = new Map<string, { id: string; name: string }>();
  for (const c of clients) {
    const name = brokerClientDisplayName(c as BrokerClientRow);
    nameById.set(c.id, name);
    if (c.email) {
      clientByEmail.set(c.email.trim().toLowerCase(), { id: c.id, name });
    }
  }

  let messages: MailboxMessage[] = raw.map((m) => {
    const linkedId = linkedByMessage.get(m.id);
    const known = clientByEmail.get(m.fromEmail) ?? null;
    return {
      id: m.id,
      from: m.fromName || m.fromEmail,
      fromEmail: m.fromEmail,
      subject: m.subject,
      receivedAt: m.receivedDateTime,
      preview: m.bodyPreview,
      hasAttachments: m.hasAttachments,
      linkedClient:
        linkedId && nameById.has(linkedId)
          ? { id: linkedId, name: nameById.get(linkedId)! }
          : null,
      knownSender: linkedId ? null : known,
      reviewed: reviewed.has(m.id),
    };
  });

  // Filtre local : la recherche IMAP plein texte est lente et inégale d'un
  // serveur à l'autre. Sur une fenêtre déjà chargée, filtrer ici est immédiat.
  if (query) {
    messages = messages.filter((m) =>
      [m.subject, m.from, m.fromEmail, m.preview].some((f) =>
        f.toLowerCase().includes(query),
      ),
    );
  }

  return NextResponse.json({
    messages,
    mailbox: mailbox.address,
    profile: profile?.display_name ?? null,
  });
}
