import { describe, expect, it } from "vitest";
import { buildSessionRunbookV1 } from "./sessionRunbook";
import {
  activateGuidedSpatialState,
  advanceGuidedSpatialStep,
  createGuidedSpatialState,
} from "./sessionSpatialRuntime";
import {
  applyGuidedAdjustmentLocally,
  applyStandardAdjustmentLocally,
  buildGuidedAdjustmentOptions,
  buildStandardAdjustmentOptions,
} from "./sessionAdjustments";

function makeRunbook(protocolType = "sport") {
  return buildSessionRunbookV1({
    blueprintSnapshot: {
      version: 1,
      protocolType,
      why:
        protocolType === "deep_work"
          ? "sortir une base claire et exploitable"
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
      estimatedMinutes: protocolType === "deep_work" ? 30 : 20,
    },
    occurrence: {
      id: "occ_1",
      goalId: "goal_1",
      date: "2026-04-10",
      durationMinutes: protocolType === "deep_work" ? 30 : 20,
    },
    action: {
      id: "goal_1",
      title:
        protocolType === "deep_work"
          ? "Structurer la note produit"
          : "Séance de sport rapide de 20 minutes",
    },
    category: {
      id: protocolType === "deep_work" ? "cat_work" : "cat_sport",
      name: protocolType === "deep_work" ? "Travail" : "Sport",
    },
  });
}

describe("sessionAdjustments", () => {
  it("builds standard local options without generating a runbook", () => {
    const options = buildStandardAdjustmentOptions({
      cause: "less_time",
      plannedMinutes: 20,
      remainingMinutes: 20,
      actionProtocol: {
        why: "tenir le cap",
        firstStep: "ouvre le bloc utile",
        ifBlocked: "réduis le scope",
        successDefinition: "progression visible",
      },
    });

    expect(options.map((option) => option.label)).toEqual(["Version courte", "Version condensée"]);
    expect(options[0].protocolOverride.firstStep).toContain("coeur du bloc");
  });

  it("applies a standard local adjustment with a summary and protocol override", () => {
    const adjustment = applyStandardAdjustmentLocally({
      cause: "blocked",
      strategyId: "restart",
      plannedMinutes: 20,
      remainingMinutes: 12,
      actionProtocol: {
        why: "tenir le cap",
        firstStep: "ouvre le bloc utile",
        ifBlocked: "réduis le scope",
        successDefinition: "progression visible",
      },
    });

    expect(adjustment).toMatchObject({
      kind: "standard",
      label: "Relance concrète",
      strategyId: "restart",
    });
    expect(adjustment.protocolOverride.firstStep).toContain("2 minutes");
  });

  it("builds guided options from the current runbook and elapsed time", () => {
    const options = buildGuidedAdjustmentOptions({
      cause: "less_time",
      sessionRunbook: makeRunbook(),
      elapsedSec: 8 * 60,
    });

    expect(options.map((option) => option.strategyId)).toEqual([
      "shorten_keep_core",
      "compress_from_now",
    ]);
  });

  it("patches the guided runbook locally when shortening the remaining block", () => {
    const runbook = makeRunbook();
    const result = applyGuidedAdjustmentLocally({
      cause: "less_time",
      strategyId: "shorten_keep_core",
      sessionRunbook: runbook,
      elapsedSec: 7 * 60,
    });

    expect(result.adjustment).toMatchObject({
      kind: "guided",
      strategyId: "shorten_keep_core",
      runbookPatch: {
        version: 1,
        stepCount: expect.any(Number),
        itemCount: expect.any(Number),
      },
    });
    expect(result.sessionRunbook.durationMinutes).toBeLessThan(runbook.durationMinutes);
  });

  it("softens future sport segments when energy is lower", () => {
    const runbook = makeRunbook();
    const result = applyGuidedAdjustmentLocally({
      cause: "less_energy",
      strategyId: "lower_intensity_keep_goal",
      sessionRunbook: runbook,
      elapsedSec: 6 * 60,
    });

    const futureItems = result.sessionRunbook.steps.flatMap((step) => step.items);
    expect(result.adjustment.label).toBe("Baisser l’intensité");
    expect(futureItems.some((item) => (item.restSec || 0) >= 30)).toBe(true);
  });

  it("anchors guided adjustment on the spatial active step instead of the legacy elapsed step", () => {
    const runbook = makeRunbook("deep_work");
    let guidedSpatialState = createGuidedSpatialState({
      sessionRunbook: runbook,
      mode: "preview",
    });
    guidedSpatialState = activateGuidedSpatialState({
      sessionRunbook: runbook,
      guidedSpatialState,
      elapsedSec: 0,
    });
    guidedSpatialState = advanceGuidedSpatialStep({
      sessionRunbook: runbook,
      guidedSpatialState,
      elapsedSec: 180,
    });

    const result = applyGuidedAdjustmentLocally({
      cause: "blocked",
      strategyId: "recenter_on_subsegment",
      sessionRunbook: runbook,
      guidedSpatialState,
      elapsedSec: 180,
    });

    expect(result.currentState.currentStepIndex).toBe(1);
    expect(result.currentState.currentStep.id).toBe(runbook.steps[1].id);
  });
});
