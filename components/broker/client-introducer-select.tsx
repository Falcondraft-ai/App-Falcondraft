"use client";

import { useRouter } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const NO_INTRODUCER = "__none__";

/**
 * Assigns / changes the introducer (apporteur) on a client. The change is
 * persisted immediately; the client's future commissions inherit the
 * introducer's retrocession rate.
 */
export function ClientIntroducerSelect({
  clientId,
  introducers,
  currentIntroducerId,
  canEdit,
}: {
  clientId: string;
  introducers: { id: string; name: string }[];
  currentIntroducerId: string | null;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [value, setValue] = React.useState(currentIntroducerId ?? "");
  const [saving, setSaving] = React.useState(false);

  async function change(next: string) {
    const introducerId = next === NO_INTRODUCER ? "" : next;
    const previous = value;
    setValue(introducerId);
    setSaving(true);
    try {
      const res = await fetch(`/api/broker/clients/${clientId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ introducerId: introducerId || null }),
      }).catch(() => null);
      const result = (await res?.json().catch(() => null)) as
        | { success?: boolean; message?: string }
        | null;
      if (!res?.ok || !result?.success) {
        toast.error("Modification impossible", {
          description: result?.message ?? "Veuillez réessayer.",
        });
        setValue(previous);
        return;
      }
      toast.success("Apporteur mis à jour.");
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  if (introducers.length === 0) {
    return (
      <p className="text-[12.5px] leading-5 text-[var(--fg-3)]">
        Aucun apporteur enregistré. Ajoutez-les dans Réglages → Apporteurs.
      </p>
    );
  }

  if (!canEdit) {
    const current = introducers.find((i) => i.id === currentIntroducerId);
    return (
      <p className="text-[13px] text-[var(--fg-1)]">{current?.name ?? "Aucun"}</p>
    );
  }

  return (
    <Select
      value={value || NO_INTRODUCER}
      onValueChange={change}
      disabled={saving}
    >
      <SelectTrigger className="w-full">
        <SelectValue placeholder="Aucun" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={NO_INTRODUCER}>Aucun</SelectItem>
        {introducers.map((introducer) => (
          <SelectItem key={introducer.id} value={introducer.id}>
            {introducer.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
