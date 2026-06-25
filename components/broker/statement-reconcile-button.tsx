"use client";

import { useRouter } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export function StatementReconcileButton({
  statementId,
  reconciled,
}: {
  statementId: string;
  reconciled: boolean;
}) {
  const router = useRouter();
  const [saving, setSaving] = React.useState(false);

  async function toggle() {
    if (saving) return;
    setSaving(true);
    try {
      const res = await fetch(
        `/api/broker/commission-statements/${statementId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            reconciled ? { status: "received" } : { reconcile: true },
          ),
        },
      ).catch(() => null);
      if (!res?.ok) {
        toast.error("Action impossible.");
        return;
      }
      toast.success(reconciled ? "Bordereau rouvert." : "Bordereau pointé.");
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  if (reconciled) {
    return (
      <Button type="button" variant="ghost" onClick={toggle} disabled={saving}>
        {saving ? "…" : "Rouvrir le pointage"}
      </Button>
    );
  }

  return (
    <Button
      type="button"
      onClick={toggle}
      disabled={saving}
      className="inline-flex items-center gap-1.5"
    >
      <CheckCircle2 className="size-3.5" strokeWidth={2} />
      {saving ? "…" : "Marquer comme pointé"}
    </Button>
  );
}
