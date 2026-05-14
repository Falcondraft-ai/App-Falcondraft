import type { ReactNode } from "react";
import { T } from "@/components/i18n/translated-text";
import { PageTransition } from "@/components/common/page-transition";
import { requireCurrentUserContext } from "@/lib/auth/session";
import { getAdminData } from "@/lib/data/supabase-app-data";
import { formatDateTime } from "@/lib/format";
import { canViewInternalAdmin } from "@/lib/internal-access";

type AdminRow = {
  id: string;
  name: string;
  detail: string;
  status: string;
  updatedAt: string;
};

function AdminRows({ title, rows }: { title: ReactNode; rows: AdminRow[] }) {
  return (
    <section className="bg-card rounded-lg border">
      <div className="border-b px-4 py-3">
        <h2 className="text-sm font-semibold">{title}</h2>
      </div>
      <div className="divide-y">
        {rows.length > 0 ? (
          rows.map((row) => (
            <article
              key={row.id}
              className="grid gap-2 px-4 py-3 text-sm md:grid-cols-[1fr_auto_auto] md:items-center"
            >
              <div>
                <p className="font-medium">{row.name}</p>
                <p className="text-muted-foreground mt-1 text-xs">
                  {row.detail}
                </p>
              </div>
              <span className="bg-secondary w-fit rounded-md border px-2 py-1 text-xs">
                {row.status}
              </span>
              <time className="text-muted-foreground text-xs">
                {formatDateTime(row.updatedAt)}
              </time>
            </article>
          ))
        ) : (
          <div className="text-muted-foreground px-4 py-4 text-sm">
            <T tx="admin.empty" />
          </div>
        )}
      </div>
    </section>
  );
}

export default async function AdminPage() {
  const context = await requireCurrentUserContext();
  const hasInternalAccess = canViewInternalAdmin(context);

  if (!hasInternalAccess) {
    return (
      <PageTransition>
        <section className="bg-card rounded-lg border p-6">
          <p className="text-muted-foreground text-sm">
            <T tx="admin.restricted" />
          </p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">
            <T tx="admin.restrictedTitle" />
          </h1>
          <p className="text-muted-foreground mt-2 max-w-2xl text-sm leading-6">
            <T tx="admin.restrictedDescription" />
          </p>
        </section>
      </PageTransition>
    );
  }

  const adminData = await getAdminData(context.organization?.id ?? null);

  return (
    <PageTransition>
      <div className="space-y-6">
        <div className="border border-slate-900/15 bg-slate-950 p-5 text-white">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm text-white/72">
              <T tx="admin.console" />
            </p>
            <span className="border border-white/15 px-2 py-1 text-xs text-white/72">
              <T tx="admin.access" />
            </span>
          </div>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">
            <T tx="admin.title" />
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-white/72">
            <T tx="admin.description" />
          </p>
        </div>

        <section className="grid gap-3 md:grid-cols-4">
          {adminData.metrics.map((metric) => (
            <div key={metric.label} className="bg-card rounded-lg border p-4">
              <p className="text-muted-foreground text-xs font-medium">
                {metric.label}
              </p>
              <p className="mt-2 font-mono text-2xl font-semibold">
                {metric.value}
              </p>
              <p className="text-muted-foreground mt-1 text-xs">
                {metric.detail}
              </p>
            </div>
          ))}
        </section>

        <div className="grid gap-6 xl:grid-cols-2">
          <AdminRows title={<T tx="admin.deals" />} rows={adminData.rows} />
          <AdminRows
            title={<T tx="admin.failedRuns" />}
            rows={adminData.failedRuns}
          />
        </div>
      </div>
    </PageTransition>
  );
}
