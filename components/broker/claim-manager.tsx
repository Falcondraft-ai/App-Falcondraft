"use client";

import Link from "next/link";
import * as React from "react";
import { Plus, ShieldAlert } from "lucide-react";
import {
  ClaimForm,
  type ClaimContractOption,
} from "@/components/broker/claim-form";
import { ClaimStatusBadge } from "@/components/broker/claim-status-badge";
import { Button } from "@/components/ui/button";
import { claimDisplayLabel } from "@/lib/broker/claims";
import { formatEuro } from "@/lib/broker/commissions";
import { formatDate } from "@/lib/format";
import type { BrokerClaimRow } from "@/types/database";

export function ClaimManager({
  clientId,
  claims,
  contracts,
  canEdit,
}: {
  clientId: string;
  claims: BrokerClaimRow[];
  contracts: ClaimContractOption[];
  canEdit: boolean;
}) {
  const [adding, setAdding] = React.useState(false);

  return (
    <div className="space-y-4">
      {claims.length > 0 ? (
        <ul
          className="divide-y overflow-hidden rounded-md border"
          style={{ borderColor: "var(--border-1)" }}
        >
          {claims.map((claim) => (
            <li key={claim.id}>
              <Link
                href={`/courtier/clients/${clientId}/claims/${claim.id}`}
                className="flex items-center gap-3 px-3.5 py-3 transition-colors hover:bg-[rgba(14,34,56,0.025)]"
                style={{ background: "var(--bg-surface)" }}
              >
                <span
                  className="flex size-9 shrink-0 items-center justify-center rounded-lg"
                  style={{
                    background: "var(--brand-navy-50)",
                    border: "1px solid var(--border-1)",
                    color: "var(--brand-navy-700)",
                  }}
                >
                  <ShieldAlert className="size-4" strokeWidth={1.75} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-semibold text-[var(--fg-1)]">
                    {claimDisplayLabel(claim)}
                  </p>
                  <p className="truncate text-[11.5px] text-[var(--fg-3)]">
                    {claim.occurrence_date
                      ? `Survenu le ${formatDate(claim.occurrence_date)}`
                      : "Date non précisée"}
                    {claim.amount_settled != null
                      ? ` · Indemnisé ${formatEuro(claim.amount_settled, claim.currency)}`
                      : claim.amount_estimate != null
                        ? ` · Estimé ${formatEuro(claim.amount_estimate, claim.currency)}`
                        : ""}
                  </p>
                </div>
                <ClaimStatusBadge status={claim.status} />
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-[12.5px] text-[var(--fg-3)]">
          Aucun sinistre déclaré. Déclarez un sinistre pour suivre son
          instruction et l’indemnisation du client.
        </p>
      )}

      {canEdit ? (
        adding ? (
          <div
            className="rounded-md border p-4"
            style={{
              borderColor: "var(--border-1)",
              background: "var(--bg-sunken)",
            }}
          >
            <ClaimForm
              clientId={clientId}
              contracts={contracts}
              canEdit={canEdit}
              mode="create"
              onCreated={() => setAdding(false)}
              onCancel={() => setAdding(false)}
            />
          </div>
        ) : (
          <Button
            type="button"
            variant="ghost"
            onClick={() => setAdding(true)}
            className="inline-flex items-center gap-1.5"
          >
            <Plus className="size-3.5" strokeWidth={2} />
            Déclarer un sinistre
          </Button>
        )
      ) : null}
    </div>
  );
}
