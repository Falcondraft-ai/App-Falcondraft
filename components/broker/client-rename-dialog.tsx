"use client";

import { useRouter } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";
import { Loader2, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * Quick rename of a client dossier from the header (individual first/last name,
 * or company name). The name is only an internal marker — this just corrects it,
 * e.g. when an email-created dossier picked up a wrong or invented name.
 */
export function ClientRenameDialog({
  clientId,
  clientType,
  firstName,
  lastName,
  companyName,
}: {
  clientId: string;
  clientType: "individual" | "company";
  firstName: string | null;
  lastName: string | null;
  companyName: string | null;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [first, setFirst] = React.useState(firstName ?? "");
  const [last, setLast] = React.useState(lastName ?? "");
  const [company, setCompany] = React.useState(companyName ?? "");

  // Re-sync fields with the latest values each time the dialog opens.
  React.useEffect(() => {
    if (open) {
      setFirst(firstName ?? "");
      setLast(lastName ?? "");
      setCompany(companyName ?? "");
    }
  }, [open, firstName, lastName, companyName]);

  const isCompany = clientType === "company";
  const valid = isCompany
    ? company.trim().length > 0
    : first.trim().length > 0 || last.trim().length > 0;

  async function save() {
    if (saving || !valid) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/broker/clients/${clientId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          isCompany
            ? { companyName: company.trim() || null }
            : {
                firstName: first.trim() || null,
                lastName: last.trim() || null,
              },
        ),
      }).catch(() => null);
      const data = (await res?.json().catch(() => null)) as
        | { success?: boolean; message?: string }
        | null;
      if (!res?.ok || !data?.success) {
        toast.error("Renommage impossible", { description: data?.message });
        return;
      }
      toast.success("Dossier renommé.");
      setOpen(false);
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          aria-label="Renommer le dossier"
          title="Renommer le dossier"
          className="inline-flex size-8 shrink-0 items-center justify-center rounded-md border transition-colors hover:bg-[var(--bg-sunken)]"
          style={{ borderColor: "var(--border-1)", color: "var(--fg-3)" }}
        >
          <Pencil className="size-3.5" strokeWidth={1.75} />
        </button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Renommer le dossier</DialogTitle>
          <DialogDescription>
            Corrigez le nom du client — c’est le repère affiché partout dans
            votre espace.
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            void save();
          }}
          className="space-y-4 py-1"
        >
          {isCompany ? (
            <div className="space-y-1.5">
              <Label htmlFor="rename-company">Raison sociale</Label>
              <Input
                id="rename-company"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                autoFocus
              />
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="rename-first">Prénom</Label>
                <Input
                  id="rename-first"
                  value={first}
                  onChange={(e) => setFirst(e.target.value)}
                  autoFocus
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="rename-last">Nom</Label>
                <Input
                  id="rename-last"
                  value={last}
                  onChange={(e) => setLast(e.target.value)}
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setOpen(false)}
              disabled={saving}
            >
              Annuler
            </Button>
            <Button type="submit" disabled={saving || !valid} className="gap-1.5">
              {saving ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" strokeWidth={2} />
                  Enregistrement…
                </>
              ) : (
                "Enregistrer"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
