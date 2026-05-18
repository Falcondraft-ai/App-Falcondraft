"use client";

import * as React from "react";
import { Plus, Search } from "lucide-react";
import { T } from "@/components/i18n/translated-text";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { ProspectingSearchRow } from "@/types/database";

function formatDate(value: string | null): string {
  if (!value) return "\u2013";
  return new Date(value).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

const searchStatusConfig: Record<
  string,
  { label: string; className: string }
> = {
  active: {
    label: "Active",
    className:
      "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800",
  },
  paused: {
    label: "En pause",
    className:
      "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800",
  },
  archived: {
    label: "Archivée",
    className:
      "bg-zinc-50 text-zinc-500 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700",
  },
};

const nicheOptions = ["Falcon Conseil", "Falcon Event", "Autre"] as const;

const scopeLabels: Record<string, string> = {
  city: "Ville",
  region: "Région",
  country: "France / Pays",
};

export function SearchesTab({
  searches: initialSearches,
}: {
  searches: ProspectingSearchRow[];
}) {
  const [searches, setSearches] = React.useState(initialSearches);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [creating, setCreating] = React.useState(false);

  const [formName, setFormName] = React.useState("");
  const [formNiche, setFormNiche] = React.useState("Falcon Conseil");
  const [formCategoryQuery, setFormCategoryQuery] = React.useState("");
  const [formScopeType, setFormScopeType] = React.useState("city");
  const [formLocationQuery, setFormLocationQuery] = React.useState("");
  const [formMaxResults, setFormMaxResults] = React.useState("50");

  const formValid = formName.trim().length >= 2;

  async function createSearch() {
    if (!formValid || creating) return;
    setCreating(true);

    try {
      const res = await fetch("/api/prospection/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create_search",
          name: formName.trim(),
          niche: formNiche,
          categoryQuery: formCategoryQuery.trim() || undefined,
          scopeType: formScopeType,
          locationQuery: formLocationQuery.trim(),
          maxResults: Number(formMaxResults) || 50,
        }),
      });

      const data = await res.json();
      if (data.success && data.search) {
        setSearches((prev) => [data.search, ...prev]);
        setDialogOpen(false);
        resetForm();
      }
    } catch {
      // silently fail
    } finally {
      setCreating(false);
    }
  }

  function resetForm() {
    setFormName("");
    setFormNiche("Falcon Conseil");
    setFormCategoryQuery("");
    setFormScopeType("city");
    setFormLocationQuery("");
    setFormMaxResults("50");
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm">
              <Plus className="size-3.5 mr-2" />
              Nouvelle recherche
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Nouvelle recherche</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="space-y-2">
                <Label htmlFor="search-name">Nom</Label>
                <Input
                  id="search-name"
                  placeholder="Ex: Agences web Lyon"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Niche</Label>
                <Select value={formNiche} onValueChange={setFormNiche}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {nicheOptions.map((n) => (
                      <SelectItem key={n} value={n}>
                        {n}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="search-category">
                  Catégorie (optionnel)
                </Label>
                <Input
                  id="search-category"
                  placeholder="Ex: marketing agency"
                  value={formCategoryQuery}
                  onChange={(e) => setFormCategoryQuery(e.target.value)}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Périmètre</Label>
                  <Select
                    value={formScopeType}
                    onValueChange={setFormScopeType}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="city">Ville</SelectItem>
                      <SelectItem value="region">Région</SelectItem>
                      <SelectItem value="country">
                        France / Pays
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="search-max">Max résultats</Label>
                  <Input
                    id="search-max"
                    type="number"
                    value={formMaxResults}
                    onChange={(e) => setFormMaxResults(e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="search-location">
                  Localisation
                </Label>
                <Input
                  id="search-location"
                  placeholder={
                    formScopeType === "city"
                      ? "Ex: Lyon"
                      : formScopeType === "region"
                        ? "Ex: Auvergne-Rhône-Alpes"
                        : "France"
                  }
                  value={formLocationQuery}
                  onChange={(e) => setFormLocationQuery(e.target.value)}
                />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    resetForm();
                    setDialogOpen(false);
                  }}
                >
                  Annuler
                </Button>
                <Button
                  disabled={!formValid || creating}
                  onClick={createSearch}
                >
                  {creating ? "Création..." : "Créer la recherche"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        <Button disabled variant="outline" size="sm">
          <Search className="size-3.5 mr-2" />
          <T tx="prospection.actions.launchSearch" />
        </Button>
        <span className="text-xs text-muted-foreground">
          <T tx="prospection.actions.launchSearchSoon" />
        </span>
      </div>

      {searches.length === 0 ? (
        <section className="bg-card/75 rounded-lg border p-8 text-center">
          <p className="text-sm font-medium text-muted-foreground">
            <T tx="prospection.empty.searches" />
          </p>
          <p className="mt-1 text-xs text-muted-foreground/70">
            Créez une recherche pour découvrir de nouveaux leads.
          </p>
        </section>
      ) : (
        <div className="bg-card rounded-lg border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40 text-left">
                  <th className="px-4 py-3 font-medium text-muted-foreground">
                    <T tx="prospection.search.name" />
                  </th>
                  <th className="px-4 py-3 font-medium text-muted-foreground hidden md:table-cell">
                    <T tx="prospection.search.niche" />
                  </th>
                  <th className="px-4 py-3 font-medium text-muted-foreground hidden lg:table-cell">
                    <T tx="prospection.search.location" />
                  </th>
                  <th className="px-4 py-3 font-medium text-muted-foreground hidden lg:table-cell">
                    <T tx="prospection.search.scope" />
                  </th>
                  <th className="px-4 py-3 font-medium text-muted-foreground">
                    Statut
                  </th>
                  <th className="px-4 py-3 font-medium text-muted-foreground hidden xl:table-cell">
                    <T tx="prospection.search.lastRun" />
                  </th>
                </tr>
              </thead>
              <tbody>
                {searches.map((search) => {
                  const config = searchStatusConfig[search.status] ?? {
                    label: search.status,
                    className:
                      "bg-slate-50 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700",
                  };

                  return (
                    <tr
                      key={search.id}
                      className="border-b last:border-0 hover:bg-muted/30 transition-colors"
                    >
                      <td className="px-4 py-3">
                        <div className="font-medium">{search.name}</div>
                        <div className="text-xs text-muted-foreground mt-0.5">
                          {search.category_query ?? search.niche ?? ""}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">
                        {search.niche ?? "\u2013"}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground hidden lg:table-cell">
                        {search.location_query ?? "\u2013"}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground hidden lg:table-cell">
                        {search.scope_type
                          ? scopeLabels[search.scope_type] ?? search.scope_type
                          : "\u2013"}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium leading-5 ${config.className}`}
                        >
                          {config.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground hidden xl:table-cell text-xs">
                        {formatDate(search.last_run_at)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
