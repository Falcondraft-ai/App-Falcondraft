export type TeamRole = "Propriétaire" | "Administrateur" | "Membre";

export type TeamMemberStatus = "Actif" | "Invitation envoyée";

export type TeamMember = {
  id: string;
  name: string;
  email: string;
  role: TeamRole;
  status: TeamMemberStatus;
  lastActiveAt: string;
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
