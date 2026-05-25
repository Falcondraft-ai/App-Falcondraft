import { Euro } from "lucide-react";
import { ComingSoonPanel } from "@/components/common/coming-soon-panel";
import { PageHeader } from "@/components/common/page-header";
import { PageTransition } from "@/components/common/page-transition";
import { T } from "@/components/i18n/translated-text";

export default function QuotesPage() {
  return (
    <PageTransition>
      <div className="space-y-6">
        <PageHeader
          eyebrow={<T tx="nav.comingSoon" />}
          title={<T tx="nav.quotes" />}
          description="Devis structurés, lignes de prestation, totaux HT/TTC, envoi en PDF — branchés sur vos dossiers commerciaux."
        />
        <ComingSoonPanel
          icon={<Euro className="size-6" strokeWidth={1.75} />}
          title={<T tx="nav.quotes" />}
          features={[
            "Création de devis depuis un dossier, avec lignes prestations et remises.",
            "Calcul automatique des sous-totaux, TVA et total TTC.",
            "Export PDF aux couleurs FalconDraft et envoi par brouillon Gmail.",
            "Modèles d'équipe réutilisables et numérotation séquentielle.",
          ]}
        />
      </div>
    </PageTransition>
  );
}
