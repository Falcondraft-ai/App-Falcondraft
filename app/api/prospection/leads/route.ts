import { NextResponse, type NextRequest } from "next/server";
import { requireCurrentUserContext } from "@/lib/auth/session";
import { canAccessProspection } from "@/lib/internal-access";
import {
  createProspectInteraction,
  updateProspectCompany,
  updateProspectCompanyStatus,
  updateProspectTask,
  createProspectingSearch,
} from "@/lib/prospection/data";

const validStatuses = [
  "new",
  "to_call",
  "called",
  "no_answer",
  "to_follow_up",
  "interested",
  "meeting_booked",
  "not_interested",
  "bad_fit",
  "do_not_contact",
  "client",
  "archived",
] as const;

const validClosers = ["Timéo", "Enzo", "Margot"] as const;

const validMeetingPlatforms = [
  "Calendly",
  "Google Meet",
  "Zoom",
  "Microsoft Teams",
  "Autre",
] as const;

function getOrgId(context: Awaited<ReturnType<typeof requireCurrentUserContext>>) {
  return context.organization?.id ?? null;
}

function orgError() {
  return NextResponse.json(
    { success: false, message: "Aucune organisation active." },
    { status: 400 },
  );
}

export async function PATCH(request: NextRequest) {
  const context = await requireCurrentUserContext();

  if (!canAccessProspection(context)) {
    return NextResponse.json(
      { success: false, message: "Accès non autorisé." },
      { status: 403 },
    );
  }

  const organizationId = getOrgId(context);
  if (!organizationId) return orgError();

  const body: unknown = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json(
      { success: false, message: "Requête invalide." },
      { status: 400 },
    );
  }

  const {
    companyId,
    taskId,
    action,
    status,
    closer,
    meetingUrl,
    meetingPlatform,
    meetingAt,
    content,
  } = body as {
    companyId?: string;
    taskId?: string;
    action?: string;
    status?: string;
    closer?: string;
    meetingUrl?: string;
    meetingPlatform?: string;
    meetingAt?: string;
    content?: string;
  };

  if (!companyId && !taskId) {
    return NextResponse.json(
      { success: false, message: "ID entreprise ou tâche requis." },
      { status: 400 },
    );
  }

  // --- mark_called ---
  if (action === "mark_called") {
    if (!companyId) {
      return NextResponse.json(
        { success: false, message: "ID entreprise requis." },
        { status: 400 },
      );
    }
    const now = new Date().toISOString();
    const updated = await updateProspectCompanyStatus(companyId, organizationId, {
      status: "called",
      last_called_at: now,
    });

    if (updated) {
      await createProspectInteraction(organizationId, {
        company_id: companyId,
        type: "call",
        channel: "phone",
        result: "called",
        content: "Lead marked as called from FalconDraft prospection dashboard.",
      });
    }

    return NextResponse.json({ success: updated });
  }

  // --- archive ---
  if (action === "archive") {
    if (!companyId) {
      return NextResponse.json(
        { success: false, message: "ID entreprise requis." },
        { status: 400 },
      );
    }
    const updated = await updateProspectCompanyStatus(companyId, organizationId, {
      status: "archived",
    });

    if (updated) {
      await createProspectInteraction(organizationId, {
        company_id: companyId,
        type: "status_change",
        channel: "system",
        result: "archived",
        content: "Lead archived from FalconDraft prospection dashboard.",
      });
    }

    return NextResponse.json({ success: updated });
  }

  // --- change_status ---
  if (action === "change_status" && status) {
    if (!companyId) {
      return NextResponse.json(
        { success: false, message: "ID entreprise requis." },
        { status: 400 },
      );
    }
    if (!validStatuses.includes(status as (typeof validStatuses)[number])) {
      return NextResponse.json(
        { success: false, message: "Statut invalide." },
        { status: 400 },
      );
    }

    const updated = await updateProspectCompanyStatus(companyId, organizationId, {
      status,
    });

    return NextResponse.json({ success: updated });
  }

  // --- assign_closer ---
  if (action === "assign_closer" && closer) {
    if (!companyId) {
      return NextResponse.json(
        { success: false, message: "ID entreprise requis." },
        { status: 400 },
      );
    }
    if (!validClosers.includes(closer as (typeof validClosers)[number])) {
      return NextResponse.json(
        { success: false, message: "Closer invalide." },
        { status: 400 },
      );
    }

    const updated = await updateProspectCompany(companyId, organizationId, {
      assigned_closer: closer,
    });

    return NextResponse.json({ success: updated, closer });
  }

  // --- update_meeting ---
  if (action === "update_meeting") {
    if (!companyId) {
      return NextResponse.json(
        { success: false, message: "ID entreprise requis." },
        { status: 400 },
      );
    }
    if (meetingPlatform && !validMeetingPlatforms.includes(meetingPlatform as (typeof validMeetingPlatforms)[number])) {
      return NextResponse.json(
        { success: false, message: "Plateforme invalide." },
        { status: 400 },
      );
    }

    const updates: Record<string, unknown> = {};
    if (meetingUrl !== undefined) updates.meeting_url = meetingUrl || null;
    if (meetingPlatform !== undefined) updates.meeting_platform = meetingPlatform || null;
    if (meetingAt !== undefined) updates.meeting_at = meetingAt || null;

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { success: false, message: "Aucune mise à jour de réunion." },
        { status: 400 },
      );
    }

    const updated = await updateProspectCompany(companyId, organizationId, updates);
    return NextResponse.json({ success: updated });
  }

  // --- add_note ---
  if (action === "add_note" && content) {
    if (!companyId) {
      return NextResponse.json(
        { success: false, message: "ID entreprise requis." },
        { status: 400 },
      );
    }

    const created = await createProspectInteraction(organizationId, {
      company_id: companyId,
      type: "note",
      channel: "manual",
      result: "noted",
      content,
    });

    return NextResponse.json({ success: created });
  }

  // --- mark_task_done ---
  if (action === "mark_task_done") {
    if (!taskId) {
      return NextResponse.json(
        { success: false, message: "ID tâche requis." },
        { status: 400 },
      );
    }
    const updated = await updateProspectTask(taskId, organizationId, {
      status: "done",
    });
    return NextResponse.json({ success: updated });
  }

  return NextResponse.json(
    { success: false, message: "Action inconnue." },
    { status: 400 },
  );
}

export async function POST(request: NextRequest) {
  const context = await requireCurrentUserContext();

  if (!canAccessProspection(context)) {
    return NextResponse.json(
      { success: false, message: "Accès non autorisé." },
      { status: 403 },
    );
  }

  const organizationId = getOrgId(context);
  if (!organizationId) return orgError();

  const body: unknown = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json(
      { success: false, message: "Requête invalide." },
      { status: 400 },
    );
  }

  const { action, name, niche, categoryQuery, scopeType, locationQuery, maxResults, notes } =
    body as {
      action?: string;
      name?: string;
      niche?: string;
      categoryQuery?: string;
      scopeType?: string;
      locationQuery?: string;
      maxResults?: number;
      notes?: string;
    };

  if (action === "create_search" && name) {
    const search = await createProspectingSearch(organizationId, {
      name,
      niche,
      category_query: categoryQuery,
      scope_type: scopeType,
      location_query: locationQuery,
      max_results: maxResults,
      notes,
    });

    if (!search) {
      return NextResponse.json(
        { success: false, message: "Création de la recherche échouée." },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true, search });
  }

  return NextResponse.json(
    { success: false, message: "Action inconnue." },
    { status: 400 },
  );
}
