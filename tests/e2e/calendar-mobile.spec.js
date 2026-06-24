import { test, expect, devices } from "@playwright/test";
import { buildBaseState, getDateKeyInDays, getTodayKey, seedState } from "./utils/seed.js";

const iPhone13 = devices["iPhone 13"];

test.use({
  viewport: iPhone13.viewport,
  userAgent: iPhone13.userAgent,
  deviceScaleFactor: iPhone13.deviceScaleFactor,
  isMobile: true,
  hasTouch: true,
});

function buildPremiumState({ withContent = false } = {}) {
  const state = buildBaseState({ withContent });
  state.profile = {
    ...(state.profile || {}),
    plan: "premium",
    entitlements: { premium: true },
  };
  return state;
}

function seedCreateLaterDraft(state) {
  state.ui.createDraft = {
    version: 1,
    kind: "action",
    origin: { mainTab: "home", sourceSurface: "today" },
    intent: null,
    proposal: null,
    actionDraft: {
      categoryId: "cat_business",
      repeat: "none",
      oneOffDate: getDateKeyInDays(1),
      timeMode: "NONE",
      startTime: "",
    },
    outcomeDraft: null,
    status: "draft",
  };
  return state;
}

async function expectNoHorizontalOverflow(page) {
  const metrics = await page.evaluate(() => ({
    doc: document.documentElement.scrollWidth,
    body: document.body.scrollWidth,
    viewport: window.visualViewport?.width || window.innerWidth,
  }));
  expect(metrics.doc).toBeLessThanOrEqual(metrics.viewport + 1);
  expect(metrics.body).toBeLessThanOrEqual(metrics.viewport + 1);
}

async function expectWithinViewport(page, locator) {
  await expect(locator).toBeVisible();
  const box = await locator.boundingBox();
  const viewport = page.viewportSize();
  expect(box).toBeTruthy();
  expect(viewport).toBeTruthy();
  expect(box.x).toBeGreaterThanOrEqual(-1);
  expect(box.x + box.width).toBeLessThanOrEqual(viewport.width + 1);
}

async function expectSafeDatePicker(page) {
  const outer = page.locator(".datePickerMenuOuter").last();
  const menu = page.getByTestId("date-picker-menu").last();
  const weekdays = page.getByTestId("date-picker-weekday");
  await expect(outer).toBeVisible();
  await expect(menu).toBeVisible();
  await expect(weekdays).toHaveCount(7);
  await expect(weekdays.last()).toHaveText("D");
  await expectWithinViewport(page, outer);
  await expectWithinViewport(page, weekdays.last());
  await expectNoHorizontalOverflow(page);
}

test("mobile calendar: Create Action later date picker has safe grid and footer", async ({ page }, testInfo) => {
  await seedState(page, seedCreateLaterDraft(buildPremiumState()));
  await page.goto("/create");
  await expect(page.locator(".pageTitle")).toContainText("Créer une action");
  await page.getByRole("button", { name: /^Plus tard\b/ }).click();
  await page.locator(".selectTrigger.AppDateField").first().click();

  await expectSafeDatePicker(page);
  await expect(page.locator(".datePickerFooter").getByRole("button", { name: /Aujourd/ })).toBeVisible();
  await expect(page.locator(".datePickerFooter").getByRole("button", { name: "Effacer" })).toBeVisible();
  await testInfo.attach("create-action-date-picker-mobile", {
    body: await page.screenshot({ fullPage: true }),
    contentType: "image/png",
  });
});

test("mobile calendar: Edit Action date, remove reminder, and delete controls stay unclipped", async ({ page }, testInfo) => {
  const state = buildPremiumState({ withContent: true });
  state.goals = state.goals.map((goal) =>
    goal.id === "goal_action"
      ? {
          ...goal,
          repeat: "none",
          oneOffDate: getTodayKey(),
          timeMode: "FIXED",
          startTime: "09:00",
          durationMinutes: 30,
        }
      : goal
  );
  state.reminders.push({
    id: "rem_action_extra",
    goalId: "goal_action",
    time: "12:00",
    windowStart: "",
    windowEnd: "",
  });
  await seedState(page, state);
  await page.goto("/edit/goal_action");
  await expect(page.locator(".pageTitle")).toContainText("Modifier");

  const dateField = page.locator(".selectTrigger.AppDateField").first();
  await dateField.scrollIntoViewIfNeeded();
  await dateField.click();
  await expectSafeDatePicker(page);
  await page.keyboard.press("Escape");

  const removeReminder = page.getByRole("button", { name: "Retirer" }).first();
  await removeReminder.scrollIntoViewIfNeeded();
  await expectWithinViewport(page, removeReminder);

  const deleteButton = page.getByRole("button", { name: "Supprimer" });
  await deleteButton.scrollIntoViewIfNeeded();
  await expectWithinViewport(page, deleteButton);
  await expectNoHorizontalOverflow(page);
  await testInfo.attach("edit-action-mobile-controls", {
    body: await page.screenshot({ fullPage: true }),
    contentType: "image/png",
  });
});

test("mobile calendar: Edit Objective horizon pickers stay mobile-safe", async ({ page }) => {
  await seedState(page, buildPremiumState({ withContent: true }));
  await page.goto("/edit/goal_proj");
  await expect(page.locator(".pageTitle")).toContainText("Modifier");

  const startDate = page.locator(".selectTrigger.AppDateField").first();
  await startDate.scrollIntoViewIfNeeded();
  await startDate.click();
  await expectSafeDatePicker(page);
  await page.keyboard.press("Escape");

  const deadline = page.locator(".selectTrigger.AppDateField").nth(1);
  await deadline.scrollIntoViewIfNeeded();
  await deadline.click();
  await expectSafeDatePicker(page);
});

test("mobile calendar: Planning rail and Timeline date dialog do not create page overflow", async ({ page }, testInfo) => {
  await seedState(page, buildPremiumState({ withContent: true }));
  await page.goto("/timeline");
  await expect(page.locator(".pageTitle")).toContainText("Planning");
  await expectNoHorizontalOverflow(page);

  await page.getByRole("button", { name: "Vue calendrier" }).click();
  await expect(page.locator(".timelineCalendarModal")).toBeVisible();
  await page.locator(".selectTrigger.AppDateField").first().click();
  await expectSafeDatePicker(page);
  await testInfo.attach("timeline-calendar-dialog-mobile", {
    body: await page.screenshot({ fullPage: true }),
    contentType: "image/png",
  });
});
