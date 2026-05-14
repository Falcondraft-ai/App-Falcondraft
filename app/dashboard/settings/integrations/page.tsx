import { PageTransition } from "@/components/common/page-transition";
import { GmailConnectionCard } from "@/components/settings/gmail-connection-card";
import { requireCurrentUserContext } from "@/lib/auth/session";
import { getGmailConnectionForUser } from "@/lib/email/connections";

export default async function IntegrationsSettingsPage() {
  const context = await requireCurrentUserContext();
  const organizationId = context.organization?.id ?? null;
  const gmailConnection = await getGmailConnectionForUser({
    organizationId,
    userId: context.user.id,
  });

  return (
    <PageTransition>
      <div className="space-y-6">
        <div className="max-w-3xl">
          <p className="text-muted-foreground text-sm leading-6">
            Connectez votre compte email pour préparer les brouillons d’envoi
            depuis votre propre messagerie.
          </p>
        </div>
        <GmailConnectionCard initialConnection={gmailConnection} />
      </div>
    </PageTransition>
  );
}
