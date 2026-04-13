import { describe, expect, it } from "vitest";
import {
  AI_INTENTS,
  AI_INTENT_POLICY,
  normalizeAiIntent,
  resolveAiIntentForChatContext,
  resolveAiIntentForCoachRequest,
  resolveAiIntentForLocalAnalysis,
  resolveAiIntentForNow,
  resolveAiIntentForRecovery,
  resolveAiIntentForSessionGuidance,
} from "./aiIntent";

describe("aiIntent", () => {
  it("exposes the canonical internal intent taxonomy", () => {
    expect(Object.values(AI_INTENTS)).toEqual([
      "explore",
      "plan_create",
      "plan_adjust",
      "execute_now",
      "session_prepare",
      "session_adapt",
      "review",
      "recovery",
    ]);
    expect(AI_INTENT_POLICY[AI_INTENTS.EXECUTE_NOW]).toMatchObject({
      engine: "execution_engine",
      outputContract: "now",
    });
  });

  it("normalizes unknown values to a safe canonical fallback", () => {
    expect(normalizeAiIntent("plan_adjust")).toBe(AI_INTENTS.PLAN_ADJUST);
    expect(normalizeAiIntent("other", AI_INTENTS.REVIEW)).toBe(AI_INTENTS.REVIEW);
  });

  it("maps coach free to explore by default", () => {
    expect(resolveAiIntentForCoachRequest({ mode: "free", message: "Bonjour" })).toBe(AI_INTENTS.EXPLORE);
  });

  it("maps coach plan to plan_create by default", () => {
    expect(resolveAiIntentForCoachRequest({ mode: "plan", message: "Aide-moi à structurer ça." })).toBe(
      AI_INTENTS.PLAN_CREATE,
    );
  });

  it("allows plan_adjust when the legacy contextual path carries clear recalibration signals", () => {
    expect(
      resolveAiIntentForCoachRequest({
        mode: "plan",
        planningState: { intent: "contextual" },
        message: "Réajuste la cadence et allège la charge de ce plan.",
      }),
    ).toBe(AI_INTENTS.PLAN_ADJUST);
  });

  it("treats card as a review contract instead of a primary intent", () => {
    expect(resolveAiIntentForChatContext({ mode: "card", message: "Analyse ce planning" })).toBe(AI_INTENTS.REVIEW);
    expect(resolveAiIntentForLocalAnalysis({ surface: "planning" })).toBe(AI_INTENTS.REVIEW);
  });

  it("keeps now, recovery, and session guidance on dedicated canonical intents", () => {
    expect(resolveAiIntentForNow()).toBe(AI_INTENTS.EXECUTE_NOW);
    expect(resolveAiIntentForRecovery()).toBe(AI_INTENTS.RECOVERY);
    expect(resolveAiIntentForSessionGuidance({ mode: "prepare" })).toBe(AI_INTENTS.SESSION_PREPARE);
    expect(resolveAiIntentForSessionGuidance({ mode: "adjust" })).toBe(AI_INTENTS.SESSION_ADAPT);
    expect(resolveAiIntentForSessionGuidance({ mode: "tool" })).toBe(AI_INTENTS.SESSION_ADAPT);
  });
});
