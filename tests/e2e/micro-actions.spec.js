import { test, expect } from "@playwright/test";
import { buildBaseState, seedState } from "./utils/seed.js";

async function openToday(page) {
  await page.goto("/");
  await expect(page.locator('[data-tour-id="today-title"]')).toBeVisible();
  await expect(page.locator('[data-tour-id="today-micro-card"]')).toBeVisible();
}

test("micro-actions V1: 3 items + done replace + reroll selected", async ({ page }) => {
  const state = buildBaseState({ withContent: true });
  state.profile.plan = "free";
  await seedState(page, state);

  await openToday(page);

  const card = page.locator('[data-tour-id="today-micro-card"]');
  const items = card.locator('[data-tour-id="today-micro-item"]');
  await expect(items).toHaveCount(3);

  const firstTitleBefore = (await items.nth(0).locator(".microItemTitle").innerText()).trim();
  await items.nth(0).locator('[data-tour-id="today-micro-done"]').click();
  await expect(items.nth(0).locator(".microItemTitle")).not.toHaveText(firstTitleBefore);

  const titlesBeforeReroll = [
    (await items.nth(0).locator(".microItemTitle").innerText()).trim(),
    (await items.nth(1).locator(".microItemTitle").innerText()).trim(),
    (await items.nth(2).locator(".microItemTitle").innerText()).trim(),
  ];

  await items.nth(0).locator('[data-tour-id="today-micro-select"]').check();
  await items.nth(2).locator('[data-tour-id="today-micro-select"]').check();
  await card.locator('[data-tour-id="today-micro-toggle"]').click();

  await expect(items.nth(0).locator(".microItemTitle")).not.toHaveText(titlesBeforeReroll[0]);
  await expect(items.nth(1).locator(".microItemTitle")).toHaveText(titlesBeforeReroll[1]);
  await expect(items.nth(2).locator(".microItemTitle")).not.toHaveText(titlesBeforeReroll[2]);
});

test("micro-actions V1: basic reroll limit = 3/day", async ({ page }) => {
  const state = buildBaseState({ withContent: true });
  state.profile.plan = "free";
  await seedState(page, state);

  await openToday(page);

  const card = page.locator('[data-tour-id="today-micro-card"]');
  const rerollButton = card.locator('[data-tour-id="today-micro-toggle"]');

  await expect(rerollButton).toBeEnabled();
  for (let i = 0; i < 3; i += 1) {
    await rerollButton.click();
  }

  await expect(rerollButton).toBeDisabled();
  await expect(card.locator(".microRerollLimit")).toContainText("Limite atteinte");
  await expect(card.locator(".microRerollMeta")).toContainText("3/3");
});

test("micro-actions V1: premium reroll is unlimited", async ({ page }) => {
  const state = buildBaseState({ withContent: true });
  state.profile.plan = "premium";
  await seedState(page, state);

  await openToday(page);

  const card = page.locator('[data-tour-id="today-micro-card"]');
  const rerollButton = card.locator('[data-tour-id="today-micro-toggle"]');

  for (let i = 0; i < 5; i += 1) {
    await expect(rerollButton).toBeEnabled();
    await rerollButton.click();
  }

  await expect(rerollButton).toBeEnabled();
  await expect(card.locator(".microRerollMeta")).toContainText("illimités");
});
