export const AI_REGIMES = Object.freeze({
  COACH_FREE: "coach_free",
  COACH_PLAN: "coach_plan",
  LOCAL_ANALYSIS: "local_analysis",
  SESSION_GUIDANCE: "session_guidance",
  MUTATION_REVIEW: "mutation_review",
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
  PILOTAGE: "pilotage",
  OBJECTIVES: "objectives",
  TIMELINE: "planning",
  INSIGHTS: "pilotage",
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
    label: "Recentrer la semaine",
    focus: "objectifs, catégories, actions clés et arbitrage concret",
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
  if (value === LOCAL_ANALYSIS_SURFACES.OBJECTIVES || value === "objectives" || value === "library") {
    return LOCAL_ANALYSIS_SURFACES.OBJECTIVES;
  }
  if (value === LOCAL_ANALYSIS_SURFACES.PLANNING) return LOCAL_ANALYSIS_SURFACES.PLANNING;
  if (value === LOCAL_ANALYSIS_SURFACES.PILOTAGE) return LOCAL_ANALYSIS_SURFACES.PILOTAGE;
  return fallback === LOCAL_ANALYSIS_SURFACES.PLANNING ||
    fallback === LOCAL_ANALYSIS_SURFACES.PILOTAGE ||
    fallback === LOCAL_ANALYSIS_SURFACES.OBJECTIVES
    ? fallback
    : LOCAL_ANALYSIS_SURFACES.GENERIC;
}

export function resolveAiRegimeForCoachMode(value) {
  const mode = normalizeCoachChatMode(value, COACH_CHAT_MODES.CARD);
  if (mode === COACH_CHAT_MODES.FREE) return AI_REGIMES.COACH_FREE;
  if (mode === COACH_CHAT_MODES.PLAN) return AI_REGIMES.COACH_PLAN;
  return AI_REGIMES.LOCAL_ANALYSIS;
}
