import { PageHeader } from "@/components/common/page-header";
import { PageTransition } from "@/components/common/page-transition";
import { CourtierSettingsNav } from "@/components/broker/courtier-settings-nav";

export default function CourtierSettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <PageTransition>
      <div className="mx-auto max-w-5xl space-y-6">
        <PageHeader
          title="Paramètres"
          description="Gérez votre espace courtier, vos types de contrat, votre équipe et vos intégrations."
        />
        <div className="flex flex-col gap-6 lg:flex-row lg:gap-10">
          <CourtierSettingsNav />
          <div className="min-w-0 flex-1">{children}</div>
        </div>
      </div>
    </PageTransition>
  );
}
