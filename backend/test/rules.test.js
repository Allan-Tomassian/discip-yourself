import test from "node:test";
import assert from "node:assert/strict";
import { buildNowFallback } from "../src/services/fallback/rules.js";

function createGapContext(overrides = {}) {
  return {
    activeDate: "2026-03-06",
    systemToday: "2026-03-06",
    isToday: true,
    activeCategoryId: "cat-1",
    category: { id: "cat-1", name: "Focus" },
    activeSessionForActiveDate: null,
    openSessionOutsideActiveDate: null,
    futureSessions: [],
    plannedActionsForActiveDate: [],
    focusOccurrenceForActiveDate: null,
    focusOccurrenceSummary: null,
    focusSelectionReason: null,
    activeSessionSummary: null,
    scheduleSignalSummary: { type: "none", targetActionTitle: null, targetDateKey: null, targetTimeLabel: null },
    gapSummary: {
      hasGapToday: true,
      emptyActiveCategory: false,
      lowLoadToday: false,
      gapReason: "empty_day",
      selectionScope: "active_category",
      activeCategoryCandidateCount: 1,
      crossCategoryCandidateCount: 0,
      candidateActionSummaries: [
        {
          actionId: "goal-1",
          title: "Deep work",
          categoryName: "Focus",
          durationMin: 25,
          lastPlannedDateKey: "2026-03-05",
        },
      ],
    },
    ...overrides,
  };
}

test("buildNowFallback maps gap fill to planifier aujourd'hui with open_pilotage", () => {
  const payload = buildNowFallback(createGapContext());

  assert.equal(payload.interventionType, "today_recommendation");
  assert.equal(payload.primaryAction.intent, "open_pilotage");
  assert.equal(payload.primaryAction.label, "Planifier aujourd’hui");
  assert.equal(payload.toolIntent, "suggest_reschedule_option");
  assert.match(payload.reason, /Deep work/i);
});

test("buildNowFallback names the active category when it is empty", () => {
  const payload = buildNowFallback(
    createGapContext({
      plannedActionsForActiveDate: [{ id: "occ-2", goalId: "goal-2", date: "2026-03-06", status: "planned" }],
      focusOccurrenceForActiveDate: null,
      gapSummary: {
        hasGapToday: true,
        emptyActiveCategory: true,
        lowLoadToday: true,
        gapReason: "empty_active_category",
        selectionScope: "active_category",
        activeCategoryCandidateCount: 1,
        crossCategoryCandidateCount: 1,
        candidateActionSummaries: [
          {
            actionId: "goal-1",
            title: "Deep work",
            categoryName: "Focus",
            durationMin: 20,
            lastPlannedDateKey: "2026-03-05",
          },
        ],
      },
    })
  );

  assert.match(payload.headline, /Focus/i);
  assert.match(payload.reason, /Deep work/i);
});

test("buildNowFallback explicitly explains cross-category fallback when no active-category candidate exists", () => {
  const payload = buildNowFallback(
    createGapContext({
      categoryCoherence: {
        reasonLinkType: "cross_category",
        recommendedCategoryId: "cat-2",
        recommendedCategoryLabel: "Sport",
        contributionTargetLabel: "objectif Focus",
        explanation: "Run 20 min en Sport contribue a objectif Focus.",
      },
      gapSummary: {
        hasGapToday: true,
        emptyActiveCategory: true,
        lowLoadToday: false,
        gapReason: "empty_active_category",
        selectionScope: "cross_category",
        activeCategoryCandidateCount: 0,
        crossCategoryCandidateCount: 1,
        candidateActionSummaries: [
          {
            actionId: "goal-2",
            title: "Run 20 min",
            categoryName: "Sport",
            durationMin: 20,
            lastPlannedDateKey: "2026-03-05",
          },
        ],
      },
    })
  );

  assert.match(payload.reason, /objectif Focus/i);
  assert.match(payload.reason, /Run 20 min/i);
  assert.match(payload.reason, /Sport/i);
});

test("buildNowFallback asks to structure the active category when no link is provable", () => {
  const payload = buildNowFallback(
    createGapContext({
      categoryCoherence: {
        reasonLinkType: "structure_missing",
        contributionTargetLabel: "objectif Focus",
        explanation:
          "Tu n'as pas encore defini d'action exploitable pour objectif Focus. Commence par clarifier l'objectif ou creer une premiere action.",
      },
      gapSummary: {
        hasGapToday: true,
        emptyActiveCategory: false,
        lowLoadToday: false,
        gapReason: "empty_day",
        selectionScope: "structure_missing",
        activeCategoryCandidateCount: 0,
        crossCategoryCandidateCount: 0,
        candidateActionSummaries: [],
      },
    })
  );

  assert.equal(payload.primaryAction.intent, "open_pilotage");
  assert.equal(payload.primaryAction.label, "Structurer");
  assert.match(payload.reason, /clarifier l'objectif/i);
});
