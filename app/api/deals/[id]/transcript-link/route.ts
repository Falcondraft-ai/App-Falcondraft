import { NextResponse, type NextRequest } from "next/server";
import { requireCurrentUserContext } from "@/lib/auth/session";
import { normalizeWorkspaceRole } from "@/lib/auth/workspace-permissions";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { getSupabaseServerClient } from "@/lib/supabase/server";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(request: NextRequest, { params }: RouteContext) {
  const { id: dealId } = await params;
  const context = await requireCurrentUserContext();
  const organizationId = context.organization?.id;
  const role = normalizeWorkspaceRole(context.membership?.role);

  if (!organizationId || role === "viewer") {
    return NextResponse.json({ error: "Accès non autorisé." }, { status: 403 });
  }

  const supabase = (await getSupabaseServerClient()) ?? getSupabaseAdminClient();
  if (!supabase) {
    return NextResponse.json({ error: "Service indisponible." }, { status: 500 });
  }

  const body = await request.json();
  const { transcriptId } = body as { transcriptId?: string };

  if (!transcriptId) {
    return NextResponse.json({ error: "transcriptId requis." }, { status: 400 });
  }

  const { data: transcript } = await supabase
    .from("transcripts")
    .select("id, transcript_text, organization_id")
    .eq("id", transcriptId)
    .eq("organization_id", organizationId)
    .single();

  if (!transcript) {
    return NextResponse.json({ error: "Transcript introuvable." }, { status: 404 });
  }

  const { error: linkError } = await supabase
    .from("transcripts")
    .update({ deal_id: dealId, updated_at: new Date().toISOString() })
    .eq("id", transcriptId)
    .eq("organization_id", organizationId);

  if (linkError) {
    return NextResponse.json({ error: "Liaison impossible." }, { status: 500 });
  }

  if (transcript.transcript_text) {
    await supabase
      .from("deals")
      .update({ transcript: transcript.transcript_text, updated_at: new Date().toISOString() })
      .eq("id", dealId)
      .eq("organization_id", organizationId);
  }

  return NextResponse.json({ success: true });
}

export async function DELETE(_request: NextRequest, { params }: RouteContext) {
  const { id: dealId } = await params;
  const context = await requireCurrentUserContext();
  const organizationId = context.organization?.id;
  const role = normalizeWorkspaceRole(context.membership?.role);

  if (!organizationId || role === "viewer") {
    return NextResponse.json({ error: "Accès non autorisé." }, { status: 403 });
  }

  const supabase = (await getSupabaseServerClient()) ?? getSupabaseAdminClient();
  if (!supabase) {
    return NextResponse.json({ error: "Service indisponible." }, { status: 500 });
  }

  const { error } = await supabase
    .from("transcripts")
    .update({ deal_id: null, updated_at: new Date().toISOString() })
    .eq("deal_id", dealId)
    .eq("organization_id", organizationId);

  if (error) {
    return NextResponse.json({ error: "Dissociation impossible." }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
