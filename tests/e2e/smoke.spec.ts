import { expect, test } from "@playwright/test";

// Prérequis : pile complète lancée (`podman compose up`).
test("la page de connexion s'affiche en français et redirige vers Keycloak", async ({ page }) => {
  await page.goto("/connexion");
  await expect(page.getByRole("heading", { name: "ClassMind" })).toBeVisible();
  await page.getByRole("button", { name: "Se connecter" }).click();
  await expect(page).toHaveURL(/\/auth\/realms\/classmind/);
});

test("une route protégée sans session renvoie vers la connexion", async ({ page }) => {
  await page.goto("/classes");
  await expect(page).toHaveURL(/\/connexion/);
});
