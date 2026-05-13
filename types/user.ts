import type { WorkspaceMemberRole } from "@/lib/auth/workspace-permissions";

export type TeamRole = "Gestionnaire" | "Collaborateur" | "Lecteur";

export type TeamMemberStatus = "Actif" | "Invitation envoyée";

export type TeamMember = {
  id: string;
  userId: string;
  name: string;
  email: string;
  role: TeamRole;
  roleKey: WorkspaceMemberRole;
  status: TeamMemberStatus;
  lastActiveAt: string;
};

export type PendingInvitation = {
  id: string;
  email: string;
  role: TeamRole;
  status: TeamMemberStatus;
  expiresAt: string;
  createdAt: string;
};

export type IntegrationStatus = "connected" | "not_connected";

export type IntegrationItem = {
  id: string;
  name: string;
  description: string;
  status: IntegrationStatus;
  actionLabel: string;
};

export type BillingInvoice = {
  id: string;
  period: string;
  amount: string;
  status: "Payée" | "À venir";
};

export type BillingSubscriptionSummary = {
  planName: string;
  monthlyPrice: string;
  status: string;
  nextInvoiceLabel: string;
};
