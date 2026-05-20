import { test, expect } from "@playwright/test";
import { buildBaseState, seedState } from "./utils/seed.js";

test("micro-actions secondary page remains reachable and closable", async ({ page }) => {
  const state = buildBaseState({ withContent: true });
  await seedState(page, state);

  await page.goto("/micro-actions");

  await expect(page.locator(".pageTitle")).toContainText("Micro-actions");
  await expect(page.getByRole("button", { name: /Retour/i })).toBeVisible();
  await expect(page.locator('[data-tour-id="today-micro-card"]')).toBeVisible();

  await page.getByRole("button", { name: /Retour/i }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByTestId("today-primary-action-card")).toBeVisible();
});
