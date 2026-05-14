import Link from "next/link";
import { GeneratedDocumentButtons } from "@/components/deals/generated-documents-panel";
import { T } from "@/components/i18n/translated-text";
import type { MockDocument } from "@/types/document";
import { formatDate } from "@/lib/format";
import type { TranslationKey } from "@/lib/i18n/translations";
import { cn } from "@/lib/utils";

const documentStatusStyles = {
  ready: "text-emerald-900 border-emerald-700/35",
  draft: "text-slate-700 border-slate-300",
  generating: "text-amber-900 border-amber-500/45",
  sent: "text-slate-900 border-slate-400",
} satisfies Record<MockDocument["status"], string>;

export function DocumentCard({ document }: { document: MockDocument }) {
  const generatedDocument = {
    id: document.id,
    type: document.rawType,
    label: document.type,
    title: document.title,
    status: document.status,
    createdAt: document.createdAt,
    url: document.url,
    hasStoragePath: document.hasStoragePath,
  };

  return (
    <article className="grid gap-4 border-b px-4 py-4 last:border-b-0 md:grid-cols-[minmax(0,1.1fr)_minmax(13rem,0.9fr)_6rem_12rem] md:items-center">
      <div className="flex min-w-0 items-start gap-3">
        <span
          className="bg-primary/75 mt-1 h-8 w-1 shrink-0"
          aria-hidden="true"
        />
        <div className="min-w-0">
          <p className="text-muted-foreground text-xs font-medium tracking-[0.08em] uppercase">
            <T tx={`documentType.${document.type}` as TranslationKey} />
          </p>
          <p className="mt-1 truncate text-sm font-semibold tracking-[-0.01em]">
            {document.clientCompanyName}
          </p>
          <p className="text-muted-foreground mt-1 truncate text-xs">
            {document.title}
          </p>
        </div>
      </div>
      <div>
        <p className="text-muted-foreground text-xs">
          <T tx="documents.dealLabel" />
        </p>
        <Link
          href={`/dashboard/deals/${document.relatedDealId}`}
          className="hover:text-primary mt-1 block text-sm font-medium transition-colors"
        >
          {document.relatedDealName}
        </Link>
        <div className="text-muted-foreground mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs">
          <span>{formatDate(document.createdAt)}</span>
          <span>{document.ownerName}</span>
        </div>
      </div>
      <div className="md:flex md:justify-start">
        <span
          className={cn(
            "border px-2 py-1 text-xs font-medium",
            documentStatusStyles[document.status],
          )}
        >
          <T tx={`common.status.${document.status}` as TranslationKey} />
        </span>
      </div>
      <div className="flex items-center md:justify-end">
        <GeneratedDocumentButtons
          document={generatedDocument}
          compact
          showOpen={
            document.rawType !== "quote_pdf" &&
            document.rawType !== "final_document_pdf"
          }
          downloadLabel={
            document.rawType === "quote_pdf" ? (
              <T tx="common.actions.downloadQuote" />
            ) : document.rawType === "final_document_pdf" ? (
              <T tx="common.actions.downloadFinalDocument" />
            ) : (
              <T tx="common.actions.download" />
            )
          }
        />
      </div>
    </article>
  );
}
