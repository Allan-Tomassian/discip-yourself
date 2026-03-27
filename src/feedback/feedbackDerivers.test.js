import { describe, expect, it } from "vitest";
import {
  deriveBehaviorFeedbackSignal,
  deriveLibraryBehaviorCue,
  derivePilotageBehaviorCue,
  derivePlanningBehaviorCue,
  deriveSessionBehaviorCue,
  deriveTodayBehaviorCue,
} from "./feedbackDerivers";
import { BEHAVIOR_FEEDBACK_KIND } from "./feedbackSignals";

describe("behavior feedback derivation", () => {
  it("returns a structural signal for action creation", () => {
    const signal = deriveBehaviorFeedbackSignal({
      intent: "create_action",
      payload: { surface: "create-flow", categoryId: "cat-work" },
    });

    expect(signal).toMatchObject({
      kind: BEHAVIOR_FEEDBACK_KIND.structure,
      message: "Ajouté à ta structure",
      categoryId: "cat-work",
      surface: "create-flow",
    });
  });

  it("prioritizes continuity for session completion when a streak is real", () => {
    const signal = deriveBehaviorFeedbackSignal({
      intent: "finish_session",
      payload: { surface: "session", categoryId: "cat-health", streakDays: 3 },
    });

    expect(signal).toMatchObject({
      kind: BEHAVIOR_FEEDBACK_KIND.continuity,
      message: "3 jours de suite",
      categoryId: "cat-health",
    });
    expect(signal.priority).toBeGreaterThan(30);
  });

  it("derives a today cue from continuity before structural alignment", () => {
    const cue = deriveTodayBehaviorCue({
      disciplineSummary: { habitDaysKept14: 4, ratio: 0.9 },
      coreProgress: { total: 2, done: 2 },
      activeCategory: { id: "cat-work", mainGoalId: "goal-1" },
      profileSummary: { currentPriority: "Livrer" },
    });

    expect(cue).toEqual({
      cueKind: "continuity",
      message: "4 jours de suite",
    });
  });

  it("derives a planning cue from a credible planned block", () => {
    const cue = derivePlanningBehaviorCue({
      planningView: "day",
      dayItems: [{ id: "occ-1" }],
      dayMinutes: 45,
      activeCategoryId: "cat-work",
    });

    expect(cue).toEqual({
      cueKind: "momentum",
      message: "Bloc crédible en place",
    });
  });

  it("derives a pilotage cue from upward discipline", () => {
    const cue = derivePilotageBehaviorCue({
      disciplineTrend: { summary: { trendLabel: "hausse", currentScore: 82 } },
      constanceSummary: { activeDays7: 4 },
      selectedCategory: { id: "cat-sport", mainGoalId: "goal-1" },
    });

    expect(cue).toEqual({
      cueKind: "continuity",
      message: "Progression constante",
    });
  });

  it("derives a session cue only for meaningful active states", () => {
    expect(
      deriveSessionBehaviorCue({ viewState: "running", plannedMinutes: 30, categoryId: "cat-deep" })
    ).toEqual({
      cueKind: "momentum",
      message: "Structure active",
    });

    expect(deriveSessionBehaviorCue({ viewState: "completed", plannedMinutes: 30, categoryId: "cat-deep" })).toBeNull();
  });

  it("derives a library cue from structure already in place", () => {
    const cue = deriveLibraryBehaviorCue({
      category: { id: "cat-health", mainGoalId: "goal-1" },
      outcomeCount: 1,
      processCount: 2,
      hasProfile: true,
    });

    expect(cue).toEqual({
      cueKind: "structure",
      message: "Structure cohérente",
    });
  });
});
