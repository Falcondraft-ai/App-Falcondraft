import { PageTransition } from "@/components/common/page-transition";
import { T } from "@/components/i18n/translated-text";
import { GmailConnectionCard } from "@/components/settings/gmail-connection-card";
import { requireCurrentUserContext } from "@/lib/auth/session";
import {
  getGmailConnectionForUser,
  getOutlookConnectionForUser,
} from "@/lib/email/connections";

export default async function IntegrationsSettingsPage() {
  const context = await requireCurrentUserContext();
  const organizationId = context.organization?.id ?? null;
  const [gmailConnection, outlookConnection] = await Promise.all([
    getGmailConnectionForUser({ organizationId, userId: context.user.id }),
    getOutlookConnectionForUser({ organizationId, userId: context.user.id }),
  ]);

  return (
    <PageTransition>
      <div className="space-y-6">
        <div className="max-w-3xl">
          <p className="text-muted-foreground text-sm leading-6">
            <T tx="integrations.description" />
          </p>
        </div>
        <GmailConnectionCard
          initialConnection={gmailConnection}
          initialOutlookConnection={outlookConnection}
        />
      </div>
    </PageTransition>
  );
}
