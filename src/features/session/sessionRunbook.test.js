import { describe, expect, it } from "vitest";
import {
  buildSessionRunbookV1,
  deriveGuidedCurrentStep,
  normalizeSessionBlueprintSnapshot,
} from "./sessionRunbook";

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

describe("sessionRunbook", () => {
  it("normalizes a persisted blueprint snapshot for launch use", () => {
    expect(
      normalizeSessionBlueprintSnapshot({
        protocolType: "deep_work",
        why: "avancer sur un levier concret",
        firstStep: "ouvre la sous-partie exacte",
        ifBlocked: "réduis le scope",
        successDefinition: "une avancée visible existe",
        estimatedMinutes: 45,
      })
    ).toEqual({
      version: 1,
      protocolType: "deep_work",
      why: "avancer sur un levier concret",
      firstStep: "ouvre la sous-partie exacte",
      ifBlocked: "réduis le scope",
      successDefinition: "une avancée visible existe",
      estimatedMinutes: 45,
    });
  });

  it("builds a 3-step sport runbook with exact duration", () => {
    const runbook = buildSessionRunbookV1({
      blueprintSnapshot: makeBlueprint(),
      occurrence: { id: "occ_1", goalId: "goal_1", date: "2026-04-10", durationMinutes: 20 },
      action: { id: "goal_1", title: "Séance de sport rapide de 20 minutes" },
      category: { id: "cat_sport", name: "Sport" },
    });

    expect(runbook).toMatchObject({
      version: 1,
      protocolType: "sport",
      occurrenceId: "occ_1",
      actionId: "goal_1",
      title: "Séance de sport rapide de 20 minutes",
      categoryName: "Sport",
      durationMinutes: 20,
    });
    expect(runbook.steps.map((step) => step.label)).toEqual([
      "Échauffement",
      "Phase principale",
      "Retour au calme",
    ]);
    expect(runbook.steps.reduce((sum, step) => sum + step.minutes, 0)).toBe(20);
  });

  it("maps deep work blocks to opening, main block, and close", () => {
    const runbook = buildSessionRunbookV1({
      blueprintSnapshot: makeBlueprint({
        protocolType: "deep_work",
        why: "avancer sur un levier concret",
        firstStep: "ouvre la sous-partie exacte",
        ifBlocked: "réduis le scope",
        successDefinition: "une avancée visible existe",
        estimatedMinutes: 45,
      }),
      occurrence: { id: "occ_2", goalId: "goal_2", date: "2026-04-10", durationMinutes: 45 },
      action: { id: "goal_2", title: "Finaliser la landing page" },
      category: { id: "cat_business", name: "Business" },
    });

    expect(runbook.steps.map((step) => step.label)).toEqual(["Ouverture", "Bloc principal", "Clôture"]);
    expect(runbook.steps[1].minutes).toBeGreaterThan(runbook.steps[0].minutes);
  });

  it("derives the current guided step from elapsed seconds", () => {
    const runbook = buildSessionRunbookV1({
      blueprintSnapshot: makeBlueprint(),
      occurrence: { id: "occ_1", goalId: "goal_1", date: "2026-04-10", durationMinutes: 20 },
      action: { id: "goal_1", title: "Séance de sport rapide de 20 minutes" },
      category: { id: "cat_sport", name: "Sport" },
    });

    const idle = deriveGuidedCurrentStep({ sessionRunbookV1: runbook, elapsedSec: 0 });
    const middle = deriveGuidedCurrentStep({ sessionRunbookV1: runbook, elapsedSec: 8 * 60 });

    expect(idle.currentStepIndex).toBe(0);
    expect(idle.currentStep.label).toBe("Échauffement");
    expect(middle.currentStepIndex).toBe(1);
    expect(middle.currentStep.label).toBe("Phase principale");
  });
});
