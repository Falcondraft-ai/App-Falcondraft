import { redirect } from "next/navigation";
import { CourtierShell } from "@/components/broker/courtier-shell";
import { requireActiveWorkspaceContext } from "@/lib/auth/session";
import { normalizeWorkspaceRole } from "@/lib/auth/workspace-permissions";
import { isBrokerWorkspace } from "@/lib/broker/access";
import { hasProposalAutomation } from "@/lib/billing/entitlements";
import {
  getActiveBrokerProfile,
  getBrokerProfiles,
} from "@/lib/broker/profiles";
import { computeStorageUsage } from "@/lib/broker/storage";

export default async function CourtierLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const context = await requireActiveWorkspaceContext();

  // Only insurance-broker workspaces use this module; everyone else goes back
  // to the commercial dashboard.
  if (!isBrokerWorkspace(context.organization)) {
    redirect("/dashboard");
  }

  const organization = context.organization!;

  // Cabinet à plusieurs sur un compte partagé : personne n'entre sans avoir dit
  // qui il est. Un cabinet sans profils n'est pas concerné et passe directement.
  const profiles = await getBrokerProfiles(organization.id);
  const activeProfile = await getActiveBrokerProfile(organization.id, profiles);
  if (profiles.length > 0 && !activeProfile) {
    redirect("/courtier/profils");
  }

  const displayName =
    activeProfile?.display_name ??
    context.profile?.full_name ??
    context.user.email ??
    "Utilisateur";
  const usage = computeStorageUsage(organization);

  return (
    <CourtierShell
      organizationName={organization.name}
      user={{
        name: displayName,
        email: activeProfile?.email ?? context.user.email ?? "",
        roleKey: normalizeWorkspaceRole(context.membership?.role) ?? "member",
      }}
      profiles={profiles}
      activeProfileId={activeProfile?.id ?? null}
      usage={usage}
      showProposals={hasProposalAutomation(organization)}
    >
      {children}
    </CourtierShell>
  );
}
