"use client";

import Link from "next/link";
import * as React from "react";
import { Search } from "lucide-react";
import { DealStatusBadge } from "@/components/common/deal-status-badge";
import { Button } from "@/components/ui/button";
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
import { dealStatusOptions, type mockDeals } from "@/data/mock-deals";
import { formatCurrency, formatDate } from "@/lib/format";
import type { DealStatus } from "@/types/deal";

type DealTableData = typeof mockDeals;
type StatusFilter = DealStatus | "all";

export function DealsTable({ deals }: { deals: DealTableData }) {
  const [query, setQuery] = React.useState("");
  const [status, setStatus] = React.useState<StatusFilter>("all");

  const filteredDeals = deals.filter((deal) => {
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
    <section className="rounded-lg border bg-card">
      <div className="grid gap-3 border-b p-4 md:grid-cols-[1fr_auto]">
        <div className="relative">
          <Search
            className="text-muted-foreground pointer-events-none absolute top-2.5 left-2.5 size-4"
            strokeWidth={1.75}
          />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Rechercher une opportunité, un client ou un contact"
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
            {dealStatusOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Opportunité</TableHead>
            <TableHead>Client</TableHead>
            <TableHead>Statut</TableHead>
            <TableHead>Montant</TableHead>
            <TableHead>Mis à jour</TableHead>
            <TableHead className="text-right">Action</TableHead>
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
                <Button asChild variant="outline" size="sm">
                  <Link href={`/dashboard/deals/${deal.id}`}>Ouvrir</Link>
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {filteredDeals.length === 0 ? (
        <div className="border-t p-6 text-center text-sm text-muted-foreground">
          Aucune opportunité ne correspond à ces critères.
        </div>
      ) : null}
    </section>
  );
}
