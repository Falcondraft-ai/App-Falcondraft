"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";
import { Ellipsis, Search, Trash2 } from "lucide-react";
import { DealStatusBadge } from "@/components/common/deal-status-badge";
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
import {
  dealStatusLabels,
  dealStatuses,
  type Deal,
  type DealStatus,
} from "@/types/deal";

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

export function DealsTable({ deals }: { deals: Deal[] }) {
  const router = useRouter();
  const [query, setQuery] = React.useState("");
  const [status, setStatus] = React.useState<StatusFilter>("all");
  const [deletedDealIds, setDeletedDealIds] = React.useState<Set<string>>(
    () => new Set(),
  );
  const [deletingDealId, setDeletingDealId] = React.useState<string | null>(
    null,
  );

  async function deleteDeal(deal: Deal) {
    const confirmed = window.confirm(
      `Supprimer définitivement le dossier “${deal.name}” ? Cette action est irréversible.`,
    );

    if (!confirmed) {
      return;
    }

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
    <section className="rounded-lg border bg-card/75">
      <div className="grid gap-3 border-b p-4 md:grid-cols-[1fr_auto]">
        <div className="relative">
          <Search
            className="text-muted-foreground pointer-events-none absolute top-2.5 left-2.5 size-4"
            strokeWidth={1.75}
          />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Rechercher un dossier, un client ou un contact"
            className="pl-8"
          />
        </div>
        <Select
          value={status}
          onValueChange={(value) => setStatus(value as StatusFilter)}
        >
          <SelectTrigger className="w-full md:w-60">
            <SelectValue placeholder="Filtrer par statut" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les statuts</SelectItem>
            {dealStatuses.map((statusOption) => (
              <SelectItem key={statusOption} value={statusOption}>
                {dealStatusLabels[statusOption]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Dossier commercial</TableHead>
            <TableHead>Client</TableHead>
            <TableHead>Statut</TableHead>
            <TableHead>Budget</TableHead>
            <TableHead>Mis à jour</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filteredDeals.map((deal) => (
            <TableRow key={deal.id}>
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
                  <Button asChild variant="outline" size="sm">
                    <Link href={`/dashboard/deals/${deal.id}`}>Ouvrir</Link>
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Options du dossier ${deal.name}`}
                        disabled={deletingDealId === deal.id}
                      >
                        <Ellipsis aria-hidden="true" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48">
                      <DropdownMenuItem
                        variant="destructive"
                        disabled={deletingDealId === deal.id}
                        onSelect={() => void deleteDeal(deal)}
                      >
                        <Trash2 aria-hidden="true" />
                        {deletingDealId === deal.id
                          ? "Suppression..."
                          : "Supprimer"}
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
        <div className="border-t p-6 text-center text-sm text-muted-foreground">
          Aucun dossier commercial ne correspond à ces critères.
        </div>
      ) : null}
    </section>
  );
}
