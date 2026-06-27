import { TranscriptsPageContent } from "@/components/transcripts/transcripts-page-content";
import { PageHeader } from "@/components/common/page-header";
import { PageTransition } from "@/components/common/page-transition";
import { requireCurrentUserContext } from "@/lib/auth/session";
import {
  getTranscriptsForOrganization,
  getDealsForTranscriptLinking,
} from "@/lib/data/transcripts";

export default async function CourtierTranscriptsPage() {
  const context = await requireCurrentUserContext();
  const organizationId = context.organization?.id ?? null;
  const access = {
    userId: context.user.id,
    role: context.membership?.role,
    allowMemberCompanyVisibility:
      context.organization?.allow_member_company_visibility ?? true,
  };

  const [transcripts, deals] = await Promise.all([
    getTranscriptsForOrganization(organizationId, access),
    organizationId
      ? getDealsForTranscriptLinking(organizationId)
      : Promise.resolve([]),
  ]);

  return (
    <PageTransition>
      <div className="space-y-6">
        <PageHeader
          eyebrow="Transcripts"
          title="Vos appels"
          description="Importez ou enregistrez vos appels clients."
        />
        <TranscriptsPageContent
          transcripts={transcripts}
          deals={deals}
          userRole={context.membership?.role ?? "viewer"}
        />
      </div>
    </PageTransition>
  );
}
