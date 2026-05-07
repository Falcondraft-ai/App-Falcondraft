import { NewDealForm } from "@/components/deals/new-deal-form";
import { PageHeader } from "@/components/common/page-header";
import { PageTransition } from "@/components/common/page-transition";
import { requireCurrentUserContext } from "@/lib/auth/session";

export default async function NewDealPage() {
  const context = await requireCurrentUserContext();

  return (
    <PageTransition>
      <div className="mx-auto max-w-5xl space-y-6">
        <PageHeader
          eyebrow="Nouvelle opportunité"
          title="Créer une opportunité"
          description="Ajoutez les informations commerciales et les notes qui serviront de base au compte-rendu puis à la proposition."
        />
        <NewDealForm
          organizationId={context.organization?.id ?? null}
          ownerProfileId={context.profile?.id ?? context.user.id}
        />
      </div>
    </PageTransition>
  );
}
