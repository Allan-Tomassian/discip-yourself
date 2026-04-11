import { describe, expect, it } from "vitest";
import { buildSessionRunbookV1, deriveGuidedCurrentStep } from "./sessionRunbook";
import {
  SESSION_TOOL_IDS,
  buildSessionToolPlan,
  deriveRecommendedSessionTools,
  executeLocalSessionTool,
} from "./sessionTools";

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

function makeSportRunbook() {
  return buildSessionRunbookV1({
    blueprintSnapshot: makeBlueprint(),
    occurrence: { id: "occ_sport", goalId: "goal_sport", date: "2026-04-11", durationMinutes: 20 },
    action: { id: "goal_sport", title: "Faire une marche rapide de 30 minutes" },
    category: { id: "cat_sport", name: "Sport" },
  });
}

function makeDeepWorkRunbook() {
  return buildSessionRunbookV1({
    blueprintSnapshot: makeBlueprint({
      protocolType: "deep_work",
      why: "sortir une structure claire",
      firstStep: "rouvre la zone utile",
      ifBlocked: "réduis au plus petit livrable",
      successDefinition: "une base exploitable existe",
      estimatedMinutes: 30,
    }),
    occurrence: { id: "occ_dw", goalId: "goal_dw", date: "2026-04-11", durationMinutes: 30 },
    action: { id: "goal_dw", title: "Structurer la note produit" },
    category: { id: "cat_work", name: "Travail" },
  });
}

describe("sessionTools", () => {
  it("builds a guided-only local tool plan from the runbook structure", () => {
    const runbook = makeSportRunbook();
    const toolPlan = buildSessionToolPlan({ sessionRunbook: runbook });

    expect(toolPlan).toMatchObject({
      version: 1,
      source: "local_fallback",
    });
    expect(toolPlan.catalog.length).toBeGreaterThanOrEqual(5);
    expect(toolPlan.recommendations.some((entry) => entry.toolId === SESSION_TOOL_IDS.ITEM_TIMER)).toBe(true);
  });

  it("derives at most three visible tools for the current guided item", () => {
    const runbook = makeSportRunbook();
    const guidedPlan = deriveGuidedCurrentStep({ sessionRunbook: runbook, elapsedSec: 0 });
    const toolPlan = buildSessionToolPlan({ sessionRunbook: runbook });

    const visible = deriveRecommendedSessionTools({
      sessionToolPlan: toolPlan,
      guidedPlan,
      accessToken: "",
    });

    expect(visible.length).toBeGreaterThan(0);
    expect(visible.length).toBeLessThanOrEqual(3);
    expect(visible[0].toolId).toBe(SESSION_TOOL_IDS.ITEM_TIMER);
  });

  it("produces a concrete checklist artifact without mutating the runbook", () => {
    const runbook = makeDeepWorkRunbook();
    const snapshot = JSON.stringify(runbook);
    const guidedPlan = deriveGuidedCurrentStep({ sessionRunbook: runbook, elapsedSec: 0 });

    const result = executeLocalSessionTool({
      toolId: SESSION_TOOL_IDS.CHECKLIST_TARGETED,
      sessionRunbook: runbook,
      guidedPlan,
    });

    expect(result?.kind).toBe("artifact");
    expect(result?.artifact).toMatchObject({
      outputKind: "support_artifact",
      artifactType: "checklist",
    });
    expect(result?.artifact.copyText).toMatch(/- \[ \]/);
    expect(JSON.stringify(runbook)).toBe(snapshot);
  });

  it("creates a local utility timer for the current item", () => {
    const runbook = makeSportRunbook();
    const guidedPlan = deriveGuidedCurrentStep({ sessionRunbook: runbook, elapsedSec: 0 });

    const result = executeLocalSessionTool({
      toolId: SESSION_TOOL_IDS.ITEM_TIMER,
      sessionRunbook: runbook,
      guidedPlan,
    });

    expect(result?.kind).toBe("utility");
    expect(result?.utility).toMatchObject({
      outputKind: "utility_active",
      utilityType: "item_timer",
      state: "idle",
    });
    expect(result?.utility.durationSec).toBeGreaterThan(0);
  });
});

