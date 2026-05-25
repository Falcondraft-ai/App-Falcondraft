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
          <Tabs
            key={initialScope}
            defaultValue={initialScope}
            className="gap-5"
          >
            <TabsList
              variant="line"
              className="h-9 w-full justify-start gap-6 border-b border-[var(--border)] p-0"
            >
              <TabsTrigger
                value="mine"
                className="h-9 rounded-none border-0 px-0 text-sm text-[var(--muted-foreground)] transition-colors duration-150 hover:text-[var(--foreground)] data-active:font-medium data-active:text-[var(--foreground)] after:!h-[2px] after:!bg-[var(--accent)] after:!bottom-[-1px]"
              >
                <T tx="deals.tabs.mine" />
              </TabsTrigger>
              <TabsTrigger
                value="organization"
                className="h-9 rounded-none border-0 px-0 text-sm text-[var(--muted-foreground)] transition-colors duration-150 hover:text-[var(--foreground)] data-active:font-medium data-active:text-[var(--foreground)] after:!h-[2px] after:!bg-[var(--accent)] after:!bottom-[-1px]"
              >
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
