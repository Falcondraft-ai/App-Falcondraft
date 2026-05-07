export const siteConfig = {
  name: "FalconDraft",
  description:
    "Plateforme premium pour transformer un deal commercial en proposition professionnelle prête à valider.",
  url: "https://app.falcondraft.com",
  futureRoutes: [
    "/dashboard/deals",
    "/dashboard/deals/new",
    "/dashboard/deals/[id]",
    "/dashboard/documents",
    "/dashboard/settings",
    "/dashboard/settings/team",
    "/dashboard/settings/integrations",
    "/dashboard/settings/billing",
    "/admin",
  ],
} as const;
