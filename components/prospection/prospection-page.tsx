"use client";

import * as React from "react";
import { T } from "@/components/i18n/translated-text";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DashboardTab } from "@/components/prospection/dashboard-tab";
import { LeadsTab } from "@/components/prospection/leads-tab";
import { SearchesTab } from "@/components/prospection/searches-tab";
import { AdminDocumentsTab } from "@/components/prospection/admin-documents-tab";
import type {
  ProspectCompanyRow,
  ProspectingSearchRow,
  ProspectDocumentRow,
} from "@/types/database";

export function ProspectionPage({
  initialCompanies,
  initialSearches,
  initialAllDocuments,
  isManager,
}: {
  initialCompanies: ProspectCompanyRow[];
  initialSearches: ProspectingSearchRow[];
  initialAllDocuments: ProspectDocumentRow[];
  isManager: boolean;
}) {
  return (
    <div className="space-y-6">
      <div className="border border-slate-900/15 bg-slate-950 p-5 text-white">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm text-white/72">
            <T tx="prospection.eyebrow" />
          </p>
          <span className="border border-white/15 px-2 py-1 text-xs text-white/72">
            Interne
          </span>
        </div>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">
          <T tx="prospection.title" />
        </h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-white/72">
          <T tx="prospection.subtitle" />
        </p>
      </div>

      <Tabs defaultValue="dashboard" className="gap-4">
        <TabsList>
          <TabsTrigger value="dashboard">
            Tableau de bord
          </TabsTrigger>
          <TabsTrigger value="leads">
            <T tx="prospection.leads" /> ({initialCompanies.length})
          </TabsTrigger>
          <TabsTrigger value="searches">
            <T tx="prospection.searches" /> ({initialSearches.length})
          </TabsTrigger>
          {isManager && (
            <TabsTrigger value="admin">
              Administration
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="dashboard">
          <DashboardTab companies={initialCompanies} />
        </TabsContent>

        <TabsContent value="leads">
          <LeadsTab initialData={initialCompanies} />
        </TabsContent>

        <TabsContent value="searches">
          <SearchesTab searches={initialSearches} />
        </TabsContent>

        {isManager && (
          <TabsContent value="admin">
            <AdminDocumentsTab initialDocuments={initialAllDocuments} />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
