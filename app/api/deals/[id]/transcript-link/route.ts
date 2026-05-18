import { NextResponse, type NextRequest } from "next/server";
import { loadUserOrganizationContextWithAdmin } from "@/lib/auth/organization-context";
import { canMutateWorkspaceDeal, normalizeWorkspaceRole } from "@/lib/auth/workspace-permissions";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { getSupabaseServerClient } from "@/lib/supabase/server";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(request: NextRequest, { params }: RouteContext) {
  const { id: dealId } = await params;

  const supabaseServer = await getSupabaseServerClient();
  if (!supabaseServer) {
    return NextResponse.json({ error: "Service indisponible." }, { status: 500 });
  }

  const {
    data: { user },
  } = await supabaseServer.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Authentification requise." }, { status: 401 });
  }

  const adminSupabase = getSupabaseAdminClient();
  if (!adminSupabase) {
    return NextResponse.json({ error: "Service indisponible." }, { status: 500 });
  }

  const context = await loadUserOrganizationContextWithAdmin(user, adminSupabase);
  const organizationId = context.organization?.id;
  const role = normalizeWorkspaceRole(context.membership?.role);

  if (!organizationId || role === "viewer") {
    return NextResponse.json({ error: "Accès non autorisé." }, { status: 403 });
  }

  const { data: deal } = await adminSupabase
    .from("deals")
    .select("id, created_by")
    .eq("id", dealId)
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (!deal) {
    return NextResponse.json({ error: "Dossier introuvable." }, { status: 404 });
  }

  if (
    !canMutateWorkspaceDeal(
      {
        userId: user.id,
        role: context.membership!.role,
        allowMemberCompanyVisibility:
          context.organization!.allow_member_company_visibility,
        scope: "organization",
      },
      deal.created_by,
    )
  ) {
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
    console.error("[transcript-link] link failed:", linkError.message);
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

  const supabaseServer = await getSupabaseServerClient();
  if (!supabaseServer) {
    return NextResponse.json({ error: "Service indisponible." }, { status: 500 });
  }

  const {
    data: { user },
  } = await supabaseServer.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Authentification requise." }, { status: 401 });
  }

  const adminSupabase = getSupabaseAdminClient();
  if (!adminSupabase) {
    return NextResponse.json({ error: "Service indisponible." }, { status: 500 });
  }

  const context = await loadUserOrganizationContextWithAdmin(user, adminSupabase);
  const organizationId = context.organization?.id;
  const role = normalizeWorkspaceRole(context.membership?.role);

  if (!organizationId || role === "viewer") {
    return NextResponse.json({ error: "Accès non autorisé." }, { status: 403 });
  }

  const { data: deal } = await adminSupabase
    .from("deals")
    .select("id, created_by")
    .eq("id", dealId)
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (!deal) {
    return NextResponse.json({ error: "Dossier introuvable." }, { status: 404 });
  }

  if (
    !canMutateWorkspaceDeal(
      {
        userId: user.id,
        role: context.membership!.role,
        allowMemberCompanyVisibility:
          context.organization!.allow_member_company_visibility,
        scope: "organization",
      },
      deal.created_by,
    )
  ) {
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
    console.error("[transcript-link] unlink failed:", error.message);
    return NextResponse.json({ error: "Dissociation impossible." }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
