import { NextResponse, type NextRequest } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { BROKER_FILES_BUCKET } from "@/lib/broker/documents";
import { requireBrokerApiContext } from "@/lib/broker/server";
import type { Database } from "@/types/database";

type RouteContext = { params: Promise<{ id: string; docId: string }> };

function jsonError(message: string, status: number, reason: string) {
  return NextResponse.json({ success: false, message, reason }, { status });
}

type Diagnosis = { reason: string; message: string };

/**
 * Pourquoi le lien signé n'a pas pu être créé.
 *
 * `createSignedUrl` échoue de la même façon que le bucket soit absent ou que
 * l'objet ait disparu — or les deux appellent des corrections opposées : dans
 * un cas la migration `0032` n'a pas été appliquée, dans l'autre le fichier
 * a réellement été supprimé du stockage. On liste le dossier parent pour les
 * départager, plutôt que de laisser le courtier deviner.
 */
async function diagnoseSigningFailure(
  admin: SupabaseClient<Database>,
  storagePath: string,
): Promise<Diagnosis> {
  const separator = storagePath.lastIndexOf("/");
  const folder = separator > 0 ? storagePath.slice(0, separator) : "";
  const basename = storagePath.slice(separator + 1);

  const { data: listed, error } = await admin.storage
    .from(BROKER_FILES_BUCKET)
    .list(folder, { search: basename, limit: 100 });

  if (error) {
    // Impossible même de lister : c'est le bucket qui manque, pas le fichier.
    if (/bucket/i.test(error.message)) {
      return {
        reason: "bucket_missing",
        message:
          "Le stockage des documents n’est pas initialisé. Appliquez la migration 0032 dans Supabase.",
      };
    }
    return {
      reason: "storage_unavailable",
      message:
        "Le stockage n’a pas répondu. Réessayez dans un instant.",
    };
  }

  const exists = (listed ?? []).some((item) => item.name === basename);
  return exists
    ? {
        // Le fichier est bien là : c'est la signature qui a échoué, donc un
        // problème de configuration ou un incident passager, pas une perte.
        reason: "signed_url_failed",
        message:
          "Le lien sécurisé n’a pas pu être créé alors que le fichier est bien présent. Réessayez.",
      }
    : {
        reason: "object_missing",
        message:
          "Le fichier n’est plus dans le stockage : il a été supprimé, ou son import ne s’est jamais terminé.",
      };
}

/**
 * Lien signé, court, vers un document du dossier.
 *
 * `?mode=inline` renvoie le même lien SANS forcer le téléchargement, pour que
 * le document s'affiche dans l'outil. Sans ce paramètre, l'en-tête
 * Content-Disposition force la sauvegarde : c'est le comportement d'origine,
 * conservé tel quel pour le bouton « Télécharger ».
 *
 * Le contrôle d'accès ne change pas d'un mode à l'autre : le document doit
 * appartenir à l'organisation ET au dossier demandé.
 */
export async function GET(request: NextRequest, ctx: RouteContext) {
  const auth = await requireBrokerApiContext();
  if (!auth.success) return jsonError(auth.message, auth.status, auth.reason);

  const { id: clientId, docId } = await ctx.params;
  const inline = request.nextUrl.searchParams.get("mode") === "inline";

  const { data: document } = await auth.adminSupabase
    .from("broker_documents")
    .select("id, storage_path, file_name, mime_type")
    .eq("organization_id", auth.organizationId)
    .eq("client_id", clientId)
    .eq("id", docId)
    .maybeSingle();

  if (!document) {
    return jsonError("Document introuvable.", 404, "document_not_found");
  }

  // Deux appels distincts plutôt qu'un `options` à `undefined` : on ne dépend
  // pas de la façon dont le SDK interprète un paramètre absent.
  const storage = auth.adminSupabase.storage.from(BROKER_FILES_BUCKET);
  const { data, error } = inline
    ? await storage.createSignedUrl(document.storage_path, 120)
    : await storage.createSignedUrl(document.storage_path, 120, {
        download: document.file_name,
      });

  if (error || !data?.signedUrl) {
    // Trois causes possibles, trois corrections très différentes : le bucket
    // n'existe pas, l'objet a disparu, ou la signature elle-même a échoué.
    // Les confondre derrière un message unique laissait sans prise — on les
    // départage ici plutôt que de faire deviner.
    const diagnosis = await diagnoseSigningFailure(
      auth.adminSupabase,
      document.storage_path,
    );
    console.error(
      "[broker] lien signé impossible:",
      JSON.stringify({
        path: document.storage_path,
        bucket: BROKER_FILES_BUCKET,
        cause: diagnosis.reason,
        error: error?.message ?? "réponse vide",
      }),
    );
    return jsonError(diagnosis.message, 500, diagnosis.reason);
  }

  return NextResponse.json({
    success: true,
    url: data.signedUrl,
    fileName: document.file_name,
    mimeType: document.mime_type,
  });
}
