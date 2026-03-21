import test from "node:test";
import assert from "node:assert/strict";
import { buildNowContext } from "../src/services/context/nowContext.js";

function createNowFixture({ activeSession = null } = {}) {
  return {
    categories: [{ id: "cat-1", name: "Focus" }],
    goals: [{ id: "goal-1", title: "Deep work", type: "PROCESS", categoryId: "cat-1" }],
    occurrences: [
      { id: "occ-1", goalId: "goal-1", date: "2026-03-06", status: "planned", start: "17:00" },
      { id: "occ-2", goalId: "goal-1", date: "2026-03-08", status: "planned", start: "09:00" },
    ],
    ui: { activeSession },
    sessionHistory: [],
  };
}

test("buildNowContext keeps only the active session that belongs to the active date", () => {
  const context = buildNowContext({
    data: createNowFixture({
      activeSession: {
        id: "sess-today",
        dateKey: "2026-03-06",
        occurrenceId: "occ-1",
        habitIds: ["goal-1"],
        runtimePhase: "in_progress",
      },
    }),
    selectedDateKey: "2026-03-06",
    activeCategoryId: "cat-1",
    quotaState: { remaining: 3 },
    requestId: "req-1",
    trigger: "screen_open",
    now: new Date(2026, 2, 6, 12, 0, 0),
  });

  assert.equal(context.activeDate, "2026-03-06");
  assert.equal(context.isToday, true);
  assert.equal(context.activeSessionForActiveDate?.id, "sess-today");
  assert.equal(context.openSessionOutsideActiveDate, null);
  assert.deepEqual(context.futureSessions, []);
  assert.equal(context.focusOccurrenceForActiveDate?.id, "occ-1");
  assert.equal(context.focusOccurrenceSummary?.title, "Deep work");
  assert.equal(context.focusOccurrenceSummary?.timeLabel, "à 17:00");
  assert.equal(context.focusSelectionReason, "upcoming_fixed");
  assert.equal(context.dayLoadSummary?.plannedCount, 1);
  assert.equal(context.activeSession?.id, "sess-today");
  assert.equal(context.topOccurrence?.id, "occ-1");
});

test("buildNowContext distinguishes a future open session without polluting today's context", () => {
  const context = buildNowContext({
    data: createNowFixture({
      activeSession: {
        id: "sess-future",
        dateKey: "2026-03-07",
        occurrenceId: "occ-future",
        habitIds: ["goal-1"],
        runtimePhase: "in_progress",
      },
    }),
    selectedDateKey: "2026-03-06",
    activeCategoryId: "cat-1",
    quotaState: { remaining: 3 },
    requestId: "req-2",
    trigger: "screen_open",
    now: new Date(2026, 2, 6, 12, 0, 0),
  });

  assert.equal(context.activeSessionForActiveDate, null);
  assert.equal(context.openSessionOutsideActiveDate?.id, "sess-future");
  assert.equal(context.futureSessions.length, 1);
  assert.equal(context.focusOccurrenceForActiveDate?.id, "occ-1");
  assert.equal(context.scheduleSignalSummary?.type, "future_open_session");
  assert.equal(context.activeSession, null);
  assert.equal(context.topOccurrence?.id, "occ-1");
});

test("buildNowContext marks a future selected date as not today", () => {
  const context = buildNowContext({
    data: createNowFixture(),
    selectedDateKey: "2026-03-08",
    activeCategoryId: "cat-1",
    quotaState: { remaining: 3 },
    requestId: "req-3",
    trigger: "screen_open",
    now: new Date(2026, 2, 6, 12, 0, 0),
  });

  assert.equal(context.activeDate, "2026-03-08");
  assert.equal(context.isToday, false);
  assert.equal(context.focusOccurrenceForActiveDate?.id, "occ-2");
  assert.equal(context.focusOccurrenceSummary?.title, "Deep work");
});

test("buildNowContext exposes gapSummary when there is no action planned today", () => {
  const context = buildNowContext({
    data: {
      categories: [{ id: "cat-1", name: "Focus" }],
      goals: [
        { id: "goal-1", title: "Deep work", type: "PROCESS", categoryId: "cat-1", status: "active", sessionMinutes: 25 },
        { id: "goal-2", title: "Run 20 min", type: "PROCESS", categoryId: "cat-1", status: "active" },
      ],
      occurrences: [{ id: "occ-2", goalId: "goal-2", date: "2026-03-05", status: "done", start: "08:00", durationMinutes: 20 }],
      ui: { activeSession: null },
      sessionHistory: [],
    },
    selectedDateKey: "2026-03-06",
    activeCategoryId: "cat-1",
    quotaState: { remaining: 3 },
    requestId: "req-gap-empty",
    trigger: "screen_open",
    now: new Date(2026, 2, 6, 12, 0, 0),
  });

  assert.equal(context.gapSummary.hasGapToday, true);
  assert.equal(context.gapSummary.gapReason, "empty_day");
  assert.equal(context.gapSummary.candidateActionSummaries.length, 2);
  assert.equal(context.gapSummary.candidateActionSummaries[0].title, "Run 20 min");
});

test("buildNowContext exposes category gap and low load summary when the active category has nothing planned", () => {
  const context = buildNowContext({
    data: {
      categories: [
        { id: "cat-1", name: "Focus" },
        { id: "cat-2", name: "Sport" },
      ],
      goals: [
        { id: "goal-1", title: "Deep work", type: "PROCESS", categoryId: "cat-1", status: "active", sessionMinutes: 20 },
        { id: "goal-2", title: "Run 20 min", type: "PROCESS", categoryId: "cat-2", status: "active", sessionMinutes: 20 },
      ],
      occurrences: [{ id: "occ-2", goalId: "goal-2", date: "2026-03-06", status: "planned", start: "08:00", durationMinutes: 20 }],
      ui: { activeSession: null },
      sessionHistory: [],
    },
    selectedDateKey: "2026-03-06",
    activeCategoryId: "cat-1",
    quotaState: { remaining: 3 },
    requestId: "req-gap-category",
    trigger: "screen_open",
    now: new Date(2026, 2, 6, 12, 0, 0),
  });

  assert.equal(context.gapSummary.hasGapToday, true);
  assert.equal(context.gapSummary.emptyActiveCategory, true);
  assert.equal(context.gapSummary.lowLoadToday, true);
  assert.equal(context.gapSummary.gapReason, "empty_active_category");
  assert.equal(context.focusOccurrenceForActiveDate?.id, "occ-2");
});
