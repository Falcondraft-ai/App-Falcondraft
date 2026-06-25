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
import {
  brokerClientStatusLabels,
  brokerClientStatuses,
} from "@/lib/broker/clients";

export function ClientStatusControl({
  clientId,
  status,
}: {
  clientId: string;
  status: string;
}) {
  const router = useRouter();
  const [value, setValue] = React.useState(status);
  const [saving, setSaving] = React.useState(false);

  async function handleChange(next: string) {
    if (next === value || saving) return;
    const previous = value;
    setValue(next);
    setSaving(true);

    const response = await fetch(`/api/broker/clients/${clientId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: next }),
    }).catch(() => null);

    setSaving(false);

    if (!response?.ok) {
      setValue(previous);
      toast.error("Statut non mis à jour", {
        description: "Veuillez réessayer dans un instant.",
      });
      return;
    }

    toast.success("Statut mis à jour.");
    router.refresh();
  }

  return (
    <Select value={value} onValueChange={handleChange} disabled={saving}>
      <SelectTrigger className="h-9 w-[220px]">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {brokerClientStatuses.map((option) => (
          <SelectItem key={option} value={option}>
            {brokerClientStatusLabels[option]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
