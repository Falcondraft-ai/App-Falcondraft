"use client";

import * as React from "react";
import Link from "next/link";
import { ExternalLink, MoreHorizontal, Phone, Eye } from "lucide-react";
import { toast } from "sonner";
import { T } from "@/components/i18n/translated-text";
import { useI18n } from "@/components/i18n/language-provider";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ProspectionStatusDropdown,
} from "@/components/prospection/status-badge";
import type { ProspectCompanyRow } from "@/types/database";

const CANONICAL_NICHES = [
  "Falcon Conseil",
  "Falcon Event",
  "Falcon Assurance",
  "Falcon Immo",
] as const;

const FILTERS_STORAGE_KEY = "falcondraft:prospection:leads-filters";

interface SavedFilters {
  search?: string;
  statusFilter?: string;
  nicheFilter?: string;
  cityFilter?: string;
  showArchived?: boolean;
}

function loadFilters(): SavedFilters {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(FILTERS_STORAGE_KEY);
    if (raw) return JSON.parse(raw) as SavedFilters;
  } catch {}
  return {};
}

function saveFilters(filters: SavedFilters) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(FILTERS_STORAGE_KEY, JSON.stringify(filters));
  } catch {}
}

const qualityLabel = (company: ProspectCompanyRow): string => {
  if (company.priority === "high") return "Haute";
  if (company.priority === "medium") return "Moyenne";
  if (company.priority === "low") return "Basse";
  if (company.fit_score != null) return `Score ${company.fit_score}`;
  return "Non scoré";
};

const qualityColor = (company: ProspectCompanyRow): string => {
  if (company.priority === "high") return "text-red-600 dark:text-red-400";
  if (company.priority === "medium") return "text-amber-600 dark:text-amber-400";
  if (company.priority === "low") return "text-slate-500";
  if (company.fit_score != null) return "text-emerald-600 dark:text-emerald-400";
  return "text-muted-foreground";
};

function getErrorMessage(result: unknown, fallback: string) {
  if (
    result &&
    typeof result === "object" &&
    "message" in result &&
    typeof result.message === "string"
  ) {
    return result.message;
  }

  return fallback;
}

export function LeadsTab({
  initialData,
}: {
  initialData: ProspectCompanyRow[];
}) {
  const { t } = useI18n();
  const defaultFilters = React.useMemo(() => loadFilters(), []);
  const [search, setSearch] = React.useState(defaultFilters.search ?? "");
  const [statusFilter, setStatusFilter] = React.useState(
    defaultFilters.statusFilter === "new"
      ? "to_call"
      : (defaultFilters.statusFilter ?? "all"),
  );
  const [nicheFilter, setNicheFilter] = React.useState(defaultFilters.nicheFilter ?? "all");
  const [cityFilter, setCityFilter] = React.useState(defaultFilters.cityFilter ?? "all");
  const [showArchived, setShowArchived] = React.useState(defaultFilters.showArchived ?? false);
  const [data, setData] = React.useState(initialData);
  const [loading, setLoading] = React.useState(false);
  const [actionId, setActionId] = React.useState<string | null>(null);

  React.useEffect(() => {
    saveFilters({ search, statusFilter, nicheFilter, cityFilter, showArchived });
  }, [search, statusFilter, nicheFilter, cityFilter, showArchived]);

  const niches = React.useMemo(() => {
    const seen = new Set<string>(CANONICAL_NICHES);
    initialData.forEach((c) => {
      if (c.niche) seen.add(c.niche);
    });
    return Array.from(seen).sort();
  }, [initialData]);

  const cities = React.useMemo(() => {
    const seen = new Set<string>();
    initialData.forEach((c) => {
      if (c.city) seen.add(c.city);
    });
    return Array.from(seen).sort();
  }, [initialData]);

  const filtered = React.useMemo(() => {
    let result = data;

    if (!showArchived) {
      result = result.filter((c) => c.status !== "archived");
    }

    if (statusFilter !== "all") {
      result = result.filter((c) =>
        statusFilter === "to_call"
          ? c.status === "to_call" || c.status === "new"
          : c.status === statusFilter,
      );
    }

    if (nicheFilter !== "all") {
      result = result.filter((c) => c.niche === nicheFilter);
    }

    if (cityFilter !== "all") {
      result = result.filter((c) => c.city === cityFilter);
    }

    if (search.trim()) {
      const term = search.toLowerCase();
      result = result.filter(
        (c) =>
          c.name?.toLowerCase().includes(term) ||
          c.phone?.includes(term) ||
          c.website?.toLowerCase().includes(term) ||
          c.city?.toLowerCase().includes(term),
      );
    }

    return result;
  }, [data, statusFilter, nicheFilter, cityFilter, search, showArchived]);

  async function performAction(
    companyId: string,
    action: string,
    extra?: Record<string, string>,
  ) {
    setActionId(companyId);
    setLoading(true);
    try {
      const body: Record<string, string> = { companyId, action, ...extra };

      const res = await fetch("/api/prospection/leads", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const result = await res.json();

      if (result.success) {
        setData((prev) =>
          prev.map((c) => {
            if (c.id !== companyId) return c;
            const updated = { ...c };
            if (action === "archive") updated.status = "archived";
            if (action === "mark_called") {
              updated.status = "called";
              updated.last_called_at = new Date().toISOString();
            }
            if (action === "change_status" && extra?.status)
              updated.status = extra.status;
            if (action === "assign_closer" && extra?.closer)
              updated.assigned_closer = extra.closer;
            return updated;
          }),
        );
      } else {
        toast.error(
          getErrorMessage(result, "La mise à jour du lead a échoué."),
        );
      }
    } catch {
      toast.error("La mise à jour du lead a échoué.");
    } finally {
      setActionId(null);
      setLoading(false);
    }
  }

  async function handleStatusChange(companyId: string, newStatus: string) {
    await performAction(companyId, "change_status", { status: newStatus });
  }

  async function handleAssignCloser(companyId: string, closer: string) {
    await performAction(companyId, "assign_closer", { closer });
  }

  if (initialData.length === 0) {
    return (
      <section className="bg-card/75 rounded-lg border p-8 text-center">
        <p className="text-sm font-medium text-muted-foreground">
          <T tx="prospection.empty.leads" />
        </p>
        <p className="mt-1 text-xs text-muted-foreground/70">
          Les leads provenant des recherches Google Maps apparaîtront ici.
        </p>
      </section>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Input
          placeholder={t("prospection.filters.search")}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-56"
        />

        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-44">
            <span className="text-muted-foreground mr-1 text-xs">
              {t("prospection.filters.status")}:
            </span>
            <SelectValue placeholder="Tous" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous</SelectItem>
            <SelectItem value="to_call">
              {t("prospection.status.toCall")}
            </SelectItem>
            <SelectItem value="called">
              {t("prospection.status.called")}
            </SelectItem>
            <SelectItem value="no_answer">
              {t("prospection.status.noAnswer")}
            </SelectItem>
            <SelectItem value="to_follow_up">
              {t("prospection.status.toFollowUp")}
            </SelectItem>
            <SelectItem value="interested">
              {t("prospection.status.interested")}
            </SelectItem>
            <SelectItem value="meeting_booked">
              {t("prospection.status.meetingBooked")}
            </SelectItem>
            <SelectItem value="not_interested">
              {t("prospection.status.notInterested")}
            </SelectItem>
            <SelectItem value="bad_fit">
              {t("prospection.status.badFit")}
            </SelectItem>
            <SelectItem value="do_not_contact">
              {t("prospection.status.doNotContact")}
            </SelectItem>
            <SelectItem value="client">
              {t("prospection.status.client")}
            </SelectItem>
            <SelectItem value="archived">
              {t("prospection.status.archived")}
            </SelectItem>
          </SelectContent>
        </Select>

        {niches.length > 0 && (
          <Select value={nicheFilter} onValueChange={setNicheFilter}>
            <SelectTrigger className="w-32">
              <span className="text-muted-foreground mr-1 text-xs">
                {t("prospection.filters.niche")}:
              </span>
              <SelectValue placeholder="Tous" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous</SelectItem>
              {niches.map((n) => (
                <SelectItem key={n} value={n}>
                  {n}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {cities.length > 0 && (
          <Select value={cityFilter} onValueChange={setCityFilter}>
            <SelectTrigger className="w-36">
              <span className="text-muted-foreground mr-1 text-xs">
                {t("prospection.filters.city")}:
              </span>
              <SelectValue placeholder="Tous" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous</SelectItem>
              {cities.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer select-none">
          <input
            type="checkbox"
            checked={showArchived}
            onChange={(e) => setShowArchived(e.target.checked)}
            className="rounded border-input"
          />
          {t("prospection.filters.showArchived")}
        </label>
      </div>

      <div className="bg-card rounded-lg border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40 text-left">
                <th className="px-4 py-3 font-medium text-muted-foreground min-w-[180px]">
                  <T tx="prospection.table.name" />
                </th>
                <th className="px-4 py-3 font-medium text-muted-foreground md:table-cell">
                  <T tx="prospection.table.phone" />
                </th>
                <th className="px-4 py-3 font-medium text-muted-foreground hidden lg:table-cell">
                  Closer
                </th>
                <th className="px-4 py-3 font-medium text-muted-foreground hidden lg:table-cell">
                  Qualité
                </th>
                <th className="px-4 py-3 font-medium text-muted-foreground">
                  <T tx="prospection.table.status" />
                </th>
                <th className="px-4 py-3 font-medium text-muted-foreground hidden xl:table-cell">
                  <T tx="prospection.table.city" />
                </th>
                <th className="px-4 py-3 font-medium text-muted-foreground hidden xl:table-cell">
                  <T tx="prospection.table.niche" />
                </th>
                <th className="px-4 py-3 font-medium text-muted-foreground w-12" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((company) => (
                <tr
                  key={company.id}
                  className="border-b last:border-0 hover:bg-muted/30 transition-colors"
                >
                  <td className="px-4 py-3">
                    <Link
                      href={`/prospection/leads/${company.id}`}
                      className="font-medium hover:text-primary transition-colors block"
                    >
                      <span className="line-clamp-2">{company.name}</span>
                    </Link>
                    {company.website && (
                      <div className="text-xs text-muted-foreground truncate mt-0.5 max-w-48">
                        {company.website_domain ?? company.website}
                      </div>
                    )}
                    <div className="text-xs text-muted-foreground truncate mt-0.5 max-w-48 md:hidden">
                      {company.city ?? company.formatted_address ?? ""}
                    </div>
                  </td>
                  <td className="px-4 py-3 md:table-cell text-muted-foreground whitespace-nowrap">
                    {company.phone ?? "\u2013"}
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell">
                    {company.assigned_closer ? (
                      <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs font-medium">
                        {company.assigned_closer}
                      </span>
                    ) : (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button className="text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer border border-dashed rounded-full px-2 py-0.5">
                            Assigner
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start" className="w-36">
                          {["Timéo", "Enzo", "Margot"].map((closer) => (
                            <DropdownMenuItem
                              key={closer}
                              onClick={() =>
                                handleAssignCloser(company.id, closer)
                              }
                            >
                              {closer}
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell">
                    <span
                      className={`text-xs font-medium ${qualityColor(company)}`}
                    >
                      {qualityLabel(company)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <ProspectionStatusDropdown
                      status={company.status}
                      onStatusChange={(s) =>
                        handleStatusChange(company.id, s)
                      }
                      disabled={loading && actionId === company.id}
                    />
                  </td>
                  <td className="px-4 py-3 text-muted-foreground hidden xl:table-cell">
                    {company.city ?? company.formatted_address ?? "\u2013"}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground hidden xl:table-cell">
                    {company.niche ?? "\u2013"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          disabled={loading && actionId === company.id}
                        >
                          <MoreHorizontal className="size-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-52">
                        <DropdownMenuLabel>
                          <T tx="prospection.table.actions" />
                        </DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem asChild>
                          <Link href={`/prospection/leads/${company.id}`}>
                            <Eye className="size-3.5 mr-2" />
                            Voir le lead
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => performAction(company.id, "mark_called")}
                        >
                          <Phone className="size-3.5 mr-2" />
                          <T tx="prospection.actions.markCalled" />
                        </DropdownMenuItem>
                        {company.website && (
                          <DropdownMenuItem asChild>
                            <a
                              href={
                                company.website.startsWith("http")
                                  ? company.website
                                  : `https://${company.website}`
                              }
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              <ExternalLink className="size-3.5 mr-2" />
                              <T tx="prospection.actions.openWebsite" />
                            </a>
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => performAction(company.id, "archive")}
                        >
                          <T tx="prospection.actions.archive" />
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td
                    colSpan={8}
                    className="px-4 py-12 text-center text-sm text-muted-foreground"
                  >
                    Aucun lead trouvé avec ces filtres.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        {filtered.length} lead{filtered.length > 1 ? "s" : ""}
      </p>
    </div>
  );
}
