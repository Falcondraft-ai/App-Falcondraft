import { NextResponse } from "next/server";
import { requireCurrentUserContext } from "@/lib/auth/session";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { normalizeWorkspaceRole } from "@/lib/auth/workspace-permissions";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const context = await requireCurrentUserContext();
  const organizationId = context.organization?.id;

  if (!organizationId) {
    return NextResponse.json({ error: "Accès non autorisé." }, { status: 403 });
  }

  const supabase = (await getSupabaseServerClient()) ?? getSupabaseAdminClient();
  if (!supabase) {
    return NextResponse.json({ error: "Service indisponible." }, { status: 500 });
  }

  const { data, error } = await supabase
    .from("transcripts")
    .select("id, title, transcript_text")
    .eq("id", id)
    .eq("organization_id", organizationId)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: "Transcript introuvable." }, { status: 404 });
  }

  return NextResponse.json({
    id: data.id,
    title: data.title,
    transcriptText: data.transcript_text,
  });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const context = await requireCurrentUserContext();
  const organizationId = context.organization?.id;
  const role = normalizeWorkspaceRole(context.membership?.role);

  if (!organizationId || role === "viewer") {
    return NextResponse.json(
      { error: "Accès non autorisé." },
      { status: 403 },
    );
  }

  const supabase = (await getSupabaseServerClient()) ?? getSupabaseAdminClient();
  if (!supabase) {
    return NextResponse.json(
      { error: "Service indisponible." },
      { status: 500 },
    );
  }

  const { error } = await supabase
    .from("transcripts")
    .delete()
    .eq("id", id)
    .eq("organization_id", organizationId);

  if (error) {
    return NextResponse.json(
      { error: "Suppression impossible." },
      { status: 500 },
    );
  }

  return NextResponse.json({ success: true });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const context = await requireCurrentUserContext();
  const organizationId = context.organization?.id;
  const role = normalizeWorkspaceRole(context.membership?.role);

  if (!organizationId || role === "viewer") {
    return NextResponse.json(
      { error: "Accès non autorisé." },
      { status: 403 },
    );
  }

  const supabase = (await getSupabaseServerClient()) ?? getSupabaseAdminClient();
  if (!supabase) {
    return NextResponse.json(
      { error: "Service indisponible." },
      { status: 500 },
    );
  }

  const body = await request.json();
  const { action, title, transcriptText } = body as {
    action?: string;
    title?: string;
    transcriptText?: string;
  };

  if (action === "update") {
    const { error } = await supabase
      .from("transcripts")
      .update({
        updated_at: new Date().toISOString(),
        ...(title !== undefined ? { title: title.trim() } : {}),
        ...(transcriptText !== undefined ? { transcript_text: transcriptText.trim() } : {}),
      })
      .eq("id", id)
      .eq("organization_id", organizationId);

    if (error) {
      return NextResponse.json(
        { error: "Mise à jour impossible." },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true });
  }

  if (action === "archive") {
    const { error } = await supabase
      .from("transcripts")
      .update({ archived_at: new Date().toISOString() })
      .eq("id", id)
      .eq("organization_id", organizationId);

    if (error) {
      return NextResponse.json(
        { error: "Archivage impossible." },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true });
  }

  if (action === "unarchive") {
    const { error } = await supabase
      .from("transcripts")
      .update({ archived_at: null })
      .eq("id", id)
      .eq("organization_id", organizationId);

    if (error) {
      return NextResponse.json(
        { error: "Désarchivage impossible." },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: "Action inconnue." }, { status: 400 });
}
