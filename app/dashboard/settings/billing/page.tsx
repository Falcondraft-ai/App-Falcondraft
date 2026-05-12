import { BillingSummaryCard } from "@/components/common/billing-summary-card";
import { PageTransition } from "@/components/common/page-transition";
import { requireCurrentUserContext } from "@/lib/auth/session";
import { getBillingForOrganization } from "@/lib/data/supabase-app-data";

export default async function BillingSettingsPage() {
  const context = await requireCurrentUserContext();
  const billing = await getBillingForOrganization(
    context.organization?.id ?? null,
  );

  return (
    <PageTransition>
      <div className="space-y-6">
        <BillingSummaryCard
          invoices={billing.invoices}
          summary={billing.summary}
        />
        <section className="rounded-lg border bg-card/80 p-4">
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
