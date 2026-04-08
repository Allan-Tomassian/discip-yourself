import { test, expect, devices } from "@playwright/test";
import { buildBaseState, buildMockProfile, seedState } from "./utils/seed.js";

const iPhone13 = devices["iPhone 13"];

test.use({
  viewport: iPhone13.viewport,
  userAgent: iPhone13.userAgent,
  deviceScaleFactor: iPhone13.deviceScaleFactor,
  isMobile: true,
  hasTouch: true,
});

async function attachScreenshot(page, testInfo, name) {
  const path = testInfo.outputPath(name);
  await page.screenshot({ path, fullPage: false });
  await testInfo.attach(name, { path, contentType: "image/png" });
}

async function expectPrimaryActionAboveFold(page) {
  const primaryAction = page.locator('[data-testid="today-hero-card"] .lovablePrimaryButton');
  await expect(primaryAction).toBeVisible();
  const box = await primaryAction.boundingBox();
  const viewport = page.viewportSize();

  expect(box).toBeTruthy();
  expect((box?.y ?? 0) + (box?.height ?? 0)).toBeLessThan((viewport?.height ?? 720) - 20);
}

function buildReadyState() {
  const state = buildBaseState({ withContent: true });
  state.occurrences = [
    {
      ...state.occurrences[0],
      durationMinutes: 45,
      status: "planned",
    },
  ];
  return state;
}

function buildActiveSessionState() {
  const state = buildBaseState({ withContent: true });
  const today = state.ui.selectedDate;

  state.occurrences = [
    {
      ...state.occurrences[0],
      date: today,
      durationMinutes: 45,
      status: "in_progress",
    },
  ];
  state.ui.activeSession = {
    id: "sess_today",
    occurrenceId: "occ_1",
    dateKey: today,
    objectiveId: "goal_proj",
    habitIds: ["goal_action"],
    status: "partial",
    runtimePhase: "in_progress",
    timerRunning: true,
    timerAccumulatedSec: 780,
    timerStartedAt: new Date(`${today}T09:00:00.000Z`).toISOString(),
    startedAt: new Date(`${today}T09:00:00.000Z`).toISOString(),
    doneHabitIds: [],
  };

  return state;
}

function buildClarifyState() {
  return buildBaseState({ withContent: false });
}

function buildOverloadState() {
  const state = buildBaseState({ withContent: true });
  const today = state.ui.selectedDate;

  state.goals = Array.from({ length: 5 }, (_, index) => ({
    id: `goal_overload_${index + 1}`,
    categoryId: "cat_business",
    title: `Bloc ${index + 1}`,
    type: "PROCESS",
    planType: "ONE_OFF",
    status: "active",
    oneOffDate: today,
    timeMode: "FLEXIBLE",
  }));

  state.occurrences = Array.from({ length: 5 }, (_, index) => ({
    id: `occ_overload_${index + 1}`,
    goalId: `goal_overload_${index + 1}`,
    date: today,
    start: `${String(9 + index).padStart(2, "0")}:00`,
    slotKey: `${String(9 + index).padStart(2, "0")}:00`,
    durationMinutes: 40,
    status: "planned",
  }));

  return state;
}

function buildValidatedState() {
  const state = buildBaseState({ withContent: true });
  state.habits = [];
  state.occurrences = [
    {
      ...state.occurrences[0],
      durationMinutes: 45,
      status: "done",
    },
  ];
  state.reminders = state.reminders.filter((item) => item.goalId !== "habit_legacy");
  return state;
}

async function openToday(page, state) {
  state.profile = {
    ...(state.profile || {}),
    full_name: "Allan",
    username: "allan",
  };
  await seedState(page, state, {
    profile: buildMockProfile({
      userId: "e2e-user-id",
      username: "allan",
      fullName: "Allan",
    }),
  });
  await page.goto("/");
  await expect(page.locator(".pageHeader .pageTitle")).toContainText("Allan");
}

test("today shell reads as a compact home in ready state", async ({ page }, testInfo) => {
  await openToday(page, buildReadyState());

  await expect(page.getByTestId("today-progress-strip")).toBeVisible();
  await expect(page.getByTestId("today-hero-card")).toBeVisible();
  await expect(page.getByTestId("today-secondary-actions")).toBeVisible();
  await expect(page.locator(".todayShellHeroState")).toHaveText("Prêt");
  await expect(page.locator(".todayHeaderSessionBadge")).toHaveCount(0);
  await expect(page.locator(".todayDailyState")).not.toContainText("Progression du jour");
  await expect(page.locator(".todayWelcomeHint")).not.toContainText(/session/i);
  await expectPrimaryActionAboveFold(page);

  const heroBox = await page.getByTestId("today-hero-card").boundingBox();
  expect(heroBox?.y ?? 0).toBeLessThan(560);

  await attachScreenshot(page, testInfo, "today-ready-shell.png");
  await page.getByTestId("today-secondary-actions").scrollIntoViewIfNeeded();
  await attachScreenshot(page, testInfo, "today-ready-alternatives.png");
});

test("today shell keeps session state inside the hero", async ({ page }, testInfo) => {
  await openToday(page, buildActiveSessionState());

  await expect(page.getByTestId("today-progress-strip")).toBeVisible();
  await expect(page.getByTestId("today-hero-card")).toBeVisible();
  await expect(page.locator(".todayShellHeroState")).toHaveText("Session");
  await expect(page.getByRole("button", { name: "Reprendre la session" })).toBeVisible();
  await expect(page.locator(".todayHeaderSessionBadge")).toHaveCount(0);
  await expectPrimaryActionAboveFold(page);

  await attachScreenshot(page, testInfo, "today-session-active-shell.png");
});

test("today shell keeps a calm clarify state without extra cards", async ({ page }) => {
  await openToday(page, buildClarifyState());

  await expect(page.getByTestId("today-progress-strip")).toBeVisible();
  await expect(page.getByTestId("today-hero-card")).toBeVisible();
  await expect(page.getByText("À clarifier")).toBeVisible();
  await expect(page.getByTestId("today-secondary-actions")).toHaveCount(0);
});

test("today shell shows overload without becoming analytical", async ({ page }, testInfo) => {
  await openToday(page, buildOverloadState());

  await expect(page.getByTestId("today-progress-strip")).toBeVisible();
  await expect(page.getByTestId("today-hero-card")).toBeVisible();
  await expect(page.getByTestId("today-hero-card").getByText("À alléger", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Alléger ma journée" })).toBeVisible();
  await expect(page.locator(".todayHeaderSessionBadge")).toHaveCount(0);

  await attachScreenshot(page, testInfo, "today-overload-shell.png");
});

test("today shell shows validated progress and return of value", async ({ page }, testInfo) => {
  await openToday(page, buildValidatedState());

  await expect(page.getByTestId("today-progress-strip")).toBeVisible();
  await expect(page.getByTestId("today-value-pulse")).toBeVisible();
  await expect(page.getByText("Journée validée")).toBeVisible();

  await attachScreenshot(page, testInfo, "today-validated-shell.png");
  await page.getByTestId("today-value-pulse").scrollIntoViewIfNeeded();
  await attachScreenshot(page, testInfo, "today-validated-value-pulse.png");
});
