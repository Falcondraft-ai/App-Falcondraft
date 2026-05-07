import Link from "next/link";
import { DealsTable } from "@/components/deals/deals-table";
import { PageHeader } from "@/components/common/page-header";
import { PageTransition } from "@/components/common/page-transition";
import { Button } from "@/components/ui/button";
import { mockDeals } from "@/data/mock-deals";

export default function DealsPage() {
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
        <DealsTable deals={mockDeals} />
      </div>
    </PageTransition>
  );
}
