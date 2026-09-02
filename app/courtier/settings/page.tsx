import Link from "next/link";
import { ArrowRight, HardDrive, Mail, Users } from "lucide-react";
import type { ReactNode } from "react";
import { requireActiveWorkspaceContext } from "@/lib/auth/session";
import { getTeamMembersForOrganization } from "@/lib/data/supabase-app-data";
import { hasConnectedMailbox } from "@/lib/email/mailbox-resolver";
import { computeStorageUsage, formatBytes } from "@/lib/broker/storage";
import { ProfilesManager } from "@/components/broker/profiles-manager";
import { getBrokerProfiles } from "@/lib/broker/profiles";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function ShortcutCard({
  href,
  icon,
  title,
  value,
  hint,
}: {
  href: string;
  icon: ReactNode;
  title: string;
  value: string;
  hint: string;
}) {
  return (
    <Link
      href={href}
      className="group flex items-center gap-4 rounded-lg border bg-[var(--bg-surface)] px-4 py-4 transition-colors hover:border-[var(--brand-navy-300)]"
      style={{ borderColor: "var(--border-1)", boxShadow: "var(--shadow-sm)" }}
    >
      <span
        className="flex size-10 shrink-0 items-center justify-center rounded-lg"
        style={{
          background: "var(--brand-navy-50)",
          border: "1px solid var(--border-1)",
          color: "var(--brand-navy-700)",
        }}
      >
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="fd-eyebrow">{title}</p>
        <p className="mt-0.5 text-[15px] font-semibold text-[var(--fg-1)]">
          {value}
        </p>
        <p className="text-[12px] text-[var(--fg-3)]">{hint}</p>
      </div>
      <ArrowRight
        className="size-4 shrink-0 text-[var(--fg-4)] transition-transform group-hover:translate-x-0.5"
        strokeWidth={1.75}
      />
    </Link>
  );
}

export default async function CourtierGeneralSettingsPage() {
  const context = await requireActiveWorkspaceContext();
  const organization = context.organization!;
  const [members, outlook, profiles] = await Promise.all([
    getTeamMembersForOrganization(organization.id),
    hasConnectedMailbox({
      organizationId: organization.id,
      userId: context.user.id,
    }),
    getBrokerProfiles(organization.id, { includeInactive: true }),
  ]);
  const usage = computeStorageUsage(organization);

  return (
    <div className="space-y-5">
      <section
        className="rounded-lg border bg-[var(--bg-surface)] p-5 sm:p-6"
        style={{ borderColor: "var(--border-1)", boxShadow: "var(--shadow-sm)" }}
      >
        <p className="fd-eyebrow">Cabinet</p>
        <h2 className="fd-serif mt-1 text-[20px] font-semibold tracking-[-0.01em] text-[var(--fg-1)]">
          {organization.name}
        </h2>
        <p className="mt-1 text-[13px] leading-6 text-[var(--fg-3)]">
          Espace courtier — centralisez vos dossiers, vos documents et vos
          devoirs de conseil.
        </p>
      </section>

      <ProfilesManager initialProfiles={profiles} />

      <div className="grid gap-3 sm:grid-cols-2">
        <ShortcutCard
          href="/courtier/settings/equipe"
          icon={<Users className="size-5" strokeWidth={1.75} />}
          title="Équipe & accès"
          value={`${members.length} membre${members.length > 1 ? "s" : ""}`}
          hint="Collaborateurs et permissions"
        />
        <ShortcutCard
          href="/courtier/settings/stockage"
          icon={<HardDrive className="size-5" strokeWidth={1.75} />}
          title="Stockage"
          value={`${usage.percent}%`}
          hint={`${formatBytes(usage.usedBytes)} / ${formatBytes(usage.limitBytes)}`}
        />
        <ShortcutCard
          href="/courtier/settings/integrations"
          icon={<Mail className="size-5" strokeWidth={1.75} />}
          title="Boîtes email"
          value={outlook.connected ? "Connectée" : "Non connectée"}
          hint="Briefing, suivi des emails et brouillons"
        />
      </div>
    </div>
  );
}
