import { describe, expect, it } from "vitest";
import {
  AI_AUTHORITY_LEVELS,
  AI_COST_CLASSES,
  AI_FEATURE_IDS,
  AI_FEATURE_POLICY,
  AI_MODEL_CLASSES,
  AI_QUOTA_COUNTS_ON,
  AI_REGIMES,
  AI_REGIME_POLICY,
  AI_TIERS,
  COACH_CHAT_MODES,
  LOCAL_ANALYSIS_SURFACES,
  LOCAL_ANALYSIS_SURFACE_POLICY,
  getAiFeatureModelClass,
  getAiFeaturePolicy,
  getAiFeatureQuotaPolicy,
  getAiTierPolicy,
  isAiFeaturePremiumOnly,
  isAiFeatureTrialAllowed,
  normalizeAiTier,
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

  it("exposes system analysis as premium structured proposal authority without mutation", () => {
    expect(AI_REGIMES.SYSTEM_ANALYSIS).toBe("system_analysis");
    expect(AI_REGIME_POLICY[AI_REGIMES.SYSTEM_ANALYSIS]).toMatchObject({
      authorityLevel: AI_AUTHORITY_LEVELS.STRUCTURED_PROPOSAL,
      canRead: true,
      canRecommend: true,
      canPropose: true,
      canCreate: false,
      canMutate: false,
      outputContract: "system_analysis_result",
      costClass: "expensive",
      access: "premium",
    });
  });

  it("normalizes coach modes without widening card into conversation", () => {
    expect(normalizeCoachChatMode("free")).toBe(COACH_CHAT_MODES.FREE);
    expect(normalizeCoachChatMode("plan")).toBe(COACH_CHAT_MODES.PLAN);
    expect(normalizeCoachChatMode("other")).toBe(COACH_CHAT_MODES.CARD);
    expect(resolveAiRegimeForCoachMode("card")).toBe(AI_REGIMES.LOCAL_ANALYSIS);
  });

  it("defines planning, objectives, and pilotage as dedicated local-analysis surfaces", () => {
    expect(normalizeLocalAnalysisSurface("planning")).toBe(LOCAL_ANALYSIS_SURFACES.PLANNING);
    expect(normalizeLocalAnalysisSurface("objectives")).toBe(LOCAL_ANALYSIS_SURFACES.OBJECTIVES);
    expect(normalizeLocalAnalysisSurface("pilotage")).toBe(LOCAL_ANALYSIS_SURFACES.PILOTAGE);
    expect(normalizeLocalAnalysisSurface("unknown")).toBe(LOCAL_ANALYSIS_SURFACES.GENERIC);
    expect(LOCAL_ANALYSIS_SURFACE_POLICY[LOCAL_ANALYSIS_SURFACES.PLANNING].allowedIntents).toEqual([
      "open_today",
      "open_library",
      "open_pilotage",
    ]);
    expect(LOCAL_ANALYSIS_SURFACE_POLICY[LOCAL_ANALYSIS_SURFACES.OBJECTIVES].allowedIntents).toEqual([
      "open_planning",
      "open_pilotage",
    ]);
  });

  it("defines one inert feature policy for every AI feature id", () => {
    const costClasses = Object.values(AI_COST_CLASSES);
    const modelClasses = Object.values(AI_MODEL_CLASSES);
    const countsOnValues = Object.values(AI_QUOTA_COUNTS_ON);

    expect(Object.keys(AI_FEATURE_POLICY).sort()).toEqual(Object.values(AI_FEATURE_IDS).sort());

    for (const featureId of Object.values(AI_FEATURE_IDS)) {
      const policy = getAiFeaturePolicy(featureId);
      expect(policy).toMatchObject({ featureId });
      expect(costClasses).toContain(policy.costClass);
      expect(modelClasses).toContain(policy.modelClass);
      expect(Object.values(AI_TIERS)).toContain(policy.access);
      expect(countsOnValues).toContain(policy.countsOn);
      expect(typeof policy.cacheHitCounts).toBe("boolean");
      expect(typeof policy.multimodal).toBe("boolean");
      expect(policy.outputContract).toEqual(expect.any(String));
      expect(Object.keys(policy.quotaByTier).sort()).toEqual(Object.values(AI_TIERS).sort());
    }
  });

  it("keeps system analysis premium-only with monthly cache-safe quotas", () => {
    const policy = getAiFeaturePolicy(AI_FEATURE_IDS.SYSTEM_ANALYSIS);

    expect(policy).toMatchObject({
      costClass: AI_COST_CLASSES.PREMIUM_DEEP,
      modelClass: AI_MODEL_CLASSES.PREMIUM_DEEP_ANALYSIS,
      countsOn: AI_QUOTA_COUNTS_ON.COMPLETED_VALIDATED_ANALYSIS,
      cacheHitCounts: false,
      outputContract: "system_analysis_result",
    });
    expect(isAiFeaturePremiumOnly(AI_FEATURE_IDS.SYSTEM_ANALYSIS)).toBe(true);
    expect(isAiFeatureTrialAllowed(AI_FEATURE_IDS.SYSTEM_ANALYSIS)).toBe(false);
    expect(getAiFeatureQuotaPolicy(AI_FEATURE_IDS.SYSTEM_ANALYSIS, AI_TIERS.TRIAL).enabled).toBe(false);
    expect(getAiFeatureQuotaPolicy(AI_FEATURE_IDS.SYSTEM_ANALYSIS, AI_TIERS.PREMIUM).monthly).toBe(1);
    expect(getAiFeatureQuotaPolicy(AI_FEATURE_IDS.SYSTEM_ANALYSIS, AI_TIERS.PREMIUM_PLUS).monthly).toBe(2);
  });

  it("allows limited trial access for first-run and tactical coach features", () => {
    expect(isAiFeatureTrialAllowed(AI_FEATURE_IDS.WHY_CLARIFICATION)).toBe(true);
    expect(isAiFeatureTrialAllowed(AI_FEATURE_IDS.FIRST_RUN_STARTER_HINTS)).toBe(true);
    expect(isAiFeatureTrialAllowed(AI_FEATURE_IDS.COACH_CHAT_FREE)).toBe(true);
    expect(isAiFeatureTrialAllowed(AI_FEATURE_IDS.COACH_PLAN)).toBe(true);
    expect(isAiFeatureTrialAllowed(AI_FEATURE_IDS.SESSION_GUIDANCE)).toBe(true);

    expect(getAiFeatureQuotaPolicy(AI_FEATURE_IDS.WHY_CLARIFICATION, AI_TIERS.TRIAL).trial).toBe(5);
    expect(getAiFeatureQuotaPolicy(AI_FEATURE_IDS.COACH_PLAN, AI_TIERS.TRIAL).trial).toBe(3);
  });

  it("keeps free coach quota lower than premium coach quota", () => {
    const freeCoachQuota = getAiFeatureQuotaPolicy(AI_FEATURE_IDS.COACH_CHAT_FREE, AI_TIERS.FREE);
    const premiumCoachQuota = getAiFeatureQuotaPolicy(AI_FEATURE_IDS.COACH_CHAT_PREMIUM, AI_TIERS.PREMIUM);

    expect(freeCoachQuota.daily).toBe(3);
    expect(freeCoachQuota.monthly).toBe(30);
    expect(premiumCoachQuota.daily).toBeGreaterThan(freeCoachQuota.daily);
    expect(premiumCoachQuota.monthly).toBeGreaterThan(freeCoachQuota.monthly);
  });

  it("keeps session guidance finite during trial", () => {
    const trialQuota = getAiFeatureQuotaPolicy(AI_FEATURE_IDS.SESSION_GUIDANCE, AI_TIERS.TRIAL);

    expect(trialQuota.enabled).toBe(true);
    expect(trialQuota.trial).toBe(2);
    expect(trialQuota.lifetime).toBe(2);
  });

  it("locks future multimodal features to premium plus by default", () => {
    for (const featureId of [AI_FEATURE_IDS.FUTURE_COACH_IMAGE_INPUT, AI_FEATURE_IDS.FUTURE_COACH_DOCUMENT_INPUT]) {
      const policy = getAiFeaturePolicy(featureId);

      expect(policy.multimodal).toBe(true);
      expect(policy.costClass).toBe(AI_COST_CLASSES.MULTIMODAL_EXPENSIVE);
      expect(getAiFeatureQuotaPolicy(featureId, AI_TIERS.FREE).enabled).toBe(false);
      expect(getAiFeatureQuotaPolicy(featureId, AI_TIERS.TRIAL).enabled).toBe(false);
      expect(getAiFeatureQuotaPolicy(featureId, AI_TIERS.PREMIUM).enabled).toBe(false);
      expect(getAiFeatureQuotaPolicy(featureId, AI_TIERS.PREMIUM_PLUS).enabled).toBe(true);
    }
  });

  it("normalizes tiers safely for policy selectors", () => {
    expect(normalizeAiTier("premium")).toBe(AI_TIERS.PREMIUM);
    expect(normalizeAiTier("admin")).toBe(AI_TIERS.PREMIUM_PLUS);
    expect(normalizeAiTier("founder")).toBe(AI_TIERS.PREMIUM_PLUS);
    expect(normalizeAiTier({ plan_tier: "trial" })).toBe(AI_TIERS.TRIAL);
    expect(normalizeAiTier("unknown")).toBe(AI_TIERS.FREE);

    expect(getAiTierPolicy("founder")).toMatchObject({ tier: AI_TIERS.PREMIUM_PLUS });
    expect(getAiFeatureModelClass(AI_FEATURE_IDS.COACH_PLAN)).toBe(AI_MODEL_CLASSES.REASONING_MEDIUM);
    expect(getAiFeaturePolicy("unknown_feature")).toBeNull();
    expect(getAiFeatureQuotaPolicy("unknown_feature", "founder")).toMatchObject({ enabled: false });
  });
});
