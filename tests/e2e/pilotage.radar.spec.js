import { test, expect } from "@playwright/test";
import { buildBaseState, seedState } from "./utils/seed.js";

test.describe("legacy Pilotage radar", () => {
  test.skip(true, "Pilotage was folded into Ajuster; canonical Ajuster/system-signal coverage lives in product-loop specs.");

  test("legacy /pilotage alias lands on Ajuster", async ({ page }) => {
    const state = buildBaseState({ withContent: true });
    await seedState(page, state);

    await page.goto("/pilotage");

    await expect(page).toHaveURL(/\/adjust$/);
    await expect(page.locator(".pageTitle")).toContainText("Ajuster");
  });
});
