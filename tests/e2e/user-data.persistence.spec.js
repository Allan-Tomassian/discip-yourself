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

async function openSettingsFromProfileMenu(page) {
  await page.getByRole("button", { name: "Ouvrir le menu du profil" }).click();
  await expect(page.getByText("Gérer ton compte et ton accès.")).toBeVisible();
  await page.getByRole("button", { name: "Paramètres" }).click();
  await expect(page).toHaveURL(/\/settings$/);
  await expect(page.locator("[data-tour-id=\"settings-title\"]")).toBeVisible();
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
  await expect(page.getByTestId("today-primary-action-card")).toBeVisible();

  await page.getByTestId("user-data-loading-screen").waitFor({ state: "hidden" }).catch(() => {});
  await openSettingsFromProfileMenu(page);

  const whySection = page.locator("[data-tour-id=\"settings-why\"]");
  const whyTextarea = whySection.getByRole("textbox", { name: /Ton pourquoi|Texte motivation/i }).first();
  const whySaveButton = whySection.getByRole("button", { name: "Enregistrer" });
  await expect(whyTextarea).toHaveValue("Pourquoi distant initial");

  const updatedWhy = "Pourquoi persistant e2e";
  await whyTextarea.fill(updatedWhy);
  await expect(whySaveButton).toBeEnabled();
  await whySaveButton.click();

  await expect.poll(async () => {
    const remoteAfterSave = await getUserData(page, userId);
    return remoteAfterSave?.profile?.whyText || "";
  }).toBe(updatedWhy);

  await page.evaluate((key) => localStorage.removeItem(key), LS_KEY);
  const reloaded = await page.context().newPage();
  await reloaded.goto("/");
  await expect(reloaded.getByTestId("today-primary-action-card")).toBeVisible();
  await openSettingsFromProfileMenu(reloaded);
  await expect.poll(async () => {
    return reloaded.evaluate((id) => {
      const raw = localStorage.getItem(`e2e.supabase.user_data.${id}`);
      const parsed = raw ? JSON.parse(raw) : null;
      return parsed?.profile?.whyText || "";
    }, userId);
  }).toBe(updatedWhy);
  await reloaded.close();
});
