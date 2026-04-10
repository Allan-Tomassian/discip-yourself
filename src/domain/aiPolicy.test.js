import { describe, expect, it } from "vitest";
import {
  AI_AUTHORITY_LEVELS,
  AI_REGIMES,
  AI_REGIME_POLICY,
  COACH_CHAT_MODES,
  LOCAL_ANALYSIS_SURFACES,
  LOCAL_ANALYSIS_SURFACE_POLICY,
  normalizeCoachChatMode,
  normalizeLocalAnalysisSurface,
  resolveAiRegimeForCoachMode,
} from "./aiPolicy";

describe("aiPolicy", () => {
  it("exposes the mutation review regime as deferred but explicit", () => {
    expect(AI_REGIMES.MUTATION_REVIEW).toBe("mutation_review");
    expect(AI_REGIME_POLICY[AI_REGIMES.MUTATION_REVIEW]).toMatchObject({
      authorityLevel: AI_AUTHORITY_LEVELS.VALIDATED_MUTATION,
      canMutate: true,
      canCreate: false,
      conversation: false,
    });
  });

  it("keeps coach free and plan separated by authority", () => {
    expect(AI_REGIME_POLICY[AI_REGIMES.COACH_FREE].authorityLevel).toBe(AI_AUTHORITY_LEVELS.CLARIFICATION);
    expect(AI_REGIME_POLICY[AI_REGIMES.COACH_FREE].canPropose).toBe(false);
    expect(AI_REGIME_POLICY[AI_REGIMES.COACH_PLAN].authorityLevel).toBe(AI_AUTHORITY_LEVELS.VALIDATED_CREATION);
    expect(AI_REGIME_POLICY[AI_REGIMES.COACH_PLAN].canPrepareCreate).toBe(true);
  });

  it("exposes a non-conversational session guidance regime", () => {
    expect(AI_REGIMES.SESSION_GUIDANCE).toBe("session_guidance");
    expect(AI_REGIME_POLICY[AI_REGIMES.SESSION_GUIDANCE]).toMatchObject({
      authorityLevel: AI_AUTHORITY_LEVELS.SUGGESTION,
      conversation: false,
      canRecommend: true,
      canPropose: true,
      canOpenSurface: false,
    });
  });

  it("normalizes coach modes without widening card into conversation", () => {
    expect(normalizeCoachChatMode("free")).toBe(COACH_CHAT_MODES.FREE);
    expect(normalizeCoachChatMode("plan")).toBe(COACH_CHAT_MODES.PLAN);
    expect(normalizeCoachChatMode("other")).toBe(COACH_CHAT_MODES.CARD);
    expect(resolveAiRegimeForCoachMode("card")).toBe(AI_REGIMES.LOCAL_ANALYSIS);
  });

  it("defines planning and pilotage as dedicated local-analysis surfaces", () => {
    expect(normalizeLocalAnalysisSurface("planning")).toBe(LOCAL_ANALYSIS_SURFACES.PLANNING);
    expect(normalizeLocalAnalysisSurface("pilotage")).toBe(LOCAL_ANALYSIS_SURFACES.PILOTAGE);
    expect(normalizeLocalAnalysisSurface("unknown")).toBe(LOCAL_ANALYSIS_SURFACES.GENERIC);
    expect(LOCAL_ANALYSIS_SURFACE_POLICY[LOCAL_ANALYSIS_SURFACES.PLANNING].allowedIntents).toEqual([
      "open_today",
      "open_library",
      "open_pilotage",
    ]);
  });
});
