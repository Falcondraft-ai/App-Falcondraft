import { ImapMailboxCard, type MailboxSummary } from "@/components/broker/imap-mailbox-card";
import { OutlookConnectionCard } from "@/components/broker/outlook-connection-card";
import { requireActiveWorkspaceContext } from "@/lib/auth/session";
import { getBrokerProfiles } from "@/lib/broker/profiles";
import { getOutlookConnectionForUser } from "@/lib/email/connections";
import { IMAP_PROVIDER } from "@/lib/email/mailbox-resolver";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function CourtierIntegrationsSettingsPage() {
  const context = await requireActiveWorkspaceContext();
  const organization = context.organization!;

  const [outlookConnection, profiles] = await Promise.all([
    getOutlookConnectionForUser({
      organizationId: organization.id,
      userId: context.user.id,
    }),
    getBrokerProfiles(organization.id),
  ]);

  // Boîtes IMAP déjà connectées, par profil. Le mot de passe chiffré n'est
  // évidemment jamais lu ici : seul l'état de la connexion remonte à l'écran.
  const admin = getSupabaseAdminClient();
  const { data: rows } = admin
    ? await admin
        .from("email_connections")
        .select("profile_id, email, provider, last_verified_at")
        .eq("organization_id", organization.id)
        .eq("user_id", context.user.id)
        .eq("provider", IMAP_PROVIDER)
        .eq("status", "connected")
    : { data: null };

  const mailboxes: MailboxSummary[] = (rows ?? [])
    .filter((r) => r.profile_id)
    .map((r) => ({
      profileId: r.profile_id!,
      email: r.email,
      provider: r.provider,
      lastVerifiedAt: r.last_verified_at,
    }));

  return (
    <div className="space-y-8">
      <section className="space-y-4">
        <div>
          <h2 className="text-[14px] font-semibold text-[var(--fg-1)]">
            Boîtes email du cabinet
          </h2>
          <p className="mt-0.5 max-w-2xl text-[12.5px] leading-5 text-[var(--fg-3)]">
            Une boîte par personne. Chacun retrouve son propre briefing du matin,
            et les dossiers clients rassemblent les échanges de toutes les
            boîtes. Fonctionne avec n’importe quel hébergeur (IONOS, OVH,
            Gandi…). Aucun email n’est jamais envoyé automatiquement.
          </p>
        </div>
        <div className="max-w-2xl">
          <ImapMailboxCard profiles={profiles} mailboxes={mailboxes} />
        </div>
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="text-[14px] font-semibold text-[var(--fg-1)]">
            Connexion Microsoft 365
          </h2>
          <p className="mt-0.5 max-w-2xl text-[12.5px] leading-5 text-[var(--fg-3)]">
            À utiliser uniquement si vos adresses sont hébergées chez Microsoft.
            Une adresse gérée par un autre hébergeur passe par la connexion
            ci-dessus, même si vous la consultez dans le logiciel Outlook.
          </p>
        </div>
        <div className="max-w-xl">
          <OutlookConnectionCard initialConnection={outlookConnection} />
        </div>
      </section>
    </div>
  );
}
