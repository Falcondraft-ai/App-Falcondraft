import { expect, test } from "@playwright/test";

test.describe("FalconDraft Step 2 routes", () => {
  test("home and login routes provide coherent app entry points", async ({
    page,
  }) => {
    await page.goto("/");

    await expect(
      page.getByRole("heading", {
        name: /poste de travail des propositions commerciales/i,
      }),
    ).toBeVisible();
    await expect(page.getByText("Chaîne de production")).toBeVisible();

    await page.goto("/login");

    await expect(
      page.getByRole("heading", { name: "Accéder à FalconDraft" }),
    ).toBeVisible();
    await expect(page.getByText("Se connecter")).toBeVisible();
  });

  test("private routes redirect unauthenticated users to login", async ({
    page,
  }) => {
    const privateRoutes = [
      "/dashboard",
      "/dashboard/deals",
      "/dashboard/deals/new",
      "/dashboard/deals/00000000-0000-0000-0000-000000000000",
      "/dashboard/documents",
      "/dashboard/settings",
      "/dashboard/settings/team",
      "/dashboard/settings/integrations",
      "/dashboard/settings/billing",
      "/admin",
    ];

    for (const route of privateRoutes) {
      await page.goto(route);
      await expect(page).toHaveURL(/\/login/);
      await expect(
        page.getByRole("heading", { name: "Accéder à FalconDraft" }),
      ).toBeVisible();
    }
  });
});
