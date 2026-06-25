import { OutlookConnectionCard } from "@/components/broker/outlook-connection-card";
import { requireActiveWorkspaceContext } from "@/lib/auth/session";
import { getOutlookConnectionForUser } from "@/lib/email/connections";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function CourtierIntegrationsSettingsPage() {
  const context = await requireActiveWorkspaceContext();
  const organization = context.organization!;
  const outlookConnection = await getOutlookConnectionForUser({
    organizationId: organization.id,
    userId: context.user.id,
  });

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-[14px] font-semibold text-[var(--fg-1)]">
          Connexion Outlook
        </h2>
        <p className="mt-0.5 text-[12.5px] leading-5 text-[var(--fg-3)]">
          Reliez votre boîte Microsoft 365 pour le suivi des emails et les
          brouillons clients. Aucun email n’est jamais envoyé automatiquement.
        </p>
      </div>
      <div className="max-w-xl">
        <OutlookConnectionCard initialConnection={outlookConnection} />
      </div>
    </div>
  );
}
