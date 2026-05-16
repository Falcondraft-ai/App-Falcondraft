import { NewTranscriptForm } from "@/components/transcripts/new-transcript-form";
import { PageHeader } from "@/components/common/page-header";
import { PageTransition } from "@/components/common/page-transition";
import { requireCurrentUserContext } from "@/lib/auth/session";
import { getDealsForTranscriptLinking } from "@/lib/data/transcripts";

export default async function NewTranscriptPage() {
  const context = await requireCurrentUserContext();
  const organizationId = context.organization?.id ?? null;

  const deals = organizationId
    ? await getDealsForTranscriptLinking(organizationId)
    : [];

  return (
    <PageTransition>
      <div className="mx-auto max-w-5xl space-y-6">
        <PageHeader
          eyebrow="Nouveau"
          title="Ajouter un transcript"
          description="Collez le contenu d'un échange commercial. Il pourra être lié à un dossier existant."
        />
        <NewTranscriptForm deals={deals} />
      </div>
    </PageTransition>
  );
}
