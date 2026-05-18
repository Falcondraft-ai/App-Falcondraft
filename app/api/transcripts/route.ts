import { NextResponse } from "next/server";
import { requireCurrentUserContext } from "@/lib/auth/session";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { normalizeWorkspaceRole } from "@/lib/auth/workspace-permissions";

export async function POST(request: Request) {
  const context = await requireCurrentUserContext();
  const organizationId = context.organization?.id;
  const role = normalizeWorkspaceRole(context.membership?.role);

  if (!organizationId || role === "viewer") {
    return NextResponse.json(
      { error: "Accès non autorisé." },
      { status: 403 },
    );
  }

  const body = await request.json();
  const { title, transcriptText, dealId, language } = body as {
    title?: string;
    transcriptText?: string;
    dealId?: string | null;
    language?: string | null;
  };

  if (!title || !transcriptText) {
    return NextResponse.json(
      { error: "Le titre et le contenu du transcript sont requis." },
      { status: 400 },
    );
  }

  const supabase = (await getSupabaseServerClient()) ?? getSupabaseAdminClient();
  if (!supabase) {
    return NextResponse.json(
      { error: "Service indisponible." },
      { status: 500 },
    );
  }

  const { data, error } = await supabase
    .from("transcripts")
    .insert({
      organization_id: organizationId,
      created_by: context.user.id,
      title: title.trim(),
      transcript_text: transcriptText.trim(),
      source: "manual_paste",
      status: "ready",
      ...(dealId ? { deal_id: dealId } : {}),
      ...(language ? { language } : {}),
    })
    .select("id")
    .single();

  if (error) {
    console.error("[transcripts] create failed:", error.message);
    return NextResponse.json(
      { error: "La création du transcript a échoué." },
      { status: 500 },
    );
  }

  if (dealId) {
    const { data: deal } = await supabase
      .from("deals")
      .select("id")
      .eq("id", dealId)
      .eq("organization_id", organizationId)
      .maybeSingle();

    if (!deal) {
      return NextResponse.json({ error: "Dossier introuvable." }, { status: 404 });
    }

    await supabase
      .from("deals")
      .update({
        transcript: transcriptText.trim(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", dealId)
      .eq("organization_id", organizationId);
  }

  if (dealId) {
    await supabase
      .from("deals")
      .update({
        transcript: transcriptText.trim(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", dealId)
      .eq("organization_id", organizationId);
  }

  return NextResponse.json({ id: data.id }, { status: 201 });
}
