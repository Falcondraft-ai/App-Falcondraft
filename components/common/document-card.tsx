import Link from "next/link";
import { MockActionButton } from "@/components/common/mock-action-button";
import {
  documentStatusLabels,
  documentTypeLabels,
  type MockDocument,
} from "@/types/document";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

const documentStatusStyles = {
  ready: "text-emerald-900 border-emerald-700/35",
  draft: "text-slate-700 border-slate-300",
  generating: "text-amber-900 border-amber-500/45",
  sent: "text-slate-900 border-slate-400",
} satisfies Record<MockDocument["status"], string>;

export function DocumentCard({ document }: { document: MockDocument }) {
  return (
    <article className="grid gap-4 border-b px-4 py-4 last:border-b-0 md:grid-cols-[1.2fr_1fr_auto] md:items-center">
      <div className="flex min-w-0 items-start gap-3">
        <span className="mt-1 h-8 w-1 shrink-0 bg-primary/75" aria-hidden="true" />
        <div className="min-w-0">
          <p className="text-sm font-semibold">{document.title}</p>
          <p className="text-muted-foreground mt-1 text-sm">
            {documentTypeLabels[document.type]} · {document.clientCompanyName}
          </p>
        </div>
      </div>
      <div>
        <Link
          href={`/dashboard/deals/${document.relatedDealId}`}
          className="hover:text-primary text-sm font-medium transition-colors"
        >
          {document.relatedDealName}
        </Link>
        <div className="text-muted-foreground mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs">
          <span>{formatDate(document.createdAt)}</span>
          <span>{document.ownerName}</span>
        </div>
      </div>
      <div className="flex items-center gap-3 md:justify-end">
        <span
          className={cn(
            "border px-2 py-1 text-xs font-medium",
            documentStatusStyles[document.status],
          )}
        >
          {documentStatusLabels[document.status]}
        </span>
        <MockActionButton
          label="Ouvrir"
          message={`${documentTypeLabels[document.type]} prêt à consulter.`}
          variant="outline"
          size="sm"
        />
      </div>
    </article>
  );
}
