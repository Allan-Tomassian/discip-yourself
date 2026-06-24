import { test, expect } from "@playwright/test";
import { buildBaseState, getTodayKey, getUserData, seedState } from "./utils/seed.js";

const E2E_USER_ID = "e2e-user-id";

function currentHm() {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
}

function addDaysKey(baseKey, days) {
  const [yyyy, mm, dd] = baseKey.split("-").map((value) => Number(value));
  const date = new Date(yyyy, mm - 1, dd, 12, 0, 0, 0);
  date.setDate(date.getDate() + days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function buildObjectivesState({ scenario }) {
  const today = getTodayKey();
  const tomorrow = addDaysKey(today, 1);
  const readyStart = currentHm();
  const activeStart = currentHm();
  const state = buildBaseState({ withContent: false });
  state.profile = { ...(state.profile || {}), plan: "premium", entitlements: { premium: true } };
  state.categories = [{ id: "cat_work", name: "Travail", color: "#30f273" }];
  state.ui = {
    ...(state.ui || {}),
    selectedDateKey: today,
    selectedDate: today,
    activeSession: null,
  };
  state.goals = [
    { id: "out-1", type: "OUTCOME", categoryId: "cat_work", title: "Objectif actionnable", status: "active" },
  ];
  state.occurrences = [];
  state.sessionHistory = [];

  if (scenario !== "needs_action") {
    const actionDate = scenario === "future" ? tomorrow : today;
    const actionStart =
      scenario === "ready"
        ? readyStart
        : scenario === "active"
          ? activeStart
          : scenario === "future"
            ? "10:00"
            : scenario === "recovery"
              ? "09:00"
              : "";
    state.goals.push({
      id: "act-1",
      type: "PROCESS",
      categoryId: "cat_work",
      parentId: "out-1",
      outcomeId: "out-1",
      title: "Action liée",
      status: "active",
      priority: "haute",
      durationMinutes: 60,
      ...(actionStart
        ? {
            planType: "ONE_OFF",
            oneOffDate: actionDate,
            timeMode: "FIXED",
            startTime: actionStart,
            timeSlots: [actionStart],
          }
        : {}),
    });
  }

  if (scenario === "ready") {
    state.occurrences.push({
      id: "occ-ready",
      goalId: "act-1",
      date: today,
      start: readyStart,
      slotKey: readyStart,
      status: "planned",
      durationMinutes: 120,
    });
  }

  if (scenario === "active") {
    state.occurrences.push({
      id: "occ-active",
      goalId: "act-1",
      date: today,
      start: activeStart,
      slotKey: activeStart,
      status: "in_progress",
      durationMinutes: 120,
    });
    state.ui.activeSession = {
      id: "session-active",
      occurrenceId: "occ-active",
      dateKey: today,
      runtimePhase: "paused",
      status: "partial",
      timerRunning: false,
      timerAccumulatedSec: 60,
    };
  }

  if (scenario === "future") {
    state.occurrences.push({
      id: "occ-future",
      goalId: "act-1",
      date: tomorrow,
      start: "10:00",
      slotKey: "10:00",
      status: "planned",
      durationMinutes: 60,
    });
  }

  if (scenario === "recovery") {
    state.occurrences.push({
      id: "occ-recovery",
      goalId: "act-1",
      date: today,
      start: "09:00",
      slotKey: "09:00",
      status: "missed",
      durationMinutes: 45,
    });
  }

  return state;
}

async function openObjectives(page, state) {
  await seedState(page, state);
  await page.goto("/objectives");
  await expect(page.locator(".pageTitle")).toContainText("Objectifs");
  await expect(page.getByText("Objectif actionnable", { exact: true })).toBeVisible();
}

test("Objectifs actionability: ready objective opens Session for the linked occurrence", async ({ page }) => {
  await openObjectives(page, buildObjectivesState({ scenario: "ready" }));

  await expect(page.getByTestId("objective-actionability-out-1")).toContainText("Prêt à démarrer");
  await page.getByTestId("objective-actionability-cta-out-1").click();

  await expect(page).toHaveURL(/\/session\/occ-ready$/);
});

test("Objectifs actionability: mobile CTA can scroll above bottom navigation", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 700 });
  await openObjectives(page, buildObjectivesState({ scenario: "ready" }));

  await page.locator('[data-page-id="objectives"]').evaluate((shell) => {
    shell.scrollTop = shell.scrollHeight;
  });

  const cta = page.getByTestId("objective-actionability-cta-out-1");
  const nav = page.getByRole("navigation", { name: "Navigation principale" });
  await expect(cta).toBeVisible();
  await expect(nav).toBeVisible();

  const ctaBox = await cta.boundingBox();
  const navBox = await nav.boundingBox();
  expect(ctaBox).not.toBeNull();
  expect(navBox).not.toBeNull();
  expect(ctaBox.y + ctaBox.height).toBeLessThan(navBox.y);
});

test("Objectifs actionability: active linked session resumes Session", async ({ page }) => {
  await openObjectives(page, buildObjectivesState({ scenario: "active" }));

  await expect(page.getByTestId("objective-actionability-out-1")).toContainText("Session en cours");
  await page.getByTestId("objective-actionability-cta-out-1").click();

  await expect(page).toHaveURL(/\/session\/occ-active$/);
});

test("Objectifs actionability: future blocks do not expose premature Démarrer", async ({ page }) => {
  await openObjectives(page, buildObjectivesState({ scenario: "future" }));

  const strip = page.getByTestId("objective-actionability-out-1");
  await expect(strip).toContainText("Prochain bloc");
  await expect(strip.getByRole("button", { name: "Démarrer" })).toHaveCount(0);
  await expect(page.locator(".lovableTimelineList")).toHaveCount(0);
  await expect(page.getByText("Architecture du temps.")).toHaveCount(0);
});

test("Objectifs actionability: recoverable objective opens UnifiedRecoverySheet", async ({ page }) => {
  await openObjectives(page, buildObjectivesState({ scenario: "recovery" }));

  await expect(page.getByTestId("objective-actionability-out-1")).toContainText("Bloc à réparer");
  await page.getByTestId("objective-actionability-cta-out-1").click();

  await expect(page.getByTestId("unified-recovery-sheet")).toBeVisible();
});

test("Objectifs actionability: missing action opens linked action creation", async ({ page }) => {
  await openObjectives(page, buildObjectivesState({ scenario: "needs_action" }));

  await expect(page.getByTestId("objective-actionability-out-1")).toContainText("Action manquante");
  await page.getByTestId("objective-actionability-cta-out-1").click();

  await expect(page).toHaveURL(/\/create$/);
  await expect(page.locator(".pageTitle")).toContainText("Créer une action");
  const userData = await getUserData(page, E2E_USER_ID);
  expect(userData?.ui?.createDraft?.actionDraft?.outcomeId).toBe("out-1");
});

test("Objectifs actionability: missing block opens canonical action edit scheduling page", async ({ page }) => {
  await openObjectives(page, buildObjectivesState({ scenario: "needs_planning" }));

  await expect(page.getByTestId("objective-actionability-out-1")).toContainText("À planifier");
  await page.getByTestId("objective-actionability-cta-out-1").click();

  await expect(page).toHaveURL(/\/edit\/act-1$/);
  await expect(page.locator(".pageTitle")).toContainText(/Modifier|Action/i);
});
