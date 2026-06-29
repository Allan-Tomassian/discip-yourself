import { test, expect } from "@playwright/test";
import { buildBaseState, seedState } from "./utils/seed.js";

test("micro-actions route is dormant and returns to Today", async ({ page }) => {
  const state = buildBaseState({ withContent: true });
  await seedState(page, state);

  await page.goto("/micro-actions");

  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByTestId("today-primary-action-card")).toBeVisible();
  await expect(page.getByText("Micro-actions")).toHaveCount(0);
  await expect(page.locator('[data-tour-id="today-micro-card"]')).toHaveCount(0);
});
