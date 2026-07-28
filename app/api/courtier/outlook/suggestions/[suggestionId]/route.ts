import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { canCreateWorkspaceRecords } from "@/lib/auth/workspace-permissions";
import { brokerClientDisplayName } from "@/lib/broker/clients";
import { BROKER_FILES_BUCKET, sanitizeFileName } from "@/lib/broker/documents";
import {
  adjustOrganizationStorage,
  logBrokerActivity,
  requireBrokerApiContext,
} from "@/lib/broker/server";
import { runContractExtraction } from "@/lib/broker/contract-ingest";
import { runQuoteExtraction } from "@/lib/broker/quote-ingest";
import { computeStorageUsage } from "@/lib/broker/storage";
import {
  getFileAttachmentBytes,
  getOutlookAccessForUser,
} from "@/lib/email/outlook-read";
import { createOutlookDraft } from "@/lib/email/outlook-drafts";
import type {
  BrokerClientRow,
  BrokerEmailItemRow,
  BrokerEmailSuggestionRow,
  Database,
} from "@/types/database";

// Accepting an action can download an attachment, store it and read a quote.
export const runtime = "nodejs";
export const maxDuration = 60;

type RouteContext = { params: Promise<{ suggestionId: string }> };

const schema = z.object({
  action: z.enum(["accept", "reject"]),
  /**
   * Dossier picked by the broker on the action itself (briefing). Overrides the
   * dossier guessed at digest time — an attachment can always be filed where
   * the broker says, without having to re-link the whole email first.
   */
  clientId: z.string().uuid().optional(),
});

function jsonError(message: string, status: number, reason: string) {
  return NextResponse.json({ success: false, message, reason }, { status });
}

function str(payload: Record<string, unknown>, key: string): string | null {
  const v = payload[key];
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

/** Accepts a date only in strict ISO day form — never stores a guessed date. */
function isoDate(payload: Record<string, unknown>, key: string): string | null {
  const raw = str(payload, key);
  if (!raw || !/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null;
  const date = new Date(`${raw}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10) === raw ? raw : null;
}

export async function POST(request: NextRequest, ctx: RouteContext) {
  const auth = await requireBrokerApiContext();
  if (!auth.success) return jsonError(auth.message, auth.status, auth.reason);

  if (!canCreateWorkspaceRecords(auth.context.membership?.role)) {
    return jsonError("Action non autorisée pour votre rôle.", 403, "insufficient_role");
  }

  const { suggestionId } = await ctx.params;
  const body: unknown = await request.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  if (!parsed.success) return jsonError("Requête invalide.", 400, "invalid_payload");

  const admin = auth.adminSupabase;
  const orgId = auth.organizationId;
  const userId = auth.user.id;

  const { data: suggestionRow } = await admin
    .from("broker_email_suggestions")
    .select("*")
    .eq("organization_id", orgId)
    .eq("user_id", userId)
    .eq("id", suggestionId)
    .maybeSingle();

  const suggestion = suggestionRow as BrokerEmailSuggestionRow | null;
  if (!suggestion) return jsonError("Action introuvable.", 404, "not_found");
  if (suggestion.status !== "pending") {
    return jsonError("Cette action a déjà été traitée.", 409, "already_handled");
  }

  if (parsed.data.action === "reject") {
    await admin
      .from("broker_email_suggestions")
      .update({ status: "rejected", updated_at: new Date().toISOString() })
      .eq("id", suggestion.id);
    return NextResponse.json({ success: true, status: "rejected" });
  }

  // --- ACCEPT: execute the action ---------------------------------------
  const { data: itemRow } = await admin
    .from("broker_email_items")
    .select("*")
    .eq("organization_id", orgId)
    .eq("id", suggestion.item_id)
    .maybeSingle();
  const item = itemRow as BrokerEmailItemRow | null;
  if (!item) return jsonError("Email introuvable.", 404, "item_not_found");

  const payload = suggestion.payload ?? {};

  // A dossier explicitly picked in the briefing wins over the one guessed at
  // digest time — but only after checking it belongs to this organisation.
  const overrideClientId = parsed.data.clientId ?? null;
  if (overrideClientId) {
    const { data: target } = await admin
      .from("broker_clients")
      .select("id")
      .eq("organization_id", orgId)
      .eq("id", overrideClientId)
      .maybeSingle();
    if (!target) return jsonError("Dossier introuvable.", 404, "client_not_found");
  }

  const resolvedClientId =
    overrideClientId ?? str(payload, "client_id") ?? item.suggested_client_id ?? null;

  async function markDone(result: Record<string, unknown>) {
    await admin
      .from("broker_email_suggestions")
      .update({
        status: "done",
        result,
        updated_at: new Date().toISOString(),
      })
      .eq("id", suggestion!.id);
  }

  try {
    // Keep the email tied to the dossier it acts on, so it always appears in
    // that dossier's emails — even when the sender isn't the client (create_client
    // links the item itself once the new dossier exists).
    if (
      suggestion.type !== "create_client" &&
      resolvedClientId &&
      item.suggested_client_id !== resolvedClientId
    ) {
      await admin
        .from("broker_email_items")
        .update({
          suggested_client_id: resolvedClientId,
          updated_at: new Date().toISOString(),
        })
        .eq("organization_id", orgId)
        .eq("id", item.id);
    }

    if (suggestion.type === "create_client") {
      const clientType = str(payload, "company_name") ? "company" : "individual";
      const { data: created, error } = await admin
        .from("broker_clients")
        .insert({
          organization_id: orgId,
          created_by: userId,
          client_type: clientType,
          first_name: str(payload, "first_name"),
          last_name: str(payload, "last_name"),
          company_name: str(payload, "company_name"),
          email: str(payload, "email"),
          // Identity read from the email goes to its own column, so the dossier
          // is usable straight away instead of hiding everything in a note.
          phone: str(payload, "phone"),
          address: str(payload, "address"),
          postal_code: str(payload, "postal_code"),
          city: str(payload, "city"),
          date_of_birth: isoDate(payload, "date_of_birth"),
          birth_country: str(payload, "birth_country"),
          insurance_type: str(payload, "insurance_type"),
          notes: str(payload, "notes"),
          status: "new",
        })
        .select("*")
        .single();
      if (error || !created) {
        throw new Error(error?.message ?? "client_insert_failed");
      }
      const newClient = created as BrokerClientRow;

      // Point the email item and its sibling suggestions at the new client.
      await admin
        .from("broker_email_items")
        .update({
          suggested_client_id: newClient.id,
          updated_at: new Date().toISOString(),
        })
        .eq("id", item.id);

      const { data: siblings } = await admin
        .from("broker_email_suggestions")
        .select("id, payload, type")
        .eq("organization_id", orgId)
        .eq("item_id", item.id)
        .neq("id", suggestion.id);
      for (const sib of (siblings ?? []) as Pick<
        BrokerEmailSuggestionRow,
        "id" | "payload" | "type"
      >[]) {
        if (sib.payload?.client_id) continue;
        await admin
          .from("broker_email_suggestions")
          .update({
            payload: { ...sib.payload, client_id: newClient.id },
            updated_at: new Date().toISOString(),
          })
          .eq("id", sib.id);
      }

      await logBrokerActivity(admin, {
        organizationId: orgId,
        clientId: newClient.id,
        userId,
        type: "client_created",
        description: `Dossier créé depuis un email — ${brokerClientDisplayName(newClient)}.`,
      });
      await markDone({ client_id: newClient.id });
      return NextResponse.json({
        success: true,
        status: "done",
        clientId: newClient.id,
        // Returned so the briefing can list the new dossier immediately,
        // without a page reload.
        clientName: brokerClientDisplayName(newClient),
      });
    }

    if (suggestion.type === "draft_reply") {
      const to = str(payload, "to");
      if (!to) throw new Error("missing_recipient");
      const draft = await createOutlookDraft({
        organizationId: orgId,
        userId,
        to,
        subject: str(payload, "subject") ?? `RE: ${item.subject ?? ""}`,
        body: str(payload, "body") ?? "",
      });
      await markDone({ draft_id: draft.draftId });
      return NextResponse.json({ success: true, status: "done" });
    }

    if (suggestion.type === "attach_document") {
      if (!resolvedClientId) {
        return jsonError(
          "Rattachez d’abord cet email à un dossier (ou créez-le) avant de ranger la pièce jointe.",
          409,
          "client_required",
        );
      }
      const access = await getOutlookAccessForUser(orgId, userId);
      if (!access) {
        return jsonError("Connexion Outlook indisponible.", 409, "not_connected");
      }
      const messageId = str(payload, "graph_message_id");
      const attachmentId = str(payload, "graph_attachment_id");
      if (!messageId || !attachmentId) throw new Error("missing_attachment_ref");

      const file = await getFileAttachmentBytes(
        access.accessToken,
        messageId,
        attachmentId,
      );
      if (!file) throw new Error("attachment_download_failed");

      const buffer = Buffer.from(file.contentBase64, "base64");
      const usage = computeStorageUsage(auth.context.organization);
      if (usage.usedBytes + buffer.byteLength > usage.limitBytes) {
        return jsonError("Quota de stockage atteint.", 413, "storage_quota_exceeded");
      }

      const fileName = str(payload, "file_name") ?? file.name;
      const path = `${orgId}/${resolvedClientId}/${crypto.randomUUID()}-${sanitizeFileName(fileName)}`;
      const { error: uploadError } = await admin.storage
        .from(BROKER_FILES_BUCKET)
        .upload(path, buffer, {
          contentType: str(payload, "content_type") ?? file.contentType,
          upsert: false,
        });
      if (uploadError) throw new Error(uploadError.message);

      const category = str(payload, "document_category") ?? "other";
      const { data: document, error: docError } = await admin
        .from("broker_documents")
        .insert({
          organization_id: orgId,
          client_id: resolvedClientId,
          uploaded_by: userId,
          category,
          title: fileName,
          file_name: fileName,
          storage_path: path,
          mime_type: str(payload, "content_type") ?? file.contentType,
          size_bytes: buffer.byteLength,
          status: "stored",
        })
        .select("id")
        .single();
      if (docError || !document) {
        await admin.storage.from(BROKER_FILES_BUCKET).remove([path]);
        throw new Error(docError?.message ?? "document_insert_failed");
      }

      await adjustOrganizationStorage(admin, orgId, buffer.byteLength);
      await logBrokerActivity(admin, {
        organizationId: orgId,
        clientId: resolvedClientId,
        userId,
        type: "document_added",
        description: `Pièce jointe rangée depuis un email : ${fileName}.`,
        metadata: { category, size_bytes: buffer.byteLength },
      });

      // A company quote is not just a file in the GED: it must appear under
      // « Devis compagnie », so it can be compared, validated and used for the
      // devoir de conseil. Same path as a quote imported by hand.
      let quoteId: string | null = null;
      if (category === "company_quote") {
        const { data: quote, error: quoteError } = await admin
          .from("broker_quotes")
          .insert({
            organization_id: orgId,
            client_id: resolvedClientId,
            created_by: userId,
            document_id: document.id,
            extraction_status: "pending",
          })
          .select("id")
          .single();

        if (quoteError || !quote) {
          // The document is safely filed — surface the miss instead of losing
          // the whole action.
          console.error(
            "[outlook] quote creation from attachment failed:",
            quoteError?.message,
          );
        } else {
          quoteId = quote.id;
          await logBrokerActivity(admin, {
            organizationId: orgId,
            clientId: resolvedClientId,
            userId,
            type: "quote_imported",
            description: "Devis compagnie reçu par email — à vérifier.",
            metadata: { quote_id: quote.id },
          });
          // Best effort: pre-fill insurer, premium and guarantees. If the read
          // fails the quote simply stays « à compléter ».
          await runQuoteExtraction({
            adminSupabase: admin,
            organizationId: orgId,
            clientId: resolvedClientId,
            quoteId: quote.id,
            userId,
          }).catch(() => null);
        }
      }

      // Same for a contract: it belongs in « Contrats », where its renewal date
      // is tracked — not as a loose file in the GED.
      let contractId: string | null = null;
      if (category === "contract") {
        const { data: contract, error: contractError } = await admin
          .from("broker_contracts")
          .insert({
            organization_id: orgId,
            client_id: resolvedClientId,
            created_by: userId,
            document_id: document.id,
            status: "active",
          })
          .select("id")
          .single();

        if (contractError || !contract) {
          console.error(
            "[outlook] contract creation from attachment failed:",
            contractError?.message,
          );
        } else {
          contractId = contract.id;
          await logBrokerActivity(admin, {
            organizationId: orgId,
            clientId: resolvedClientId,
            userId,
            type: "contract_created",
            description: "Contrat reçu par email — à vérifier.",
            metadata: { contract_id: contract.id },
          });
          await runContractExtraction({
            adminSupabase: admin,
            organizationId: orgId,
            clientId: resolvedClientId,
            contractId: contract.id,
            userId,
          }).catch(() => null);
        }
      }

      await markDone({
        broker_document_id: document.id,
        ...(quoteId ? { broker_quote_id: quoteId } : {}),
        ...(contractId ? { broker_contract_id: contractId } : {}),
      });
      return NextResponse.json({
        success: true,
        status: "done",
        quoteId,
        contractId,
      });
    }

    if (suggestion.type === "update_client") {
      if (!resolvedClientId) {
        return jsonError(
          "Rattachez d’abord cet email à un dossier avant de le mettre à jour.",
          409,
          "client_required",
        );
      }
      const update: Database["public"]["Tables"]["broker_clients"]["Update"] = {
        updated_at: new Date().toISOString(),
      };
      const phone = str(payload, "phone");
      if (phone) update.phone = phone;
      const address = str(payload, "address");
      if (address) update.address = address;
      const postalCode = str(payload, "postal_code");
      if (postalCode) update.postal_code = postalCode;
      const city = str(payload, "city");
      if (city) update.city = city;
      const email = str(payload, "email");
      if (email) update.email = email;
      const dateOfBirth = isoDate(payload, "date_of_birth");
      if (dateOfBirth) update.date_of_birth = dateOfBirth;
      const birthCountry = str(payload, "birth_country");
      if (birthCountry) update.birth_country = birthCountry;
      if (Object.keys(update).length === 1) {
        return jsonError("Rien à mettre à jour.", 400, "nothing_to_update");
      }
      const { error } = await admin
        .from("broker_clients")
        .update(update)
        .eq("organization_id", orgId)
        .eq("id", resolvedClientId);
      if (error) throw new Error(error.message);
      await logBrokerActivity(admin, {
        organizationId: orgId,
        clientId: resolvedClientId,
        userId,
        type: "client_updated",
        description: "Coordonnées mises à jour depuis un email.",
      });
      await markDone({ client_id: resolvedClientId });
      return NextResponse.json({ success: true, status: "done" });
    }

    if (suggestion.type === "declare_claim") {
      if (!resolvedClientId) {
        return jsonError(
          "Rattachez d’abord cet email à un dossier avant de déclarer le sinistre.",
          409,
          "client_required",
        );
      }
      const { data: claim, error } = await admin
        .from("broker_claims")
        .insert({
          organization_id: orgId,
          client_id: resolvedClientId,
          created_by: userId,
          claim_type: str(payload, "claim_type"),
          description: str(payload, "description"),
          status: "declared",
          declaration_date: new Date().toISOString().slice(0, 10),
        })
        .select("id")
        .single();
      if (error || !claim) throw new Error(error?.message ?? "claim_insert_failed");
      await logBrokerActivity(admin, {
        organizationId: orgId,
        clientId: resolvedClientId,
        userId,
        type: "claim_declared",
        description: "Sinistre pré-rempli depuis un email.",
        metadata: { claim_id: claim.id },
      });
      await markDone({ claim_id: claim.id });
      return NextResponse.json({ success: true, status: "done", claimId: claim.id });
    }

    if (suggestion.type === "flag_renewal") {
      if (resolvedClientId) {
        await logBrokerActivity(admin, {
          organizationId: orgId,
          clientId: resolvedClientId,
          userId,
          type: "note_added",
          description:
            str(payload, "note") ?? "Échéance signalée depuis un email.",
        });
      }
      await markDone({ flagged: true });
      return NextResponse.json({ success: true, status: "done" });
    }

    if (suggestion.type === "add_note") {
      if (!resolvedClientId) {
        return jsonError(
          "Rattachez d’abord cet email à un dossier avant d’y ajouter une note.",
          409,
          "client_required",
        );
      }
      const note = str(payload, "note");
      if (!note) throw new Error("empty_note");
      // Append to the dossier's internal notes (dated) — never overwrite.
      const { data: clientRow } = await admin
        .from("broker_clients")
        .select("notes")
        .eq("organization_id", orgId)
        .eq("id", resolvedClientId)
        .maybeSingle();
      const existing = (clientRow?.notes ?? "").trim();
      const stamp = new Date().toLocaleDateString("fr-FR");
      const combined = existing
        ? `${existing}\n\n[${stamp}] ${note}`
        : `[${stamp}] ${note}`;
      const { error } = await admin
        .from("broker_clients")
        .update({ notes: combined, updated_at: new Date().toISOString() })
        .eq("organization_id", orgId)
        .eq("id", resolvedClientId);
      if (error) throw new Error(error.message);
      await logBrokerActivity(admin, {
        organizationId: orgId,
        clientId: resolvedClientId,
        userId,
        type: "note_added",
        description: "Information ajoutée au dossier depuis un email.",
      });
      await markDone({ client_id: resolvedClientId });
      return NextResponse.json({ success: true, status: "done" });
    }

    return jsonError("Type d’action inconnu.", 400, "unknown_type");
  } catch (error) {
    console.error("[outlook] suggestion execution failed:", error);
    await admin
      .from("broker_email_suggestions")
      .update({ status: "failed", updated_at: new Date().toISOString() })
      .eq("id", suggestion.id);
    return jsonError(
      "L’action n’a pas pu être réalisée. Réessayez.",
      500,
      "execution_failed",
    );
  }
}
