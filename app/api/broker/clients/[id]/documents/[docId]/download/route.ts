import { NextResponse, type NextRequest } from "next/server";
import { BROKER_FILES_BUCKET } from "@/lib/broker/documents";
import { requireBrokerApiContext } from "@/lib/broker/server";

type RouteContext = { params: Promise<{ id: string; docId: string }> };

function jsonError(message: string, status: number, reason: string) {
  return NextResponse.json({ success: false, message, reason }, { status });
}

export async function GET(_request: NextRequest, ctx: RouteContext) {
  const auth = await requireBrokerApiContext();
  if (!auth.success) return jsonError(auth.message, auth.status, auth.reason);

  const { id: clientId, docId } = await ctx.params;

  const { data: document } = await auth.adminSupabase
    .from("broker_documents")
    .select("id, storage_path, file_name")
    .eq("organization_id", auth.organizationId)
    .eq("client_id", clientId)
    .eq("id", docId)
    .maybeSingle();

  if (!document) {
    return jsonError("Document introuvable.", 404, "document_not_found");
  }

  const { data, error } = await auth.adminSupabase.storage
    .from(BROKER_FILES_BUCKET)
    .createSignedUrl(document.storage_path, 120, {
      download: document.file_name,
    });

  if (error || !data?.signedUrl) {
    return jsonError("Lien sécurisé indisponible.", 500, "signed_url_failed");
  }

  return NextResponse.json({ success: true, url: data.signedUrl });
}
