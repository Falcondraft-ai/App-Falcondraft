import type { BillingInvoice, IntegrationItem, TeamMember } from "@/types/user";

export const mockTeamMembers: TeamMember[] = [
  {
    id: "team-clemence",
    userId: "user-clemence",
    name: "Clémence Varlet",
    email: "clemence@falcondraft.local",
    role: "Gestionnaire",
    roleKey: "manager",
    status: "Actif",
    lastActiveAt: "2026-05-06T16:12:00.000Z",
  },
  {
    id: "team-noemie",
    userId: "user-noemie",
    name: "Noémie Abadie",
    email: "noemie@falcondraft.local",
    role: "Gestionnaire",
    roleKey: "manager",
    status: "Actif",
    lastActiveAt: "2026-05-06T11:42:00.000Z",
  },
  {
    id: "team-victor",
    userId: "user-victor",
    name: "Victor Lemaire",
    email: "victor@falcondraft.local",
    role: "Collaborateur",
    roleKey: "member",
    status: "Invitation envoyée",
    lastActiveAt: "2026-05-02T09:20:00.000Z",
  },
];

export const mockIntegrations: IntegrationItem[] = [
  {
    id: "messaging",
    name: "Messagerie",
    description:
      "Prépare les brouillons d’envoi dans la messagerie de l’équipe.",
    status: "not_connected",
    actionLabel: "Connecter",
  },
  {
    id: "proposal-generation",
    name: "Génération de propositions",
    description:
      "Produit des propositions structurées à partir des notes et du contexte.",
    status: "connected",
    actionLabel: "Configurer",
  },
  {
    id: "signature",
    name: "Signature",
    description: "Prépare un lien de signature pour les documents validés.",
    status: "connected",
    actionLabel: "Configurer",
  },
  {
    id: "billing",
    name: "Facturation",
    description: "Centralise les informations d’abonnement et de facturation.",
    status: "not_connected",
    actionLabel: "Préparer",
  },
];

export const mockInvoices: BillingInvoice[] = [
  {
    id: "inv-2026-05",
    period: "Mai 2026",
    amount: "490 €",
    status: "À venir",
  },
  {
    id: "inv-2026-04",
    period: "Avril 2026",
    amount: "490 €",
    status: "Payée",
  },
  {
    id: "inv-2026-03",
    period: "Mars 2026",
    amount: "490 €",
    status: "Payée",
  },
];
