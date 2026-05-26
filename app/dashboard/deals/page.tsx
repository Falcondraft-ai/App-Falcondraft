import Link from "next/link";
import { DealsTable } from "@/components/deals/deals-table";
import { DealsScopeTabs } from "@/components/deals/deals-scope-tabs";
import { PageHeader } from "@/components/common/page-header";
import { PageTransition } from "@/components/common/page-transition";
import { T } from "@/components/i18n/translated-text";
import { Button } from "@/components/ui/button";
import { requireCurrentUserContext } from "@/lib/auth/session";
import { canUseOrganizationDataScope } from "@/lib/auth/workspace-permissions";
import { getDealsForOrganization } from "@/lib/data/supabase-app-data";

export default async function DealsPage({
  searchParams,
}: {
  searchParams: Promise<{ scope?: string | string[] }>;
}) {
  const params = await searchParams;
  const rawScope = Array.isArray(params.scope) ? params.scope[0] : params.scope;
  const initialScope = rawScope === "organization" ? "organization" : "mine";

  const context = await requireCurrentUserContext();
  const organizationId = context.organization?.id ?? null;
  const access = {
    userId: context.user.id,
    role: context.membership?.role,
    allowMemberCompanyVisibility:
      context.organization?.allow_member_company_visibility ?? true,
  };
  const canOpenCompanyView = canUseOrganizationDataScope(
    access.role,
    access.allowMemberCompanyVisibility,
  );
  const [ownDeals, companyDeals] = await Promise.all([
    getDealsForOrganization(organizationId, {
      access: { ...access, scope: "mine" },
    }),
    canOpenCompanyView
      ? getDealsForOrganization(organizationId, {
          access: { ...access, scope: "organization" },
        })
      : Promise.resolve([]),
  ]);

  return (
    <PageTransition>
      <div className="space-y-6">
        <PageHeader
          eyebrow={<T tx="deals.eyebrow" />}
          title={<T tx="deals.title" />}
          description={<T tx="deals.description" />}
          actions={
            <Button
              asChild
              className="rounded-md bg-[var(--primary)] text-[var(--primary-foreground)] hover:bg-[var(--primary-hover)]"
            >
              <Link href="/dashboard/deals/new">
                <T tx="common.actions.newDeal" />
              </Link>
            </Button>
          }
        />
        {canOpenCompanyView ? (
          <DealsScopeTabs
            ownDeals={ownDeals}
            companyDeals={companyDeals}
            initialScope={initialScope}
          />
        ) : (
          <DealsTable deals={ownDeals} />
        )}
      </div>
    </PageTransition>
  );
}
