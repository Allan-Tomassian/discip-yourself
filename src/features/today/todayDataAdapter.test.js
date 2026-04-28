import { describe, expect, it } from "vitest";
import { buildTodayData, getTodayVisualSmokeModel } from "./todayDataAdapter";

const SELECTED_DATE_KEY = "2026-04-28";
const NOW = new Date("2026-04-28T12:00:00");

function baseData(overrides = {}) {
  return {
    profile: { name: "Allan" },
    categories: [{ id: "cat-work", name: "Travail" }],
    goals: [{ id: "goal-deep", title: "Deep work", categoryId: "cat-work", priority: "high" }],
    occurrences: [],
    microChecks: {},
    ui: {},
    ...overrides,
  };
}

function build(overrides = {}) {
  return buildTodayData({
    data: baseData(overrides.data),
    selectedDateKey: overrides.selectedDateKey || SELECTED_DATE_KEY,
    now: overrides.now || NOW,
    auth: overrides.auth,
    profile: overrides.profile,
    manualTodayAnalysis: overrides.manualTodayAnalysis,
    persistenceScope: overrides.persistenceScope,
    visualSmokeModel: overrides.visualSmokeModel,
  });
}

describe("buildTodayData", () => {
  it("returns unavailable score and baseline delta without history", () => {
    const result = build({ data: { occurrences: [], microChecks: {} } });

    expect(result.scoreDisplay).toBe("--%");
    expect(result.scoreAvailable).toBe(false);
    expect(result.previousDayDeltaDisplay).toBe("Point de départ");
    expect(result.previousDayDeltaAvailable).toBe(false);
  });

  it("allows a real zero score when expected historical signal exists", () => {
    const result = build({
      data: {
        occurrences: [
          {
            id: "occ-missed",
            goalId: "goal-deep",
            date: "2026-04-27",
            start: "09:00",
            durationMinutes: 30,
            status: "missed",
          },
        ],
      },
    });

    expect(result.scoreDisplay).toBe("0%");
    expect(result.scoreAvailable).toBe(true);
    expect(result.previousDayDeltaDisplay).toBe("Point de départ");
  });

  it("maps two completed blocks out of three to 67 percent progress", () => {
    const result = build({
      data: {
        occurrences: [
          {
            id: "occ-1",
            goalId: "goal-deep",
            date: SELECTED_DATE_KEY,
            start: "07:00",
            status: "done",
          },
          {
            id: "occ-2",
            goalId: "goal-deep",
            date: SELECTED_DATE_KEY,
            start: "09:30",
            status: "done",
          },
          {
            id: "occ-3",
            goalId: "goal-deep",
            date: SELECTED_DATE_KEY,
            start: "13:00",
            status: "planned",
          },
        ],
      },
    });

    expect(result.completedBlocks).toBe(2);
    expect(result.totalBlocks).toBe(3);
    expect(result.timelineProgressPercent).toBe(67);
    expect(result.timelineProgressLabel).toBe("67%");
  });

  it("maps an active session to a resume primary action", () => {
    const result = build({
      data: {
        ui: {
          activeSession: {
            occurrenceId: "occ-active",
            dateKey: SELECTED_DATE_KEY,
            habitIds: ["goal-deep"],
            runtimePhase: "in_progress",
          },
        },
        occurrences: [
          {
            id: "occ-active",
            goalId: "goal-deep",
            date: SELECTED_DATE_KEY,
            start: "13:00",
            durationMinutes: 30,
            status: "in_progress",
          },
        ],
      },
    });

    expect(result.primaryAction.status).toBe("in_progress");
    expect(result.primaryAction.primaryLabel).toBe("Reprendre");
    expect(result.timelineItems[0]).toMatchObject({
      id: "occ-active",
      status: "in_progress",
    });
  });

  it("maps an empty day to safe coach/planning fallbacks", () => {
    const result = build({ data: { occurrences: [] } });

    expect(result.totalBlocks).toBe(0);
    expect(result.timelineProgressPercent).toBeNull();
    expect(result.timelineProgressLabel).toBe("--%");
    expect(result.primaryAction.status).toBe("empty");
    expect(result.primaryAction.primaryLabel).toContain("Coach IA");
    expect(result.aiInsight.status).toBe("unavailable");
    expect(result.aiInsight.canApply).toBe(false);
  });

  it("applies the smoke fixture deterministically without leaking into production data", () => {
    const smokeModel = {
      scoreLabel: "72%",
      deltaLabel: "+8% vs hier",
      doneBlocksCount: 2,
      plannedBlocksCount: 3,
      timelineProgressLabel: "67%",
      cockpitStatus: {
        welcome: "Bon retour — aujourd’hui, on avance bloc par bloc.",
        mode: "MODE EXÉCUTION",
        title: "Tu es en contrôle.",
        detail: "Ne casse pas le rythme maintenant.",
      },
      primaryAction: {
        title: "Deep work",
        description: "Avancer sur ton objectif principal.",
        durationLabel: "30 min",
        timingLabel: "13:00",
        categoryLabel: "Travail",
        priorityLabel: "Priorité haute",
        reason: "C’est le bloc qui débloque ta journée.",
        ctaLabel: "Verrouiller 30 min",
      },
      timelineItems: [
        { id: "smoke-routine", timeLabel: "07:00", title: "Routine", status: "done" },
        { id: "smoke-sport", timeLabel: "09:30", title: "Sport", status: "done" },
        { id: "smoke-deep", timeLabel: "13:00", title: "Deep work", status: "in_progress" },
      ],
      ai: {
        headline: "Tu tiens mieux les blocs courts.",
        recommendation: "Garde ce bloc à 30 min.",
        reason: "Tes sessions de 20-40 min ont 67% de taux de complétion ces 7 derniers jours.",
      },
    };

    const smoked = build({ visualSmokeModel: smokeModel });
    expect(smoked.scoreDisplay).toBe("72%");
    expect(smoked.previousDayDeltaDisplay).toBe("+8% vs hier");
    expect(smoked.completedBlocks).toBe(2);
    expect(smoked.totalBlocks).toBe(3);
    expect(smoked.timelineProgressPercent).toBe(67);
    expect(smoked.primaryAction.title).toBe("Deep work");
    expect(smoked.primaryAction.primaryLabel).toBe("Verrouiller 30 min");
    expect(smoked.timelineItems[2].status).toBe("in_progress");
    expect(smoked.aiInsight.recommendation).toBe("Garde ce bloc à 30 min.");

    const production = build();
    expect(production.scoreDisplay).toBe("--%");
    expect(production.primaryAction.title).not.toBe("Deep work");
    expect(getTodayVisualSmokeModel()).toBeNull();
  });
});
