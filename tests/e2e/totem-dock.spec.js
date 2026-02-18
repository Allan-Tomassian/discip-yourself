import { test, expect } from "@playwright/test";
import { buildBaseState, seedState } from "./utils/seed.js";
import { buildLocalUserDataKey } from "../../src/data/userDataApi.js";
import { LS_KEY } from "../../src/utils/storage.js";

test("totem dock: open, close, hide, nub reveal, persistence", async ({ page }) => {
  const state = buildBaseState({ withContent: true });
  await seedState(page, state);
  await page.goto("/");

  const dock = page.getByTestId("totem-dock");
  await expect(dock).toBeVisible();

  await dock.click();
  const panel = page.getByTestId("totem-panel");
  await expect(panel).toBeVisible();

  await page.mouse.click(8, 8);
  await expect(panel).toHaveCount(0);

  await dock.click();
  await expect(panel).toBeVisible();
  await page.getByTestId("totem-panel-hide-action").click();

  await expect.poll(async () => {
    return page.evaluate((key) => {
      const raw = localStorage.getItem(key);
      const parsed = raw ? JSON.parse(raw) : null;
      return parsed?.ui?.totemDockV1?.hidden === true;
    }, buildLocalUserDataKey("e2e-user-id"));
  }).toBe(true);
  await expect.poll(async () => {
    return page.evaluate((key) => {
      const raw = localStorage.getItem(key);
      const parsed = raw ? JSON.parse(raw) : null;
      return parsed?.ui?.totemDockV1?.hidden === true;
    }, LS_KEY);
  }).toBe(true);
  const nub = page.locator(".totemDockNub, [data-testid='totem-nub']").first();
  await expect(nub).toBeVisible({ timeout: 3000 });

  await page.getByRole("button", { name: "Bibliothèque" }).click();
  await page.getByRole("button", { name: "Aujourd’hui" }).click();
  await expect(page.locator(".totemDockNub, [data-testid='totem-nub']").first()).toBeVisible();

  await page.locator(".totemDockNub, [data-testid='totem-nub']").first().click();
  await expect(page.getByTestId("totem-panel")).toBeVisible();
  await expect(page.getByTestId("totem-dock")).toBeVisible();
});
