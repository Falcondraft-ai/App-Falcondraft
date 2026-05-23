import { NewDealForm } from "@/components/deals/new-deal-form";
import { PageHeader } from "@/components/common/page-header";
import { PageTransition } from "@/components/common/page-transition";
import { T } from "@/components/i18n/translated-text";
import { requireCurrentUserContext } from "@/lib/auth/session";
import { getTranscriptsForLinking } from "@/lib/data/transcripts";

export default async function NewDealPage() {
  const context = await requireCurrentUserContext();
  const organizationId = context.organization?.id ?? null;

  const transcripts = organizationId
    ? await getTranscriptsForLinking(organizationId)
    : [];

  return (
    <PageTransition>
      <div className="mx-auto max-w-5xl space-y-6">
        <PageHeader
          eyebrow={<T tx="dealDetail.newEyebrow" />}
          title={<T tx="dealDetail.newTitle" />}
          description={<T tx="dealDetail.newDescription" />}
        />
        <NewDealForm
          existingTranscripts={transcripts}
          defaultQuoteClientType={
            context.organization?.default_quote_client_type ?? "company"
          }
          defaultQuoteTaxRate={
            context.organization?.default_quote_tax_rate ?? 20
          }
        />
      </div>
    </PageTransition>
  );
}
