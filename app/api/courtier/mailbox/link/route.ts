import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { canCreateWorkspaceRecords } from "@/lib/auth/workspace-permissions";
import { brokerClientDisplayName } from "@/lib/broker/clients";
import { getActiveBrokerProfile } from "@/lib/broker/profiles";
import { logBrokerActivity, requireBrokerApiContext } from "@/lib/broker/server";
import type { BrokerClientRow } from "@/types/database";

export const runtime = "nodejs";

const schema = z.object({
  messageId: z.string().trim().min(1).max(998),
  /** null détache l'email du dossier. */
  clientId: z.string().uuid().nullable(),
  from: z.string().trim().max(320).optional(),
  fromName: z.string().trim().max(200).optional(),
  subject: z.string().trim().max(500).optional(),
  receivedAt: z.string().trim().max(64).optional(),
  hasAttachments: z.boolean().optional(),
});

function jsonError(message: string, status: number, reason: string) {
  return NextResponse.json({ success: false, message, reason }, { status });
}

/**
 * Range un email de la boîte dans un dossier client, ou l'en retire.
 *
 * Le courtier voit tout son courrier dans « Vos emails », y compris ce que
 * l'assistant n'a jamais analysé : il doit pouvoir classer sans attendre un
 * briefing. Le rattachement se fait sur la ligne du briefing quand elle existe
 * déjà — sinon on en crée une, sans briefing (`digest_id` nul).
 *
 * Idempotent : reclasser le même email met la ligne à jour, il n'y en a jamais
 * deux (index unique de la migration 0060).
 */
export async function POST(request: NextRequest) {
  const auth = await requireBrokerApiContext();
  if (!auth.success) return jsonError(auth.message, auth.status, auth.reason);
  if (!canCreateWorkspaceRecords(auth.context.membership?.role)) {
    return jsonError("Votre rôle ne permet pas cette action.", 403, "insufficient_role");
  }

  const body: unknown = await request.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  if (!parsed.success) return jsonError("Requête invalide.", 400, "invalid_input");
  const input = parsed.data;

  // Le dossier doit appartenir à l'organisation : sans ce contrôle, une requête
  // forgée rangerait un email dans le portefeuille d'un autre cabinet.
  let client: BrokerClientRow | null = null;
  if (input.clientId) {
    const { data } = await auth.adminSupabase
      .from("broker_clients")
      .select("*")
      .eq("organization_id", auth.organizationId)
      .eq("id", input.clientId)
      .maybeSingle();
    if (!data) return jsonError("Dossier introuvable.", 404, "client_not_found");
    client = data as BrokerClientRow;
  }

  const profile = await getActiveBrokerProfile(auth.organizationId);
  const profileId = profile?.id ?? null;
  const now = new Date().toISOString();

  // Ligne existante ? Le briefing a pu déjà voir cet email : on la met à jour
  // plutôt que d'en créer une seconde qui le ferait apparaître en double.
  let existing = auth.adminSupabase
    .from("broker_email_items")
    .select("id, digest_id")
    .eq("organization_id", auth.organizationId)
    .eq("graph_message_id", input.messageId);
  existing = profileId
    ? existing.eq("profile_id", profileId)
    : existing.is("profile_id", null);
  const { data: found } = await existing
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (found) {
    const { error } = await auth.adminSupabase
      .from("broker_email_items")
      .update({ suggested_client_id: input.clientId, updated_at: now })
      .eq("organization_id", auth.organizationId)
      .eq("id", found.id);
    if (error) {
      console.error("[mailbox] rattachement impossible:", error.message);
      return jsonError("Le rattachement a échoué.", 500, "update_failed");
    }
  } else {
    const { error } = await auth.adminSupabase.from("broker_email_items").insert({
      organization_id: auth.organizationId,
      // Rattachement manuel : il n'appartient à aucun briefing.
      digest_id: null,
      user_id: auth.user.id,
      profile_id: profileId,
      graph_message_id: input.messageId,
      from_name: input.fromName || null,
      from_email: input.from || null,
      subject: input.subject || null,
      received_at: input.receivedAt || null,
      // Rangé à la main : le courtier a tranché, ce n'est pas « à vérifier ».
      relevance: "relevant",
      suggested_client_id: input.clientId,
      has_attachments: input.hasAttachments ?? false,
      status: "reviewed",
      updated_at: now,
    });
    if (error) {
      console.error("[mailbox] création du rattachement impossible:", error.message);
      return jsonError(
        "Le rattachement a échoué. Vérifiez que la migration 0060 est appliquée.",
        500,
        "insert_failed",
      );
    }
  }

  if (client) {
    await logBrokerActivity(auth.adminSupabase, {
      organizationId: auth.organizationId,
      clientId: client.id,
      userId: auth.user.id,
      profileId,
      type: "email_linked",
      description: `Email rattaché au dossier : « ${input.subject || "(sans objet)"} ».`,
      metadata: { message_id: input.messageId, from: input.from ?? null },
    });
  }

  return NextResponse.json({
    success: true,
    client: client
      ? { id: client.id, name: brokerClientDisplayName(client) }
      : null,
  });
}
