import { test, expect, devices } from "@playwright/test";
import { buildCanonicalExecutionState, expectTodayReady, openMainTab, openProfileMenu, seedCurrentUser } from "./utils/currentProduct.js";

const iPhone13 = devices["iPhone 13"];

test.use({
  viewport: iPhone13.viewport,
  userAgent: iPhone13.userAgent,
  deviceScaleFactor: iPhone13.deviceScaleFactor,
  isMobile: true,
  hasTouch: true,
});

test("mobile smoke: bottom nav, Coach composer, profile sheet and Today CTA remain reachable", async ({ page }) => {
  await seedCurrentUser(page, buildCanonicalExecutionState());
  await page.goto("/");
  await expectTodayReady(page);

  await openMainTab(page, "Planning");
  await expect(page.locator(".pageTitle")).toContainText("Planning");
  await page.evaluate(() => window.scrollTo(0, 500));

  await openMainTab(page, "Objectifs");
  await expect(page.locator(".pageTitle")).toContainText("Objectifs");
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeLessThan(8);

  await openMainTab(page, "Coach IA");
  await expect(page.locator(".pageTitle")).toContainText("Coach");
  await expect(page.getByRole("textbox", { name: /Demande au coach/i })).toBeVisible();

  await openMainTab(page, "Ajuster");
  await expect(page.locator(".pageTitle")).toContainText("Ajuster");

  await openMainTab(page, "Home");
  await expectTodayReady(page);
  await openProfileMenu(page);
  await page.getByRole("button", { name: "Fermer" }).click();
  await expect(page.getByText("Gérer ton compte et ton accès.")).toHaveCount(0);

  await page.locator(".todayCommitmentButton").scrollIntoViewIfNeeded();
  const ctaBox = await page.locator(".todayCommitmentButton").boundingBox();
  const navBox = await page.locator(".lovableTabBarWrap").boundingBox();
  expect(ctaBox).toBeTruthy();
  expect(navBox).toBeTruthy();
  expect(ctaBox.y).toBeLessThan(navBox.y);
});
