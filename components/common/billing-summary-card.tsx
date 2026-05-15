"use client";

import Link from "next/link";
import { useI18n } from "@/components/i18n/language-provider";
import { Button } from "@/components/ui/button";
import type {
  BillingInvoice,
  BillingSubscriptionSummary,
} from "@/types/user";

export function BillingSummaryCard({
  invoices,
  summary,
}: {
  invoices: BillingInvoice[];
  summary: BillingSubscriptionSummary;
}) {
  const { t } = useI18n();
  const detailParts = [
    summary.monthlyPrice,
    t("billing.statusDetail", {
      status: summary.status.toLowerCase(),
    }),
    summary.nextInvoiceLabel
      ? t("billing.nextInvoiceDetail", {
          nextInvoice: summary.nextInvoiceLabel,
        })
      : null,
  ].filter(Boolean);

  return (
    <section className="rounded-lg border bg-card">
      <div className="grid gap-4 border-b p-4 md:grid-cols-[1fr_auto] md:items-center">
        <div>
          <p className="text-muted-foreground text-sm">
            {t("billing.current")}
          </p>
          <h2 className="mt-1 text-xl font-semibold tracking-tight">
            {summary.planName}
          </h2>
          {detailParts.length > 0 ? (
            <p className="text-muted-foreground mt-2 text-sm">
              {detailParts.join(" · ")}
            </p>
          ) : null}
        </div>
        <Button asChild type="button">
          <Link href="/dashboard/support">{t("billing.manage")}</Link>
        </Button>
      </div>
      <div className="divide-y">
        {invoices.length > 0 ? (
          invoices.map((invoice) => (
            <div
              key={invoice.id}
              className="grid grid-cols-[1fr_auto_auto] items-center gap-4 px-4 py-3 text-sm"
            >
              <span className="font-medium">{invoice.period}</span>
              <span className="text-muted-foreground">{invoice.amount}</span>
              <span className="border px-2 py-1 text-xs">{invoice.status}</span>
            </div>
          ))
        ) : (
          <div className="px-4 py-4 text-sm text-muted-foreground">
            {t("billing.emptyInvoices")}
          </div>
        )}
      </div>
    </section>
  );
}
