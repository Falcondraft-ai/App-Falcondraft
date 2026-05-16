import { NextResponse } from "next/server";
import { requireCurrentUserContext } from "@/lib/auth/session";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { normalizeWorkspaceRole } from "@/lib/auth/workspace-permissions";

export async function DELETE(request: Request) {
  const context = await requireCurrentUserContext();
  const organizationId = context.organization?.id;
  const role = normalizeWorkspaceRole(context.membership?.role);

  if (!organizationId || role === "viewer") {
    return NextResponse.json({ error: "Accès non autorisé." }, { status: 403 });
  }

  const body = await request.json();
  const { dealId } = body as { dealId?: string };

  if (!dealId) {
    return NextResponse.json({ error: "ID manquant." }, { status: 400 });
  }

  const supabase = (await getSupabaseServerClient()) ?? getSupabaseAdminClient();
  if (!supabase) {
    return NextResponse.json({ error: "Service indisponible." }, { status: 500 });
  }

  const { error } = await supabase
    .from("deals")
    .update({ transcript: null, updated_at: new Date().toISOString() })
    .eq("id", dealId)
    .eq("organization_id", organizationId);

  if (error) {
    return NextResponse.json({ error: "Suppression impossible." }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

export async function PATCH(request: Request) {
  const context = await requireCurrentUserContext();
  const organizationId = context.organization?.id;
  const role = normalizeWorkspaceRole(context.membership?.role);

  if (!organizationId || role === "viewer") {
    return NextResponse.json({ error: "Accès non autorisé." }, { status: 403 });
  }

  const body = await request.json();
  const { dealId, action } = body as { dealId?: string; action?: string };

  if (!dealId) {
    return NextResponse.json({ error: "ID manquant." }, { status: 400 });
  }

  const supabase = (await getSupabaseServerClient()) ?? getSupabaseAdminClient();
  if (!supabase) {
    return NextResponse.json({ error: "Service indisponible." }, { status: 500 });
  }

  if (action === "archive") {
    const { error } = await supabase
      .from("deals")
      .update({ transcript: null, updated_at: new Date().toISOString() })
      .eq("id", dealId)
      .eq("organization_id", organizationId);

    if (error) {
      return NextResponse.json({ error: "Archivage impossible." }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: "Action inconnue." }, { status: 400 });
}
