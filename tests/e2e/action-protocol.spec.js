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

async function seedApp(page, state) {
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
}

async function expectPrimaryActionAboveFold(page) {
  const primaryAction = page.locator('[data-testid="today-primary-action-card"] .todayCommitmentButton');
  await expect(primaryAction).toBeVisible();
  const box = await primaryAction.boundingBox();
  const viewport = page.viewportSize();

  expect(box).toBeTruthy();
  expect((box?.y ?? 0) + (box?.height ?? 0)).toBeLessThan((viewport?.height ?? 720) - 20);
}

function buildDeepWorkState() {
  const state = buildBaseState({ withContent: true });
  const today = state.ui.selectedDate;

  state.categories = [
    { id: "sys_inbox", name: "Général", color: "#64748B", isSystem: true },
    { id: "cat_business", name: "Business", color: "#0EA5E9" },
  ];
  state.ui.categoryRailOrder = ["cat_business", "sys_inbox"];
  state.ui.selectedCategoryId = "cat_business";
  state.ui.selectedCategoryByView = {
    home: "cat_business",
    library: "cat_business",
    plan: "cat_business",
    pilotage: "cat_business",
  };
  state.goals = [
    {
      id: "goal_proj",
      categoryId: "cat_business",
      title: "Launch MVP",
      type: "OUTCOME",
      planType: "STATE",
      status: "active",
      startDate: today,
      deadline: today,
      priority: "haute",
    },
    {
      id: "goal_action",
      categoryId: "cat_business",
      title: "Build onboarding MVP",
      type: "PROCESS",
      planType: "ONE_OFF",
      status: "active",
      oneOffDate: today,
      timeMode: "FIXED",
      startTime: "09:00",
      timeSlots: ["09:00"],
      reminderTime: "08:00",
      sessionMinutes: 50,
    },
  ];
  state.habits = [];
  state.occurrences = [
    {
      id: "occ_1",
      goalId: "goal_action",
      date: today,
      start: "09:00",
      slotKey: "09:00",
      durationMinutes: 50,
      status: "planned",
    },
  ];
  state.reminders = [];

  return state;
}

function buildDeepWorkActiveSessionState() {
  const state = buildDeepWorkState();
  const today = state.ui.selectedDate;

  state.occurrences = [
    {
      ...state.occurrences[0],
      status: "in_progress",
    },
  ];
  state.ui.activeSession = {
    id: "sess_deep",
    occurrenceId: "occ_1",
    dateKey: today,
    objectiveId: "goal_proj",
    habitIds: ["goal_action"],
    status: "partial",
    runtimePhase: "in_progress",
    timerRunning: true,
    timerAccumulatedSec: 900,
    timerStartedAt: new Date(`${today}T09:00:00.000Z`).toISOString(),
    startedAt: new Date(`${today}T09:00:00.000Z`).toISOString(),
    doneHabitIds: [],
  };

  return state;
}

function buildSportState() {
  const state = buildBaseState({ withContent: true });
  const today = state.ui.selectedDate;

  state.categories = [
    { id: "sys_inbox", name: "Général", color: "#64748B", isSystem: true },
    { id: "cat_sport", name: "Sport", color: "#22C55E" },
  ];
  state.ui.categoryRailOrder = ["cat_sport", "sys_inbox"];
  state.ui.selectedCategoryId = "cat_sport";
  state.ui.selectedCategoryByView = {
    home: "cat_sport",
    library: "cat_sport",
    plan: "cat_sport",
    pilotage: "cat_sport",
  };
  state.goals = [
    {
      id: "goal_sport",
      categoryId: "cat_sport",
      title: "Gym session upper body",
      type: "PROCESS",
      planType: "ONE_OFF",
      status: "active",
      oneOffDate: today,
      timeMode: "FIXED",
      startTime: "18:30",
      timeSlots: ["18:30"],
      reminderTime: "18:00",
      sessionMinutes: 45,
    },
  ];
  state.habits = [];
  state.occurrences = [
    {
      id: "occ_1",
      goalId: "goal_sport",
      date: today,
      start: "18:30",
      slotKey: "18:30",
      durationMinutes: 45,
      status: "planned",
    },
  ];
  state.reminders = [];

  return state;
}

async function openToday(page, state) {
  await seedApp(page, state);
  await page.goto("/");
  await expect(page.locator(".todayCockpitTitle")).toHaveText("Today");
}

async function openSession(page, state, { categoryId }) {
  const dateKey = state.ui.selectedDate;
  await seedApp(page, state);
  await page.goto(`/session/occ_1?date=${dateKey}&cat=${categoryId}`);
  await expect(page.getByTestId("session-action-protocol")).toBeVisible();
}

test("today ready routes the deep-work block through the primary action card", async ({ page }, testInfo) => {
  await openToday(page, buildDeepWorkState());

  await expect(page.getByTestId("today-primary-action-card")).toBeVisible();
  await expect(page.getByTestId("today-primary-action-card")).toContainText("Build onboarding MVP");
  await expect(page.getByTestId("today-primary-action-card")).not.toContainText("Cap");
  await expect(page.getByTestId("today-action-protocol")).toHaveCount(0);
  await expectPrimaryActionAboveFold(page);

  await attachScreenshot(page, testInfo, "today-primary-action-deep-work-ready.png");
});

test("today active session keeps the resume action in the primary card", async ({ page }, testInfo) => {
  await openToday(page, buildDeepWorkActiveSessionState());

  await expect(page.getByTestId("today-primary-action-card")).toBeVisible();
  await expect(page.getByTestId("today-primary-action-card")).toContainText("BLOC EN COURS");
  await expect(page.getByTestId("today-primary-action-card").locator(".todayCommitmentButton")).toContainText(/Reprendre/i);
  await expect(page.getByTestId("today-action-protocol")).toHaveCount(0);
  await expectPrimaryActionAboveFold(page);

  await attachScreenshot(page, testInfo, "today-primary-action-deep-work-session.png");
});

test("session shows the full deep-work protocol without a new flow", async ({ page }, testInfo) => {
  await openSession(page, buildDeepWorkState(), { categoryId: "cat_business" });

  await expect(page.getByTestId("session-action-protocol")).toContainText("Pourquoi");
  await expect(page.getByTestId("session-action-protocol")).toContainText("Départ");
  await expect(page.getByTestId("session-action-protocol")).toContainText("Si blocage");
  await expect(page.getByTestId("session-action-protocol")).toContainText("Réussi quand");
  await expect(page.getByTestId("session-action-protocol")).toContainText("une avancée visible est produite");

  await attachScreenshot(page, testInfo, "session-action-protocol-deep-work.png");
});

test("session adapts the protocol for sport blocks", async ({ page }, testInfo) => {
  await openSession(page, buildSportState(), { categoryId: "cat_sport" });

  await expect(page.getByTestId("session-action-protocol")).toContainText("activer ton énergie et tenir le rythme");
  await expect(page.getByTestId("session-action-protocol")).toContainText("commence par 5 min d’échauffement");
  await expect(page.getByTestId("session-action-protocol")).toContainText("séance tenue ou version courte assumée");

  await attachScreenshot(page, testInfo, "session-action-protocol-sport.png");
});
