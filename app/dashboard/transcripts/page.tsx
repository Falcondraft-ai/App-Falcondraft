import { TranscriptsPageContent } from "@/components/transcripts/transcripts-page-content";
import { PageHeader } from "@/components/common/page-header";
import { PageTransition } from "@/components/common/page-transition";
import { requireCurrentUserContext } from "@/lib/auth/session";
import { getTranscriptsForOrganization, getDealsForTranscriptLinking } from "@/lib/data/transcripts";

export default async function TranscriptsPage() {
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
          title="Transcripts d'appel"
          description="Transcripts d'échanges commerciaux : texte collé, fichier audio ou enregistrement automatique."
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
