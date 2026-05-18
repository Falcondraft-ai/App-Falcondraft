import { PageTransition } from "@/components/common/page-transition";
import { ProspectionPage } from "@/components/prospection/prospection-page";
import { requireCurrentUserContext } from "@/lib/auth/session";
import { canAccessProspection, canManageProspection } from "@/lib/internal-access";
import {
  getProspectCompanies,
  getProspectingSearches,
  getAllProspectDocuments,
} from "@/lib/prospection/data";

export default async function ProspectionRoute() {
  const context = await requireCurrentUserContext();

  if (!canAccessProspection(context)) {
    return null;
  }

  const organizationId = context.organization?.id;
  if (!organizationId) return null;

  const isManager = canManageProspection(context);

  const [companies, searches, allDocuments] = await Promise.all([
    getProspectCompanies(organizationId),
    getProspectingSearches(organizationId),
    isManager ? getAllProspectDocuments(organizationId) : Promise.resolve([]),
  ]);

  return (
    <PageTransition>
      <ProspectionPage
        initialCompanies={companies}
        initialSearches={searches}
        initialAllDocuments={allDocuments}
        isManager={isManager}
      />
    </PageTransition>
  );
}
