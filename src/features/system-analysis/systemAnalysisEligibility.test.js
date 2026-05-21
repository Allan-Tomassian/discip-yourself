import { describe, expect, it } from "vitest";
import { buildSystemAnalysisSnapshot, SYSTEM_ANALYSIS_MODE } from "./systemAnalysisSnapshot";
import {
  SYSTEM_ANALYSIS_LOCKED_COPY,
  buildSystemAnalysisEligibility,
} from "./systemAnalysisEligibility";

const NOW = new Date("2026-05-20T12:00:00");
const PERIOD = { startDateKey: "2026-05-11", endDateKey: "2026-05-20" };

function buildEligibleState(overrides = {}) {
  const occurrences = Array.from({ length: 10 }, (_, index) => {
    const day = 11 + index;
    const status = index < 4 ? "done" : index === 4 ? "missed" : "planned";
    return {
      id: `occ-${index}`,
      goalId: "act-1",
      date: `2026-05-${String(day).padStart(2, "0")}`,
      start: "09:00",
      durationMinutes: 30,
      status,
    };
  });
  return {
    categories: [{ id: "cat-1", name: "Travail" }],
    goals: [
      { id: "out-1", type: "OUTCOME", categoryId: "cat-1", title: "Ship" },
      { id: "act-1", type: "PROCESS", categoryId: "cat-1", parentId: "out-1", title: "Deep work" },
    ],
    occurrences,
    sessionHistory: [],
    ui: {
      firstRunV1: {
        commitV1: { status: "applied", appliedAt: "2026-05-10T10:00:00.000Z" },
        draftAnswers: { whyText: "Construire une discipline stable." },
      },
    },
    ...overrides,
  };
}

function snapshotFor(state) {
  return buildSystemAnalysisSnapshot({
    state,
    period: PERIOD,
    referenceDateKey: "2026-05-20",
    now: NOW,
  });
}

describe("buildSystemAnalysisEligibility", () => {
  it("fails before seven days since activation", () => {
    const state = buildEligibleState({
      ui: {
        firstRunV1: {
          commitV1: { status: "applied", appliedAt: "2026-05-18T10:00:00.000Z" },
          draftAnswers: { whyText: "Construire une discipline stable." },
        },
      },
    });
    const result = buildSystemAnalysisEligibility({ state, snapshot: snapshotFor(state), now: NOW });

    expect(result.eligible).toBe(false);
    expect(result.missingRequirements.map((item) => item.code)).toContain("activation_too_recent");
  });

  it("allows initial analysis with a committed first-run system and too few planned blocks", () => {
    const state = buildEligibleState({ occurrences: buildEligibleState().occurrences.slice(0, 3) });
    const result = buildSystemAnalysisEligibility({ state, snapshot: snapshotFor(state), now: NOW });

    expect(result.eligible).toBe(true);
    expect(result.analysisMode).toBe(SYSTEM_ANALYSIS_MODE.INITIAL);
    expect(result.behavioralEligible).toBe(false);
    expect(result.behavioralMissingRequirements.map((item) => item.code)).toContain("not_enough_planned_blocks");
    expect(result.missingRequirements).toEqual([]);
  });

  it("allows initial analysis with a committed first-run system and too few execution outcomes", () => {
    const state = buildEligibleState({
      occurrences: buildEligibleState().occurrences.map((occurrence) => ({ ...occurrence, status: "planned" })),
    });
    const result = buildSystemAnalysisEligibility({ state, snapshot: snapshotFor(state), now: NOW });

    expect(result.eligible).toBe(true);
    expect(result.analysisMode).toBe(SYSTEM_ANALYSIS_MODE.INITIAL);
    expect(result.behavioralMissingRequirements.map((item) => item.code)).toContain("not_enough_execution_outcomes");
  });

  it("allows initial analysis when active days are still thin", () => {
    const state = buildEligibleState({
      occurrences: buildEligibleState().occurrences.map((occurrence, index) => ({
        ...occurrence,
        id: `same-day-${index}`,
        date: "2026-05-20",
        status: index < 5 ? "done" : "planned",
      })),
    });
    const result = buildSystemAnalysisEligibility({ state, snapshot: snapshotFor(state), now: NOW });

    expect(result.eligible).toBe(true);
    expect(result.analysisMode).toBe(SYSTEM_ANALYSIS_MODE.INITIAL);
    expect(result.behavioralMissingRequirements.map((item) => item.code)).toContain("not_enough_active_days");
  });

  it("passes with enough real execution data", () => {
    const state = buildEligibleState();
    const result = buildSystemAnalysisEligibility({ state, snapshot: snapshotFor(state), now: NOW });

    expect(result.eligible).toBe(true);
    expect(result.reasons).toEqual(["enough_real_usage_data"]);
    expect(result.unlockCopy).toBe("");
  });

  it("allows initial analysis when a meaningful planned system exists without full execution", () => {
    const state = {
      categories: [{ id: "cat-1", name: "Travail" }],
      goals: [{ id: "act-1", type: "PROCESS", categoryId: "cat-1", title: "Deep work" }],
      occurrences: [],
      sessionHistory: [],
      ui: {},
    };
    const result = buildSystemAnalysisEligibility({ state, snapshot: snapshotFor(state), now: NOW });

    expect(result.eligible).toBe(true);
    expect(result.analysisMode).toBe(SYSTEM_ANALYSIS_MODE.INITIAL);
    expect(result.reasons).toEqual(["initial_structure_analysis_available"]);
    expect(result.behavioralMissingRequirements.length).toBeGreaterThan(0);
  });

  it("returns locked copy and progress fields when no usable system exists", () => {
    const result = buildSystemAnalysisEligibility({
      state: { occurrences: [], sessionHistory: [], ui: {} },
      now: NOW,
    });

    expect(result.eligible).toBe(false);
    expect(result.unlockCopy).toBe(SYSTEM_ANALYSIS_LOCKED_COPY);
    expect(result.progressToUnlock.plannedBlocks).toMatchObject({ current: 0, target: 10, complete: false });
    expect(result.behavioralMissingRequirements.map((item) => item.code)).toContain("activation_date_missing");
    expect(result.missingRequirements.map((item) => item.code)).toContain("usable_system_missing");
  });
});
