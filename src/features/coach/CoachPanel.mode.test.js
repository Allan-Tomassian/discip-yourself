import { describe, expect, it } from "vitest";
import {
  buildCoachRequestedModeIntentKey,
  normalizeCoachRequestedMode,
  shouldApplyCoachRequestedMode,
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
});
