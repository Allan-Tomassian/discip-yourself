import { test, expect } from "@playwright/test";
import { clearAuthSession } from "./utils/seed.js";

test("login: pas de bloc diagnostics réseau legacy", async ({ page }) => {
  await clearAuthSession(page);
  await page.goto("/");

  await expect(page.getByTestId("auth-signup-screen")).toBeVisible();
  await expect(page.getByTestId("auth-diagnostics-button")).toHaveCount(0);
});
