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
  await expect(page.locator(".todayCockpitTitle")).toHaveText("Today");
}

async function expectCockpitStack(page) {
  await expect(page.getByTestId("today-hero-card")).toBeVisible();
  await expect(page.getByTestId("today-primary-action-card")).toBeVisible();
  await expect(page.getByTestId("today-timeline-card")).toBeVisible();
  await expect(page.getByTestId("today-ai-insight-card")).toBeVisible();
  await expect(page.locator(".todayFloatingWelcomeLine")).toBeVisible();
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

function buildEmptyState() {
  return buildBaseState({ withContent: false });
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

test("today cockpit renders the validated compact stack in ready state", async ({ page }, testInfo) => {
  await openToday(page, buildReadyState());

  await expectCockpitStack(page);
  await expect(page.getByTestId("today-primary-action-card").locator(".todayCommitmentButton")).toBeVisible();
  await expect(page.locator('[data-tour-id="today-micro-card"]')).toHaveCount(0);
  await expect(page.getByTestId("today-progress-strip")).toHaveCount(0);
  await expect(page.locator(".lovableTabButton.is-home")).toContainText("Home");
  await expect(page.locator(".lovableTabButton.is-ai")).toContainText("Coach IA");
  await expect(page.locator(".lovableTabBar")).not.toContainText("Analyses");

  await attachScreenshot(page, testInfo, "today-cockpit-ready.png");
});

test("today cockpit keeps active session state in the primary action card", async ({ page }, testInfo) => {
  await openToday(page, buildActiveSessionState());

  await expectCockpitStack(page);
  await expect(page.getByTestId("today-primary-action-card")).toContainText("BLOC EN COURS");
  await expect(page.getByTestId("today-primary-action-card").locator(".todayCommitmentButton")).toContainText(/Reprendre/i);
  await expect(page.locator(".todayHeaderSessionBadge")).toHaveCount(0);

  await attachScreenshot(page, testInfo, "today-cockpit-session-active.png");
});

test("today cockpit shows the empty-day state without old quick actions", async ({ page }) => {
  await openToday(page, buildEmptyState());

  await expectCockpitStack(page);
  await expect(page.getByTestId("today-primary-action-card")).toContainText(/STRUCTURER LA JOURNÉE|AUCUN BLOC/);
  await expect(page.getByTestId("today-timeline-card")).toContainText(/Planning à structurer|Aucun bloc structuré/);
  await expect(page.locator('[data-tour-id="today-micro-card"]')).toHaveCount(0);
  await expect(page.getByTestId("today-secondary-actions")).toHaveCount(0);
});

test("today cockpit turns a completed day into a calm locked state", async ({ page }, testInfo) => {
  await openToday(page, buildValidatedState());

  await expectCockpitStack(page);
  await expect(page.getByTestId("today-primary-action-card")).toContainText(/JOURNÉE TERMINÉE|JOURNÉE VERROUILLÉE/);
  await expect(page.getByTestId("today-primary-action-card").locator(".todayCommitmentButton")).toContainText("Voir demain");
  await expect(page.getByTestId("today-value-pulse")).toHaveCount(0);
  await expect(page.locator(".todayShellHeroState")).toHaveCount(0);

  await attachScreenshot(page, testInfo, "today-cockpit-locked.png");
});
