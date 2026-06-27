import { NewDealForm } from "@/components/deals/new-deal-form";
import { PageHeader } from "@/components/common/page-header";
import { PageTransition } from "@/components/common/page-transition";
import { requireCurrentUserContext } from "@/lib/auth/session";
import { getTranscriptsForLinking } from "@/lib/data/transcripts";

export default async function NewCourtierDealPage() {
  const context = await requireCurrentUserContext();
  const organizationId = context.organization?.id ?? null;

  const transcripts = organizationId
    ? await getTranscriptsForLinking(organizationId)
    : [];

  return (
    <PageTransition>
      <div className="mx-auto max-w-5xl space-y-6">
        <PageHeader
          eyebrow="Nouveau"
          title="Nouvelle proposition"
          description="Renseignez le contexte client. La proposition pourra ensuite être générée puis validée."
        />
        <NewDealForm
          existingTranscripts={transcripts}
          defaultQuoteClientType={
            context.organization?.default_quote_client_type ?? "company"
          }
          defaultQuoteTaxRate={context.organization?.default_quote_tax_rate ?? 20}
        />
      </div>
    </PageTransition>
  );
}
