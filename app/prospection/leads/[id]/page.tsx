import { notFound } from "next/navigation";
import { PageTransition } from "@/components/common/page-transition";
import { LeadDetail } from "@/components/prospection/lead-detail";
import { requireCurrentUserContext } from "@/lib/auth/session";
import { canAccessProspection } from "@/lib/internal-access";
import {
  getProspectCompanyById,
  getProspectInteractions,
  getProspectTasks,
} from "@/lib/prospection/data";

export default async function LeadDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const context = await requireCurrentUserContext();

  if (!canAccessProspection(context)) {
    notFound();
  }

  const organizationId = context.organization?.id;
  if (!organizationId) notFound();

  const company = await getProspectCompanyById(organizationId, id);
  if (!company) notFound();

  const [interactions, tasks] = await Promise.all([
    getProspectInteractions(organizationId, id),
    getProspectTasks(organizationId, { companyId: id }),
  ]);

  return (
    <PageTransition>
      <LeadDetail
        company={company}
        initialInteractions={interactions}
        initialTasks={tasks}
      />
    </PageTransition>
  );
}
