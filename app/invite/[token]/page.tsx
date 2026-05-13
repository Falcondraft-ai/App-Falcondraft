import { AuthShell } from "@/components/auth/auth-shell";
import { InviteOnboarding } from "@/components/invitations/invite-onboarding";
import { lookupInvitationByToken } from "@/lib/invitations/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { InvitationLookupResult } from "@/lib/invitations/shared";

type InvitePageProps = {
  params: Promise<{
    token: string;
  }>;
};

const unavailableLookup: InvitationLookupResult = {
  valid: false,
  state: "invalid",
  invitation: null,
};

export default async function InvitePage({ params }: InvitePageProps) {
  const { token } = await params;
  const adminSupabase = getSupabaseAdminClient();
  const lookup = adminSupabase
    ? await lookupInvitationByToken(adminSupabase, token)
    : unavailableLookup;
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = supabase
    ? await supabase.auth.getUser()
    : {
        data: {
          user: null,
        },
      };

  return (
    <AuthShell
      eyebrow="Invitation"
      title="Rejoindre un espace FalconDraft"
      cardTitle="Accès sur invitation"
      cardDescription="Créez votre compte ou connectez-vous uniquement avec l’adresse invitée."
      footer={
        <>
          <span>Création de compte privée.</span>
          <span className="hidden sm:inline">FalconDraft</span>
        </>
      }
    >
      <InviteOnboarding
        token={token}
        lookup={lookup}
        currentUserEmail={user?.email ?? null}
      />
    </AuthShell>
  );
}
