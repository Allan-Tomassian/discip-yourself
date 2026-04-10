import { describe, expect, it } from "vitest";
import { buildSessionRunbookV1 } from "./sessionRunbook";
import {
  applyGuidedAdjustmentLocally,
  applyStandardAdjustmentLocally,
  buildGuidedAdjustmentOptions,
  buildStandardAdjustmentOptions,
} from "./sessionAdjustments";

function makeRunbook() {
  return buildSessionRunbookV1({
    blueprintSnapshot: {
      version: 1,
      protocolType: "sport",
      why: "activer ton énergie et tenir le rythme",
      firstStep: "commence par 3 min d’échauffement",
      ifBlocked: "fais la version courte",
      successDefinition: "séance tenue ou version courte assumée",
      estimatedMinutes: 20,
    },
    occurrence: { id: "occ_1", goalId: "goal_1", date: "2026-04-10", durationMinutes: 20 },
    action: { id: "goal_1", title: "Séance de sport rapide de 20 minutes" },
    category: { id: "cat_sport", name: "Sport" },
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
});
