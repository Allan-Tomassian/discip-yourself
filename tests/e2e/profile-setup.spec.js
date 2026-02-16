import { test, expect } from "@playwright/test";
import {
  buildBaseState,
  buildMockAuthSession,
  buildMockProfile,
  clearProfile,
  seedProfile,
  seedState,
} from "./utils/seed.js";

test("création profil puis reload: le profil persiste", async ({ page }) => {
  const userId = "profile-user-1";
  const authSession = buildMockAuthSession({ userId, email: "profile1@example.com" });
  const state = buildBaseState({ withContent: false });

  await seedState(page, state, { authSession, withProfile: false });
  await clearProfile(page, userId);

  await page.goto("/");
  await expect(page.getByTestId("profile-setup-screen")).toBeVisible();

  await page.getByTestId("profile-username-input").fill("new_profile_user");
  await page.getByTestId("profile-submit-button").click();

  await expect(page.getByTestId("profile-setup-screen")).toHaveCount(0);
  await expect(page.locator("[data-tour-id=\"topnav-tabs\"]")).toBeVisible();

  const reloaded = await page.context().newPage();
  await reloaded.goto("/");
  await expect(reloaded.getByTestId("profile-setup-screen")).toHaveCount(0);
  await expect(reloaded.locator("[data-tour-id=\"topnav-tabs\"]")).toBeVisible();
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
    buildMockProfile({ userId: takenUserId, username: "alreadytaken", displayName: "Existing User" })
  );
  await clearProfile(page, newUserId);

  await page.goto("/");
  await expect(page.getByTestId("profile-setup-screen")).toBeVisible();

  await page.getByTestId("profile-username-input").fill("AlreadyTaken");
  await expect(page.getByTestId("profile-username-feedback")).toContainText("déjà pris");
  await expect(page.getByTestId("profile-submit-button")).toBeDisabled();
  await expect(page.getByTestId("profile-setup-screen")).toBeVisible();
});
