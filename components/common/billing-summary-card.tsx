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
  void invoices;
  const detailParts = [
    summary.monthlyPrice,
    t("billing.statusDetail", {
      status: summary.status.toLowerCase(),
    }),
  ].filter(Boolean);

  return (
    <section className="rounded-lg border bg-card">
      <div className="grid gap-4 p-4 md:grid-cols-[1fr_auto] md:items-center">
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
    </section>
  );
}
