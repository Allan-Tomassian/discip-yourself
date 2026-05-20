import { describe, expect, it } from "vitest";
import {
  buildObjectiveProgressModel,
  OBJECTIVE_DISPLAY_STATUS,
  OBJECTIVE_PROGRESS_SOURCE,
} from "./objectiveProgressModel";

const categories = [{ id: "cat-1", name: "Travail" }];

function buildModel(overrides = {}) {
  return buildObjectiveProgressModel({
    categories,
    dateKey: "2026-04-14",
    goals: [],
    occurrences: [],
    sessionHistory: [],
    ...overrides,
  });
}

describe("objectiveProgressModel", () => {
  it("increases execution progress from completed linked occurrences", () => {
    const model = buildModel({
      goals: [
        { id: "out-1", type: "OUTCOME", categoryId: "cat-1", title: "Ship" },
        { id: "act-1", type: "PROCESS", categoryId: "cat-1", parentId: "out-1", title: "Deep work" },
      ],
      occurrences: [
        { id: "occ-1", goalId: "act-1", date: "2026-04-13", status: "done" },
        { id: "occ-2", goalId: "act-1", date: "2026-04-14", status: "planned" },
      ],
    });

    const objective = model.byObjectiveId.get("out-1");
    const action = model.byActionId.get("act-1");

    expect(objective.source).toBe(OBJECTIVE_PROGRESS_SOURCE.EXECUTION);
    expect(objective.displayProgress).toBe(0.5);
    expect(objective.executionProgress).toBe(0.5);
    expect(objective.completedCount).toBe(1);
    expect(objective.expectedCount).toBe(2);
    expect(action.displayProgress).toBe(0.5);
  });

  it("does not count missed, skipped, or canceled occurrences as progress", () => {
    const model = buildModel({
      goals: [
        { id: "out-1", type: "OUTCOME", categoryId: "cat-1" },
        { id: "act-1", type: "PROCESS", categoryId: "cat-1", parentId: "out-1" },
      ],
      occurrences: [
        { id: "occ-1", goalId: "act-1", date: "2026-04-11", status: "done" },
        { id: "occ-2", goalId: "act-1", date: "2026-04-12", status: "missed" },
        { id: "occ-3", goalId: "act-1", date: "2026-04-13", status: "skipped" },
        { id: "occ-4", goalId: "act-1", date: "2026-04-14", status: "canceled" },
      ],
    });

    const objective = model.byObjectiveId.get("out-1");

    expect(objective.completedCount).toBe(1);
    expect(objective.expectedCount).toBe(2);
    expect(objective.missedCount).toBe(1);
    expect(objective.displayProgress).toBe(0.5);
  });

  it("counts blocked and reported session history as friction, not progress", () => {
    const model = buildModel({
      goals: [
        { id: "out-1", type: "OUTCOME", categoryId: "cat-1" },
        { id: "act-1", type: "PROCESS", categoryId: "cat-1", parentId: "out-1" },
      ],
      occurrences: [
        { id: "occ-1", goalId: "act-1", date: "2026-04-13", status: "planned" },
        { id: "occ-2", goalId: "act-1", date: "2026-04-14", status: "planned" },
      ],
      sessionHistory: [
        { id: "hist-1", occurrenceId: "occ-1", actionId: "act-1", dateKey: "2026-04-13", state: "ended", endedReason: "blocked" },
        { id: "hist-2", occurrenceId: "occ-2", actionId: "act-1", dateKey: "2026-04-14", state: "ended", endedReason: "reported" },
      ],
    });

    const objective = model.byObjectiveId.get("out-1");

    expect(objective.completedCount).toBe(0);
    expect(objective.expectedCount).toBe(2);
    expect(objective.blockedCount).toBe(1);
    expect(objective.reportedCount).toBe(1);
    expect(objective.frictionCount).toBe(2);
    expect(objective.displayProgress).toBe(0);
    expect(objective.status.key).toBe(OBJECTIVE_DISPLAY_STATUS.EXECUTION_FRICTION);
  });

  it("does not leak session friction across unrelated linked actions", () => {
    const model = buildModel({
      goals: [
        { id: "out-clean", type: "OUTCOME", categoryId: "cat-1" },
        { id: "act-clean", type: "PROCESS", categoryId: "cat-1", parentId: "out-clean" },
        { id: "out-friction", type: "OUTCOME", categoryId: "cat-1" },
        { id: "act-friction", type: "PROCESS", categoryId: "cat-1", parentId: "out-friction" },
      ],
      occurrences: [
        { id: "occ-clean-1", goalId: "act-clean", date: "2026-04-13", status: "done" },
        { id: "occ-clean-2", goalId: "act-clean", date: "2026-04-14", status: "planned" },
        { id: "occ-friction-1", goalId: "act-friction", date: "2026-04-14", status: "planned" },
      ],
      sessionHistory: [
        { id: "hist-1", occurrenceId: "occ-friction-1", actionId: "act-friction", dateKey: "2026-04-14", state: "ended", endedReason: "blocked" },
      ],
    });

    const clean = model.byObjectiveId.get("out-clean");
    const friction = model.byObjectiveId.get("out-friction");

    expect(clean.completedCount).toBe(1);
    expect(clean.expectedCount).toBe(2);
    expect(clean.frictionCount).toBe(0);
    expect(clean.displayProgress).toBe(0.5);
    expect(friction.completedCount).toBe(0);
    expect(friction.frictionCount).toBe(1);
  });

  it("keeps a current-day clean execution objective separate from empty history", () => {
    const model = buildObjectiveProgressModel({
      categories: [{ id: "cat-work", name: "Travail" }],
      dateKey: "2026-05-20",
      goals: [
        { id: "out-exec", type: "OUTCOME", categoryId: "cat-work", status: "active" },
        { id: "act-exec", type: "PROCESS", categoryId: "cat-work", parentId: "out-exec", status: "active" },
      ],
      occurrences: [
        { id: "occ-exec-1", goalId: "act-exec", date: "2026-05-19", status: "done" },
        { id: "occ-exec-2", goalId: "act-exec", date: "2026-05-20", status: "planned" },
      ],
      sessionHistory: [],
    });

    const objective = model.byObjectiveId.get("out-exec");

    expect(objective.completedCount).toBe(1);
    expect(objective.expectedCount).toBe(2);
    expect(objective.frictionCount).toBe(0);
    expect(objective.displayProgress).toBe(0.5);
    expect(objective.labels.source).toBe("Progression d’exécution");
  });

  it("derives outcome progress only from linked process action occurrences", () => {
    const model = buildModel({
      goals: [
        { id: "out-1", type: "OUTCOME", categoryId: "cat-1" },
        { id: "act-linked", type: "PROCESS", categoryId: "cat-1", parentId: "out-1" },
        { id: "act-standalone", type: "PROCESS", categoryId: "cat-1" },
      ],
      occurrences: [
        { id: "occ-1", goalId: "act-linked", date: "2026-04-14", status: "done" },
        { id: "occ-2", goalId: "act-standalone", date: "2026-04-14", status: "missed" },
      ],
    });

    const objective = model.byObjectiveId.get("out-1");

    expect(objective.completedCount).toBe(1);
    expect(objective.expectedCount).toBe(1);
    expect(objective.displayProgress).toBe(1);
    expect(model.standaloneActions.map((action) => action.id)).toEqual(["act-standalone"]);
  });

  it("resolves legacy outcomeId and primaryGoalId links", () => {
    const model = buildModel({
      goals: [
        { id: "out-1", type: "OUTCOME", categoryId: "cat-1" },
        { id: "act-legacy", type: "PROCESS", categoryId: "cat-1", outcomeId: "out-1" },
        { id: "act-primary", type: "PROCESS", categoryId: "cat-1", primaryGoalId: "out-1" },
      ],
      occurrences: [
        { id: "occ-1", goalId: "act-legacy", date: "2026-04-13", status: "done" },
        { id: "occ-2", goalId: "act-primary", date: "2026-04-14", status: "done" },
      ],
    });

    const objective = model.byObjectiveId.get("out-1");

    expect(objective.linkedActions.map((action) => action.id).sort()).toEqual(["act-legacy", "act-primary"]);
    expect(objective.displayProgress).toBe(1);
    expect(model.standaloneActions).toHaveLength(0);
  });

  it("marks an objective with no linked actions as a starting structure state", () => {
    const model = buildModel({
      goals: [{ id: "out-1", type: "OUTCOME", categoryId: "cat-1" }],
    });

    const objective = model.byObjectiveId.get("out-1");

    expect(objective.source).toBe(OBJECTIVE_PROGRESS_SOURCE.NONE);
    expect(objective.displayProgress).toBe(0);
    expect(objective.status.key).toBe(OBJECTIVE_DISPLAY_STATUS.NEEDS_STRUCTURE);
    expect(objective.labels.source).toBe("À structurer");
  });

  it("preserves manual progress with a manual source when no execution exists", () => {
    const model = buildModel({
      goals: [{ id: "out-1", type: "OUTCOME", categoryId: "cat-1", progress: 0.42 }],
    });

    const objective = model.byObjectiveId.get("out-1");

    expect(objective.source).toBe(OBJECTIVE_PROGRESS_SOURCE.MANUAL);
    expect(objective.displayProgress).toBe(0.42);
    expect(objective.manualProgress).toBe(0.42);
    expect(objective.labels.source).toBe("À structurer");
    expect(objective.labels.progress).toBe("Progression manuelle");
  });

  it("uses execution progress for display when manual and execution signals both exist", () => {
    const model = buildModel({
      goals: [
        { id: "out-1", type: "OUTCOME", categoryId: "cat-1", progress: 0.9 },
        { id: "act-1", type: "PROCESS", categoryId: "cat-1", parentId: "out-1" },
      ],
      occurrences: [
        { id: "occ-1", goalId: "act-1", date: "2026-04-13", status: "done" },
        { id: "occ-2", goalId: "act-1", date: "2026-04-14", status: "planned" },
      ],
    });

    const objective = model.byObjectiveId.get("out-1");

    expect(objective.source).toBe(OBJECTIVE_PROGRESS_SOURCE.EXECUTION);
    expect(objective.displayProgress).toBe(0.5);
    expect(objective.manualProgress).toBe(0.9);
  });

  it("keeps archived, completed, and failed lifecycle statuses as derived display statuses", () => {
    const model = buildModel({
      goals: [
        { id: "out-archived", type: "OUTCOME", categoryId: "cat-1", status: "archived" },
        { id: "out-completed", type: "OUTCOME", categoryId: "cat-1", status: "done" },
        { id: "out-failed", type: "OUTCOME", categoryId: "cat-1", status: "failed" },
      ],
    });

    expect(model.byObjectiveId.get("out-archived").status.key).toBe(OBJECTIVE_DISPLAY_STATUS.ARCHIVED);
    expect(model.byObjectiveId.get("out-completed").status.key).toBe(OBJECTIVE_DISPLAY_STATUS.COMPLETED);
    expect(model.byObjectiveId.get("out-completed").displayProgress).toBe(1);
    expect(model.byObjectiveId.get("out-failed").status.key).toBe(OBJECTIVE_DISPLAY_STATUS.FAILED);
  });
});
