import { test, expect, devices } from "@playwright/test";
import { buildBaseState, seedState } from "./utils/seed.js";

const iPhone13 = devices["iPhone 13"];

test.use({
  viewport: iPhone13.viewport,
  userAgent: iPhone13.userAgent,
  deviceScaleFactor: iPhone13.deviceScaleFactor,
  isMobile: true,
  hasTouch: true,
});

test("Objectifs: création actuelle passe par l’action liée d’un objectif", async ({ page }) => {
  const state = buildBaseState({ withContent: true });
  state.profile = { ...(state.profile || {}), plan: "premium", entitlements: { premium: true } };
  await seedState(page, state);

  await page.goto("/objectives");
  await expect(page.locator(".pageTitle")).toContainText("Objectifs");
  await page.getByText("Projet Seed", { exact: true }).click();
  await page.getByRole("button", { name: /Ajouter une action/i }).click();

  await expect(page).toHaveURL(/\/create$/);
  await expect(page.locator(".pageTitle")).toContainText("Créer une action");
  await page.getByPlaceholder(/Envoyer la proposition|Nom de l'action/i).first().fill("Action liée depuis Objectifs");
  await expect(page.getByRole("button", { name: /Créer l.action|Créer une action/ })).toBeVisible();
});

test("Objectifs: l’ancien universal capture global n’est plus exposé", async ({ page }) => {
  const state = buildBaseState({ withContent: false });
  await seedState(page, state);

  await page.goto("/objectives");

  await expect(page.getByTestId("objectives-universal-capture-button")).toHaveCount(0);
  await page.getByLabel("Navigation principale").getByRole("button", { name: "Coach IA" }).click();
  await expect(page.getByText("Ton copilote stratégique")).toBeVisible();
  await page.locator(".coachSurfaceComposerPlus").click();
  await page.getByRole("menuitem", { name: /Plan/i }).click();
  await expect(page.locator(".lovableCoachTextarea")).toHaveValue(
    "Aide-moi à transformer cette intention en plan clair et actionnable."
  );
});
