import { test, expect } from "@playwright/test";
import { buildBaseState, clearAuthSession, seedState } from "./utils/seed.js";

test("sans session: affiche LoginScreen et bloque l'app", async ({ page }) => {
  await clearAuthSession(page);
  await page.goto("/");

  await expect(page.getByTestId("auth-login-screen")).toBeVisible();
  await expect(page.locator("[data-tour-id=\"topnav-tabs\"]")).toHaveCount(0);
});

test("session mockée: accès à l'app", async ({ page }) => {
  const state = buildBaseState({ withContent: false });
  await seedState(page, state);
  await page.goto("/");

  await expect(page.getByTestId("auth-login-screen")).toHaveCount(0);
  await expect(page.locator("[data-tour-id=\"topnav-tabs\"]")).toBeVisible();
});
