import { NewDealForm } from "@/components/deals/new-deal-form";
import { PageHeader } from "@/components/common/page-header";
import { PageTransition } from "@/components/common/page-transition";
import { T } from "@/components/i18n/translated-text";

export default function NewDealPage() {
  return (
    <PageTransition>
      <div className="mx-auto max-w-5xl space-y-6">
        <PageHeader
          eyebrow={<T tx="dealDetail.newEyebrow" />}
          title={<T tx="dealDetail.newTitle" />}
          description={<T tx="dealDetail.newDescription" />}
        />
        <NewDealForm />
      </div>
    </PageTransition>
  );
}
