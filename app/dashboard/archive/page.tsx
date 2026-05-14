import { DealsTable } from "@/components/deals/deals-table";
import { EmptyState } from "@/components/common/empty-state";
import { PageHeader } from "@/components/common/page-header";
import { PageTransition } from "@/components/common/page-transition";
import { T } from "@/components/i18n/translated-text";
import { requireCurrentUserContext } from "@/lib/auth/session";
import { getDealsForOrganization } from "@/lib/data/supabase-app-data";

export default async function ArchivePage() {
  const context = await requireCurrentUserContext();
  const deals = await getDealsForOrganization(
    context.organization?.id ?? null,
    {
      archive: "only",
      access: {
        userId: context.user.id,
        role: context.membership?.role,
        allowMemberCompanyVisibility:
          context.organization?.allow_member_company_visibility ?? true,
        scope: "organization",
      },
    },
  );

  return (
    <PageTransition>
      <div className="space-y-6">
        <PageHeader
          eyebrow={<T tx="archives.eyebrow" />}
          title={<T tx="archives.title" />}
          description={<T tx="archives.description" />}
        />
        {deals.length > 0 ? (
          <DealsTable deals={deals} mode="archived" />
        ) : (
          <section className="bg-card/75 rounded-lg border p-4">
            <EmptyState
              title={<T tx="common.empty.archives.title" />}
              description={<T tx="common.empty.archives.description" />}
            />
          </section>
        )}
      </div>
    </PageTransition>
  );
}
