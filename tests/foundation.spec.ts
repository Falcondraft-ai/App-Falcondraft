import { expect, test } from "@playwright/test";

test.describe("FalconDraft foundation routes", () => {
  test("home route renders the Step 1 foundation", async ({ page }) => {
    await page.goto("/");

    await expect(
      page.getByRole("heading", { name: /production commerciale premium/i }),
    ).toBeVisible();
    await expect(page.getByText("Fondation technique")).toBeVisible();
  });

  test("login route renders the placeholder auth card", async ({ page }) => {
    await page.goto("/login");

    await expect(
      page.getByRole("heading", { name: "Connexion" }),
    ).toBeVisible();
    await expect(
      page.getByText("Authentification prête à connecter"),
    ).toBeVisible();
  });

  test("dashboard route renders the minimal shell", async ({ page }) => {
    await page.goto("/dashboard");

    await expect(
      page.getByRole("heading", { name: "Pilotage commercial" }),
    ).toBeVisible();
    await expect(page.getByText("Pipeline de démonstration")).toBeVisible();
  });
});
