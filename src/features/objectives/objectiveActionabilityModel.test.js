import { describe, expect, it } from "vitest";
import {
  OBJECTIVE_ACTIONABILITY_STATE,
  buildObjectiveActionabilityModel,
} from "./objectiveActionabilityModel";

const now = new Date("2026-04-14T12:00:00");
const objective = { id: "out-1", type: "OUTCOME", categoryId: "cat-1", title: "Objectif" };

function model(overrides = {}) {
  const linkedActions = overrides.linkedActions || [];
  const occurrences = overrides.occurrences || [];
  return buildObjectiveActionabilityModel({
    objective: overrides.objective || objective,
    linkedActions,
    occurrences,
    sessionHistory: overrides.sessionHistory || [],
    activeSession: overrides.activeSession || null,
    now,
    selectedDateKey: "2026-04-14",
    state: {
      goals: [overrides.objective || objective, ...linkedActions],
      occurrences,
      sessionHistory: overrides.sessionHistory || [],
      ui: { activeSession: overrides.activeSession || null },
    },
  });
}

describe("objectiveActionabilityModel", () => {
  it("marks an objective without linked actions as needs_action", () => {
    const result = model();

    expect(result.state).toBe(OBJECTIVE_ACTIONABILITY_STATE.NEEDS_ACTION);
    expect(result.cta?.label).toBe("Ajouter une action");
    expect(result.description).toBe("Aucune action exécutable liée à cet objectif.");
  });

  it("marks a linked action without occurrences as needs_planning", () => {
    const result = model({
      linkedActions: [{ id: "act-1", type: "PROCESS", parentId: "out-1", title: "Deep work" }],
    });

    expect(result.state).toBe(OBJECTIVE_ACTIONABILITY_STATE.NEEDS_PLANNING);
    expect(result.action?.id).toBe("act-1");
    expect(result.cta?.label).toBe("Planifier");
  });

  it("marks a launchable current block as ready_to_start", () => {
    const result = model({
      linkedActions: [{ id: "act-1", type: "PROCESS", parentId: "out-1", title: "Deep work" }],
      occurrences: [{ id: "occ-1", goalId: "act-1", date: "2026-04-14", start: "12:00", status: "planned", durationMinutes: 45 }],
    });

    expect(result.state).toBe(OBJECTIVE_ACTIONABILITY_STATE.READY_TO_START);
    expect(result.cta?.label).toBe("Démarrer");
    expect(result.occurrence?.id).toBe("occ-1");
  });

  it("keeps future blocks on_track without a start CTA", () => {
    const result = model({
      linkedActions: [{ id: "act-1", type: "PROCESS", parentId: "out-1", title: "Deep work" }],
      occurrences: [{ id: "occ-1", goalId: "act-1", date: "2026-04-15", start: "10:00", status: "planned", durationMinutes: 45 }],
    });

    expect(result.state).toBe(OBJECTIVE_ACTIONABILITY_STATE.ON_TRACK);
    expect(result.cta).toBeNull();
    expect(result.description).toContain("Deep work");
  });

  it("keeps later same-day blocks on_track instead of ready_to_start", () => {
    const result = model({
      linkedActions: [{ id: "act-1", type: "PROCESS", parentId: "out-1", title: "Deep work" }],
      occurrences: [{ id: "occ-1", goalId: "act-1", date: "2026-04-14", start: "16:00", status: "planned", durationMinutes: 45 }],
    });

    expect(result.state).toBe(OBJECTIVE_ACTIONABILITY_STATE.ON_TRACK);
    expect(result.cta).toBeNull();
  });

  it("returns active_session when an open runtime belongs to the objective", () => {
    const result = model({
      linkedActions: [{ id: "act-1", type: "PROCESS", parentId: "out-1", title: "Deep work" }],
      occurrences: [{ id: "occ-1", goalId: "act-1", date: "2026-04-14", start: "10:00", status: "in_progress", durationMinutes: 45 }],
      activeSession: { occurrenceId: "occ-1", runtimePhase: "paused", status: "partial" },
    });

    expect(result.state).toBe(OBJECTIVE_ACTIONABILITY_STATE.ACTIVE_SESSION);
    expect(result.cta?.label).toBe("Reprendre");
  });

  it("marks missed linked occurrences as needs_recovery when recovery is usable", () => {
    const result = model({
      linkedActions: [{ id: "act-1", type: "PROCESS", parentId: "out-1", title: "Deep work" }],
      occurrences: [{ id: "occ-1", goalId: "act-1", date: "2026-04-14", start: "10:00", status: "missed", durationMinutes: 45 }],
    });

    expect(result.state).toBe(OBJECTIVE_ACTIONABILITY_STATE.NEEDS_RECOVERY);
    expect(result.cta?.label).toBe("Réparer");
    expect(result.recoveryContext).toBe("missed");
  });

  it("marks late planned linked occurrences as needs_recovery", () => {
    const result = model({
      linkedActions: [{ id: "act-1", type: "PROCESS", parentId: "out-1", title: "Deep work" }],
      occurrences: [{ id: "occ-1", goalId: "act-1", date: "2026-04-14", start: "09:00", status: "planned", durationMinutes: 30 }],
    });

    expect(result.state).toBe(OBJECTIVE_ACTIONABILITY_STATE.NEEDS_RECOVERY);
    expect(result.recoveryContext).toBe("late");
  });

  it("marks blocked and reported linked history as needs_recovery", () => {
    const blocked = model({
      linkedActions: [{ id: "act-1", type: "PROCESS", parentId: "out-1", title: "Deep work" }],
      occurrences: [{ id: "occ-1", goalId: "act-1", date: "2026-04-14", start: "10:00", status: "planned", durationMinutes: 45 }],
      sessionHistory: [{ id: "hist-1", occurrenceId: "occ-1", dateKey: "2026-04-14", state: "ended", endedReason: "blocked" }],
    });
    const reported = model({
      linkedActions: [{ id: "act-1", type: "PROCESS", parentId: "out-1", title: "Deep work" }],
      occurrences: [{ id: "occ-1", goalId: "act-1", date: "2026-04-14", start: "10:00", status: "planned", durationMinutes: 45 }],
      sessionHistory: [{ id: "hist-1", occurrenceId: "occ-1", dateKey: "2026-04-14", state: "ended", endedReason: "reported" }],
    });

    expect(blocked.state).toBe(OBJECTIVE_ACTIONABILITY_STATE.NEEDS_RECOVERY);
    expect(blocked.recoveryContext).toBe("blocked");
    expect(reported.state).toBe(OBJECTIVE_ACTIONABILITY_STATE.NEEDS_RECOVERY);
    expect(reported.recoveryContext).toBe("reported");
  });

  it("does not surface stale repaired sources when a valid target exists", () => {
    const result = model({
      linkedActions: [{ id: "act-1", type: "PROCESS", parentId: "out-1", title: "Deep work" }],
      occurrences: [
        {
          id: "occ-source",
          goalId: "act-1",
          date: "2026-04-13",
          start: "10:00",
          status: "missed",
          durationMinutes: 45,
          repairV1: { targetOccurrenceId: "occ-target" },
        },
        { id: "occ-target", goalId: "act-1", date: "2026-04-15", start: "10:00", status: "planned", durationMinutes: 30 },
      ],
    });

    expect(result.state).toBe(OBJECTIVE_ACTIONABILITY_STATE.ON_TRACK);
    expect(result.occurrence?.id).toBe("occ-target");
  });

  it("suppresses execution CTAs for completed and paused objectives", () => {
    const completed = model({ objective: { ...objective, status: "done" } });
    const paused = model({ objective: { ...objective, status: "paused" } });

    expect(completed.state).toBe(OBJECTIVE_ACTIONABILITY_STATE.COMPLETED);
    expect(completed.cta).toBeNull();
    expect(paused.state).toBe(OBJECTIVE_ACTIONABILITY_STATE.PAUSED);
    expect(paused.cta).toBeNull();
  });

  it("selects the planning target deterministically across multiple linked actions", () => {
    const result = model({
      linkedActions: [
        { id: "act-low", type: "PROCESS", parentId: "out-1", title: "Basse", priority: "secondaire" },
        { id: "act-high", type: "PROCESS", parentId: "out-1", title: "Haute", priority: "haute" },
        { id: "act-normal", type: "PROCESS", parentId: "out-1", title: "Normale", priority: "normal" },
      ],
    });

    expect(result.state).toBe(OBJECTIVE_ACTIONABILITY_STATE.NEEDS_PLANNING);
    expect(result.action?.id).toBe("act-high");
  });

  it("reports missing objective ids without referencing missing linked ids", () => {
    const result = buildObjectiveActionabilityModel({
      objective: { type: "OUTCOME", title: "Sans id" },
      linkedActions: [{ title: "Sans id" }],
      now,
    });

    expect(result.state).toBe(OBJECTIVE_ACTIONABILITY_STATE.NEEDS_ACTION);
    expect(result.issues).toContain("objective_missing_id");
  });
});
