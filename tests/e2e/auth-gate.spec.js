import { test, expect } from "@playwright/test";
import { buildBaseState, buildMockAuthSession, clearAuthSession, seedState } from "./utils/seed.js";

test("sans session: affiche signup et bloque l'app", async ({ page }) => {
  await clearAuthSession(page);
  await page.goto("/");

  await expect(page.getByTestId("auth-signup-screen")).toBeVisible();
  await expect(page.locator("[data-tour-id=\"topnav-tabs\"]")).toHaveCount(0);
});

test("sans session sur /auth/login: affiche login", async ({ page }) => {
  await clearAuthSession(page);
  await page.goto("/auth/login");

  await expect(page.getByTestId("auth-login-screen")).toBeVisible();
  await expect(page.locator("[data-tour-id=\"topnav-tabs\"]")).toHaveCount(0);
});

test("session mockee verifiee: acces a l'app", async ({ page }) => {
  const state = buildBaseState({ withContent: false });
  await seedState(page, state);
  await page.goto("/");

  await expect(page.getByTestId("auth-signup-screen")).toHaveCount(0);
  await expect(page.locator("[data-tour-id=\"topnav-tabs\"]")).toBeVisible();
});

test("session mockee non verifiee: blocage sur verify email", async ({ page }) => {
  const state = buildBaseState({ withContent: false });
  await seedState(page, state, {
    authSession: buildMockAuthSession({ verified: false }),
  });
  await page.goto("/");

  await expect(page.getByTestId("auth-verify-email-screen")).toBeVisible();
  await expect(page.locator("[data-tour-id=\"topnav-tabs\"]")).toHaveCount(0);
});

test("session verifiee + onboarding incomplet: redirection vers onboarding", async ({ page }) => {
  const state = buildBaseState({ withContent: false });
  state.ui.onboardingCompleted = false;
  await seedState(page, state, {
    authSession: buildMockAuthSession({ verified: true }),
  });
  await page.goto("/auth/login");

  await expect(page.getByText("Choisis tes priorites")).toBeVisible();
});

test("session recovery presente sur /auth/reset-password: affiche le formulaire", async ({ page }) => {
  const state = buildBaseState({ withContent: false });
  await seedState(page, state, {
    authSession: buildMockAuthSession({ verified: true }),
  });
  await page.addInitScript(() => {
    sessionStorage.setItem("discip.auth.recovery_mode", "1");
  });
  await page.goto("/auth/reset-password");

  await expect(page.getByTestId("auth-reset-password-screen")).toBeVisible();
  await expect(page.getByTestId("auth-password-input")).toBeVisible();
  await expect(page.getByTestId("auth-confirm-password-input")).toBeVisible();
});
