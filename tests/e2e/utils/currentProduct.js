import { expect } from "@playwright/test";
import {
  buildBaseState,
  buildMockAuthSession,
  buildMockProfile,
  seedState,
} from "./seed.js";

export const E2E_USER_ID = "e2e-user-id";

export function addDaysKey(dateKey, deltaDays) {
  const [yyyy, mm, dd] = String(dateKey || "").split("-").map((value) => Number(value));
  if (!Number.isFinite(yyyy) || !Number.isFinite(mm) || !Number.isFinite(dd)) return "";
  const date = new Date(yyyy, mm - 1, dd, 12, 0, 0, 0);
  date.setDate(date.getDate() + deltaDays);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function buildCanonicalExecutionState({
  status = "planned",
  premium = true,
  withHistory = false,
} = {}) {
  const state = buildBaseState({ withContent: true });
  const today = state.ui.selectedDate;
  const yesterday = addDaysKey(today, -1);
  const tomorrow = addDaysKey(today, 1);

  state.profile = {
    ...(state.profile || {}),
    plan: premium ? "premium" : "free",
    entitlements: { premium },
  };
  state.ui.firstRunV1 = {
    ...(state.ui.firstRunV1 || {}),
    status: "done",
    discoveryDone: true,
    commitV1: {
      status: "applied",
      appliedAt: `${addDaysKey(today, -12)}T08:00:00.000Z`,
    },
    draftAnswers: {
      whyText: "Construire une discipline stable.",
    },
  };
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
      id: "goal_outcome",
      categoryId: "cat_business",
      title: "Lancer le système client",
      type: "OUTCOME",
      planType: "STATE",
      status: "active",
      startDate: yesterday,
      deadline: tomorrow,
      progress: 20,
    },
    {
      id: "goal_action",
      categoryId: "cat_business",
      parentId: "goal_outcome",
      outcomeId: "goal_outcome",
      title: "Bloc d’exécution client",
      type: "PROCESS",
      planType: "ONE_OFF",
      status: "active",
      oneOffDate: today,
      timeMode: "FIXED",
      startTime: "09:00",
      timeSlots: ["09:00"],
      durationMinutes: 30,
      sessionMinutes: 30,
    },
  ];
  state.habits = [];
  state.occurrences = [
    {
      id: "occ_today",
      goalId: "goal_action",
      date: today,
      start: "09:00",
      slotKey: "09:00",
      durationMinutes: 30,
      status,
    },
  ];
  state.reminders = [];
  state.sessionHistory = withHistory
    ? [
        {
          id: "hist_done_1",
          occurrenceId: "hist_occ_1",
          goalId: "goal_action",
          dateKey: addDaysKey(today, -5),
          startedAt: `${addDaysKey(today, -5)}T09:00:00.000Z`,
          endedAt: `${addDaysKey(today, -5)}T09:25:00.000Z`,
          endedReason: "done",
          durationSec: 1500,
        },
      ]
    : [];

  return state;
}

export function buildEligibleSystemAnalysisState() {
  const state = buildCanonicalExecutionState({ premium: true, withHistory: true });
  const today = state.ui.selectedDate;
  state.occurrences = Array.from({ length: 12 }, (_, index) => {
    const date = addDaysKey(today, index - 9);
    const isCurrent = index === 9;
    const status =
      index < 5 ? "done"
        : index === 5 || index === 6 ? "planned"
          : index === 7 ? "missed"
            : index === 8 ? "done"
              : "planned";
    return {
      id: isCurrent ? "occ_today" : `occ_hist_${index}`,
      goalId: "goal_action",
      date,
      start: index % 2 === 0 ? "09:00" : "15:00",
      slotKey: index % 2 === 0 ? "09:00" : "15:00",
      durationMinutes: 30,
      status,
    };
  });
  state.occurrences.unshift({
    id: "occ_activation",
    goalId: "goal_action",
    date: addDaysKey(today, -12),
    start: "09:00",
    slotKey: "09:00",
    durationMinutes: 20,
    status: "planned",
  });
  state.sessionHistory = [
    ...state.sessionHistory,
    {
      id: "hist_blocked_1",
      occurrenceId: "occ_hist_5",
      goalId: "goal_action",
      dateKey: addDaysKey(today, -4),
      startedAt: `${addDaysKey(today, -4)}T09:00:00.000Z`,
      endedAt: `${addDaysKey(today, -4)}T09:10:00.000Z`,
      endedReason: "blocked",
      durationSec: 600,
    },
    {
      id: "hist_reported_1",
      occurrenceId: "occ_hist_6",
      goalId: "goal_action",
      dateKey: addDaysKey(today, -3),
      startedAt: `${addDaysKey(today, -3)}T15:00:00.000Z`,
      endedAt: `${addDaysKey(today, -3)}T15:05:00.000Z`,
      endedReason: "reported",
      durationSec: 300,
    },
  ];
  return state;
}

export async function seedCurrentUser(page, state, options = {}) {
  await seedState(page, state, {
    authSession:
      options.authSession ||
      buildMockAuthSession({
        userId: E2E_USER_ID,
        email: "e2e@example.com",
        appMetadata: options.appMetadata || null,
      }),
    profile:
      options.profile ||
      buildMockProfile({
        userId: E2E_USER_ID,
        username: "allan",
        fullName: "Allan",
      }),
  });
}

export async function openMainTab(page, name) {
  await page.getByLabel("Navigation principale").getByRole("button", { name }).click();
}

export async function expectTodayReady(page) {
  await expect(page.locator(".todayCockpitTitle")).toHaveText("Home");
  await expect(page.getByTestId("today-trajectory-card")).toBeVisible();
  await expect(page.getByTestId("today-ai-insight-card")).toBeVisible();
  await expect(page.getByTestId("today-primary-action-card")).toBeVisible();
}

export async function openProfileMenu(page) {
  await page.getByRole("button", { name: "Ouvrir le menu du profil" }).click();
  await expect(page.getByText("Gérer ton compte et ton accès.")).toBeVisible();
}
