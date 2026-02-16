import { test, expect } from "@playwright/test";
import { LS_KEY } from "../../src/utils/storage.js";
import {
  buildBaseState,
  buildMockAuthSession,
  getUserData,
  seedAuthSession,
  seedUserData,
} from "./utils/seed.js";

test("user_data: charge puis persiste une modification après reload", async ({ page }) => {
  const userId = "e2e-user-id";
  const authSession = buildMockAuthSession({ userId, email: "e2e@example.com" });
  const remoteState = buildBaseState({ withContent: false });
  remoteState.profile.whyText = "Pourquoi distant initial";
  remoteState.profile.whyUpdatedAt = "";
  remoteState.ui.onboardingCompleted = true;

  await seedAuthSession(page, authSession);
  await seedUserData(page, userId, remoteState);
  await page.addInitScript((key) => {
    localStorage.removeItem(key);
  }, LS_KEY);

  await page.goto("/");
  await expect(page.locator("[data-tour-id=\"topnav-tabs\"]")).toBeVisible();

  await page.getByTestId("user-data-loading-screen").waitFor({ state: "hidden" }).catch(() => {});
  await page.locator("[data-tour-id=\"topnav-settings\"]").click();
  await expect(page.locator("[data-tour-id=\"settings-title\"]")).toBeVisible();
  await expect(page.getByPlaceholder("Ton pourquoi")).toHaveValue("Pourquoi distant initial");

  const updatedWhy = "Pourquoi persistant e2e";
  await page.getByPlaceholder("Ton pourquoi").fill(updatedWhy);
  await page.getByRole("button", { name: "Enregistrer" }).click();
  await page.waitForTimeout(700);

  const remoteAfterSave = await getUserData(page, userId);
  expect(remoteAfterSave?.profile?.whyText || "").toBe(updatedWhy);

  await page.evaluate((key) => localStorage.removeItem(key), LS_KEY);
  const reloaded = await page.context().newPage();
  await reloaded.goto("/");
  await expect(reloaded.locator("[data-tour-id=\"topnav-tabs\"]")).toBeVisible();
  await reloaded.locator("[data-tour-id=\"topnav-settings\"]").click();
  await expect(reloaded.getByPlaceholder("Ton pourquoi")).toHaveValue(updatedWhy);
  await reloaded.close();
});
