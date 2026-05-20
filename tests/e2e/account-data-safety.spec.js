import { test, expect, devices } from "@playwright/test";
import { buildBaseState, getState } from "./utils/seed.js";
import {
  openProfileMenu,
  seedCurrentUser,
} from "./utils/currentProduct.js";

const iPhone13 = devices["iPhone 13"];

test.use({
  viewport: iPhone13.viewport,
  userAgent: iPhone13.userAgent,
  deviceScaleFactor: iPhone13.deviceScaleFactor,
  isMobile: true,
  hasTouch: true,
});

test("ProfileMenu: Account, Settings, Support and secondary backs are reachable", async ({ page }) => {
  await seedCurrentUser(page, buildBaseState({ withContent: false }));
  await page.goto("/");

  await openProfileMenu(page);
  await page.getByRole("button", { name: "Fermer" }).click();
  await expect(page.getByText("Gérer ton compte et ton accès.")).toHaveCount(0);

  await openProfileMenu(page);
  await page.getByRole("button", { name: "Profil", exact: true }).click();
  await expect(page).toHaveURL(/\/account$/);
  await expect(page.getByRole("button", { name: /Retour/i })).toBeVisible();
  await page.getByRole("button", { name: /Retour/i }).click();
  await expect(page.getByTestId("today-primary-action-card")).toBeVisible();

  await openProfileMenu(page);
  await page.getByRole("button", { name: "Paramètres" }).click();
  await expect(page).toHaveURL(/\/settings$/);
  await page.getByRole("button", { name: "Confidentialité" }).click();
  await expect(page).toHaveURL(/\/privacy$/);
  await page.getByRole("button", { name: /Retour/i }).click();
  await expect(page.getByTestId("today-primary-action-card")).toBeVisible();

  await page.goto("/settings");
  await page.getByRole("button", { name: "Conditions" }).click();
  await expect(page).toHaveURL(/\/legal$/);
  await page.getByRole("button", { name: /Retour/i }).click();
  await expect(page.getByTestId("today-primary-action-card")).toBeVisible();

  await openProfileMenu(page);
  await page.getByRole("button", { name: "Support" }).click();
  await expect(page).toHaveURL(/\/support$/);
  await expect(page.getByRole("button", { name: /Retour/i })).toBeVisible();
});

test("Data import: confirmation required and invalid import does not mutate", async ({ page }) => {
  const state = buildBaseState({ withContent: false });
  state.profile.whyText = "État initial";
  await seedCurrentUser(page, state);
  await page.goto("/data");

  await page.locator("input[type=\"file\"]").setInputFiles({
    name: "invalid.json",
    mimeType: "application/json",
    buffer: Buffer.from("{"),
  });
  await expect(page.getByText(/importé|invalide|Impossible/i).first()).toBeVisible();
  expect((await getState(page)).profile.whyText).toBe("État initial");

  const replacement = buildBaseState({ withContent: false });
  replacement.profile.whyText = "État importé";
  await page.locator("input[type=\"file\"]").setInputFiles({
    name: "valid.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(replacement)),
  });

  await expect(page.getByTestId("data-import-confirmation")).toBeVisible();
  expect((await getState(page)).profile.whyText).toBe("État initial");
  await page.getByRole("button", { name: "Annuler" }).click();
  await expect(page.getByTestId("data-import-confirmation")).toHaveCount(0);
  expect((await getState(page)).profile.whyText).toBe("État initial");

  await page.locator("input[type=\"file\"]").setInputFiles({
    name: "valid.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(replacement)),
  });
  await page.getByRole("button", { name: "Importer et remplacer" }).click();
  await expect(page.getByText(/Import terminé|importées|importé/i).first()).toBeVisible();
  expect((await getState(page)).profile.whyText).toBe("État importé");
});
