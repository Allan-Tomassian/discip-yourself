import { describe, expect, it } from "vitest";
import {
  buildSessionRunbookV1,
  deriveGuidedCurrentStep,
  normalizePreparedSessionRunbook,
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

  it("builds a richer sport fallback runbook with objective, steps, and items", () => {
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
      source: "deterministic_fallback",
      objective: {
        why: "activer ton énergie et tenir le rythme",
        successDefinition: "séance tenue ou version courte assumée",
      },
    });
    expect(runbook.steps.map((step) => step.label)).toEqual([
      "Échauffement",
      "Bloc principal",
      "Retour au calme",
    ]);
    expect(runbook.steps.reduce((sum, step) => sum + step.minutes, 0)).toBe(20);
    expect(runbook.steps[1].items.length).toBeGreaterThan(1);
    expect(runbook.steps.flatMap((step) => step.items).length).toBeGreaterThanOrEqual(6);
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

  it("normalizes a prepared v2 runbook only when density stays within bounds", () => {
    const prepared = normalizePreparedSessionRunbook({
      version: 2,
      protocolType: "deep_work",
      occurrenceId: "occ_3",
      actionId: "goal_3",
      dateKey: "2026-04-10",
      title: "Finaliser la landing page",
      categoryName: "Business",
      objective: {
        why: "sortir une version livrable",
        successDefinition: "une version publiable existe",
      },
      steps: [
        {
          label: "Ouverture",
          purpose: "rétablir le bon contexte",
          successCue: "point d’entrée clair",
          items: [
            { label: "Relire la zone utile", minutes: 2, guidance: "rouvre uniquement la partie exacte" },
            { label: "Fixer le point d’entrée", minutes: 1, guidance: "choisis le prochain sous-bloc" },
          ],
        },
        {
          label: "Bloc principal",
          purpose: "avancer sur le coeur du livrable",
          successCue: "un sous-livrable concret existe",
          items: [
            { label: "Premier passage", minutes: 8, guidance: "attaque le point le plus utile" },
            { label: "Passage critique", minutes: 10, guidance: "pousse jusqu’au vrai déblocage" },
            { label: "Trace exploitable", minutes: 4, guidance: "laisse quelque chose de réutilisable" },
          ],
        },
        {
          label: "Clôture",
          purpose: "préparer la reprise",
          successCue: "suite lisible",
          items: [
            { label: "Noter la reprise", minutes: 2, guidance: "écris la prochaine action" },
            { label: "Nettoyer le contexte", minutes: 1, guidance: "garde seulement l’essentiel" },
          ],
        },
      ],
    });

    expect(prepared).toMatchObject({
      version: 2,
      source: "ai_prepared",
      durationMinutes: 28,
    });
    expect(prepared.steps).toHaveLength(3);
    expect(prepared.steps[1].items).toHaveLength(3);
  });

  it("derives the current guided item from elapsed seconds", () => {
    const runbook = buildSessionRunbookV1({
      blueprintSnapshot: makeBlueprint(),
      occurrence: { id: "occ_1", goalId: "goal_1", date: "2026-04-10", durationMinutes: 20 },
      action: { id: "goal_1", title: "Séance de sport rapide de 20 minutes" },
      category: { id: "cat_sport", name: "Sport" },
    });

    const idle = deriveGuidedCurrentStep({ sessionRunbook: runbook, elapsedSec: 0 });
    const middle = deriveGuidedCurrentStep({ sessionRunbook: runbook, elapsedSec: 8 * 60 });

    expect(idle.currentStepIndex).toBe(0);
    expect(idle.currentStep.label).toBe("Échauffement");
    expect(idle.currentItem).toBeTruthy();
    expect(idle.currentItemProgress01).toBeGreaterThanOrEqual(0);
    expect(middle.currentStepIndex).toBe(1);
    expect(middle.currentStep.label).toBe("Bloc principal");
    expect(middle.currentItem).toBeTruthy();
    expect(middle.nextItem || null).not.toBe(undefined);
  });
});
