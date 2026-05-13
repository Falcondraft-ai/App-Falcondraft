import Link from "next/link";
import { DealsTable } from "@/components/deals/deals-table";
import { PageHeader } from "@/components/common/page-header";
import { PageTransition } from "@/components/common/page-transition";
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
          eyebrow="Dossiers commerciaux"
          title="Pipeline commercial"
          description="Liste de travail des dossiers commerciaux et de leur progression documentaire."
          actions={
            <Button asChild>
              <Link href="/dashboard/deals/new">
                Nouveau dossier commercial
              </Link>
            </Button>
          }
        />
        {canOpenCompanyView ? (
          <Tabs defaultValue="mine" className="gap-4">
            <TabsList>
              <TabsTrigger value="mine">Mes dossiers</TabsTrigger>
              <TabsTrigger value="organization">Toute l’entreprise</TabsTrigger>
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
