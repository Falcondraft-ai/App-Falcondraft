import { PageTransition } from "@/components/common/page-transition";
import { requireCurrentUserContext } from "@/lib/auth/session";
import { getAdminData } from "@/lib/data/supabase-app-data";
import { formatDateTime } from "@/lib/format";

type AdminRow = {
  id: string;
  name: string;
  detail: string;
  status: string;
  updatedAt: string;
};

function AdminRows({
  title,
  rows,
}: {
  title: string;
  rows: AdminRow[];
}) {
  return (
    <section className="rounded-lg border bg-card">
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
              <span className="w-fit rounded-md border bg-secondary px-2 py-1 text-xs">
                {row.status}
              </span>
              <time className="text-muted-foreground text-xs">
                {formatDateTime(row.updatedAt)}
              </time>
            </article>
          ))
        ) : (
          <div className="px-4 py-4 text-sm text-muted-foreground">
            Aucune ligne disponible.
          </div>
        )}
      </div>
    </section>
  );
}

export default async function AdminPage() {
  const context = await requireCurrentUserContext();
  const hasInternalAccess =
    context.membership?.role === "owner" || context.membership?.role === "admin";

  if (!hasInternalAccess) {
    return (
      <PageTransition>
        <section className="border bg-card p-6">
          <p className="text-muted-foreground text-sm">Accès réservé</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">
            Page interne FalconDraft
          </h1>
          <p className="text-muted-foreground mt-2 max-w-2xl text-sm leading-6">
            Cette route est prévue pour une vérification de rôle interne et ne
            doit pas apparaître dans l’espace client standard.
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
            <p className="text-sm text-white/72">Console interne</p>
            <span className="border border-white/15 px-2 py-1 text-xs text-white/72">
              Accès interne
            </span>
          </div>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">
            Supervision FalconDraft
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-white/72">
            Console réservée à l’équipe FalconDraft pour surveiller les
            organisations, les utilisateurs et les cycles de génération.
          </p>
        </div>

        <section className="grid gap-3 md:grid-cols-4">
          {adminData.metrics.map((metric) => (
            <div key={metric.label} className="border bg-card p-4">
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
          <AdminRows title="Opportunités" rows={adminData.rows} />
          <AdminRows title="Générations échouées" rows={adminData.failedRuns} />
        </div>
      </div>
    </PageTransition>
  );
}
