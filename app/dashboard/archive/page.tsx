import { DealsTable } from "@/components/deals/deals-table";
import { EmptyState } from "@/components/common/empty-state";
import { PageHeader } from "@/components/common/page-header";
import { PageTransition } from "@/components/common/page-transition";
import { requireCurrentUserContext } from "@/lib/auth/session";
import { getDealsForOrganization } from "@/lib/data/supabase-app-data";

export default async function ArchivePage() {
  const context = await requireCurrentUserContext();
  const deals = await getDealsForOrganization(context.organization?.id ?? null, {
    archive: "only",
  });

  return (
    <PageTransition>
      <div className="space-y-6">
        <PageHeader
          eyebrow="Archives"
          title="Dossiers archivés"
          description="Dossiers retirés du pipeline commercial, conservés pour consultation ou restauration."
        />
        {deals.length > 0 ? (
          <DealsTable deals={deals} mode="archived" />
        ) : (
          <section className="rounded-lg border bg-card/75 p-4">
            <EmptyState
              title="Aucun dossier archivé"
              description="Les dossiers archivés apparaîtront ici sans entrer dans le pipeline commercial."
            />
          </section>
        )}
      </div>
    </PageTransition>
  );
}
