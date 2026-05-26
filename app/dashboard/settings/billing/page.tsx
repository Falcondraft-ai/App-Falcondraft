import { redirect } from "next/navigation";
import { BillingSummaryCard } from "@/components/common/billing-summary-card";
import { PageTransition } from "@/components/common/page-transition";
import { requireCurrentUserContext } from "@/lib/auth/session";
import { canManageWorkspace } from "@/lib/auth/workspace-permissions";
import { getBillingForOrganization } from "@/lib/data/supabase-app-data";

export default async function BillingSettingsPage() {
  const context = await requireCurrentUserContext();

  if (!canManageWorkspace(context.membership?.role)) {
    redirect("/dashboard/settings");
  }

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
      </div>
    </PageTransition>
  );
}
