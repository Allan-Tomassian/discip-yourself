import { describe, expect, it } from "vitest";
import { buildSessionRunbookV1 } from "./sessionRunbook";
import {
  activateGuidedSpatialState,
  advanceGuidedSpatialStep,
  createGuidedSpatialState,
  deriveGuidedSpatialPlan,
  rebaseGuidedSpatialState,
  returnGuidedSpatialToActive,
  setGuidedSpatialViewedStep,
  syncGuidedSpatialStateWithElapsed,
  toggleGuidedSpatialChecklistItem,
} from "./sessionSpatialRuntime";

function makeBlueprint(overrides = {}) {
  return {
    version: 1,
    protocolType: "sport",
    why: "activer ton énergie et tenir le rythme",
    firstStep: "commence par 3 min d’échauffement",
    ifBlocked: "fais la version courte",
    successDefinition: "séance tenue ou version courte assumée",
    estimatedMinutes: 20,
    ...overrides,
  };
}

function makeRunbook({
  protocolType = "sport",
  title = "Faire une marche rapide de 30 minutes",
  durationMinutes = 20,
  categoryId = "cat_sport",
  categoryName = "Sport",
} = {}) {
  return buildSessionRunbookV1({
    blueprintSnapshot: makeBlueprint({
      protocolType,
      why:
        protocolType === "deep_work"
          ? "sortir une structure claire et exploitable"
          : "activer ton énergie et tenir le rythme",
      firstStep:
        protocolType === "deep_work"
          ? "rouvre la zone utile et fixe le point d’entrée"
          : "commence par 3 min d’échauffement",
      ifBlocked:
        protocolType === "deep_work"
          ? "réduis à une première trame"
          : "fais la version courte",
      successDefinition:
        protocolType === "deep_work"
          ? "une base exploitable existe"
          : "séance tenue ou version courte assumée",
      estimatedMinutes: durationMinutes,
    }),
    occurrence: { id: `occ_${protocolType}`, goalId: `goal_${protocolType}`, date: "2026-04-11", durationMinutes },
    action: { id: `goal_${protocolType}`, title },
    category: { id: categoryId, name: categoryName },
  });
}

describe("sessionSpatialRuntime", () => {
  it("creates a preview spatial state from the runbook structure", () => {
    const runbook = makeRunbook();
    const state = createGuidedSpatialState({
      sessionRunbook: runbook,
      mode: "preview",
      nowMs: 1234,
    });
    const plan = deriveGuidedSpatialPlan({
      sessionRunbook: runbook,
      guidedSpatialState: state,
      elapsedSec: 0,
    });

    expect(state).toMatchObject({
      mode: "preview",
      viewedStepIndex: 0,
      activeStepIndex: 0,
      lastPreparedAtMs: 1234,
    });
    expect(plan).toMatchObject({
      mode: "preview",
      totalSteps: 3,
      viewedStepIndex: 0,
      activeStepIndex: 0,
      isViewedStepActive: true,
    });
    expect(plan.steps[0].progressKind).toBe("timed");
  });

  it("auto-advances timed sport steps when the elapsed budget is consumed", () => {
    const runbook = makeRunbook();
    const firstStepDurationSec = runbook.steps[0].minutes * 60;
    let state = createGuidedSpatialState({ sessionRunbook: runbook, mode: "preview" });
    state = activateGuidedSpatialState({
      sessionRunbook: runbook,
      guidedSpatialState: state,
      elapsedSec: 0,
    });
    state = syncGuidedSpatialStateWithElapsed({
      sessionRunbook: runbook,
      guidedSpatialState: state,
      elapsedSec: firstStepDurationSec,
    });
    const plan = deriveGuidedSpatialPlan({
      sessionRunbook: runbook,
      guidedSpatialState: state,
      elapsedSec: firstStepDurationSec,
    });

    expect(plan.activeStepIndex).toBe(1);
    expect(plan.steps[0].state).toBe("done");
    expect(plan.steps[1].isActive).toBe(true);
  });

  it("keeps elapsed sync idempotent when the active step state did not change", () => {
    const runbook = makeRunbook();
    let state = createGuidedSpatialState({ sessionRunbook: runbook, mode: "preview" });
    state = activateGuidedSpatialState({
      sessionRunbook: runbook,
      guidedSpatialState: state,
      elapsedSec: 0,
    });

    const nextState = syncGuidedSpatialStateWithElapsed({
      sessionRunbook: runbook,
      guidedSpatialState: state,
      elapsedSec: 30,
    });

    expect(nextState).toBe(state);
  });

  it("tracks checklist progress locally without mutating the runbook", () => {
    const runbook = makeRunbook({
      protocolType: "deep_work",
      title: "Structurer la note produit",
      durationMinutes: 30,
      categoryId: "cat_work",
      categoryName: "Travail",
    });
    const runbookSnapshot = JSON.stringify(runbook);
    let state = createGuidedSpatialState({ sessionRunbook: runbook, mode: "preview" });
    state = activateGuidedSpatialState({
      sessionRunbook: runbook,
      guidedSpatialState: state,
      elapsedSec: 0,
    });

    let plan = deriveGuidedSpatialPlan({
      sessionRunbook: runbook,
      guidedSpatialState: state,
      elapsedSec: 0,
    });
    expect(plan.activeStep.progressKind).toBe("checklist");

    const firstItemId = plan.activeStep.items[0].id;
    state = toggleGuidedSpatialChecklistItem({
      guidedSpatialState: state,
      sessionRunbook: runbook,
      stepId: plan.activeStep.id,
      itemId: firstItemId,
    });
    plan = deriveGuidedSpatialPlan({
      sessionRunbook: runbook,
      guidedSpatialState: state,
      elapsedSec: 0,
    });

    expect(plan.activeStep.items[0].checked).toBe(true);
    expect(plan.activeStep.progressLabel).toContain("1/");
    expect(JSON.stringify(runbook)).toBe(runbookSnapshot);

    state = advanceGuidedSpatialStep({
      guidedSpatialState: state,
      sessionRunbook: runbook,
      elapsedSec: 180,
    });
    plan = deriveGuidedSpatialPlan({
      sessionRunbook: runbook,
      guidedSpatialState: state,
      elapsedSec: 180,
    });

    expect(plan.activeStepIndex).toBe(1);
    expect(plan.viewedStepIndex).toBe(1);
  });

  it("keeps the consulted slide separate from the active step until recentered", () => {
    const runbook = makeRunbook();
    let state = createGuidedSpatialState({ sessionRunbook: runbook, mode: "preview" });
    state = activateGuidedSpatialState({
      sessionRunbook: runbook,
      guidedSpatialState: state,
      elapsedSec: 0,
    });
    state = setGuidedSpatialViewedStep({
      guidedSpatialState: state,
      sessionRunbook: runbook,
      stepIndex: 1,
    });

    let plan = deriveGuidedSpatialPlan({
      sessionRunbook: runbook,
      guidedSpatialState: state,
      elapsedSec: 0,
    });

    expect(plan.activeStepIndex).toBe(0);
    expect(plan.viewedStepIndex).toBe(1);
    expect(plan.isViewedStepActive).toBe(false);
    expect(plan.canReturnToActiveStep).toBe(true);

    state = returnGuidedSpatialToActive({
      guidedSpatialState: state,
      sessionRunbook: runbook,
    });
    plan = deriveGuidedSpatialPlan({
      sessionRunbook: runbook,
      guidedSpatialState: state,
      elapsedSec: 0,
    });

    expect(plan.viewedStepIndex).toBe(0);
    expect(plan.isViewedStepActive).toBe(true);
  });

  it("rebases the active and viewed steps onto an equivalent next runbook", () => {
    const previousRunbook = makeRunbook({ durationMinutes: 20 });
    const nextRunbook = makeRunbook({ durationMinutes: 25 });
    let state = createGuidedSpatialState({ sessionRunbook: previousRunbook, mode: "preview" });
    state = activateGuidedSpatialState({
      sessionRunbook: previousRunbook,
      guidedSpatialState: state,
      elapsedSec: 0,
    });
    state = advanceGuidedSpatialStep({
      guidedSpatialState: state,
      sessionRunbook: previousRunbook,
      elapsedSec: previousRunbook.steps[0].minutes * 60,
    });

    const rebased = rebaseGuidedSpatialState({
      guidedSpatialState: state,
      previousRunbook,
      nextRunbook,
      mode: "active",
      elapsedSec: 300,
    });
    const plan = deriveGuidedSpatialPlan({
      sessionRunbook: nextRunbook,
      guidedSpatialState: rebased,
      elapsedSec: 300,
    });

    expect(plan.activeStepIndex).toBe(1);
    expect(plan.viewedStepIndex).toBe(1);
    expect(plan.activeStep.label).toBe(nextRunbook.steps[1].label);
  });
});
