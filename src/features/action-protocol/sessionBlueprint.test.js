import { describe, expect, it } from "vitest";
import {
  buildPersistedSessionBlueprint,
  buildSessionBlueprintDraft,
  normalizePrimaryActionRef,
  normalizeSessionBlueprintDraft,
} from "./sessionBlueprint";

describe("sessionBlueprint", () => {
  it("selects the first action by default when a proposal has actionable drafts", () => {
    expect(
      normalizePrimaryActionRef(null, [{ title: "Bloc 1" }, { title: "Bloc 2" }])
    ).toEqual({ index: 0 });
  });

  it("builds a coach blueprint draft from action protocol v1", () => {
    expect(
      buildSessionBlueprintDraft({
        actionDraft: {
          title: "Gym session upper body",
          repeat: "weekly",
          durationMinutes: 20,
        },
        categoryName: "Sport",
      })
    ).toEqual({
      version: 1,
      source: "action_protocol_v1",
      protocolType: "sport",
      why: "activer ton énergie et tenir le rythme",
      firstStep: "commence par 3 min d’échauffement",
      ifBlocked: "fais la version courte",
      successDefinition: "séance tenue ou version courte assumée",
      estimatedMinutes: 20,
    });
  });

  it("normalizes an explicit blueprint draft while keeping the action protocol grammar", () => {
    expect(
      normalizeSessionBlueprintDraft(
        {
          protocolType: "deep_work",
          why: "avancer sur un levier concret",
          firstStep: "ouvre la première sous-partie précise",
          ifBlocked: "réduis le scope à un sous-livrable",
          successDefinition: "une avancée visible est produite",
          estimatedMinutes: 50,
        },
        { fallback: null }
      )
    ).toEqual({
      version: 1,
      source: "action_protocol_v1",
      protocolType: "deep_work",
      why: "avancer sur un levier concret",
      firstStep: "ouvre la première sous-partie précise",
      ifBlocked: "réduis le scope à un sous-livrable",
      successDefinition: "une avancée visible est produite",
      estimatedMinutes: 50,
    });
  });

  it("builds the persisted session blueprint payload for a created action", () => {
    expect(
      buildPersistedSessionBlueprint({
        actionDraft: {
          title: "Build onboarding MVP",
          durationMinutes: 50,
        },
        categoryName: "Business",
        conversationId: "conv_1",
      })
    ).toEqual({
      version: 1,
      status: "validated",
      source: "coach_plan",
      protocolType: "deep_work",
      why: "avancer sur un levier concret",
      firstStep: "ouvre la première sous-partie précise",
      ifBlocked: "réduis le scope à un sous-livrable",
      successDefinition: "une avancée visible est produite",
      estimatedMinutes: 50,
      conversationId: "conv_1",
    });
  });
});
