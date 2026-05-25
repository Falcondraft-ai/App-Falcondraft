import { notFound } from "next/navigation";
import { PageHeader } from "@/components/common/page-header";
import { PageBreadcrumb } from "@/components/common/page-breadcrumb";
import { PageTransition } from "@/components/common/page-transition";
import { TranscriptDetailContent } from "@/components/transcripts/transcript-detail-content";
import { requireCurrentUserContext } from "@/lib/auth/session";
import { getTranscriptById } from "@/lib/data/transcripts";

export default async function TranscriptDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const context = await requireCurrentUserContext();
  const organizationId = context.organization?.id ?? null;

  if (!organizationId) notFound();

  const transcript = await getTranscriptById(id, organizationId);
  if (!transcript) notFound();

  return (
    <PageTransition>
      <div className="space-y-6">
        <PageBreadcrumb parent="Vos appels" parentHref="/dashboard/transcripts" current={transcript.title} />
        <PageHeader
          eyebrow="Transcript"
          title={transcript.title}
          description={transcript.dealName ? `Dossier : ${transcript.dealName}` : undefined}
        />
        <TranscriptDetailContent
          transcript={transcript}
          userRole={context.membership?.role ?? "viewer"}
        />
      </div>
    </PageTransition>
  );
}
