import { PageHeader } from "@/components/common/page-header";
import { PageTransition } from "@/components/common/page-transition";
import { CourtierSettingsNav } from "@/components/broker/courtier-settings-nav";
import { requireActiveWorkspaceContext } from "@/lib/auth/session";
import { BROKER_OFFERING_CUSTOM, getBrokerOffering } from "@/lib/broker/access";

export default async function CourtierSettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const context = await requireActiveWorkspaceContext();
  // Bespoke ("sur mesure") cabinets are billed manually off-platform, so they
  // get no Stripe billing tab.
  const showBilling =
    getBrokerOffering(context.organization) !== BROKER_OFFERING_CUSTOM;

  return (
    <PageTransition>
      <div className="mx-auto max-w-5xl space-y-6">
        <PageHeader
          title="Paramètres"
          description="Gérez votre espace courtier, vos types de contrat, votre équipe et vos intégrations."
        />
        <div className="flex flex-col gap-6 lg:flex-row lg:gap-10">
          <CourtierSettingsNav showBilling={showBilling} />
          <div className="min-w-0 flex-1">{children}</div>
        </div>
      </div>
    </PageTransition>
  );
}
