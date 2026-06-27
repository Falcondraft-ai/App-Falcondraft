import { notFound } from "next/navigation";
import { DealDetailView } from "@/components/deals/deal-detail-view";
import { requireCurrentUserContext } from "@/lib/auth/session";
import { normalizeWorkspaceRole } from "@/lib/auth/workspace-permissions";
import { getDealDetail } from "@/lib/data/supabase-app-data";
import {
  getLinkedTranscriptForDeal,
  getTranscriptsForLinking,
} from "@/lib/data/transcripts";

type DealDetailPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function DealDetailPage({ params }: DealDetailPageProps) {
  const { id } = await params;
  const context = await requireCurrentUserContext();

  const organizationId = context.organization?.id ?? "";
  const userRole = normalizeWorkspaceRole(context.membership?.role);
  const canEdit = userRole !== "viewer";

  const [{ deal, activity, documents }, linkedTranscript, availableTranscripts] =
    await Promise.all([
      getDealDetail(context.organization?.id ?? null, id, {
        userId: context.user.id,
        role: context.membership?.role,
        allowMemberCompanyVisibility:
          context.organization?.allow_member_company_visibility ?? true,
        scope: "organization",
      }),
      getLinkedTranscriptForDeal(organizationId, id),
      canEdit ? getTranscriptsForLinking(organizationId) : Promise.resolve([]),
    ]);

  if (!deal) {
    notFound();
  }

  return (
    <DealDetailView
      deal={deal}
      activity={activity}
      documents={documents}
      linkedTranscript={linkedTranscript}
      availableTranscripts={availableTranscripts}
      canEdit={canEdit}
      backHref="/dashboard/deals"
      backLabel="Dossiers"
    />
  );
}
