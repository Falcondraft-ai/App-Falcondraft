"use client";

import Link from "next/link";
import * as React from "react";
import { Plus, ShieldCheck } from "lucide-react";
import { ContractForm } from "@/components/broker/contract-form";
import { ContractStatusBadge } from "@/components/broker/contract-status-badge";
import { Button } from "@/components/ui/button";
import type { BrokerInsuranceType } from "@/lib/broker/clients";
import {
  contractDisplayLabel,
  formatContractPremium,
  renewalUrgency,
  renewalUrgencyTone,
} from "@/lib/broker/contracts";
import { formatDate } from "@/lib/format";
import type { BrokerContractRow } from "@/types/database";

export function ContractManager({
  clientId,
  contracts,
  branches,
  insurers,
  canEdit,
}: {
  clientId: string;
  contracts: BrokerContractRow[];
  branches: BrokerInsuranceType[];
  insurers: string[];
  canEdit: boolean;
}) {
  const [adding, setAdding] = React.useState(false);

  return (
    <div className="space-y-4">
      {contracts.length > 0 ? (
        <ul
          className="divide-y overflow-hidden rounded-md border"
          style={{ borderColor: "var(--border-1)" }}
        >
          {contracts.map((contract) => {
            const urgency = renewalUrgency(contract);
            const tone = renewalUrgencyTone[urgency];
            return (
              <li key={contract.id}>
                <Link
                  href={`/courtier/clients/${clientId}/contracts/${contract.id}`}
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
                    <ShieldCheck className="size-4" strokeWidth={1.75} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-semibold text-[var(--fg-1)]">
                      {contractDisplayLabel(contract)}
                    </p>
                    <p className="truncate text-[11.5px] text-[var(--fg-3)]">
                      {formatContractPremium(contract)}
                      {contract.renewal_date
                        ? ` · Échéance ${formatDate(contract.renewal_date)}`
                        : ""}
                    </p>
                  </div>
                  {urgency === "overdue" || urgency === "soon" ? (
                    <span
                      className="hidden shrink-0 rounded-full border px-2 py-[3px] text-[10.5px] font-semibold sm:inline-flex"
                      style={{
                        color: tone.fg,
                        background: tone.bg,
                        borderColor: tone.bd,
                      }}
                    >
                      {urgency === "overdue" ? "À renouveler" : "Échéance proche"}
                    </span>
                  ) : null}
                  <ContractStatusBadge status={contract.status} />
                </Link>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-[12.5px] text-[var(--fg-3)]">
          Aucun contrat enregistré. Ajoutez les contrats en cours du client pour
          suivre leurs échéances et leurs renouvellements.
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
            <ContractForm
              clientId={clientId}
              branches={branches}
              insurers={insurers}
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
            Ajouter un contrat
          </Button>
        )
      ) : null}
    </div>
  );
}
