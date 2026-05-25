"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";
import { Archive, Ellipsis, RotateCcw, Search, Trash2 } from "lucide-react";
import { DealStatusBadge } from "@/components/common/deal-status-badge";
import { useI18n } from "@/components/i18n/language-provider";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCurrency, formatDate } from "@/lib/format";
import { toast } from "sonner";
import { dealStatuses, type Deal, type DealStatus } from "@/types/deal";
import { getLocalizedCopy, type TranslationKey } from "@/lib/i18n/translations";

type StatusFilter = DealStatus | "all";

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

export function DealsTable({
  deals,
  mode = "active",
}: {
  deals: Deal[];
  mode?: "active" | "archived";
}) {
  const router = useRouter();
  const { t, language } = useI18n();
  const [query, setQuery] = React.useState("");
  const [confirmAction, setConfirmAction] = React.useState<{
    type: "delete" | "archive";
    deal: Deal;
  } | null>(null);
  const [status, setStatus] = React.useState<StatusFilter>("all");
  const [deletedDealIds, setDeletedDealIds] = React.useState<Set<string>>(
    () => new Set(),
  );
  const [deletingDealId, setDeletingDealId] = React.useState<string | null>(
    null,
  );
  const [archivingDealId, setArchivingDealId] = React.useState<string | null>(
    null,
  );

  async function deleteDeal(deal: Deal) {
    setConfirmAction(null);
    setDeletingDealId(deal.id);

    const response = await fetch(`/api/deals/${deal.id}`, {
      method: "DELETE",
    }).catch(() => null);

    setDeletingDealId(null);

    if (!response?.ok) {
      const result: unknown = await response?.json().catch(() => null);

      toast.error("Suppression impossible", {
        description: getErrorMessage(
          result,
          "Le dossier commercial n’a pas pu être supprimé.",
        ),
      });
      return;
    }

    setDeletedDealIds((current) => {
      const next = new Set(current);
      next.add(deal.id);
      return next;
    });

    toast.success("Dossier commercial supprimé", {
      description: "La liste des dossiers a été mise à jour.",
    });
    router.refresh();
  }

  async function updateArchiveState(deal: Deal) {
    const isArchivedMode = mode === "archived";
    setConfirmAction(null);
    setArchivingDealId(deal.id);

    const response = await fetch(`/api/deals/${deal.id}/archive`, {
      method: isArchivedMode ? "DELETE" : "PATCH",
    }).catch(() => null);

    setArchivingDealId(null);

    if (!response?.ok) {
      const result: unknown = await response?.json().catch(() => null);

      toast.error(
        isArchivedMode ? "Restauration impossible" : "Archivage impossible",
        {
          description: getErrorMessage(
            result,
            "Le dossier commercial n’a pas pu être mis à jour.",
          ),
        },
      );
      return;
    }

    setDeletedDealIds((current) => {
      const next = new Set(current);
      next.add(deal.id);
      return next;
    });

    toast.success(isArchivedMode ? "Dossier restauré" : "Dossier archivé", {
      description: isArchivedMode
        ? "Le dossier revient dans le pipeline commercial."
        : "Le dossier a été retiré du pipeline commercial.",
    });
    router.refresh();
  }

  const filteredDeals = deals.filter((deal) => {
    if (deletedDealIds.has(deal.id)) {
      return false;
    }

    const normalizedQuery = query.trim().toLowerCase();
    const matchesQuery =
      normalizedQuery.length === 0 ||
      [
        deal.name,
        deal.clientCompanyName,
        deal.clientContactName,
        deal.clientEmail,
      ].some((value) => value.toLowerCase().includes(normalizedQuery));
    const matchesStatus = status === "all" || deal.status === status;

    return matchesQuery && matchesStatus;
  });

  return (
    <section className="rounded-lg border border-[var(--border)] bg-[var(--background-card)] shadow-sm">
      <div className="grid gap-3 border-b border-[var(--border)] p-4 md:grid-cols-[1fr_auto]">
        <div className="relative">
          <Search
            className="pointer-events-none absolute top-2.5 left-2.5 size-4 text-[var(--muted-foreground)]"
            strokeWidth={1.75}
          />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t("deals.searchPlaceholder")}
            className="h-9 rounded-md border-[var(--border)] bg-[var(--background-card)] pl-8 focus-visible:border-[var(--accent)] focus-visible:ring-1 focus-visible:ring-[var(--accent)]"
          />
        </div>
        <Select
          value={status}
          onValueChange={(value) => setStatus(value as StatusFilter)}
        >
          <SelectTrigger className="h-9 w-full rounded-md border-[var(--border)] bg-[var(--background-card)] focus-visible:border-[var(--accent)] focus-visible:ring-1 focus-visible:ring-[var(--accent)] md:w-60">
            <SelectValue placeholder={t("deals.statusPlaceholder")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("deals.allStatuses")}</SelectItem>
            {dealStatuses.map((statusOption) => (
              <SelectItem key={statusOption} value={statusOption}>
                {t(`dealStatus.${statusOption}` as TranslationKey)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="h-10 text-[11px] font-medium uppercase tracking-[0.06em] text-[var(--muted-foreground)]">
              {t("table.deal")}
            </TableHead>
            <TableHead className="h-10 text-[11px] font-medium uppercase tracking-[0.06em] text-[var(--muted-foreground)]">
              {t("deals.client")}
            </TableHead>
            <TableHead className="h-10 text-[11px] font-medium uppercase tracking-[0.06em] text-[var(--muted-foreground)]">
              {t("table.status")}
            </TableHead>
            <TableHead className="h-10 text-[11px] font-medium uppercase tracking-[0.06em] text-[var(--muted-foreground)]">
              {t("table.budget")}
            </TableHead>
            <TableHead className="h-10 text-[11px] font-medium uppercase tracking-[0.06em] text-[var(--muted-foreground)]">
              {t("table.updated")}
            </TableHead>
            <TableHead className="h-10 text-right text-[11px] font-medium uppercase tracking-[0.06em] text-[var(--muted-foreground)]">
              {t("deals.actions")}
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filteredDeals.map((deal) => (
            <TableRow
              key={deal.id}
              className="duration-100 hover:bg-[var(--background-subtle)]"
            >
              <TableCell>
                <div className="max-w-72">
                  <Link
                    href={`/dashboard/deals/${deal.id}`}
                    className="hover:text-primary font-medium transition-colors"
                  >
                    {deal.name}
                  </Link>
                  <p className="text-muted-foreground mt-1 truncate text-xs">
                    {deal.lastAction}
                  </p>
                </div>
              </TableCell>
              <TableCell>
                <div>
                  <p>{deal.clientCompanyName}</p>
                  <p className="text-muted-foreground text-xs">
                    {deal.clientContactName}
                  </p>
                </div>
              </TableCell>
              <TableCell>
                <DealStatusBadge status={deal.status} />
              </TableCell>
              <TableCell className="font-mono">
                {formatCurrency(deal.amountEstimate)}
              </TableCell>
              <TableCell>{formatDate(deal.updatedAt)}</TableCell>
              <TableCell className="text-right">
                <div className="flex items-center justify-end gap-1.5">
                  <Button
                    asChild
                    variant="outline"
                    size="sm"
                    className="border-[var(--border)] bg-transparent text-[var(--foreground)] hover:bg-[var(--background-subtle)] hover:text-[var(--foreground)]"
                  >
                    <Link href={`/dashboard/deals/${deal.id}`}>
                      {t("deals.open")}
                    </Link>
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Options du dossier ${deal.name}`}
                        disabled={
                          deletingDealId === deal.id ||
                          archivingDealId === deal.id
                        }
                      >
                        <Ellipsis aria-hidden="true" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48">
                      <DropdownMenuItem
                        disabled={archivingDealId === deal.id}
                        onSelect={() =>
                          setConfirmAction({ type: "archive", deal })
                        }
                      >
                        {mode === "archived" ? (
                          <RotateCcw aria-hidden="true" />
                        ) : (
                          <Archive aria-hidden="true" />
                        )}
                        {archivingDealId === deal.id
                          ? t("deals.updating")
                          : mode === "archived"
                            ? t("deals.restore")
                            : t("deals.archive")}
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        variant="destructive"
                        disabled={deletingDealId === deal.id}
                        onSelect={() =>
                          setConfirmAction({ type: "delete", deal })
                        }
                      >
                        <Trash2 aria-hidden="true" />
                        {deletingDealId === deal.id
                          ? t("deals.deleting")
                          : t("deals.delete")}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {filteredDeals.length === 0 ? (
        <div className="text-muted-foreground border-t p-6 text-center text-sm">
          {t("deals.emptyFiltered")}
        </div>
      ) : null}
      <AlertDialog
        open={confirmAction !== null}
        onOpenChange={(open) => {
          if (!open) setConfirmAction(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmAction?.type === "delete"
                ? getLocalizedCopy(language, {
                    fr: "Supprimer le dossier",
                    en: "Delete deal",
                    es: "Eliminar expediente",
                  })
                : mode === "archived"
                  ? getLocalizedCopy(language, {
                      fr: "Restaurer le dossier",
                      en: "Restore deal",
                      es: "Restaurar expediente",
                    })
                  : getLocalizedCopy(language, {
                      fr: "Archiver le dossier",
                      en: "Archive deal",
                      es: "Archivar expediente",
                    })}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmAction?.type === "delete"
                ? getLocalizedCopy(language, {
                    fr: `Supprimer définitivement le dossier "${confirmAction.deal.name}" ? Cette action est irréversible.`,
                    en: `Permanently delete "${confirmAction.deal.name}"? This action is irreversible.`,
                    es: `¿Eliminar definitivamente el expediente "${confirmAction.deal.name}"? Esta acción es irreversible.`,
                  })
                : mode === "archived"
                  ? getLocalizedCopy(language, {
                      fr: `Restaurer le dossier "${confirmAction?.deal.name}" dans le pipeline commercial ?`,
                      en: `Restore "${confirmAction?.deal.name}" to the sales pipeline?`,
                      es: `¿Restaurar "${confirmAction?.deal.name}" en el pipeline comercial?`,
                    })
                  : getLocalizedCopy(language, {
                      fr: `Archiver le dossier "${confirmAction?.deal.name}" ? Il sortira du pipeline commercial.`,
                      en: `Archive "${confirmAction?.deal.name}"? It will be removed from the sales pipeline.`,
                      es: `¿Archivar "${confirmAction?.deal.name}"? Saldrá del pipeline comercial.`,
                    })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>
              {getLocalizedCopy(language, {
                fr: "Annuler",
                en: "Cancel",
                es: "Cancelar",
              })}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (confirmAction?.type === "delete")
                  void deleteDeal(confirmAction.deal);
                else if (confirmAction)
                  void updateArchiveState(confirmAction.deal);
              }}
              className={
                confirmAction?.type === "delete"
                  ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  : ""
              }
            >
              {confirmAction?.type === "delete"
                ? getLocalizedCopy(language, {
                    fr: "Supprimer",
                    en: "Delete",
                    es: "Eliminar",
                  })
                : mode === "archived"
                  ? getLocalizedCopy(language, {
                      fr: "Restaurer",
                      en: "Restore",
                      es: "Restaurar",
                    })
                  : getLocalizedCopy(language, {
                      fr: "Archiver",
                      en: "Archive",
                      es: "Archivar",
                    })}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
