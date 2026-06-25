import "server-only";

import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { managedWorkflowTypes } from "@/lib/internal-admin/workflows";
import type {
  OrganizationInvitationRow,
  OrganizationMemberRow,
  OrganizationRow,
  ProfileRow,
  WorkflowConfigRow,
} from "@/types/database";

export type InternalAdminWorkflowConfig = {
  id: string;
  organizationId: string;
  workflowType: string;
  n8nWebhookUrl: string;
  n8nWorkflowId: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
};

export type InternalAdminOrganization = {
  id: string;
  name: string;
  slug: string;
  billingStatus: string;
  workspaceType: string;
  storageLimitBytes: number;
  storageUsedBytes: number;
  setupAmount: number | null;
  monthlySubscriptionAmount: number | null;
  allowMemberCompanyVisibility: boolean;
  meetingBotName: string;
  createdAt: string;
  isInternalWorkspace: boolean;
  activeMemberCount: number;
  pendingInvitationCount: number;
  workflowConfigs: InternalAdminWorkflowConfig[];
  accounts: InternalAdminWorkspaceAccount[];
  pendingInvitations: InternalAdminWorkspaceInvitation[];
};

export type InternalAdminWorkspaceAccount = {
  id: string;
  userId: string;
  name: string;
  email: string;
  role: string;
  status: string;
  createdAt: string;
};

export type InternalAdminWorkspaceInvitation = {
  id: string;
  email: string;
  role: string;
  status: string;
  expiresAt: string;
  createdAt: string;
};

export type InternalAdminWorkspaceData = {
  organizations: InternalAdminOrganization[];
  metrics: Array<{
    label: string;
    value: string;
    detail: string;
  }>;
};

function mapWorkflowConfig(
  config: WorkflowConfigRow,
): InternalAdminWorkflowConfig {
  return {
    id: config.id,
    organizationId: config.organization_id,
    workflowType: config.workflow_type,
    n8nWebhookUrl: config.n8n_webhook_url,
    n8nWorkflowId: config.n8n_workflow_id,
    status: config.status,
    createdAt: config.created_at,
    updatedAt: config.updated_at,
  };
}

function countByOrganization<T extends { organization_id: string }>(rows: T[]) {
  const counts = new Map<string, number>();

  for (const row of rows) {
    counts.set(row.organization_id, (counts.get(row.organization_id) ?? 0) + 1);
  }

  return counts;
}

export async function getInternalAdminWorkspaceData(input: {
  internalOrganizationId: string | null;
}): Promise<InternalAdminWorkspaceData> {
  const adminSupabase = getSupabaseAdminClient();

  if (!adminSupabase) {
    return {
      organizations: [],
      metrics: [
        { label: "Workspaces", value: "0", detail: "Configuration manquante" },
        { label: "Workflows", value: "0", detail: "Configuration manquante" },
        { label: "Invitations", value: "0", detail: "Configuration manquante" },
      ],
    };
  }

  const [
    organizationsResult,
    workflowConfigsResult,
    activeMembersResult,
    pendingInvitationsResult,
  ] = await Promise.all([
    adminSupabase
      .from("organizations")
      .select("*")
      .order("created_at", { ascending: false }),
    adminSupabase
      .from("workflow_configs")
      .select("*")
      .order("workflow_type", { ascending: true }),
    adminSupabase
      .from("organization_members")
      .select("id, organization_id, user_id, role, status, created_at")
      .eq("status", "active"),
    adminSupabase
      .from("organization_invitations")
      .select("*")
      .eq("status", "pending")
      .gt("expires_at", new Date().toISOString()),
  ]);

  const organizations = (organizationsResult.data ?? []) as OrganizationRow[];
  const workflowConfigs = (workflowConfigsResult.data ??
    []) as WorkflowConfigRow[];
  const activeMembers = (activeMembersResult.data ??
    []) as OrganizationMemberRow[];
  const pendingInvitations = (pendingInvitationsResult.data ??
    []) as OrganizationInvitationRow[];
  const memberUserIds = [
    ...new Set(activeMembers.map((member) => member.user_id)),
  ];
  const profilesResult =
    memberUserIds.length > 0
      ? await adminSupabase
          .from("profiles")
          .select("*")
          .in("user_id", memberUserIds)
      : { data: [], error: null };
  const profiles = (profilesResult.data ?? []) as ProfileRow[];
  const profileByUserId = new Map(
    profiles.map((profile) => [profile.user_id, profile]),
  );

  const membersByOrganization = countByOrganization(activeMembers);
  const invitationsByOrganization = countByOrganization(pendingInvitations);
  const configsByOrganization = new Map<
    string,
    InternalAdminWorkflowConfig[]
  >();

  const managedTypes = new Set<string>(managedWorkflowTypes);

  for (const config of workflowConfigs) {
    if (!managedTypes.has(config.workflow_type)) continue;
    const mappedConfig = mapWorkflowConfig(config);
    const current = configsByOrganization.get(config.organization_id) ?? [];
    current.push(mappedConfig);
    configsByOrganization.set(config.organization_id, current);
  }

  const accountsByOrganization = new Map<
    string,
    InternalAdminWorkspaceAccount[]
  >();

  for (const member of activeMembers) {
    const profile = profileByUserId.get(member.user_id);
    const email = profile?.email ?? "Email inconnu";
    const account = {
      id: member.id,
      userId: member.user_id,
      name: profile?.full_name?.trim() || email,
      email,
      role: member.role,
      status: member.status,
      createdAt: member.created_at,
    };
    const current = accountsByOrganization.get(member.organization_id) ?? [];
    current.push(account);
    accountsByOrganization.set(member.organization_id, current);
  }

  const pendingInvitationsByOrganization = new Map<
    string,
    InternalAdminWorkspaceInvitation[]
  >();

  for (const invitation of pendingInvitations) {
    const mappedInvitation = {
      id: invitation.id,
      email: invitation.email,
      role: invitation.role,
      status: invitation.status,
      expiresAt: invitation.expires_at,
      createdAt: invitation.created_at,
    };
    const current =
      pendingInvitationsByOrganization.get(invitation.organization_id) ?? [];
    current.push(mappedInvitation);
    pendingInvitationsByOrganization.set(invitation.organization_id, current);
  }

  const mappedOrganizations = organizations.map<InternalAdminOrganization>(
    (organization) => ({
      id: organization.id,
      name: organization.name,
      slug: organization.slug,
      billingStatus: organization.billing_status,
      workspaceType: organization.workspace_type || "sales_automation",
      storageLimitBytes: organization.storage_limit_bytes ?? 268435456000,
      storageUsedBytes: organization.storage_used_bytes ?? 0,
      setupAmount: organization.setup_amount,
      monthlySubscriptionAmount: organization.monthly_subscription_amount,
      allowMemberCompanyVisibility:
        organization.allow_member_company_visibility,
      meetingBotName: organization.meeting_bot_name || "FalconDraft",
      createdAt: organization.created_at,
      isInternalWorkspace: organization.id === input.internalOrganizationId,
      activeMemberCount: membersByOrganization.get(organization.id) ?? 0,
      pendingInvitationCount:
        invitationsByOrganization.get(organization.id) ?? 0,
      workflowConfigs: configsByOrganization.get(organization.id) ?? [],
      accounts: accountsByOrganization.get(organization.id) ?? [],
      pendingInvitations:
        pendingInvitationsByOrganization.get(organization.id) ?? [],
    }),
  );

  const activeConfigCount = workflowConfigs.filter(
    (config) => config.status === "active",
  ).length;

  return {
    organizations: mappedOrganizations,
    metrics: [
      {
        label: "Workspaces",
        value: String(mappedOrganizations.length),
        detail: "Espaces FalconDraft connus",
      },
      {
        label: "Workflows actifs",
        value: String(activeConfigCount),
        detail: "Webhooks n8n prêts",
      },
      {
        label: "Invitations",
        value: String(pendingInvitations.length),
        detail: "Invitations client en attente",
      },
    ],
  };
}
