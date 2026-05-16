import { DealsTable } from "@/components/deals/deals-table";
import { ArchivedTranscriptsList } from "@/components/transcripts/archived-transcripts-list";
import { EmptyState } from "@/components/common/empty-state";
import { PageHeader } from "@/components/common/page-header";
import { PageTransition } from "@/components/common/page-transition";
import { T } from "@/components/i18n/translated-text";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { requireCurrentUserContext } from "@/lib/auth/session";
import { getDealsForOrganization } from "@/lib/data/supabase-app-data";
import { getArchivedTranscripts } from "@/lib/data/transcripts";

export default async function ArchivePage() {
  const context = await requireCurrentUserContext();
  const organizationId = context.organization?.id ?? null;
  const access = {
    userId: context.user.id,
    role: context.membership?.role,
    allowMemberCompanyVisibility:
      context.organization?.allow_member_company_visibility ?? true,
    scope: "organization" as const,
  };

  const [deals, archivedTranscripts] = await Promise.all([
    getDealsForOrganization(organizationId, {
      archive: "only",
      access,
    }),
    getArchivedTranscripts(organizationId, access),
  ]);

  return (
    <PageTransition>
      <div className="space-y-6">
        <PageHeader
          eyebrow={<T tx="archives.eyebrow" />}
          title={<T tx="archives.title" />}
          description={<T tx="archives.description" />}
        />
        <Tabs defaultValue="deals" className="gap-4">
          <TabsList>
            <TabsTrigger value="deals">
              <T tx="nav.deals" /> ({deals.length})
            </TabsTrigger>
            <TabsTrigger value="transcripts">
              <T tx="nav.transcripts" /> ({archivedTranscripts.length})
            </TabsTrigger>
          </TabsList>
          <TabsContent value="deals">
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
          </TabsContent>
          <TabsContent value="transcripts">
            <ArchivedTranscriptsList
              transcripts={archivedTranscripts}
              userRole={context.membership?.role ?? "viewer"}
            />
          </TabsContent>
        </Tabs>
      </div>
    </PageTransition>
  );
}
