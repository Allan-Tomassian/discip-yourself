import { test, expect } from "@playwright/test";
import { LS_KEY } from "../../src/utils/storage.js";
import {
  buildBaseState,
  buildMockAuthSession,
  buildMockProfile,
  getUserData,
  seedAuthSession,
  seedProfile,
  seedUserData,
} from "./utils/seed.js";

async function openPreferencesFromTopMenu(page) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const settingsTitle = page.locator("[data-tour-id=\"settings-title\"]");
    if (await settingsTitle.isVisible().catch(() => false)) return;

    const trigger = page.locator("[data-tour-id=\"topnav-settings\"]");
    if (await trigger.isVisible().catch(() => false)) {
      await trigger.click();
    }

    await page.evaluate(() => {
      const candidates = Array.from(document.querySelectorAll('[role="menuitem"]'));
      const target = candidates.find((element) => /Réglages/i.test(element.textContent || ""));
      if (target instanceof HTMLElement) target.click();
    });

    if (await settingsTitle.isVisible().catch(() => false)) return;

    const closeButton = page.getByRole("button", { name: /Fermer le menu/i }).first();
    if (await closeButton.isVisible().catch(() => false)) {
      await closeButton.click().catch(() => {});
      await page.waitForTimeout(100);
    }
  }
  throw new Error("Impossible d'ouvrir la sous-vue Réglages depuis le menu topbar.");
}

test("user_data: charge puis persiste une modification après reload", async ({ page }) => {
  const userId = "e2e-user-id";
  const authSession = buildMockAuthSession({ userId, email: "e2e@example.com" });
  const remoteState = buildBaseState({ withContent: false });
  remoteState.profile.whyText = "Pourquoi distant initial";
  remoteState.profile.whyUpdatedAt = "";
  remoteState.ui.onboardingCompleted = true;

  await seedAuthSession(page, authSession);
  await seedProfile(page, userId, buildMockProfile({ userId, username: "userdatauser" }));
  await seedUserData(page, userId, remoteState);
  await page.addInitScript((key) => {
    localStorage.removeItem(key);
  }, LS_KEY);

  await page.goto("/");
  await expect(page.locator("[data-tour-id=\"topnav-tabs\"]")).toBeVisible();

  await page.getByTestId("user-data-loading-screen").waitFor({ state: "hidden" }).catch(() => {});
  await openPreferencesFromTopMenu(page);
  await expect(page.locator("[data-tour-id=\"settings-title\"]")).toBeVisible();
  const whyTextarea = page.getByRole("textbox", { name: /Ton pourquoi/i }).first();
  await expect(whyTextarea).toHaveValue("Pourquoi distant initial");

  const updatedWhy = "Pourquoi persistant e2e";
  await whyTextarea.fill(updatedWhy);
  await page.getByRole("button", { name: "Enregistrer" }).click();
  await page.waitForTimeout(700);

  const remoteAfterSave = await getUserData(page, userId);
  expect(remoteAfterSave?.profile?.whyText || "").toBe(updatedWhy);

  await page.evaluate((key) => localStorage.removeItem(key), LS_KEY);
  const reloaded = await page.context().newPage();
  await reloaded.goto("/");
  await expect(reloaded.locator("[data-tour-id=\"topnav-tabs\"]")).toBeVisible();
  await openPreferencesFromTopMenu(reloaded);
  await expect.poll(async () => {
    return reloaded.evaluate((id) => {
      const raw = localStorage.getItem(`e2e.supabase.user_data.${id}`);
      const parsed = raw ? JSON.parse(raw) : null;
      return parsed?.profile?.whyText || "";
    }, userId);
  }).toBe(updatedWhy);
  await reloaded.close();
});
