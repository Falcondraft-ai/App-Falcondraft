import { MailboxView } from "@/components/broker/mailbox-view";
import { PageHeader } from "@/components/common/page-header";
import { PageTransition } from "@/components/common/page-transition";
import { requireActiveWorkspaceContext } from "@/lib/auth/session";
import { getActiveBrokerProfile } from "@/lib/broker/profiles";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function CourtierMailboxPage() {
  const context = await requireActiveWorkspaceContext();
  const profile = await getActiveBrokerProfile(context.organization!.id);

  return (
    <PageTransition>
      <div className="space-y-5">
        <PageHeader
          title="Vos emails"
          description={
            profile
              ? `La boîte de ${profile.display_name}, en entier. Consulter votre courrier ne déclenche aucune analyse.`
              : "Votre boîte email en entier. Consulter votre courrier ne déclenche aucune analyse."
          }
        />
        <MailboxView />
      </div>
    </PageTransition>
  );
}
