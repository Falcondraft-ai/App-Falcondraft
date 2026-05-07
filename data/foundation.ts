import {
  BarChart3,
  FileCheck2,
  Gauge,
  LockKeyhole,
  type LucideIcon,
} from "lucide-react";

export type FoundationPillar = {
  title: string;
  description: string;
  icon: LucideIcon;
};

export const foundationPillars: FoundationPillar[] = [
  {
    title: "Base SaaS propre",
    description:
      "App Router, TypeScript strict, Tailwind et shadcn prêts pour construire vite sans dette.",
    icon: Gauge,
  },
  {
    title: "Parcours commercial clair",
    description:
      "Créer un deal, générer une proposition, valider, envoyer : la promesse reste simple.",
    icon: FileCheck2,
  },
  {
    title: "Architecture sécurisée",
    description:
      "Structure multi-organisation et RLS-ready pour préparer une vraie application B2B.",
    icon: LockKeyhole,
  },
  {
    title: "Pilotage premium",
    description:
      "Fondations analytics, billing, email et observabilité prêtes sans données sensibles.",
    icon: BarChart3,
  },
];

export const dashboardPreviewRows = [
  {
    deal: "Refonte offre conseil",
    status: "Prêt à générer",
    owner: "Équipe commerciale",
  },
  {
    deal: "Accompagnement architecture",
    status: "Validation interne",
    owner: "Direction",
  },
  {
    deal: "Mission automatisation",
    status: "En préparation",
    owner: "Partenaire",
  },
] as const;
