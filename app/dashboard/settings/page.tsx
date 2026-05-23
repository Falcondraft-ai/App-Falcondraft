import { PageTransition } from "@/components/common/page-transition";
import { GeneralSettingsForm } from "@/components/settings/general-settings-form";
import { OrganizationQuoteDefaults } from "@/components/settings/organization-quote-defaults";
import { WorkspaceVisibilitySettings } from "@/components/settings/workspace-visibility-settings";
import { requireCurrentUserContext } from "@/lib/auth/session";
import { canManageWorkspaceSettings } from "@/lib/auth/workspace-permissions";

export default async function SettingsPage() {
  const context = await requireCurrentUserContext();
  const organization = context.organization;
  const userName =
    context.profile?.full_name ?? context.user.email ?? "Utilisateur";

  return (
    <PageTransition>
      <div className="space-y-5">
        <GeneralSettingsForm
          organizationName={organization?.name ?? "Espace client"}
          userName={userName}
          userEmail={context.user.email ?? ""}
        />
        {canManageWorkspaceSettings(context.membership?.role) ? (
          <>
            <WorkspaceVisibilitySettings
              initialAllowMemberCompanyVisibility={
                organization?.allow_member_company_visibility ?? true
              }
            />
            <OrganizationQuoteDefaults
              initialDefaultQuoteClientType={
                organization?.default_quote_client_type ?? "company"
              }
              initialDefaultQuoteTaxRate={
                organization?.default_quote_tax_rate ?? 20
              }
            />
          </>
        ) : null}
      </div>
    </PageTransition>
  );
}
