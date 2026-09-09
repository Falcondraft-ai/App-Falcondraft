import { NextResponse, type NextRequest } from "next/server";
import { canCreateWorkspaceRecords } from "@/lib/auth/workspace-permissions";
import { getActiveBrokerProfile } from "@/lib/broker/profiles";
import { requireBrokerApiContext } from "@/lib/broker/server";
import { sanitizeEmailHtml } from "@/lib/email/html";
import { getMailboxClient } from "@/lib/email/mailbox-resolver";

export const runtime = "nodejs";
export const maxDuration = 60;

export type MailboxMessageDetail = {
  id: string;
  /** Corps en texte : repli sûr et toujours présent. */
  body: string;
  /** Corps HTML ASSAINI, prêt à être rendu dans une iframe sandbox. */
  html: string | null;
  attachments: {
    id: string;
    name: string;
    contentType: string;
    size: number;
  }[];
};

function jsonError(message: string, status: number, reason: string) {
  return NextResponse.json({ message, reason }, { status });
}

/**
 * Le contenu complet d'un email, à la demande.
 *
 * Le HTML est renvoyé ASSAINI (voir lib/email/html.ts) : liste blanche de
 * balises, aucun script, aucun cadre. Le client le rend dans une iframe
 * sandbox — deuxième barrière. Les images distantes s'affichent telles quelles,
 * comme dans n'importe quel logiciel de messagerie.
 */
export async function GET(request: NextRequest) {
  const auth = await requireBrokerApiContext();
  if (!auth.success) return jsonError(auth.message, auth.status, auth.reason);

  const id = request.nextUrl.searchParams.get("id")?.trim();
  if (!id) return jsonError("Email manquant.", 400, "invalid_input");

  const profile = await getActiveBrokerProfile(auth.organizationId);
  const mailbox = await getMailboxClient({
    organizationId: auth.organizationId,
    userId: auth.user.id,
    profileId: profile?.id ?? null,
    adminSupabase: auth.adminSupabase,
  });
  if (!mailbox) return jsonError("Boîte non connectée.", 409, "not_connected");

  try {
    const [body, attachments] = await Promise.all([
      mailbox.getBody(id),
      mailbox.listAttachments(id),
    ]);

    if (!body && attachments.length === 0) {
      return jsonError("Email introuvable dans la boîte.", 404, "not_found");
    }

    const sanitized = body?.html ? sanitizeEmailHtml(body.html) : null;

    const detail: MailboxMessageDetail = {
      id,
      body: body?.body ?? "",
      html: sanitized?.html ?? null,
      attachments: attachments.map((a) => ({
        id: a.id,
        name: a.name,
        contentType: a.contentType,
        size: a.size,
      })),
    };
    return NextResponse.json(detail);
  } catch (error) {
    console.error("[mailbox] lecture du message impossible:", error);
    return jsonError(
      "Le contenu de cet email n’a pas pu être chargé.",
      502,
      "read_failed",
    );
  } finally {
    await mailbox.close();
  }
}

/**
 * Met un email à la corbeille de la messagerie.
 *
 * Le courtier reçoit de la publicité et des notifications de plateformes qu'il
 * ne veut ni traiter ni revoir. « Écarter » ne faisait que masquer la ligne du
 * briefing ; l'email restait dans la boîte, et revenait au briefing suivant.
 *
 * La suppression s'arrête à la corbeille du fournisseur : celle-ci se vide
 * seule selon sa propre rétention, et reste le seul endroit où le courtier a
 * l'habitude d'aller repêcher un message. On ne réinvente pas de corbeille
 * maison — deux corbeilles qui divergent valent moins que zéro.
 *
 * Effet de bord assumé : les lignes de briefing portant ce message passent en
 * « écarté ». Sans ça, le briefing continuerait de proposer des actions sur un
 * email qui n'existe plus.
 */
export async function DELETE(request: NextRequest) {
  const auth = await requireBrokerApiContext();
  if (!auth.success) return jsonError(auth.message, auth.status, auth.reason);
  if (!canCreateWorkspaceRecords(auth.context.membership?.role)) {
    return jsonError(
      "Votre rôle ne permet pas de supprimer un email.",
      403,
      "insufficient_role",
    );
  }

  const id = request.nextUrl.searchParams.get("id")?.trim();
  if (!id) return jsonError("Email manquant.", 400, "invalid_input");

  const profile = await getActiveBrokerProfile(auth.organizationId);
  const mailbox = await getMailboxClient({
    organizationId: auth.organizationId,
    userId: auth.user.id,
    profileId: profile?.id ?? null,
    adminSupabase: auth.adminSupabase,
  });
  if (!mailbox) return jsonError("Boîte non connectée.", 409, "not_connected");

  let deleted = false;
  try {
    deleted = await mailbox.deleteMessage(id);
  } catch (error) {
    console.error("[mailbox] suppression impossible:", error);
  } finally {
    await mailbox.close();
  }

  if (!deleted) {
    return jsonError(
      "Cet email n’a pas pu être supprimé. Réessayez dans un instant.",
      502,
      "delete_failed",
    );
  }

  // Le briefing ne doit plus rien proposer sur un message disparu. On écarte
  // à l'échelle de l'organisation : le même email a pu être vu par plusieurs
  // briefings successifs.
  const { error } = await auth.adminSupabase
    .from("broker_email_items")
    .update({ relevance: "excluded", status: "reviewed", updated_at: new Date().toISOString() })
    .eq("organization_id", auth.organizationId)
    .eq("graph_message_id", id);
  if (error) {
    // La suppression, elle, a bien eu lieu : on ne la présente pas comme un
    // échec pour un ménage de second plan.
    console.error("[mailbox] nettoyage du briefing impossible:", error.message);
  }

  return NextResponse.json({ success: true });
}
