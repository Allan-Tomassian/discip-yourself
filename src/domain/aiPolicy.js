export const AI_REGIMES = Object.freeze({
  COACH_FREE: "coach_free",
  COACH_PLAN: "coach_plan",
  LOCAL_ANALYSIS: "local_analysis",
  SESSION_GUIDANCE: "session_guidance",
  MUTATION_REVIEW: "mutation_review",
  SYSTEM_ANALYSIS: "system_analysis",
});

export const COACH_CHAT_MODES = Object.freeze({
  CARD: "card",
  FREE: "free",
  PLAN: "plan",
});

export const AI_AUTHORITY_LEVELS = Object.freeze({
  READ_ONLY: "read_only",
  SUGGESTION: "suggestion",
  CLARIFICATION: "clarification",
  STRUCTURED_PROPOSAL: "structured_proposal",
  VALIDATED_CREATION: "validated_creation",
  VALIDATED_MUTATION: "validated_mutation",
});

export const LOCAL_ANALYSIS_SURFACES = Object.freeze({
  GENERIC: "generic",
  PLANNING: "planning",
  OBJECTIVES: "objectives",
  PILOTAGE: "pilotage",
  TIMELINE: "planning",
  INSIGHTS: "pilotage",
});

export const AI_FEATURE_IDS = Object.freeze({
  WHY_CLARIFICATION: "why_clarification",
  FIRST_RUN_STARTER_HINTS: "first_run_starter_hints",
  FIRST_RUN_FULL_PLAN_LEGACY: "first_run_full_plan_legacy",
  COACH_CHAT_FREE: "coach_chat_free",
  COACH_CHAT_PREMIUM: "coach_chat_premium",
  COACH_PLAN: "coach_plan",
  SESSION_GUIDANCE: "session_guidance",
  TODAY_AI_INSIGHT: "today_ai_insight",
  SYSTEM_ANALYSIS: "system_analysis",
  FUTURE_WEEKLY_REVIEW: "future_weekly_review",
  FUTURE_PROJECT_CONTEXT_ANALYSIS: "future_project_context_analysis",
  FUTURE_COACH_IMAGE_INPUT: "future_coach_image_input",
  FUTURE_COACH_DOCUMENT_INPUT: "future_coach_document_input",
  FUTURE_SESSION_FLOATING_COACH: "future_session_floating_coach",
});

export const AI_COST_CLASSES = Object.freeze({
  CHEAP: "cheap",
  MEDIUM: "medium",
  EXPENSIVE: "expensive",
  PREMIUM_DEEP: "premium_deep",
  MULTIMODAL_EXPENSIVE: "multimodal_expensive",
});

export const AI_MODEL_CLASSES = Object.freeze({
  FAST_LOW_COST_TEXT: "fast_low_cost_text",
  STRUCTURED_JSON_SMALL: "structured_json_small",
  REASONING_MEDIUM: "reasoning_medium",
  REASONING_DEEP: "reasoning_deep",
  PREMIUM_DEEP_ANALYSIS: "premium_deep_analysis",
  MULTIMODAL_VISION: "multimodal_vision",
  DOCUMENT_SUMMARY: "document_summary",
});

export const AI_TIERS = Object.freeze({
  FREE: "free",
  TRIAL: "trial",
  PREMIUM: "premium",
  PREMIUM_PLUS: "premium_plus",
});

export const AI_QUOTA_COUNTS_ON = Object.freeze({
  SUCCESSFUL_VALIDATED_RESPONSE: "successful_validated_response",
  COMPLETED_VALIDATED_ANALYSIS: "completed_validated_analysis",
  VALIDATED_PROPOSAL_RESPONSE: "validated_proposal_response",
  FRESH_AI_PREPARE: "fresh_ai_prepare",
  COMPLETED_SUMMARY: "completed_summary",
  NONE: "none",
});

const AI_FEATURE_OUTPUT_CONTRACTS = Object.freeze({
  WHY_CLARIFICATION: "why_clarification",
  FIRST_RUN_STARTER_HINTS: "first_run_starter_hints",
  FIRST_RUN_FULL_PLAN_LEGACY: "first_run_full_plan_legacy",
  COACH_MESSAGE: "coach_message",
  COACH_PLAN_PROPOSAL: "coach_plan_proposal",
  SESSION_GUIDANCE: "session_guidance",
  TODAY_AI_INSIGHT: "today_ai_insight",
  SYSTEM_ANALYSIS_RESULT: "system_analysis_result",
  WEEKLY_REVIEW: "weekly_review",
  PROJECT_CONTEXT_ANALYSIS: "project_context_analysis",
  CONTEXT_SOURCE_SUMMARY: "context_source_summary",
  SESSION_FLOATING_HELP: "session_floating_help",
});

function quotaPolicy({
  enabled = true,
  daily = null,
  weekly = null,
  monthly = null,
  lifetime = null,
  trial = null,
  cooldownMs = 0,
} = {}) {
  return Object.freeze({
    enabled: Boolean(enabled),
    daily,
    weekly,
    monthly,
    lifetime,
    trial,
    cooldownMs,
  });
}

const LOCKED_QUOTA_POLICY = quotaPolicy({ enabled: false });

function quotaByTier(overrides = {}) {
  return Object.freeze({
    [AI_TIERS.FREE]: LOCKED_QUOTA_POLICY,
    [AI_TIERS.TRIAL]: LOCKED_QUOTA_POLICY,
    [AI_TIERS.PREMIUM]: LOCKED_QUOTA_POLICY,
    [AI_TIERS.PREMIUM_PLUS]: LOCKED_QUOTA_POLICY,
    ...overrides,
  });
}

function featurePolicy({
  featureId,
  costClass,
  modelClass,
  access,
  quotaByTier: featureQuotaByTier,
  countsOn = AI_QUOTA_COUNTS_ON.SUCCESSFUL_VALIDATED_RESPONSE,
  cacheHitCounts = true,
  multimodal = false,
  outputContract,
}) {
  return Object.freeze({
    featureId,
    costClass,
    modelClass,
    access,
    quotaByTier: featureQuotaByTier,
    countsOn,
    cacheHitCounts,
    multimodal,
    outputContract,
  });
}

export const AI_TIER_POLICY = Object.freeze({
  [AI_TIERS.FREE]: Object.freeze({
    tier: AI_TIERS.FREE,
    label: "Free",
    rank: 0,
    trial: false,
    premium: false,
    premiumPlus: false,
  }),
  [AI_TIERS.TRIAL]: Object.freeze({
    tier: AI_TIERS.TRIAL,
    label: "Trial",
    rank: 1,
    trial: true,
    premium: false,
    premiumPlus: false,
  }),
  [AI_TIERS.PREMIUM]: Object.freeze({
    tier: AI_TIERS.PREMIUM,
    label: "Premium",
    rank: 2,
    trial: false,
    premium: true,
    premiumPlus: false,
  }),
  [AI_TIERS.PREMIUM_PLUS]: Object.freeze({
    tier: AI_TIERS.PREMIUM_PLUS,
    label: "Premium Plus",
    rank: 3,
    trial: false,
    premium: true,
    premiumPlus: true,
  }),
});

export const AI_FEATURE_POLICY = Object.freeze({
  [AI_FEATURE_IDS.WHY_CLARIFICATION]: featurePolicy({
    featureId: AI_FEATURE_IDS.WHY_CLARIFICATION,
    costClass: AI_COST_CLASSES.CHEAP,
    modelClass: AI_MODEL_CLASSES.STRUCTURED_JSON_SMALL,
    access: AI_TIERS.FREE,
    quotaByTier: quotaByTier({
      [AI_TIERS.FREE]: quotaPolicy({ lifetime: 2, cooldownMs: 10_000 }),
      [AI_TIERS.TRIAL]: quotaPolicy({ lifetime: 5, trial: 5, cooldownMs: 10_000 }),
      [AI_TIERS.PREMIUM]: quotaPolicy({ monthly: 20, cooldownMs: 10_000 }),
      [AI_TIERS.PREMIUM_PLUS]: quotaPolicy({ monthly: 40, cooldownMs: 10_000 }),
    }),
    outputContract: AI_FEATURE_OUTPUT_CONTRACTS.WHY_CLARIFICATION,
  }),
  [AI_FEATURE_IDS.FIRST_RUN_STARTER_HINTS]: featurePolicy({
    featureId: AI_FEATURE_IDS.FIRST_RUN_STARTER_HINTS,
    costClass: AI_COST_CLASSES.MEDIUM,
    modelClass: AI_MODEL_CLASSES.STRUCTURED_JSON_SMALL,
    access: AI_TIERS.FREE,
    quotaByTier: quotaByTier({
      [AI_TIERS.FREE]: quotaPolicy({ lifetime: 1, cooldownMs: 30_000 }),
      [AI_TIERS.TRIAL]: quotaPolicy({ lifetime: 3, trial: 3, cooldownMs: 30_000 }),
      [AI_TIERS.PREMIUM]: quotaPolicy({ monthly: 5, cooldownMs: 30_000 }),
      [AI_TIERS.PREMIUM_PLUS]: quotaPolicy({ monthly: 10, cooldownMs: 30_000 }),
    }),
    outputContract: AI_FEATURE_OUTPUT_CONTRACTS.FIRST_RUN_STARTER_HINTS,
  }),
  [AI_FEATURE_IDS.FIRST_RUN_FULL_PLAN_LEGACY]: featurePolicy({
    featureId: AI_FEATURE_IDS.FIRST_RUN_FULL_PLAN_LEGACY,
    costClass: AI_COST_CLASSES.EXPENSIVE,
    modelClass: AI_MODEL_CLASSES.REASONING_DEEP,
    access: AI_TIERS.TRIAL,
    quotaByTier: quotaByTier({
      [AI_TIERS.TRIAL]: quotaPolicy({ lifetime: 1, trial: 1, cooldownMs: 60_000 }),
      [AI_TIERS.PREMIUM]: quotaPolicy({ monthly: 2, cooldownMs: 60_000 }),
      [AI_TIERS.PREMIUM_PLUS]: quotaPolicy({ monthly: 4, cooldownMs: 60_000 }),
    }),
    countsOn: AI_QUOTA_COUNTS_ON.VALIDATED_PROPOSAL_RESPONSE,
    outputContract: AI_FEATURE_OUTPUT_CONTRACTS.FIRST_RUN_FULL_PLAN_LEGACY,
  }),
  [AI_FEATURE_IDS.COACH_CHAT_FREE]: featurePolicy({
    featureId: AI_FEATURE_IDS.COACH_CHAT_FREE,
    costClass: AI_COST_CLASSES.MEDIUM,
    modelClass: AI_MODEL_CLASSES.FAST_LOW_COST_TEXT,
    access: AI_TIERS.FREE,
    quotaByTier: quotaByTier({
      [AI_TIERS.FREE]: quotaPolicy({ daily: 3, monthly: 30, cooldownMs: 5_000 }),
      [AI_TIERS.TRIAL]: quotaPolicy({ daily: 8, monthly: 60, trial: 60, cooldownMs: 5_000 }),
    }),
    outputContract: AI_FEATURE_OUTPUT_CONTRACTS.COACH_MESSAGE,
  }),
  [AI_FEATURE_IDS.COACH_CHAT_PREMIUM]: featurePolicy({
    featureId: AI_FEATURE_IDS.COACH_CHAT_PREMIUM,
    costClass: AI_COST_CLASSES.MEDIUM,
    modelClass: AI_MODEL_CLASSES.REASONING_MEDIUM,
    access: AI_TIERS.PREMIUM,
    quotaByTier: quotaByTier({
      [AI_TIERS.PREMIUM]: quotaPolicy({ daily: 40, monthly: 600, cooldownMs: 3_000 }),
      [AI_TIERS.PREMIUM_PLUS]: quotaPolicy({ daily: 100, monthly: 1_500, cooldownMs: 2_000 }),
    }),
    outputContract: AI_FEATURE_OUTPUT_CONTRACTS.COACH_MESSAGE,
  }),
  [AI_FEATURE_IDS.COACH_PLAN]: featurePolicy({
    featureId: AI_FEATURE_IDS.COACH_PLAN,
    costClass: AI_COST_CLASSES.EXPENSIVE,
    modelClass: AI_MODEL_CLASSES.REASONING_MEDIUM,
    access: AI_TIERS.TRIAL,
    quotaByTier: quotaByTier({
      [AI_TIERS.TRIAL]: quotaPolicy({ lifetime: 3, trial: 3, cooldownMs: 60_000 }),
      [AI_TIERS.PREMIUM]: quotaPolicy({ daily: 5, monthly: 30, cooldownMs: 30_000 }),
      [AI_TIERS.PREMIUM_PLUS]: quotaPolicy({ daily: 12, monthly: 100, cooldownMs: 20_000 }),
    }),
    countsOn: AI_QUOTA_COUNTS_ON.VALIDATED_PROPOSAL_RESPONSE,
    outputContract: AI_FEATURE_OUTPUT_CONTRACTS.COACH_PLAN_PROPOSAL,
  }),
  [AI_FEATURE_IDS.SESSION_GUIDANCE]: featurePolicy({
    featureId: AI_FEATURE_IDS.SESSION_GUIDANCE,
    costClass: AI_COST_CLASSES.EXPENSIVE,
    modelClass: AI_MODEL_CLASSES.REASONING_DEEP,
    access: AI_TIERS.TRIAL,
    quotaByTier: quotaByTier({
      [AI_TIERS.TRIAL]: quotaPolicy({ lifetime: 2, trial: 2, cooldownMs: 60_000 }),
      [AI_TIERS.PREMIUM]: quotaPolicy({ daily: 3, monthly: 40, cooldownMs: 45_000 }),
      [AI_TIERS.PREMIUM_PLUS]: quotaPolicy({ daily: 10, monthly: 150, cooldownMs: 30_000 }),
    }),
    countsOn: AI_QUOTA_COUNTS_ON.FRESH_AI_PREPARE,
    cacheHitCounts: false,
    outputContract: AI_FEATURE_OUTPUT_CONTRACTS.SESSION_GUIDANCE,
  }),
  [AI_FEATURE_IDS.TODAY_AI_INSIGHT]: featurePolicy({
    featureId: AI_FEATURE_IDS.TODAY_AI_INSIGHT,
    costClass: AI_COST_CLASSES.MEDIUM,
    modelClass: AI_MODEL_CLASSES.FAST_LOW_COST_TEXT,
    access: AI_TIERS.FREE,
    quotaByTier: quotaByTier({
      [AI_TIERS.FREE]: quotaPolicy({ daily: 1, monthly: 10, cooldownMs: 30_000 }),
      [AI_TIERS.TRIAL]: quotaPolicy({ daily: 3, monthly: 20, trial: 20, cooldownMs: 30_000 }),
      [AI_TIERS.PREMIUM]: quotaPolicy({ daily: 10, monthly: 120, cooldownMs: 20_000 }),
      [AI_TIERS.PREMIUM_PLUS]: quotaPolicy({ daily: 25, monthly: 300, cooldownMs: 15_000 }),
    }),
    outputContract: AI_FEATURE_OUTPUT_CONTRACTS.TODAY_AI_INSIGHT,
  }),
  [AI_FEATURE_IDS.SYSTEM_ANALYSIS]: featurePolicy({
    featureId: AI_FEATURE_IDS.SYSTEM_ANALYSIS,
    costClass: AI_COST_CLASSES.PREMIUM_DEEP,
    modelClass: AI_MODEL_CLASSES.PREMIUM_DEEP_ANALYSIS,
    access: AI_TIERS.PREMIUM,
    quotaByTier: quotaByTier({
      [AI_TIERS.PREMIUM]: quotaPolicy({ monthly: 1, cooldownMs: 86_400_000 }),
      [AI_TIERS.PREMIUM_PLUS]: quotaPolicy({ monthly: 2, cooldownMs: 86_400_000 }),
    }),
    countsOn: AI_QUOTA_COUNTS_ON.COMPLETED_VALIDATED_ANALYSIS,
    cacheHitCounts: false,
    outputContract: AI_FEATURE_OUTPUT_CONTRACTS.SYSTEM_ANALYSIS_RESULT,
  }),
  [AI_FEATURE_IDS.FUTURE_WEEKLY_REVIEW]: featurePolicy({
    featureId: AI_FEATURE_IDS.FUTURE_WEEKLY_REVIEW,
    costClass: AI_COST_CLASSES.EXPENSIVE,
    modelClass: AI_MODEL_CLASSES.REASONING_DEEP,
    access: AI_TIERS.PREMIUM,
    quotaByTier: quotaByTier({
      [AI_TIERS.PREMIUM]: quotaPolicy({ weekly: 1, monthly: 4, cooldownMs: 86_400_000 }),
      [AI_TIERS.PREMIUM_PLUS]: quotaPolicy({ weekly: 2, monthly: 8, cooldownMs: 86_400_000 }),
    }),
    countsOn: AI_QUOTA_COUNTS_ON.COMPLETED_SUMMARY,
    cacheHitCounts: false,
    outputContract: AI_FEATURE_OUTPUT_CONTRACTS.WEEKLY_REVIEW,
  }),
  [AI_FEATURE_IDS.FUTURE_PROJECT_CONTEXT_ANALYSIS]: featurePolicy({
    featureId: AI_FEATURE_IDS.FUTURE_PROJECT_CONTEXT_ANALYSIS,
    costClass: AI_COST_CLASSES.PREMIUM_DEEP,
    modelClass: AI_MODEL_CLASSES.PREMIUM_DEEP_ANALYSIS,
    access: AI_TIERS.PREMIUM_PLUS,
    quotaByTier: quotaByTier({
      [AI_TIERS.PREMIUM_PLUS]: quotaPolicy({ monthly: 2, cooldownMs: 86_400_000 }),
    }),
    countsOn: AI_QUOTA_COUNTS_ON.COMPLETED_VALIDATED_ANALYSIS,
    cacheHitCounts: false,
    outputContract: AI_FEATURE_OUTPUT_CONTRACTS.PROJECT_CONTEXT_ANALYSIS,
  }),
  [AI_FEATURE_IDS.FUTURE_COACH_IMAGE_INPUT]: featurePolicy({
    featureId: AI_FEATURE_IDS.FUTURE_COACH_IMAGE_INPUT,
    costClass: AI_COST_CLASSES.MULTIMODAL_EXPENSIVE,
    modelClass: AI_MODEL_CLASSES.MULTIMODAL_VISION,
    access: AI_TIERS.PREMIUM_PLUS,
    quotaByTier: quotaByTier({
      [AI_TIERS.PREMIUM_PLUS]: quotaPolicy({ daily: 5, monthly: 30, cooldownMs: 30_000 }),
    }),
    countsOn: AI_QUOTA_COUNTS_ON.COMPLETED_SUMMARY,
    cacheHitCounts: false,
    multimodal: true,
    outputContract: AI_FEATURE_OUTPUT_CONTRACTS.CONTEXT_SOURCE_SUMMARY,
  }),
  [AI_FEATURE_IDS.FUTURE_COACH_DOCUMENT_INPUT]: featurePolicy({
    featureId: AI_FEATURE_IDS.FUTURE_COACH_DOCUMENT_INPUT,
    costClass: AI_COST_CLASSES.MULTIMODAL_EXPENSIVE,
    modelClass: AI_MODEL_CLASSES.DOCUMENT_SUMMARY,
    access: AI_TIERS.PREMIUM_PLUS,
    quotaByTier: quotaByTier({
      [AI_TIERS.PREMIUM_PLUS]: quotaPolicy({ daily: 3, monthly: 20, cooldownMs: 60_000 }),
    }),
    countsOn: AI_QUOTA_COUNTS_ON.COMPLETED_SUMMARY,
    cacheHitCounts: false,
    multimodal: true,
    outputContract: AI_FEATURE_OUTPUT_CONTRACTS.CONTEXT_SOURCE_SUMMARY,
  }),
  [AI_FEATURE_IDS.FUTURE_SESSION_FLOATING_COACH]: featurePolicy({
    featureId: AI_FEATURE_IDS.FUTURE_SESSION_FLOATING_COACH,
    costClass: AI_COST_CLASSES.MEDIUM,
    modelClass: AI_MODEL_CLASSES.FAST_LOW_COST_TEXT,
    access: AI_TIERS.FREE,
    quotaByTier: quotaByTier({
      [AI_TIERS.FREE]: quotaPolicy({ daily: 1, monthly: 10, cooldownMs: 30_000 }),
      [AI_TIERS.TRIAL]: quotaPolicy({ daily: 3, monthly: 30, trial: 30, cooldownMs: 20_000 }),
      [AI_TIERS.PREMIUM]: quotaPolicy({ daily: 10, monthly: 180, cooldownMs: 10_000 }),
      [AI_TIERS.PREMIUM_PLUS]: quotaPolicy({ daily: 30, monthly: 600, cooldownMs: 5_000 }),
    }),
    outputContract: AI_FEATURE_OUTPUT_CONTRACTS.SESSION_FLOATING_HELP,
  }),
});

export const AI_REGIME_POLICY = Object.freeze({
  [AI_REGIMES.COACH_FREE]: Object.freeze({
    authorityLevel: AI_AUTHORITY_LEVELS.CLARIFICATION,
    conversation: true,
    canRead: true,
    canClarify: true,
    canRecommend: true,
    canPropose: false,
    canPrepareCreate: false,
    canCreate: false,
    canMutate: false,
    canOpenSurface: true,
    label: "Coach libre",
  }),
  [AI_REGIMES.COACH_PLAN]: Object.freeze({
    authorityLevel: AI_AUTHORITY_LEVELS.VALIDATED_CREATION,
    conversation: true,
    canRead: true,
    canClarify: true,
    canRecommend: true,
    canPropose: true,
    canPrepareCreate: true,
    canCreate: true,
    canMutate: false,
    canOpenSurface: true,
    label: "Coach Plan",
  }),
  [AI_REGIMES.LOCAL_ANALYSIS]: Object.freeze({
    authorityLevel: AI_AUTHORITY_LEVELS.SUGGESTION,
    conversation: false,
    canRead: true,
    canClarify: false,
    canRecommend: true,
    canPropose: false,
    canPrepareCreate: false,
    canCreate: false,
    canMutate: false,
    canOpenSurface: true,
    label: "Lecture du coach",
  }),
  [AI_REGIMES.SESSION_GUIDANCE]: Object.freeze({
    authorityLevel: AI_AUTHORITY_LEVELS.SUGGESTION,
    conversation: false,
    canRead: true,
    canClarify: false,
    canRecommend: true,
    canPropose: true,
    canPrepareCreate: false,
    canCreate: false,
    canMutate: false,
    canOpenSurface: false,
    label: "Préparation de séance",
  }),
  [AI_REGIMES.MUTATION_REVIEW]: Object.freeze({
    authorityLevel: AI_AUTHORITY_LEVELS.VALIDATED_MUTATION,
    conversation: false,
    canRead: true,
    canClarify: true,
    canRecommend: true,
    canPropose: true,
    canPrepareCreate: false,
    canCreate: false,
    canMutate: true,
    canOpenSurface: true,
    label: "Review de modification IA",
  }),
  [AI_REGIMES.SYSTEM_ANALYSIS]: Object.freeze({
    authorityLevel: AI_AUTHORITY_LEVELS.STRUCTURED_PROPOSAL,
    conversation: false,
    canRead: true,
    canClarify: false,
    canRecommend: true,
    canPropose: true,
    canPrepareCreate: false,
    canCreate: false,
    canMutate: false,
    canOpenSurface: true,
    outputContract: "system_analysis_result",
    costClass: "expensive",
    access: "premium",
    frequency: "monthly",
    label: "Analyse système",
  }),
});

export const LOCAL_ANALYSIS_SURFACE_POLICY = Object.freeze({
  [LOCAL_ANALYSIS_SURFACES.GENERIC]: Object.freeze({
    label: "Lecture du coach",
    focus: "lecture contextuelle",
    allowedIntents: ["open_today", "open_library", "open_pilotage", "resume_session", "start_occurrence"],
  }),
  [LOCAL_ANALYSIS_SURFACES.PLANNING]: Object.freeze({
    label: "Lecture du rythme",
    focus: "cadence, trous, charge et crédibilité du rythme",
    allowedIntents: ["open_today", "open_library", "open_pilotage"],
  }),
  [LOCAL_ANALYSIS_SURFACES.OBJECTIVES]: Object.freeze({
    label: "Lecture des objectifs",
    focus: "protection du cap, arbitrage du planning et recentrage de la semaine",
    allowedIntents: ["open_planning", "open_pilotage"],
  }),
  [LOCAL_ANALYSIS_SURFACES.PILOTAGE]: Object.freeze({
    label: "Lecture des analyses",
    focus: "équilibre, surcharge, dérive et continuité",
    allowedIntents: ["open_today", "open_library", "open_pilotage"],
  }),
});

export function normalizeCoachChatMode(value, fallback = COACH_CHAT_MODES.CARD) {
  if (value === COACH_CHAT_MODES.FREE) return COACH_CHAT_MODES.FREE;
  if (value === COACH_CHAT_MODES.PLAN) return COACH_CHAT_MODES.PLAN;
  return fallback === COACH_CHAT_MODES.FREE || fallback === COACH_CHAT_MODES.PLAN
    ? fallback
    : COACH_CHAT_MODES.CARD;
}

export function isConversationCoachMode(value) {
  return normalizeCoachChatMode(value, COACH_CHAT_MODES.CARD) !== COACH_CHAT_MODES.CARD;
}

export function normalizeLocalAnalysisSurface(value, fallback = LOCAL_ANALYSIS_SURFACES.GENERIC) {
  if (value === LOCAL_ANALYSIS_SURFACES.TIMELINE || value === "timeline") return LOCAL_ANALYSIS_SURFACES.PLANNING;
  if (value === LOCAL_ANALYSIS_SURFACES.INSIGHTS || value === "insights") return LOCAL_ANALYSIS_SURFACES.PILOTAGE;
  if (value === LOCAL_ANALYSIS_SURFACES.OBJECTIVES || value === "objectives") return LOCAL_ANALYSIS_SURFACES.OBJECTIVES;
  if (value === LOCAL_ANALYSIS_SURFACES.PLANNING) return LOCAL_ANALYSIS_SURFACES.PLANNING;
  if (value === LOCAL_ANALYSIS_SURFACES.PILOTAGE) return LOCAL_ANALYSIS_SURFACES.PILOTAGE;
  return fallback === LOCAL_ANALYSIS_SURFACES.PLANNING ||
    fallback === LOCAL_ANALYSIS_SURFACES.OBJECTIVES ||
    fallback === LOCAL_ANALYSIS_SURFACES.PILOTAGE
    ? fallback
    : LOCAL_ANALYSIS_SURFACES.GENERIC;
}

export function resolveAiRegimeForCoachMode(value) {
  const mode = normalizeCoachChatMode(value, COACH_CHAT_MODES.CARD);
  if (mode === COACH_CHAT_MODES.FREE) return AI_REGIMES.COACH_FREE;
  if (mode === COACH_CHAT_MODES.PLAN) return AI_REGIMES.COACH_PLAN;
  return AI_REGIMES.LOCAL_ANALYSIS;
}

export function normalizeAiTier(value) {
  const rawValue =
    typeof value === "string"
      ? value
      : value?.tier || value?.planTier || value?.plan_tier || value?.effectiveTier || value?.role || "";
  const normalized = String(rawValue).trim().toLowerCase().replace(/\s+/g, "_");
  if (normalized === "admin" || normalized === "founder") return AI_TIERS.PREMIUM_PLUS;
  if (Object.values(AI_TIERS).includes(normalized)) return normalized;
  return AI_TIERS.FREE;
}

export function getAiFeaturePolicy(featureId) {
  return AI_FEATURE_POLICY[featureId] || null;
}

export function getAiTierPolicy(tier) {
  return AI_TIER_POLICY[normalizeAiTier(tier)];
}

export function getAiFeatureQuotaPolicy(featureId, tier) {
  const policy = getAiFeaturePolicy(featureId);
  if (!policy) return LOCKED_QUOTA_POLICY;
  return policy.quotaByTier[normalizeAiTier(tier)] || LOCKED_QUOTA_POLICY;
}

export function getAiFeatureModelClass(featureId) {
  return getAiFeaturePolicy(featureId)?.modelClass || null;
}

export function isAiFeaturePremiumOnly(featureId) {
  const access = getAiFeaturePolicy(featureId)?.access;
  return access === AI_TIERS.PREMIUM || access === AI_TIERS.PREMIUM_PLUS;
}

export function isAiFeatureTrialAllowed(featureId) {
  return getAiFeatureQuotaPolicy(featureId, AI_TIERS.TRIAL).enabled === true;
}
