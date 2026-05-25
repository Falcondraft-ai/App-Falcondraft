import { DocumentCard } from "@/components/common/document-card";
import type { ReactNode } from "react";
import { EmptyState } from "@/components/common/empty-state";
import { PageHeader } from "@/components/common/page-header";
import { PageTransition } from "@/components/common/page-transition";
import { T } from "@/components/i18n/translated-text";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { requireCurrentUserContext } from "@/lib/auth/session";
import { canUseOrganizationDataScope } from "@/lib/auth/workspace-permissions";
import { getDocumentsForOrganization } from "@/lib/data/supabase-app-data";
import type { MockDocument } from "@/types/document";

function DocumentsLibrary({
  documents,
  description,
}: {
  documents: MockDocument[];
  description: ReactNode;
}) {
  return (
    <section className="bg-card/75 rounded-lg border">
      <div className="border-b px-4 py-3">
        <h2 className="text-sm font-semibold">
          <T tx="documents.libraryTitle" />
        </h2>
        <p className="text-muted-foreground mt-1 text-sm">{description}</p>
      </div>
      <div>
        {documents.length > 0 ? (
          documents.map((document) => (
            <DocumentCard key={document.id} document={document} />
          ))
        ) : (
          <div className="p-4">
            <EmptyState
              title={<T tx="common.empty.documents.title" />}
              description={<T tx="common.empty.documents.description" />}
            />
          </div>
        )}
      </div>
    </section>
  );
}

export default async function DocumentsPage() {
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
  const [ownDocuments, companyDocuments] = await Promise.all([
    getDocumentsForOrganization(organizationId, {
      ...access,
      scope: "mine",
    }),
    canOpenCompanyView
      ? getDocumentsForOrganization(organizationId, {
          ...access,
          scope: "organization",
        })
      : Promise.resolve([]),
  ]);

  return (
    <PageTransition>
      <div className="space-y-6">
        <PageHeader
          eyebrow={<T tx="documents.eyebrow" />}
          title={<T tx="documents.title" />}
          description={<T tx="documents.description" />}
        />
        {canOpenCompanyView ? (
          <Tabs defaultValue="mine" className="gap-5">
            <TabsList
              variant="line"
              className="h-9 w-full justify-start gap-6 border-b border-[var(--border)] p-0"
            >
              <TabsTrigger
                value="mine"
                className="h-9 rounded-none border-0 px-0 text-sm text-[var(--muted-foreground)] transition-colors duration-150 hover:text-[var(--foreground)] data-active:font-medium data-active:text-[var(--foreground)] after:!h-[2px] after:!bg-[var(--accent)] after:!bottom-[-1px]"
              >
                <T tx="documents.tabs.mine" />
              </TabsTrigger>
              <TabsTrigger
                value="organization"
                className="h-9 rounded-none border-0 px-0 text-sm text-[var(--muted-foreground)] transition-colors duration-150 hover:text-[var(--foreground)] data-active:font-medium data-active:text-[var(--foreground)] after:!h-[2px] after:!bg-[var(--accent)] after:!bottom-[-1px]"
              >
                <T tx="documents.tabs.organization" />
              </TabsTrigger>
            </TabsList>
            <TabsContent value="mine">
              <DocumentsLibrary
                documents={ownDocuments}
                description={<T tx="documents.libraryMine" />}
              />
            </TabsContent>
            <TabsContent value="organization">
              <DocumentsLibrary
                documents={companyDocuments}
                description={<T tx="documents.libraryOrganization" />}
              />
            </TabsContent>
          </Tabs>
        ) : (
          <DocumentsLibrary
            documents={ownDocuments}
            description={<T tx="documents.libraryMine" />}
          />
        )}
      </div>
    </PageTransition>
  );
}
