import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { canCreateWorkspaceRecords } from "@/lib/auth/workspace-permissions";
import { requireBrokerApiContext } from "@/lib/broker/server";
import type { BrokerImportBatchRow } from "@/types/database";

export const dynamic = "force-dynamic";

const createSchema = z.object({
  sourceType: z.enum(["folder", "zip"]).default("folder"),
});

function jsonError(message: string, status: number, reason: string) {
  return NextResponse.json({ success: false, message, reason }, { status });
}

/** Creates a new import batch (empty, status "uploading"). */
export async function POST(request: NextRequest) {
  const auth = await requireBrokerApiContext();
  if (!auth.success) return jsonError(auth.message, auth.status, auth.reason);
  if (!canCreateWorkspaceRecords(auth.context.membership?.role)) {
    return jsonError("Action non autorisée pour votre rôle.", 403, "insufficient_role");
  }

  const body: unknown = await request.json().catch(() => ({}));
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return jsonError("Requête invalide.", 400, "invalid_payload");

  const { data, error } = await auth.adminSupabase
    .from("broker_import_batches")
    .insert({
      organization_id: auth.organizationId,
      created_by: auth.user.id,
      source_type: parsed.data.sourceType,
      status: "uploading",
    })
    .select("id")
    .single();

  if (error || !data) {
    return jsonError("Création de l'import impossible.", 500, error?.message ?? "insert_failed");
  }

  return NextResponse.json({ success: true, batchId: data.id });
}

/** Recent import batches for the organization (for the imports landing page). */
export async function GET() {
  const auth = await requireBrokerApiContext();
  if (!auth.success) return jsonError(auth.message, auth.status, auth.reason);

  const { data } = await auth.adminSupabase
    .from("broker_import_batches")
    .select("*")
    .eq("organization_id", auth.organizationId)
    .order("created_at", { ascending: false })
    .limit(50);

  return NextResponse.json({ batches: (data ?? []) as BrokerImportBatchRow[] });
}
