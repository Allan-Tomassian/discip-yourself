import { describe, expect, it } from "vitest";
import { SYSTEM_SIGNAL_SEVERITY, SYSTEM_SIGNAL_TYPE } from "../../logic/systemSignals";
import { RECOVERY_CONTEXT } from "../recovery/recoveryTypes";
import { ADJUST_ACTION_IDS, buildAdjustDiagnostic } from "./adjustDiagnostic";
import { buildAdjustPresentationModel } from "./adjustPresentationModel";

const ACTIVE_DATE = "2026-05-20";

function baseState(overrides = {}) {
  return {
    categories: [{ id: "cat_work", name: "Travail" }],
    goals: [
      {
        id: "goal_focus",
        type: "PROCESS",
        title: "Focus profond",
        categoryId: "cat_work",
        durationMinutes: 45,
      },
    ],
    occurrences: [],
    ui: { selectedDateKey: ACTIVE_DATE },
    ...overrides,
  };
}

describe("buildAdjustPresentationModel", () => {
  it("promotes a valid concrete recovery request to the primary action", () => {
    const diagnostic = buildAdjustDiagnostic(
      baseState({
        occurrences: [
          {
            id: "occ_missed",
            goalId: "goal_focus",
            categoryId: "cat_work",
            date: ACTIVE_DATE,
            start: "09:00",
            durationMinutes: 45,
            status: "missed",
          },
        ],
      }),
      ACTIVE_DATE
    );

    const model = buildAdjustPresentationModel({
      diagnostic,
      recoveryRequest: {
        occurrenceId: "occ_missed",
        context: RECOVERY_CONTEXT.MISSED,
        source: "adjust",
      },
    });

    expect(model.primaryDiagnosis).toMatchObject({
      eyebrow: "CE QUI BLOQUE",
      title: "Bloc manqué",
      tone: "attention",
    });
    expect(model.evidence).toBe("1 bloc manqué aujourd’hui.");
    expect(model.primaryAction).toMatchObject({
      kind: "recovery",
      label: "Réparer ce bloc",
      actionId: null,
    });
    expect(model.recoveryRequest?.occurrenceId).toBe("occ_missed");
  });

  it("keeps the existing deterministic recommendation when no recovery request exists", () => {
    const diagnostic = buildAdjustDiagnostic(
      baseState({
        occurrences: [
          { id: "occ_1", goalId: "goal_focus", date: ACTIVE_DATE, start: "13:00", status: "planned", durationMinutes: 75 },
          { id: "occ_2", goalId: "goal_focus", date: ACTIVE_DATE, start: "18:00", status: "planned", durationMinutes: 75 },
        ],
      }),
      ACTIVE_DATE
    );

    const model = buildAdjustPresentationModel({ diagnostic });

    expect(diagnostic.recommendation.actionId).toBe(ADJUST_ACTION_IDS.SIMPLIFY_DAY);
    expect(model.primaryAction).toMatchObject({
      kind: "recommendation",
      label: "Simplifier la journée",
      actionId: ADJUST_ACTION_IDS.SIMPLIFY_DAY,
    });
    expect(model.recoveryRequest).toBeNull();
  });

  it("keeps System Analysis as a secondary header entry", () => {
    const diagnostic = buildAdjustDiagnostic(baseState(), ACTIVE_DATE);
    const model = buildAdjustPresentationModel({
      diagnostic,
      systemAnalysisEntry: { placement: "header", priority: "secondary", state: "available" },
    });

    expect(model.systemAnalysisEntry).toEqual({
      placement: "header",
      priority: "secondary",
      state: "available",
    });
    expect(model.primaryAction.label).not.toMatch(/Analyse système/i);
  });

  it("uses concise evidence from existing signals without inventing a problem", () => {
    const diagnostic = buildAdjustDiagnostic(baseState(), ACTIVE_DATE);
    const calm = buildAdjustPresentationModel({ diagnostic });

    expect(calm.primaryDiagnosis.title).toBe("Signal faible");
    expect(calm.primaryDiagnosis.eyebrow).toBe("ÉTAT DU SYSTÈME");
    expect(calm.evidence).toContain("Ouvre Planning");

    const signaled = buildAdjustPresentationModel({
      diagnostic: {
        ...diagnostic,
        systemSignals: [
          {
            id: "blocked",
            type: SYSTEM_SIGNAL_TYPE.BLOCKED_BLOCK,
            severity: SYSTEM_SIGNAL_SEVERITY.ATTENTION,
            title: "Bloc bloqué",
            message: "Un bloc a rencontré une friction d’exécution.",
          },
        ],
      },
    });

    expect(signaled.primaryDiagnosis.title).toBe("Bloc bloqué");
    expect(signaled.evidence).toBe("Un bloc a rencontré une friction d’exécution.");
  });

  it("represents secondary data in collapsed detail sections without a duplicate recommendation section", () => {
    const diagnostic = buildAdjustDiagnostic(
      baseState({
        occurrences: [
          { id: "occ_missed", goalId: "goal_focus", date: ACTIVE_DATE, start: "09:00", status: "missed", durationMinutes: 45 },
          { id: "occ_next", goalId: "goal_focus", date: ACTIVE_DATE, start: "14:00", status: "planned", durationMinutes: 45 },
        ],
      }),
      ACTIVE_DATE
    );

    const model = buildAdjustPresentationModel({ diagnostic });
    const sections = Object.fromEntries(model.detailSections.map((section) => [section.id, section]));

    expect(Object.keys(sections)).toEqual(["signals", "trends", "actions", "diagnostic"]);
    expect(sections.signals.items.length).toBe(diagnostic.frictionSignals.length);
    expect(sections.trends.trendSnapshot).toBe(diagnostic.trendSnapshot);
    expect(sections.trends.categorySignals).toBe(diagnostic.categorySignals);
    expect(sections.actions.actions.some((action) => action.id === model.primaryAction.actionId)).toBe(false);
    expect(sections.diagnostic.metrics.map((metric) => metric.id)).toEqual([
      "planned",
      "done",
      "missed_reported",
      "remaining",
    ]);
    expect(model.detailSections.map((section) => section.title)).not.toContain("Recommandation");
  });
});
