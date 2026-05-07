import { NewDealForm } from "@/components/deals/new-deal-form";
import { PageHeader } from "@/components/common/page-header";
import { PageTransition } from "@/components/common/page-transition";

export default function NewDealPage() {
  return (
    <PageTransition>
      <div className="mx-auto max-w-5xl space-y-6">
        <PageHeader
          eyebrow="Nouveau dossier commercial"
          title="Créer un dossier commercial"
          description="Ajoutez les informations commerciales et les notes qui serviront de base au compte-rendu puis à la proposition."
        />
        <NewDealForm />
      </div>
    </PageTransition>
  );
}
