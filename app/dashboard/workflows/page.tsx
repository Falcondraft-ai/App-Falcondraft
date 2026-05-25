import { Workflow } from "lucide-react";
import { ComingSoonPanel } from "@/components/common/coming-soon-panel";
import { PageHeader } from "@/components/common/page-header";
import { PageTransition } from "@/components/common/page-transition";
import { T } from "@/components/i18n/translated-text";

export default function WorkflowsPage() {
  return (
    <PageTransition>
      <div className="space-y-6">
        <PageHeader
          eyebrow={<T tx="nav.comingSoon" />}
          title={<T tx="nav.workflows" />}
          description="Automatisations sur-mesure : relances programmées, alertes pipeline, suivi de signature, escalades internes."
        />
        <ComingSoonPanel
          icon={<Workflow className="size-6" strokeWidth={1.75} />}
          title={<T tx="nav.workflows" />}
          features={[
            "Relances programmées si la proposition reste sans réponse.",
            "Alertes pipeline lorsqu'un dossier change de statut.",
            "Suivi de signature avec rappels automatiques aux signataires.",
            "Configuration par équipe, par type de dossier ou par client.",
          ]}
        />
      </div>
    </PageTransition>
  );
}
