import { describe, expect, it } from "vitest";
import {
  createEmptyFirstRunWindow,
  getNextFirstRunStatus,
  hasMeaningfulFirstRunState,
  isFirstRunDone,
  normalizeFirstRunV1,
} from "./firstRunModel";

describe("firstRunModel", () => {
  it("normalizes the v1 contract with safe defaults", () => {
    const normalized = normalizeFirstRunV1({
      status: "signals",
      draftAnswers: {
        whyText: "  Reprendre le controle  ",
        primaryGoal: "  Relancer le projet  ",
        unavailableWindows: [
          {
            id: "w1",
            daysOfWeek: [1, 1, 5, 9],
            startTime: "09:00",
            endTime: "18:00",
            label: "  Travail  ",
          },
        ],
      },
    });

    expect(normalized.version).toBe(1);
    expect(normalized.status).toBe("signals");
    expect(normalized.draftAnswers.whyText).toBe("Reprendre le controle");
    expect(normalized.draftAnswers.primaryGoal).toBe("Relancer le projet");
    expect(normalized.draftAnswers.unavailableWindows).toEqual([
      {
        id: "w1",
        daysOfWeek: [1, 5],
        startTime: "09:00",
        endTime: "18:00",
        label: "Travail",
      },
    ]);
    expect(normalized.generatedPlans).toBeNull();
    expect(normalized.inputHash).toBeNull();
    expect(normalized.generationError).toBeNull();
    expect(normalized.selectedPlanId).toBeNull();
    expect(normalized.discoveryDone).toBe(false);
  });

  it("falls back to legacy onboarding completion only when firstRunV1 is absent", () => {
    expect(normalizeFirstRunV1(null, { legacyOnboardingCompleted: true }).status).toBe("done");
    expect(isFirstRunDone({ onboardingCompleted: true })).toBe(true);
    expect(isFirstRunDone({ firstRunV1: { status: "signals" }, onboardingCompleted: true })).toBe(false);
  });

  it("migrates incomplete legacy onboarding to intro", () => {
    const normalized = normalizeFirstRunV1(null, { legacyOnboardingCompleted: false });
    expect(normalized.status).toBe("intro");
    expect(normalized.discoveryDone).toBe(false);
  });

  it("validates forward transitions and blocks compare without a selection", () => {
    expect(getNextFirstRunStatus("intro")).toBe("why");
    expect(getNextFirstRunStatus("signals")).toBe("generate");
    expect(getNextFirstRunStatus("compare", { selectedPlanId: null })).toBe("compare");
    expect(getNextFirstRunStatus("compare", { selectedPlanId: "tenable" })).toBe("commit");
  });

  it("treats a non-empty interrupted draft as meaningful local data", () => {
    const emptyState = normalizeFirstRunV1(null, { legacyOnboardingCompleted: false });
    expect(hasMeaningfulFirstRunState(emptyState)).toBe(false);

    const withWhy = normalizeFirstRunV1({
      status: "why",
      draftAnswers: { whyText: "Avancer vraiment" },
    });
    expect(hasMeaningfulFirstRunState(withWhy)).toBe(true);

    const withWindow = normalizeFirstRunV1({
      draftAnswers: {
        preferredWindows: [createEmptyFirstRunWindow({ label: "Matin", daysOfWeek: [1], startTime: "07:00" })],
      },
    });
    expect(hasMeaningfulFirstRunState(withWindow)).toBe(true);
  });

  it("normalizes generatedPlans with commitDraft canonique and legacy variants", () => {
    const normalized = normalizeFirstRunV1({
      status: "compare",
      inputHash: "hash-1",
      generatedPlans: {
        version: 2,
        source: "ai_backend",
        inputHash: "hash-1",
        generatedAt: "2026-04-19T08:00:00.000Z",
        requestId: "req-1",
        model: "gpt-5.4",
        promptVersion: "first_run_plan_v1",
        plans: [
          {
            id: "steady",
            variant: "steady",
            title: "",
            summary: "Version tenable",
            comparisonMetrics: {
              weeklyMinutes: 150,
              totalBlocks: 5,
              activeDays: 4,
              recoverySlots: 3,
              dailyDensity: "respirable",
              engagementLevel: "tenable",
            },
            categories: [{ id: "cat_1", label: "Business", role: "primary", blockCount: 3 }],
            preview: [
              {
                dayKey: "2026-04-19",
                dayLabel: "DIM 19/04",
                slotLabel: "08:00 - 08:25",
                categoryId: "cat_1",
                categoryLabel: "Business",
                title: "Bloc profond",
                minutes: 25,
              },
            ],
            todayPreview: [
              {
                dayKey: "2026-04-19",
                dayLabel: "DIM 19/04",
                slotLabel: "08:00 - 08:25",
                categoryId: "cat_1",
                categoryLabel: "Business",
                title: "Bloc profond",
                minutes: 25,
              },
            ],
            rationale: {
              whyFit: "Plan sobre.",
              capacityFit: "Charge stable.",
              constraintFit: "Contraintes respectées.",
            },
            commitDraft: {
              version: 1,
              categories: [{ id: "cat_1", templateId: "business", name: "Business", color: "#0ea5e9", order: 0 }],
              goals: [{ id: "goal_1", categoryId: "cat_1", title: "Relancer le projet", type: "OUTCOME", order: 0 }],
              actions: [
                {
                  id: "action_1",
                  categoryId: "cat_1",
                  parentGoalId: "goal_1",
                  title: "Bloc profond",
                  type: "PROCESS",
                  order: 0,
                  repeat: "weekly",
                  daysOfWeek: [1, 3, 5],
                  timeMode: "FIXED",
                  startTime: "08:00",
                  timeSlots: ["08:00"],
                  durationMinutes: 25,
                  sessionMinutes: 25,
                },
              ],
              occurrences: [
                { id: "occ_1", actionId: "action_1", date: "2026-04-19", start: "08:00", durationMinutes: 25, status: "planned" },
              ],
            },
          },
        ],
      },
      selectedPlanId: "steady",
    });

    expect(normalized.generatedPlans?.plans[0]?.variant).toBe("tenable");
    expect(normalized.generatedPlans?.plans[0]?.id).toBe("tenable");
    expect(normalized.generatedPlans?.plans[0]?.title).toBe("Plan tenable");
    expect(normalized.selectedPlanId).toBe("tenable");
    expect(normalized.generatedPlans?.plans[0]?.commitDraft?.actions[0]?.id).toBe("action_1");
    expect(normalized.generatedPlans?.plans[0]?.commitDraft?.occurrences[0]?.actionId).toBe("action_1");
  });

  it("reste compatible avec les anciens payloads qui stockent occurrence.goalId", () => {
    const normalized = normalizeFirstRunV1({
      status: "compare",
      generatedPlans: {
        version: 2,
        source: "ai_backend",
        inputHash: "hash-legacy",
        generatedAt: "2026-04-19T08:00:00.000Z",
        requestId: "req-legacy",
        model: "gpt-5.4",
        promptVersion: "first_run_plan_v1",
        plans: [
          {
            id: "tenable",
            variant: "tenable",
            title: "Plan tenable",
            summary: "Version legacy",
            comparisonMetrics: {
              weeklyMinutes: 150,
              totalBlocks: 5,
              activeDays: 4,
              recoverySlots: 3,
              dailyDensity: "respirable",
              engagementLevel: "tenable",
            },
            categories: [{ id: "cat_1", label: "Business", role: "primary", blockCount: 3 }],
            preview: [
              {
                dayKey: "2026-04-19",
                dayLabel: "DIM 19/04",
                slotLabel: "08:00 - 08:25",
                categoryId: "cat_1",
                categoryLabel: "Business",
                title: "Bloc profond",
                minutes: 25,
              },
            ],
            todayPreview: [
              {
                dayKey: "2026-04-19",
                dayLabel: "DIM 19/04",
                slotLabel: "08:00 - 08:25",
                categoryId: "cat_1",
                categoryLabel: "Business",
                title: "Bloc profond",
                minutes: 25,
              },
            ],
            rationale: {
              whyFit: "Plan sobre.",
              capacityFit: "Charge stable.",
              constraintFit: "Contraintes respectées.",
            },
            commitDraft: {
              version: 1,
              categories: [{ id: "cat_1", templateId: "business", name: "Business", color: "#0ea5e9", order: 0 }],
              goals: [{ id: "goal_1", categoryId: "cat_1", title: "Relancer le projet", type: "OUTCOME", order: 0 }],
              actions: [
                {
                  id: "action_1",
                  categoryId: "cat_1",
                  parentGoalId: "goal_1",
                  title: "Bloc profond",
                  type: "PROCESS",
                  order: 0,
                  repeat: "weekly",
                  daysOfWeek: [1, 3, 5],
                  timeMode: "FIXED",
                  startTime: "08:00",
                  timeSlots: ["08:00"],
                  durationMinutes: 25,
                  sessionMinutes: 25,
                },
              ],
              occurrences: [
                { id: "occ_legacy", goalId: "action_1", date: "2026-04-19", start: "08:00", durationMinutes: 25, status: "planned" },
              ],
            },
          },
        ],
      },
    });

    expect(normalized.generatedPlans?.plans[0]?.commitDraft?.occurrences[0]?.actionId).toBe("action_1");
  });
});
