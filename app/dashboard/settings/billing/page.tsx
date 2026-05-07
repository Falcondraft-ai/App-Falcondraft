import { BillingSummaryCard } from "@/components/common/billing-summary-card";
import { PageTransition } from "@/components/common/page-transition";
import { mockInvoices } from "@/data/mock-team";

export default function BillingSettingsPage() {
  return (
    <PageTransition>
      <div className="space-y-6">
        <BillingSummaryCard invoices={mockInvoices} />
        <section className="rounded-lg border bg-card p-4">
          <h2 className="text-sm font-semibold">Notes de facturation</h2>
          <p className="text-muted-foreground mt-2 max-w-3xl text-sm leading-6">
            Les informations d’abonnement, les échéances et les factures sont
            regroupées pour faciliter le suivi administratif.
          </p>
        </section>
      </div>
    </PageTransition>
  );
}
