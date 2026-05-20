import { test, expect } from "@playwright/test";
import {
  buildBaseState,
  buildMockAuthSession,
  buildMockProfile,
  clearProfile,
  seedProfile,
  seedState,
} from "./utils/seed.js";

test("profil optionnel: une session sans username atteint Today et peut ouvrir Profil", async ({ page }) => {
  const userId = "profile-user-optional";
  const authSession = buildMockAuthSession({ userId, email: "optional@example.com" });
  const state = buildBaseState({ withContent: false });

  await seedState(page, state, { authSession, withProfile: false });
  await clearProfile(page, userId);

  await page.goto("/");

  await expect(page).not.toHaveURL(/\/account$/);
  await expect(page.getByTestId("today-primary-action-card")).toBeVisible();
  await page.getByRole("button", { name: "Ouvrir le menu du profil" }).click();
  await page.getByRole("button", { name: "Profil", exact: true }).click();

  await expect(page).toHaveURL(/\/account$/);
  await expect(page.getByTestId("account-username-input")).toBeVisible();
  await expect(page.getByText("Identifiant optionnel. Tu peux le définir plus tard.")).toBeVisible();
});

test("profil: sauvegarde et recharge un username optionnel", async ({ page }) => {
  const userId = "profile-user-save";
  const authSession = buildMockAuthSession({ userId, email: "profile-save@example.com" });
  const state = buildBaseState({ withContent: false });

  await seedState(page, state, { authSession, profile: buildMockProfile({ userId, username: "oldname" }) });
  await page.goto("/account");

  await page.getByTestId("account-username-input").fill("new_profile_user");
  await page.getByTestId("account-full-name-input").fill("New Profile User");
  await expect(page.getByTestId("account-save-button")).toBeEnabled();
  await page.getByTestId("account-save-button").click();
  await expect(page.getByTestId("account-save-status")).toContainText("Compte mis à jour.");

  const reloaded = await page.context().newPage();
  await seedState(reloaded, state, { authSession, profile: buildMockProfile({ userId, username: "new_profile_user" }) });
  await reloaded.goto("/account");
  await expect(reloaded.getByTestId("account-username-input")).toHaveValue("new_profile_user");
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

  await page.goto("/account");

  await page.getByTestId("account-username-input").fill("AlreadyTaken");
  await expect(page.getByTestId("account-username-feedback")).toContainText("déjà pris");
  await expect(page.getByTestId("account-save-button")).toBeDisabled();
});
