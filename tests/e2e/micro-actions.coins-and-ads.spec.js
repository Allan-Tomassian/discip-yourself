import { expect, test } from "@playwright/test";
import { buildBaseState, seedState } from "./utils/seed.js";
import { buildLocalUserDataKey } from "../../src/data/userDataApi.js";
import { LS_KEY } from "../../src/utils/storage.js";

async function readWalletBalance(page) {
  return page.evaluate(
    ({ userKey, fallbackKey }) => {
      const read = (key) => {
        const raw = localStorage.getItem(key);
        if (!raw) return null;
        try {
          return JSON.parse(raw);
        } catch {
          return null;
        }
      };
      const data = read(userKey) || read(fallbackKey) || {};
      return Number(data?.ui?.walletV1?.balance || 0);
    },
    { userKey: buildLocalUserDataKey("e2e-user-id"), fallbackKey: LS_KEY }
  );
}

test("micro-actions: coins + rewarded ad reroll credit flow", async ({ page }) => {
  const state = buildBaseState({ withContent: true });
  state.profile.plan = "free";
  await seedState(page, state);

  await page.goto("/micro-actions");
  const card = page.locator('[data-tour-id="today-micro-card"]');
  await expect(card).toBeVisible();

  const items = card.locator('[data-tour-id="today-micro-item"]');
  await expect(items).toHaveCount(3);

  const balanceBeforeDone = await readWalletBalance(page);

  await items.nth(0).locator('[data-tour-id="today-micro-done"]').click();
  await expect
    .poll(async () => readWalletBalance(page))
    .toBe(balanceBeforeDone + 2);

  const rerollButton = card.locator('[data-tour-id="today-micro-toggle"]');
  for (let i = 0; i < 3; i += 1) {
    await rerollButton.click();
  }
  await expect(rerollButton).toBeDisabled();

  const watchAdButton = card.getByTestId("micro-watch-ad");
  await expect(watchAdButton).toBeVisible();

  const balanceBeforeAd = await readWalletBalance(page);
  await watchAdButton.click();

  const adModal = page.getByTestId("rewarded-ad-modal");
  await expect(adModal).toBeVisible();
  await adModal.getByTestId("rewarded-ad-complete").click();

  await expect
    .poll(async () => readWalletBalance(page))
    .toBe(balanceBeforeAd + 50);
  await expect(card.getByTestId("micro-use-reroll-credit")).toBeVisible();

  const firstTitleBefore = (await items.nth(0).locator(".microItemTitle").innerText()).trim();
  await card.getByTestId("micro-use-reroll-credit").click();
  await expect(items.nth(0).locator(".microItemTitle")).not.toHaveText(firstTitleBefore);
  await expect(card.getByTestId("micro-watch-ad")).toBeVisible();
});

test("micro-actions: premium hides rewarded ad CTA", async ({ page }) => {
  const state = buildBaseState({ withContent: true });
  state.profile.plan = "premium";
  await seedState(page, state);

  await page.goto("/micro-actions");
  const card = page.locator('[data-tour-id="today-micro-card"]');
  await expect(card).toBeVisible();
  await expect(card.getByTestId("micro-watch-ad")).toHaveCount(0);
});
