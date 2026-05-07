export type ActivityEvent = {
  id: string;
  dealId: string;
  title: string;
  description: string;
  createdAt: string;
  actorName: string;
};

export const mockActivity: ActivityEvent[] = [
  {
    id: "act-001",
    dealId: "opp-archipel-gare",
    title: "Proposition marquée à valider",
    description: "La version de relecture est prête pour contrôle interne.",
    createdAt: "2026-05-06T15:48:00.000Z",
    actorName: "Clémence Varlet",
  },
  {
    id: "act-002",
    dealId: "opp-archipel-gare",
    title: "Compte-rendu consolidé",
    description: "Les notes d’appel ont été structurées par enjeux et livrables.",
    createdAt: "2026-05-06T10:20:00.000Z",
    actorName: "FalconDraft",
  },
  {
    id: "act-003",
    dealId: "opp-studio-lignage",
    title: "Proposition prête",
    description: "La proposition peut être relue avant création du document final.",
    createdAt: "2026-05-05T10:06:00.000Z",
    actorName: "Noémie Abadie",
  },
  {
    id: "act-004",
    dealId: "opp-cobalt-methodologie",
    title: "Document final préparé",
    description: "Le PDF final intègre les ajustements de gouvernance.",
    createdAt: "2026-05-04T17:25:00.000Z",
    actorName: "Clémence Varlet",
  },
  {
    id: "act-005",
    dealId: "opp-nord-ouvrage",
    title: "Brouillon email prêt",
    description: "Le message d’envoi inclut le lien de signature.",
    createdAt: "2026-05-03T11:15:00.000Z",
    actorName: "Noémie Abadie",
  },
  {
    id: "act-006",
    dealId: "opp-rivage-conseil",
    title: "Proposition en préparation",
    description: "Le périmètre et le chiffrage sont en cours de structuration.",
    createdAt: "2026-05-06T09:30:00.000Z",
    actorName: "FalconDraft",
  },
];

export function getActivityForDeal(dealId: string): ActivityEvent[] {
  return mockActivity.filter((event) => event.dealId === dealId);
}
