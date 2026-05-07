"use client";

import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { BillingInvoice } from "@/types/user";

export function BillingSummaryCard({
  invoices,
}: {
  invoices: BillingInvoice[];
}) {
  return (
    <section className="rounded-lg border bg-card">
      <div className="grid gap-4 border-b p-4 md:grid-cols-[1fr_auto] md:items-center">
        <div>
          <p className="text-muted-foreground text-sm">Abonnement actuel</p>
          <h2 className="mt-1 text-xl font-semibold tracking-tight">
            FalconDraft Professionnel
          </h2>
          <p className="text-muted-foreground mt-2 text-sm">
            490 € / mois · Statut actif · Prochaine facture le 1 juin 2026
          </p>
        </div>
        <Button
          type="button"
          onClick={() => {
            toast.success("Ouverture de la gestion d’abonnement.");
          }}
        >
          Gérer l’abonnement
        </Button>
      </div>
      <div className="divide-y">
        {invoices.map((invoice) => (
          <div
            key={invoice.id}
            className="grid grid-cols-[1fr_auto_auto] items-center gap-4 px-4 py-3 text-sm"
          >
            <span className="font-medium">{invoice.period}</span>
            <span className="text-muted-foreground">{invoice.amount}</span>
            <span className="rounded-[4px] border px-2 py-1 text-xs">
              {invoice.status}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
