"use client";

import * as React from "react";
import { ChevronDown, Plus } from "lucide-react";
import {
  CommissionLineForm,
  type LineClientOption,
  type LineContractOption,
} from "@/components/broker/commission-line-form";
import { CommissionStatusBadge } from "@/components/broker/commission-status-badge";
import { Button } from "@/components/ui/button";
import {
  formatEuro,
  netCommission,
  sumCommissions,
} from "@/lib/broker/commissions";
import { cn } from "@/lib/utils";
import type { BrokerCommissionRow } from "@/types/database";

export function CommissionLineManager({
  statementId,
  commissions,
  clients,
  contracts,
  canEdit,
}: {
  statementId: string;
  commissions: BrokerCommissionRow[];
  clients: LineClientOption[];
  contracts: LineContractOption[];
  canEdit: boolean;
}) {
  const [adding, setAdding] = React.useState(false);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const totals = sumCommissions(commissions);
  const clientNames = new Map(clients.map((c) => [c.id, c.name]));

  return (
    <div className="space-y-4">
      {commissions.length > 0 ? (
        <ul
          className="divide-y overflow-hidden rounded-md border"
          style={{ borderColor: "var(--border-1)" }}
        >
          {commissions.map((line) => {
            const editing = editingId === line.id;
            return (
              <li key={line.id} style={{ background: "var(--bg-surface)" }}>
                <button
                  type="button"
                  onClick={() =>
                    canEdit
                      ? setEditingId(editing ? null : line.id)
                      : undefined
                  }
                  className={cn(
                    "flex w-full items-center gap-3 px-3.5 py-3 text-left transition-colors",
                    canEdit && "hover:bg-[rgba(14,34,56,0.025)]",
                  )}
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-semibold text-[var(--fg-1)]">
                      {line.label || line.insurer_name || "Commission"}
                    </p>
                    <p className="truncate text-[11.5px] text-[var(--fg-3)]">
                      {line.client_id
                        ? clientNames.get(line.client_id) ?? "Dossier lié"
                        : "Sans dossier"}
                      {line.retrocession_amount
                        ? ` · Rétrocession ${formatEuro(line.retrocession_amount, line.currency)}`
                        : ""}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-[13px] font-semibold text-[var(--fg-1)]">
                      {formatEuro(line.commission_amount, line.currency)}
                    </p>
                    {line.retrocession_amount ? (
                      <p className="text-[11px] text-[var(--fg-3)]">
                        Net {formatEuro(netCommission(line), line.currency)}
                      </p>
                    ) : null}
                  </div>
                  <CommissionStatusBadge status={line.status} kind="line" />
                  {canEdit ? (
                    <ChevronDown
                      className={cn(
                        "size-4 shrink-0 text-[var(--fg-4)] transition-transform",
                        editing && "rotate-180",
                      )}
                      strokeWidth={1.75}
                      aria-hidden="true"
                    />
                  ) : null}
                </button>
                {editing && canEdit ? (
                  <div
                    className="border-t px-3.5 py-4"
                    style={{
                      borderColor: "var(--border-1)",
                      background: "var(--bg-sunken)",
                    }}
                  >
                    <CommissionLineForm
                      statementId={statementId}
                      commission={line}
                      clients={clients}
                      contracts={contracts}
                      mode="edit"
                      onDone={() => setEditingId(null)}
                      onCancel={() => setEditingId(null)}
                    />
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-[12.5px] text-[var(--fg-3)]">
          Aucune ligne sur ce bordereau. Ajoutez les commissions qu’il contient
          pour pouvoir le pointer.
        </p>
      )}

      {commissions.length > 0 ? (
        <div
          className="flex flex-wrap items-center justify-end gap-x-6 gap-y-1 rounded-md border px-4 py-3 text-[12.5px]"
          style={{ borderColor: "var(--border-1)", background: "var(--bg-sunken)" }}
        >
          <span className="text-[var(--fg-3)]">
            Commissions :{" "}
            <span className="font-semibold text-[var(--fg-1)]">
              {formatEuro(totals.gross)}
            </span>
          </span>
          {totals.retrocession > 0 ? (
            <span className="text-[var(--fg-3)]">
              Rétrocessions :{" "}
              <span className="font-semibold text-[var(--fg-1)]">
                {formatEuro(totals.retrocession)}
              </span>
            </span>
          ) : null}
          <span className="text-[var(--fg-3)]">
            Net :{" "}
            <span className="font-semibold text-[var(--fg-1)]">
              {formatEuro(totals.net)}
            </span>
          </span>
        </div>
      ) : null}

      {canEdit ? (
        adding ? (
          <div
            className="rounded-md border p-4"
            style={{
              borderColor: "var(--border-1)",
              background: "var(--bg-sunken)",
            }}
          >
            <CommissionLineForm
              statementId={statementId}
              clients={clients}
              contracts={contracts}
              mode="create"
              onDone={() => setAdding(false)}
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
            Ajouter une ligne
          </Button>
        )
      ) : null}
    </div>
  );
}
