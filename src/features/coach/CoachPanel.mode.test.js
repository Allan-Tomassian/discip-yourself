import { describe, expect, it } from "vitest";
import {
  buildDismissWorkIntentTransition,
  buildQuickCreateIntentTransition,
  buildCoachRequestedModeIntentKey,
  buildCoachRequestedPrefillIntentKey,
  buildStructuringIntentTransition,
  normalizeCoachRequestedMode,
  normalizeCoachRequestedPrefill,
  shouldApplyCoachRequestedMode,
  shouldApplyCoachRequestedPrefill,
  shouldClearDraftOnDismissWorkIntent,
  toggleCoachPlanMode,
} from "./coachPanelController.js";

describe("CoachPanel mode control", () => {
  it("toggle Plan bascule entre free et plan", () => {
    expect(toggleCoachPlanMode("free")).toBe("plan");
    expect(toggleCoachPlanMode("plan")).toBe("free");
  });

  it("normalise requestedMode sur free par defaut", () => {
    expect(normalizeCoachRequestedMode("plan")).toBe("plan");
    expect(normalizeCoachRequestedMode("free")).toBe("free");
    expect(normalizeCoachRequestedMode("other")).toBe("free");
  });

  it("applique requestedMode une seule fois par ouverture", () => {
    const intentKey = buildCoachRequestedModeIntentKey({
      openCycle: 2,
      requestedConversationId: "conv_1",
      requestedMode: "plan",
    });

    expect(
      shouldApplyCoachRequestedMode({
        open: true,
        openCycle: 2,
        requestedConversationId: "conv_1",
        currentConversationId: "conv_1",
        requestedMode: "plan",
        lastAppliedIntentKey: "",
      })
    ).toEqual({
      shouldApply: true,
      intentKey,
      normalizedMode: "plan",
    });

    expect(
      shouldApplyCoachRequestedMode({
        open: true,
        openCycle: 2,
        requestedConversationId: "conv_1",
        currentConversationId: "conv_1",
        requestedMode: "plan",
        lastAppliedIntentKey: intentKey,
      })
    ).toEqual({
      shouldApply: false,
      intentKey,
      normalizedMode: "plan",
    });
  });

  it("attend la bonne conversation avant de reappliquer requestedMode", () => {
    expect(
      shouldApplyCoachRequestedMode({
        open: true,
        openCycle: 3,
        requestedConversationId: "conv_target",
        currentConversationId: "conv_other",
        requestedMode: "plan",
        lastAppliedIntentKey: "",
      })
    ).toEqual({
      shouldApply: false,
      intentKey: "3:conv_target:plan",
      normalizedMode: "plan",
    });
  });

  it("normalise requestedPrefill et l'applique une seule fois sur un draft vide, meme avec historique", () => {
    expect(normalizeCoachRequestedPrefill("  Clarifier mon prochain bloc  ")).toBe("Clarifier mon prochain bloc");
    const intentKey = buildCoachRequestedPrefillIntentKey({
      openCycle: 4,
      requestedConversationId: "conv_1",
      requestedPrefill: "Clarifier mon prochain bloc",
    });

    expect(
      shouldApplyCoachRequestedPrefill({
        open: true,
        openCycle: 4,
        requestedConversationId: "conv_1",
        currentConversationId: "conv_1",
        requestedPrefill: "Clarifier mon prochain bloc",
        draft: "",
        hasMessages: true,
        lastAppliedIntentKey: "",
      })
    ).toEqual({
      shouldApply: true,
      intentKey,
      normalizedPrefill: "Clarifier mon prochain bloc",
    });

    expect(
      shouldApplyCoachRequestedPrefill({
        open: true,
        openCycle: 4,
        requestedConversationId: "conv_1",
        currentConversationId: "conv_1",
        requestedPrefill: "Clarifier mon prochain bloc",
        draft: "",
        hasMessages: true,
        lastAppliedIntentKey: intentKey,
      })
    ).toEqual({
      shouldApply: false,
      intentKey,
      normalizedPrefill: "Clarifier mon prochain bloc",
    });
  });

  it("n'applique pas requestedPrefill sur une conversation deja remplie ou un draft non vide", () => {
    expect(
      shouldApplyCoachRequestedPrefill({
        open: true,
        openCycle: 5,
        requestedConversationId: "conv_1",
        currentConversationId: "conv_1",
        requestedPrefill: "Alléger ma journée",
        draft: "Message déjà saisi",
        hasMessages: false,
        lastAppliedIntentKey: "",
      }).shouldApply
    ).toBe(false);

    expect(
      shouldApplyCoachRequestedPrefill({
        open: true,
        openCycle: 5,
        requestedConversationId: "conv_1",
        currentConversationId: "conv_1",
        requestedPrefill: "Alléger ma journée",
        draft: "",
        lastAppliedIntentKey: "",
      }).shouldApply
    ).toBe(true);
  });

  it("reapplique requestedPrefill sur une nouvelle ouverture", () => {
    const firstIntentKey = buildCoachRequestedPrefillIntentKey({
      openCycle: 6,
      requestedConversationId: "conv_1",
      requestedPrefill: "Préparer le prochain pas",
    });

    expect(
      shouldApplyCoachRequestedPrefill({
        open: true,
        openCycle: 7,
        requestedConversationId: "conv_1",
        currentConversationId: "conv_1",
        requestedPrefill: "Préparer le prochain pas",
        draft: "",
        hasMessages: false,
        lastAppliedIntentKey: firstIntentKey,
      })
    ).toEqual({
      shouldApply: true,
      intentKey: "7:conv_1:Préparer le prochain pas",
      normalizedPrefill: "Préparer le prochain pas",
    });
  });

  it("seed Structurer seulement si le draft est vide", () => {
    expect(buildStructuringIntentTransition({ draft: "" })).toMatchObject({
      nextMode: "plan",
      shouldSeedDraft: true,
    });
    expect(buildStructuringIntentTransition({ draft: "Déjà saisi" })).toMatchObject({
      nextMode: "plan",
      nextDraft: "Déjà saisi",
      shouldSeedDraft: false,
    });
  });

  it("seed Créer vite seulement si le draft est vide", () => {
    expect(buildQuickCreateIntentTransition({ draft: "" })).toMatchObject({
      nextMode: "plan",
      shouldSeedDraft: true,
    });
    expect(buildQuickCreateIntentTransition({ draft: "J'ai déjà mon idée" })).toMatchObject({
      nextMode: "plan",
      nextDraft: "J'ai déjà mon idée",
      shouldSeedDraft: false,
    });
  });

  it("n'efface le draft seedé à la fermeture que s'il n'a pas été retouché", () => {
    expect(
      shouldClearDraftOnDismissWorkIntent({
        activeWorkIntent: {
          seededDraftPrefill: "Aide-moi à structurer ce que je veux faire avancer.",
          draftTouchedSinceSeed: false,
        },
        draft: "Aide-moi à structurer ce que je veux faire avancer.",
      })
    ).toBe(true);

    expect(
      shouldClearDraftOnDismissWorkIntent({
        activeWorkIntent: {
          seededDraftPrefill: "Aide-moi à structurer ce que je veux faire avancer.",
          draftTouchedSinceSeed: true,
        },
        draft: "Aide-moi à structurer ce que je veux faire avancer.",
      })
    ).toBe(false);
  });

  it("annuler une intention ramène le coach au mode free", () => {
    expect(
      buildDismissWorkIntentTransition({
        activeWorkIntent: {
          seededDraftPrefill: "Aide-moi à structurer ce que je veux faire avancer.",
          draftTouchedSinceSeed: false,
        },
        draft: "Aide-moi à structurer ce que je veux faire avancer.",
      })
    ).toMatchObject({
      nextMode: "free",
      nextDraft: "",
      shouldClearDraft: true,
    });

    expect(
      buildDismissWorkIntentTransition({
        activeWorkIntent: {
          seededDraftPrefill: "Aide-moi à structurer ce que je veux faire avancer.",
          draftTouchedSinceSeed: true,
        },
        draft: "Aide-moi à structurer ce que je veux faire avancer, puis clarifie mes priorités.",
      })
    ).toMatchObject({
      nextMode: "free",
      nextDraft: "Aide-moi à structurer ce que je veux faire avancer, puis clarifie mes priorités.",
      shouldClearDraft: false,
    });
  });
});
