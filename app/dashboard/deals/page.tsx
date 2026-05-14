import Link from "next/link";
import { DealsTable } from "@/components/deals/deals-table";
import { PageHeader } from "@/components/common/page-header";
import { PageTransition } from "@/components/common/page-transition";
import { T } from "@/components/i18n/translated-text";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { requireCurrentUserContext } from "@/lib/auth/session";
import { canUseOrganizationDataScope } from "@/lib/auth/workspace-permissions";
import { getDealsForOrganization } from "@/lib/data/supabase-app-data";

export default async function DealsPage() {
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
            <Button asChild>
              <Link href="/dashboard/deals/new">
                <T tx="common.actions.newDeal" />
              </Link>
            </Button>
          }
        />
        {canOpenCompanyView ? (
          <Tabs defaultValue="mine" className="gap-4">
            <TabsList>
              <TabsTrigger value="mine">
                <T tx="deals.tabs.mine" />
              </TabsTrigger>
              <TabsTrigger value="organization">
                <T tx="deals.tabs.organization" />
              </TabsTrigger>
            </TabsList>
            <TabsContent value="mine">
              <DealsTable deals={ownDeals} />
            </TabsContent>
            <TabsContent value="organization">
              <DealsTable deals={companyDeals} />
            </TabsContent>
          </Tabs>
        ) : (
          <DealsTable deals={ownDeals} />
        )}
      </div>
    </PageTransition>
  );
}
