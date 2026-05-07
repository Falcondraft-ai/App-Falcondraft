import { expect, test } from "@playwright/test";

test.describe("FalconDraft Step 2 routes", () => {
  test("home and login routes provide coherent app entry points", async ({
    page,
  }) => {
    await page.goto("/");

    await expect(
      page.getByRole("heading", {
        name: /produire des propositions commerciales/i,
      }),
    ).toBeVisible();
    await expect(page.getByText("Flux de production")).toBeVisible();

    await page.goto("/login");

    await expect(
      page.getByRole("heading", { name: "Accéder à l’espace client" }),
    ).toBeVisible();
    await expect(page.getByText("Se connecter")).toBeVisible();
  });

  test("dashboard route renders the client overview", async ({
    page,
  }) => {
    await page.goto("/dashboard");

    await expect(
      page.getByRole("heading", { name: "Pilotage des propositions" }),
    ).toBeVisible();
    await expect(page.getByText("Opportunités récentes")).toBeVisible();
    await expect(page.getByText("Activité de génération")).toBeVisible();
  });

  test("deals routes render list, create form, and detail page", async ({
    page,
  }) => {
    await page.goto("/dashboard/deals");

    await expect(
      page.getByRole("heading", { name: "Pipeline commercial" }),
    ).toBeVisible();
    await expect(page.getByText("Atelier Archipel").first()).toBeVisible();

    await page.goto("/dashboard/deals/new");

    await expect(
      page.getByRole("heading", { name: "Créer une opportunité" }),
    ).toBeVisible();
    await expect(page.getByLabel("Nom de l’opportunité")).toBeVisible();

    await page.goto("/dashboard/deals/opp-archipel-gare");

    await expect(
      page.getByRole("heading", {
        name: "Concours restructuration gare fluviale",
      }),
    ).toBeVisible();
    await expect(page.getByText("Générer la proposition")).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Brouillon email" }),
    ).toBeVisible();
  });

  test("documents, settings, and admin routes render core labels", async ({
    page,
  }) => {
    await page.goto("/dashboard/documents");

    await expect(
      page.getByRole("heading", { name: "Documents générés" }),
    ).toBeVisible();
    await expect(page.getByText("Lien de signature — logements")).toBeVisible();

    await page.goto("/dashboard/settings");

    await expect(
      page.getByRole("heading", { name: "Organisation et accès" }),
    ).toBeVisible();
    await expect(page.getByLabel("Nom de l’organisation")).toBeVisible();

    await page.goto("/dashboard/settings/integrations");

    await expect(
      page.getByRole("heading", { name: "Messagerie" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Facturation" }),
    ).toBeVisible();

    await page.goto("/dashboard/settings/billing");

    await expect(page.getByText("Gérer l’abonnement")).toBeVisible();

    await page.goto("/admin");

    await expect(
      page.getByRole("heading", { name: "Supervision FalconDraft" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Générations échouées" }),
    ).toBeVisible();
  });
});
