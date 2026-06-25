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
      <div className="mx-auto max-w-4xl space-y-5">
        <PageHeader
          title="Paramètres"
          description="Gérez votre espace courtier, vos types de contrat, votre équipe et vos intégrations."
        />
        <CourtierSettingsNav />
        <div>{children}</div>
      </div>
    </PageTransition>
  );
}
