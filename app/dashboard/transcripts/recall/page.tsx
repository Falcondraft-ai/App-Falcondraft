import { RecallTranscriptForm } from "@/components/transcripts/recall-transcript-form";
import { PageHeader } from "@/components/common/page-header";
import { PageTransition } from "@/components/common/page-transition";
import { requireCurrentUserContext } from "@/lib/auth/session";
import { getDealsForTranscriptLinking } from "@/lib/data/transcripts";

export default async function RecallTranscriptPage() {
  const context = await requireCurrentUserContext();
  const organizationId = context.organization?.id ?? null;

  const deals = organizationId
    ? await getDealsForTranscriptLinking(organizationId)
    : [];

  return (
    <PageTransition>
      <div className="mx-auto max-w-2xl space-y-6">
        <PageHeader
          eyebrow="Recall.ai"
          title="Récupérer un appel"
          description="Collez le lien de votre réunion pour capturer automatiquement le transcript."
        />
        <RecallTranscriptForm deals={deals} />
      </div>
    </PageTransition>
  );
}
