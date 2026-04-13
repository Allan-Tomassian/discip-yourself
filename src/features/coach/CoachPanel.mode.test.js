import { describe, expect, it } from "vitest";
import {
  buildManualPlanDismissTransition,
  buildDismissWorkIntentTransition,
  buildPlanIntentTransition,
  buildCoachRequestedModeIntentKey,
  buildCoachRequestedPrefillIntentKey,
  deriveCoachPendingUi,
  normalizeCoachRequestedMode,
  normalizeCoachRequestedPrefill,
  resolveAssistantReplyPlanningState,
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

  it("seed Plan seulement si le draft est vide", () => {
    expect(buildPlanIntentTransition({ draft: "" })).toMatchObject({
      nextMode: "plan",
      shouldSeedDraft: true,
    });
    expect(buildPlanIntentTransition({ draft: "Déjà saisi" })).toMatchObject({
      nextMode: "plan",
      nextDraft: "Déjà saisi",
      shouldSeedDraft: false,
    });
  });

  it("émet un intent manuel canonique pour Plan", () => {
    expect(buildPlanIntentTransition({ draft: "" })).toMatchObject({
      nextMode: "plan",
      shouldSeedDraft: true,
      intent: {
        type: "manual_plan",
        preferredMode: "plan",
        source: "composer_menu",
      },
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

  it("fermer manuellement le mode plan bloque la réactivation automatique", () => {
    expect(
      buildManualPlanDismissTransition({
        planningState: {
          mode: "plan",
          entryPoint: "composer_plan",
          intent: "manual_plan",
          autoActivation: "allowed",
        },
        activeWorkIntent: {
          seededDraftPrefill: "Aide-moi à transformer cette intention en plan clair et actionnable.",
          draftTouchedSinceSeed: false,
        },
        draft: "Aide-moi à transformer cette intention en plan clair et actionnable.",
      })
    ).toMatchObject({
      nextMode: "free",
      nextDraft: "",
      shouldClearDraft: true,
      planningState: {
        mode: "free",
        entryPoint: "composer_plan",
        intent: null,
        autoActivation: "blocked_by_user",
      },
    });
  });

  it("ignore une tentative de retour automatique en plan après fermeture manuelle", () => {
    expect(
      resolveAssistantReplyPlanningState({
        currentPlanningState: {
          mode: "free",
          entryPoint: "composer_plan",
          intent: null,
          autoActivation: "blocked_by_user",
        },
        reply: {
          kind: "conversation",
          mode: "plan",
        },
        activeWorkIntentType: "manual_plan",
      })
    ).toEqual({
      mode: "free",
      entryPoint: "composer_plan",
      intent: null,
      autoActivation: "blocked_by_user",
    });
  });

  it("n'expose aucun pending UI quand le coach ne charge pas", () => {
    expect(deriveCoachPendingUi({ loading: false, planningState: { mode: "free" } })).toBeNull();
  });

  it("expose un pending compact sans texte en mode free", () => {
    expect(
      deriveCoachPendingUi({
        loading: true,
        planningState: {
          mode: "free",
          entryPoint: null,
          intent: null,
          autoActivation: "allowed",
        },
      })
    ).toEqual({
      variant: "free",
      label: "",
      ariaLabel: "Le coach prépare sa réponse",
    });
  });

  it("expose un pending éditorial en mode plan", () => {
    expect(
      deriveCoachPendingUi({
        loading: true,
        planningState: {
          mode: "plan",
          entryPoint: "composer_plan",
          intent: "manual_plan",
          autoActivation: "allowed",
        },
      })
    ).toEqual({
      variant: "plan",
      label: "Préparation du plan",
      ariaLabel: "Le coach prépare le plan",
    });
  });
});
