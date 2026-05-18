"use client";

import * as React from "react";
import {
  Plus,
  Search,
  RefreshCw,
  CheckCircle,
  XCircle,
  RotateCcw,
  ExternalLink,
  Download,
  Loader2,
  Phone,
  MapPin,
  Clock,
  History,
} from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
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
import { cn } from "@/lib/utils";
import type {
  ProspectingSearchRow,
  ProspectSearchResultRow,
} from "@/types/database";

/* ------------------------------------------------------------------ */
/*  Data helpers                                                       */
/* ------------------------------------------------------------------ */

function formatShortDate(value: string | null): string {
  if (!value) return "\u2013";
  return new Date(value).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
  });
}

/* ------------------------------------------------------------------ */
/*  Location options                                                   */
/* ------------------------------------------------------------------ */

const nicheOptions = ["Falcon Conseil", "Falcon Event", "Autre"] as const;

const scopeOptions = [
  { value: "city", label: "Ville" },
  { value: "region", label: "Région" },
  { value: "country", label: "France / Pays" },
] as const;

const scopeLabels: Record<string, string> = {
  city: "Ville",
  region: "Région",
  country: "France / Pays",
};

const cityOptions = [
  "Paris", "Lyon", "Bordeaux", "Nantes", "Lille", "Toulouse",
  "Marseille", "Rennes", "Strasbourg", "Montpellier", "Nice",
] as const;

const regionOptions = [
  "Île-de-France", "Auvergne-Rhône-Alpes", "Nouvelle-Aquitaine",
  "Occitanie", "Hauts-de-France", "Pays de la Loire",
  "Provence-Alpes-Côte d'Azur", "Bretagne", "Grand Est",
] as const;

const countryOptions = [
  "France", "Belgique", "Suisse", "Luxembourg", "Espagne", "Portugal",
] as const;

const maxResultsOptions = [10, 20, 50, 100] as const;

/* ------------------------------------------------------------------ */
/*  Badges                                                             */
/* ------------------------------------------------------------------ */

const searchStatusConfig: Record<string, { label: string; className: string }> = {
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
};

const reviewBadge: Record<string, { label: string; className: string }> = {
  pending_review: {
    label: "À vérifier",
    className:
      "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800",
  },
  selected: {
    label: "Sélectionné",
    className:
      "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800",
  },
  ignored: {
    label: "Ignoré",
    className:
      "bg-zinc-50 text-zinc-500 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700",
  },
};

/* ================================================================== */
/*  Component                                                          */
/* ================================================================== */

export function SearchesTab({
  searches: initialSearches,
  onUnimportedCountChange,
}: {
  searches: ProspectingSearchRow[];
  onUnimportedCountChange?: (count: number) => void;
}) {
  const [searches, setSearches] = React.useState(initialSearches);

  /* Active search */
  const [activeSearchId, setActiveSearchId] = React.useState<string | null>(null);
  const [results, setResults] = React.useState<ProspectSearchResultRow[]>([]);
  const [loadingResults, setLoadingResults] = React.useState(false);
  const [launchMessage, setLaunchMessage] = React.useState<string | null>(null);
  const [polling, setPolling] = React.useState(false);
  const [showIgnored, setShowIgnored] = React.useState(false);

  /* ---- Inline form state ---- */
  const [formExpanded, setFormExpanded] = React.useState(false);
  const [formNiche, setFormNiche] = React.useState("Falcon Conseil");
  const [formScope, setFormScope] = React.useState("city");
  const [formLocation, setFormLocation] = React.useState("Lyon");
  const [formMaxResults, setFormMaxResults] = React.useState("50");
  const [formInclude, setFormInclude] = React.useState("");
  const [formExclude, setFormExclude] = React.useState("");
  const [creating, setCreating] = React.useState(false);

  /* ---- Recent searches dialog ---- */
  const [recentOpen, setRecentOpen] = React.useState(false);

  /* ---- Derived ---- */
  const formValid =
    formNiche === "Autre" ? formInclude.trim().length >= 2 : true;

  const locationOptions = React.useMemo(() => {
    if (formScope === "city") return [...cityOptions];
    if (formScope === "region") return [...regionOptions];
    return [...countryOptions];
  }, [formScope]);

  React.useEffect(() => {
    if (formScope === "city") setFormLocation("Lyon");
    else if (formScope === "region") setFormLocation("Île-de-France");
    else setFormLocation("France");
  }, [formScope]);

  const activeSearch = searches.find((s) => s.id === activeSearchId) ?? null;

  /* ---- Default select latest ---- */
  React.useEffect(() => {
    if (!activeSearchId && searches.length > 0) {
      const latest = searches[0];
      setActiveSearchId(latest.id);
      fetchResults(latest.id);
    }
  }, []);

  /* ---- Polling ---- */
  React.useEffect(() => {
    if (!polling || !activeSearchId) return;
    let stopped = false;
    const i = setInterval(() => {
      if (stopped) return;
      fetchResults(activeSearchId);
    }, 5000);
    const t = setTimeout(() => {
      if (!stopped) setPolling(false);
    }, 60000);
    return () => {
      stopped = true;
      clearInterval(i);
      clearTimeout(t);
    };
  }, [polling, activeSearchId]);

  /* ---- Actions ---- */
  async function fetchResults(searchId: string) {
    setLoadingResults(true);
    try {
      const res = await fetch(`/api/prospection/searches/${searchId}/results`);
      const data = await res.json();
      if (data.success) setResults(data.results);
    } catch {
      /* ignore */
    } finally {
      setLoadingResults(false);
    }
  }

  async function handleCreateAndLaunch() {
    if (!formValid || creating) return;
    setCreating(true);
    setLaunchMessage(null);
    try {
      const res = await fetch("/api/prospection/searches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          niche: formNiche,
          scope_type: formScope,
          location_query: formLocation,
          max_results: Number(formMaxResults),
          include_keywords: formInclude.trim() || undefined,
          exclude_keywords: formExclude.trim() || undefined,
          auto_launch: true,
        }),
      });
      const data = await res.json();
      if (data.success && data.search) {
        setSearches((prev) => [data.search, ...prev]);
        setFormExpanded(false);
        resetForm();
        setActiveSearchId(data.search.id);
        setResults([]);
        setPolling(true);
        setLaunchMessage(
          data.launch?.message ??
            "Recherche lancée. Les résultats peuvent prendre quelques instants.",
        );
        setTimeout(() => fetchResults(data.search.id), 3000);
      }
    } catch {
      /* ignore */
    } finally {
      setCreating(false);
    }
  }

  async function handleRelaunch(searchId: string) {
    setLaunchMessage(null);
    try {
      const res = await fetch(`/api/prospection/searches/${searchId}/run`, {
        method: "POST",
      });
      const data = await res.json();
      if (data.success) {
        setLaunchMessage(data.message);
        setPolling(true);
        setResults([]);
        setTimeout(() => fetchResults(searchId), 3000);
      }
    } catch {
      /* ignore */
    }
  }

  function handleSelectFromHistory(searchId: string) {
    setActiveSearchId(searchId);
    setPolling(false);
    setLaunchMessage(null);
    setRecentOpen(false);
    fetchResults(searchId);
  }

  async function handleReview(resultId: string, status: string) {
    if (!activeSearchId) return;
    try {
      await fetch(`/api/prospection/searches/${activeSearchId}/results`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resultId, review_status: status }),
      });
      setResults((prev) =>
        prev.map((r) =>
          r.id === resultId ? { ...r, review_status: status } : r,
        ),
      );
    } catch {
      /* ignore */
    }
  }

  async function handleImport(
    action: "import_selected" | "import_all" | "import_single",
    resultId?: string,
  ) {
    if (!activeSearchId) return;
    try {
      const res = await fetch(
        `/api/prospection/searches/${activeSearchId}/import`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action, resultId }),
        },
      );
      const data = await res.json();
      if (data.success) {
        const count = data.imported ?? 0;
        if (action === "import_single") {
          toast.success("Lead importé avec succès.");
        } else {
          toast.success(`${count} lead${count > 1 ? "s" : ""} importé${count > 1 ? "s" : ""} avec succès.`);
        }
        await fetchResults(activeSearchId);
      }
    } catch {
      /* ignore */
    }
  }

  function resetForm() {
    setFormNiche("Falcon Conseil");
    setFormScope("city");
    setFormLocation("Lyon");
    setFormMaxResults("50");
    setFormInclude("");
    setFormExclude("");
  }

  /* ---- Counts ---- */
  const selectedCount = results.filter(
    (r) => r.review_status === "selected",
  ).length;
  const totalValid = results.filter(
    (r) => r.review_status !== "ignored",
  ).length;

  const displayedResults = showIgnored
    ? results
    : results.filter((r) => r.review_status !== "ignored");

  React.useEffect(() => {
    onUnimportedCountChange?.(totalValid);
  }, [totalValid, onUnimportedCountChange]);

  return (
    <div className="space-y-6">
      {/* ================================================================ */}
      {/*  Top bar                                                         */}
      {/* ================================================================ */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Inline expandable form */}
        <div className="flex-1 min-w-0">
          {!formExpanded ? (
            <Button onClick={() => setFormExpanded(true)}>
              <Plus className="size-3.5 mr-2" />
              Nouvelle recherche
            </Button>
          ) : (
            <AnimatePresence mode="wait">
              <motion.div
                key="search-form"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                className="overflow-hidden bg-card rounded-lg border p-4 space-y-4"
              >
                <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium">
                  Nouvelle recherche
                </h3>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => {
                    resetForm();
                    setFormExpanded(false);
                  }}
                >
                  <XCircle className="size-4" />
                </Button>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Niche</Label>
                  <Select value={formNiche} onValueChange={setFormNiche}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {nicheOptions.map((n) => (
                        <SelectItem key={n} value={n}>{n}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Max résultats</Label>
                  <Select value={formMaxResults} onValueChange={setFormMaxResults}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {maxResultsOptions.map((m) => (
                        <SelectItem key={m} value={String(m)}>{m}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Périmètre</Label>
                  <Select value={formScope} onValueChange={setFormScope}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {scopeOptions.map((s) => (
                        <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Localisation</Label>
                  <Select value={formLocation} onValueChange={setFormLocation}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {locationOptions.map((l) => (
                        <SelectItem key={l} value={l}>{l}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>
                    Mots-clés à inclure
                    {formNiche === "Autre" && (
                      <span className="text-red-500 ml-0.5">*</span>
                    )}
                  </Label>
                  <Input
                    placeholder="Ex: marketing, web..."
                    value={formInclude}
                    onChange={(e) => setFormInclude(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Mots-clés à exclure</Label>
                  <Input
                    placeholder="Ex: freelance..."
                    value={formExclude}
                    onChange={(e) => setFormExclude(e.target.value)}
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    resetForm();
                    setFormExpanded(false);
                  }}
                >
                  Annuler
                </Button>
                <Button
                  size="sm"
                  disabled={!formValid || creating}
                  onClick={handleCreateAndLaunch}
                >
                  {creating ? (
                    <>
                      <Loader2 className="size-3.5 mr-2 animate-spin" />
                      Création...
                    </>
                  ) : (
                    <>
                      <Search className="size-3.5 mr-2" />
                      Lancer la recherche
                    </>
                  )}
                </Button>
              </div>
                </motion.div>
              </AnimatePresence>
            )}
          </div>

        {/* Recent searches */}
        <Dialog open={recentOpen} onOpenChange={setRecentOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" disabled={searches.length === 0}>
              <History className="size-3.5 mr-2" />
              Voir les recherches récentes
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Recherches récentes</DialogTitle>
            </DialogHeader>
            <div className="divide-y max-h-96 overflow-y-auto -mx-6">
              {searches.map((s) => {
                const cfg =
                  searchStatusConfig[s.status] ?? searchStatusConfig.active;
                return (
                  <button
                    key={s.id}
                    className={cn(
                      "w-full text-left px-6 py-3 hover:bg-muted/40 transition-colors flex items-center gap-3",
                      s.id === activeSearchId && "bg-muted/30",
                    )}
                    onClick={() => handleSelectFromHistory(s.id)}
                  >
                    <Search className="size-4 text-muted-foreground shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{s.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {s.niche ?? ""}
                        {s.location_query ? ` · ${s.location_query}` : ""}
                        {" · "}
                        {formatShortDate(s.last_run_at)}
                      </p>
                    </div>
                    <span
                      className={cn(
                        "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium shrink-0",
                        cfg.className,
                      )}
                    >
                      {cfg.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </DialogContent>
        </Dialog>

        {/* Refresh */}
        {activeSearch && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchResults(activeSearch.id)}
            disabled={loadingResults}
          >
            {loadingResults ? (
              <Loader2 className="size-3.5 mr-1.5 animate-spin" />
            ) : (
              <RefreshCw className="size-3.5 mr-1.5" />
            )}
            Rafraîchir
          </Button>
        )}
      </div>

      {/* Launch message */}
      {launchMessage && (
        <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg px-4 py-2.5 text-sm text-amber-800 dark:text-amber-300 flex items-start gap-2">
          <Clock className="size-4 mt-0.5 shrink-0" />
          {launchMessage}
        </div>
      )}

      {/* ================================================================ */}
      {/*  Active search summary                                           */}
      {/* ================================================================ */}
      {!activeSearch ? (
        <section className="bg-card/75 rounded-lg border p-8 text-center">
          <p className="text-sm font-medium text-muted-foreground">
            Lancez une nouvelle recherche pour générer des leads à importer.
          </p>
        </section>
      ) : (
        <>
          <div className="bg-card rounded-lg border overflow-hidden">
            <div className="border-b bg-muted/40 px-4 py-3 flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-3 min-w-0">
                <Search className="size-4 text-muted-foreground shrink-0" />
                <div className="min-w-0">
                  <span className="text-sm font-medium">
                    {activeSearch.name}
                  </span>
                </div>
                <span
                  className={cn(
                    "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium shrink-0",
                    (searchStatusConfig[activeSearch.status] ?? searchStatusConfig.active)
                      .className,
                  )}
                >
                  {(searchStatusConfig[activeSearch.status] ?? searchStatusConfig.active)
                    .label}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleRelaunch(activeSearch.id)}
                  title="Relancer"
                >
                  <RefreshCw className="size-3.5 mr-1.5" />
                  Relancer
                </Button>
              </div>
            </div>
            <div className="px-4 py-3 grid gap-2 sm:grid-cols-4 text-sm">
              <div>
                <span className="text-xs text-muted-foreground">Niche</span>
                <p className="font-medium">{activeSearch.niche ?? "\u2013"}</p>
              </div>
              <div>
                <span className="text-xs text-muted-foreground">Périmètre</span>
                <p className="font-medium">
                  {activeSearch.scope_type
                    ? scopeLabels[activeSearch.scope_type] ?? activeSearch.scope_type
                    : "\u2013"}
                </p>
              </div>
              <div>
                <span className="text-xs text-muted-foreground">Localisation</span>
                <p className="font-medium">
                  {activeSearch.location_query ?? "\u2013"}
                </p>
              </div>
              <div>
                <span className="text-xs text-muted-foreground">Dernière exécution</span>
                <p className="font-medium">
                  {formatShortDate(activeSearch.last_run_at)}
                </p>
              </div>
              {activeSearch.include_keywords && (
                <div className="sm:col-span-2">
                  <span className="text-xs text-muted-foreground">
                    Mots-clés inclus
                  </span>
                  <p className="font-medium text-sm">
                    {activeSearch.include_keywords}
                  </p>
                </div>
              )}
              {activeSearch.exclude_keywords && (
                <div className="sm:col-span-2">
                  <span className="text-xs text-muted-foreground">
                    Mots-clés exclus
                  </span>
                  <p className="font-medium text-sm">
                    {activeSearch.exclude_keywords}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* ============================================================ */}
          {/*  Results panel                                                */}
          {/* ============================================================ */}
          <div className="bg-card rounded-lg border overflow-hidden">
            <div className="border-b bg-muted/40 px-4 py-3 flex items-center justify-between flex-wrap gap-2">
              <div>
                <h3 className="text-sm font-medium text-muted-foreground">
                  Résultats
                  {displayedResults.length > 0 && (
                    <span className="ml-2 text-xs font-normal text-muted-foreground">
                      {displayedResults.length} lead{displayedResults.length > 1 ? "s" : ""}
                      {selectedCount > 0 && ` · ${selectedCount} sélectionné${selectedCount > 1 ? "s" : ""}`}
                    </span>
                  )}
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={selectedCount === 0}
                  onClick={() => handleImport("import_selected")}
                >
                  <Download className="size-3.5 mr-1.5" />
                  Importer sélectionnés ({selectedCount})
                </Button>
                <Button
                  size="sm"
                  disabled={totalValid === 0}
                  onClick={() => handleImport("import_all")}
                >
                  <Download className="size-3.5 mr-1.5" />
                  Importer tous ({totalValid})
                </Button>
                <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer select-none ml-2">
                  <input
                    type="checkbox"
                    checked={showIgnored}
                    onChange={(e) => setShowIgnored(e.target.checked)}
                    className="rounded border-input"
                  />
                  Afficher les ignorés
                </label>
              </div>
            </div>

            {loadingResults ? (
              <div className="p-12 text-center">
                <Loader2 className="size-5 animate-spin mx-auto text-muted-foreground" />
                <p className="mt-2 text-sm text-muted-foreground">
                  Chargement des résultats...
                </p>
              </div>
            ) : displayedResults.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground">
                {activeSearch.last_run_at
                  ? "Recherche lancée. Les résultats peuvent prendre quelques instants. Cliquez sur Rafraîchir les résultats."
                  : "Lancez la recherche pour voir les résultats."}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/40 text-left">
                      <th className="px-4 py-3 font-medium text-muted-foreground min-w-[160px]">
                        Entreprise
                      </th>
                      <th className="px-4 py-3 font-medium text-muted-foreground md:table-cell whitespace-nowrap">
                        <Phone className="size-3 inline mr-1" />Tél
                      </th>
                      <th className="px-4 py-3 font-medium text-muted-foreground hidden lg:table-cell">
                        <MapPin className="size-3 inline mr-1" />Ville
                      </th>
                      <th className="px-4 py-3 font-medium text-muted-foreground hidden xl:table-cell">
                        Score
                      </th>
                      <th className="px-4 py-3 font-medium text-muted-foreground">
                        Statut
                      </th>
                      <th className="px-4 py-3 font-medium text-muted-foreground w-12" />
                    </tr>
                  </thead>
                  <tbody>
                    {displayedResults.map((r) => {
                      const badge =
                        reviewBadge[r.review_status] ?? reviewBadge.pending_review;
                      return (
                        <tr
                          key={r.id}
                          className={cn(
                            "border-b last:border-0 hover:bg-muted/20 transition-colors",
                            r.review_status === "ignored" && "opacity-50",
                            r.review_status === "selected" &&
                              "bg-blue-50/30 dark:bg-blue-950/10",
                          )}
                        >
                          <td className="px-4 py-3">
                            <div className="font-medium line-clamp-2">
                              {r.name}
                            </div>
                            {r.website_domain && (
                              <div className="text-xs text-muted-foreground truncate mt-0.5">
                                {r.website_domain}
                              </div>
                            )}
                            <div className="flex items-center gap-1.5 mt-1">
                              {r.rating != null && (
                                <span className="text-[11px] font-medium text-amber-600">
                                  {"\u2605"}
                                  {r.rating}
                                  <span className="text-muted-foreground ml-0.5">
                                    ({r.user_rating_count ?? 0})
                                  </span>
                                </span>
                              )}
                            </div>
                            {r.reason_for_fit && (
                              <div className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                                {r.reason_for_fit}
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-3 md:table-cell text-muted-foreground whitespace-nowrap">
                            {r.phone ?? "\u2013"}
                          </td>
                          <td className="px-4 py-3 text-muted-foreground hidden lg:table-cell">
                            {r.city ?? "\u2013"}
                          </td>
                          <td className="px-4 py-3 hidden xl:table-cell">
                            {r.fit_score != null ? (
                              <div className="flex items-center gap-2">
                                <span
                                  className={cn(
                                    "text-sm font-semibold",
                                    r.fit_score >= 70
                                      ? "text-emerald-600 dark:text-emerald-400"
                                      : r.fit_score >= 40
                                        ? "text-amber-600 dark:text-amber-400"
                                        : "text-red-600 dark:text-red-400",
                                  )}
                                >
                                  {r.fit_score}
                                </span>
                                {r.priority && (
                                  <span
                                    className={cn(
                                      "inline-flex items-center rounded-full border px-1.5 py-0.5 text-[10px] font-medium",
                                      r.priority === "high"
                                        ? "border-red-200 text-red-700 dark:border-red-800 dark:text-red-400"
                                        : r.priority === "medium"
                                          ? "border-amber-200 text-amber-700 dark:border-amber-800 dark:text-amber-400"
                                          : "border-slate-200 text-slate-500",
                                    )}
                                  >
                                    {r.priority === "high"
                                      ? "Haute"
                                      : r.priority === "medium"
                                        ? "Moy."
                                        : "Basse"}
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span className="text-xs text-muted-foreground">
                                Non scoré
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={cn(
                                "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium whitespace-nowrap",
                                badge.className,
                              )}
                            >
                              {badge.label}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center gap-0.5 justify-end">
                              <Button
                                variant="ghost"
                                    size="icon-sm"
                                    title="Sélectionner"
                                    onClick={() => handleReview(r.id, "selected")}
                                  >
                                    <CheckCircle className="size-3.5 text-blue-600" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon-sm"
                                    title="Ignorer"
                                    onClick={() => handleReview(r.id, "ignored")}
                                  >
                                    <XCircle className="size-3.5 text-zinc-400" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon-sm"
                                    title="Réinitialiser"
                                    onClick={() => handleReview(r.id, "pending_review")}
                                  >
                                    <RotateCcw className="size-3.5" />
                                  </Button>
                              {r.website && (
                                <a
                                  href={
                                    r.website.startsWith("http")
                                      ? r.website
                                      : `https://${r.website}`
                                  }
                                  target="_blank"
                                  rel="noopener noreferrer"
                                >
                                  <Button
                                    variant="ghost"
                                    size="icon-sm"
                                    title="Ouvrir le site"
                                  >
                                    <ExternalLink className="size-3.5" />
                                  </Button>
                                </a>
                              )}
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                title="Importer ce lead"
                                onClick={() =>
                                  handleImport("import_single", r.id)
                                  }
                                >
                                  <Download className="size-3.5" />
                                </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
