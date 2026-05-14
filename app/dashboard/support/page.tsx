import { PageHeader } from "@/components/common/page-header";
import { SupportPageContent } from "@/components/support/support-page-content";
import { T } from "@/components/i18n/translated-text";

export default function SupportPage() {
  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow={<T tx="support.eyebrow" />}
        title={<T tx="support.title" />}
        description={<T tx="support.description" />}
      />
      <SupportPageContent />
    </div>
  );
}
