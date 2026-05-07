import Link from "next/link";
import { DealsTable } from "@/components/deals/deals-table";
import { PageHeader } from "@/components/common/page-header";
import { PageTransition } from "@/components/common/page-transition";
import { Button } from "@/components/ui/button";
import { requireCurrentUserContext } from "@/lib/auth/session";
import { getDealsForOrganization } from "@/lib/data/supabase-app-data";

export default async function DealsPage() {
  const context = await requireCurrentUserContext();
  const deals = await getDealsForOrganization(context.organization?.id ?? null);

  return (
    <PageTransition>
      <div className="space-y-6">
        <PageHeader
          eyebrow="Opportunités"
          title="Pipeline commercial"
          description="Liste de travail des opportunités et de leur progression documentaire."
          actions={
            <Button asChild>
              <Link href="/dashboard/deals/new">Nouvelle opportunité</Link>
            </Button>
          }
        />
        <DealsTable deals={deals} />
      </div>
    </PageTransition>
  );
}
