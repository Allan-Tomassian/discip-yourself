import { test, expect } from "@playwright/test";
import {
  buildBaseState,
  buildMockAuthSession,
  buildMockProfile,
  clearProfile,
  seedProfile,
  seedState,
} from "./utils/seed.js";

test("première connexion: redirection /account puis sauvegarde profil", async ({ page }) => {
  const userId = "profile-user-1";
  const authSession = buildMockAuthSession({ userId, email: "profile1@example.com" });
  const state = buildBaseState({ withContent: false });

  await seedState(page, state, { authSession, withProfile: false });
  await clearProfile(page, userId);

  await page.goto("/");
  await expect(page).toHaveURL(/\/account$/);

  await page.getByTestId("account-username-input").fill("new_profile_user");
  await page.getByTestId("account-full-name-input").fill("New Profile User");
  await expect(page.getByTestId("account-save-button")).toBeEnabled();
  await page.getByTestId("account-save-button").click();

  const reloaded = await page.context().newPage();
  await reloaded.goto("/");
  await expect(reloaded.locator("[data-tour-id=\"topnav-tabs\"]")).toBeVisible();
  await expect(reloaded.getByTestId("account-username-input")).toHaveCount(0);
  await reloaded.close();
});

test("username déjà pris: erreur visible", async ({ page }) => {
  const takenUserId = "profile-user-existing";
  const newUserId = "profile-user-2";
  const authSession = buildMockAuthSession({ userId: newUserId, email: "profile2@example.com" });
  const state = buildBaseState({ withContent: false });

  await seedState(page, state, { authSession, withProfile: false });
  await seedProfile(
    page,
    takenUserId,
    buildMockProfile({ userId: takenUserId, username: "alreadytaken", fullName: "Existing User" })
  );
  await clearProfile(page, newUserId);

  await page.goto("/");
  await expect(page).toHaveURL(/\/account$/);

  await page.getByTestId("account-username-input").fill("AlreadyTaken");
  await expect(page.getByTestId("account-username-feedback")).toContainText("déjà pris");
  await expect(page.getByTestId("account-save-button")).toBeDisabled();
});
