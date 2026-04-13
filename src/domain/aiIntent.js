import {
  COACH_CHAT_MODES,
  LOCAL_ANALYSIS_SURFACES,
  normalizeCoachChatMode,
  normalizeLocalAnalysisSurface,
} from "./aiPolicy.js";

export const AI_INTENTS = Object.freeze({
  EXPLORE: "explore",
  PLAN_CREATE: "plan_create",
  PLAN_ADJUST: "plan_adjust",
  EXECUTE_NOW: "execute_now",
  SESSION_PREPARE: "session_prepare",
  SESSION_ADAPT: "session_adapt",
  REVIEW: "review",
  RECOVERY: "recovery",
});

const AI_INTENT_VALUES = new Set(Object.values(AI_INTENTS));

export const AI_INTENT_POLICY = Object.freeze({
  [AI_INTENTS.EXPLORE]: Object.freeze({
    engine: "conversation_engine",
    outputContract: "conversation",
  }),
  [AI_INTENTS.PLAN_CREATE]: Object.freeze({
    engine: "conversation_engine",
    outputContract: "conversation_with_proposal",
  }),
  [AI_INTENTS.PLAN_ADJUST]: Object.freeze({
    engine: "conversation_engine",
    outputContract: "conversation_with_adjustment",
  }),
  [AI_INTENTS.EXECUTE_NOW]: Object.freeze({
    engine: "execution_engine",
    outputContract: "now",
  }),
  [AI_INTENTS.SESSION_PREPARE]: Object.freeze({
    engine: "session_engine",
    outputContract: "session_guidance",
  }),
  [AI_INTENTS.SESSION_ADAPT]: Object.freeze({
    engine: "session_engine",
    outputContract: "session_guidance",
  }),
  [AI_INTENTS.REVIEW]: Object.freeze({
    engine: "review_engine",
    outputContract: "review_card",
  }),
  [AI_INTENTS.RECOVERY]: Object.freeze({
    engine: "recovery_engine",
    outputContract: "recovery",
  }),
});

const PLAN_ADJUST_SIGNAL_RE =
  /\b(ajust\w*|reajust\w*|recalibr\w*|adapt\w*|replanif\w*|alleg\w*|redui\w*|cadence|charge|rythme|surcharge|tenable|credible)\b/;

function normalizeString(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function hasPlanAdjustSignals(message) {
  return PLAN_ADJUST_SIGNAL_RE.test(normalizeString(message));
}

export function normalizeAiIntent(value, fallback = AI_INTENTS.EXPLORE) {
  const next = normalizeString(value);
  if (AI_INTENT_VALUES.has(next)) return next;
  return AI_INTENT_VALUES.has(fallback) ? fallback : AI_INTENTS.EXPLORE;
}

export function isAiIntent(value) {
  return AI_INTENT_VALUES.has(normalizeString(value));
}

export function resolveAiIntentPolicy(value) {
  return AI_INTENT_POLICY[normalizeAiIntent(value)] || AI_INTENT_POLICY[AI_INTENTS.EXPLORE];
}

export function resolveAiIntentForCoachRequest({
  mode = COACH_CHAT_MODES.FREE,
  requestedIntent = null,
  planningState = null,
  message = "",
} = {}) {
  const normalizedMode = normalizeCoachChatMode(mode, COACH_CHAT_MODES.FREE);
  if (normalizedMode === COACH_CHAT_MODES.PLAN) {
    const normalizedRequestedIntent = normalizeAiIntent(requestedIntent, AI_INTENTS.PLAN_CREATE);
    if (normalizedRequestedIntent === AI_INTENTS.PLAN_ADJUST) return AI_INTENTS.PLAN_ADJUST;
    if (
      normalizeString(planningState?.intent) === "contextual" &&
      hasPlanAdjustSignals(message)
    ) {
      return AI_INTENTS.PLAN_ADJUST;
    }
    return AI_INTENTS.PLAN_CREATE;
  }

  const normalizedRequestedIntent = normalizeAiIntent(requestedIntent, AI_INTENTS.EXPLORE);
  if (normalizedRequestedIntent === AI_INTENTS.REVIEW) return AI_INTENTS.REVIEW;
  return AI_INTENTS.EXPLORE;
}

export function resolveAiIntentForLocalAnalysis({
  requestedIntent = null,
  surface = LOCAL_ANALYSIS_SURFACES.GENERIC,
} = {}) {
  normalizeLocalAnalysisSurface(surface, LOCAL_ANALYSIS_SURFACES.GENERIC);
  const normalizedRequestedIntent = normalizeAiIntent(requestedIntent, AI_INTENTS.REVIEW);
  return normalizedRequestedIntent === AI_INTENTS.REVIEW ? AI_INTENTS.REVIEW : AI_INTENTS.REVIEW;
}

export function resolveAiIntentForNow({ requestedIntent = null } = {}) {
  const normalizedRequestedIntent = normalizeAiIntent(requestedIntent, AI_INTENTS.EXECUTE_NOW);
  return normalizedRequestedIntent === AI_INTENTS.EXECUTE_NOW
    ? AI_INTENTS.EXECUTE_NOW
    : AI_INTENTS.EXECUTE_NOW;
}

export function resolveAiIntentForRecovery({ requestedIntent = null } = {}) {
  const normalizedRequestedIntent = normalizeAiIntent(requestedIntent, AI_INTENTS.RECOVERY);
  return normalizedRequestedIntent === AI_INTENTS.RECOVERY ? AI_INTENTS.RECOVERY : AI_INTENTS.RECOVERY;
}

export function resolveAiIntentForSessionGuidance({
  mode = "",
  requestedIntent = null,
} = {}) {
  const normalizedMode = normalizeString(mode);
  if (normalizedMode === "prepare") {
    return normalizeAiIntent(requestedIntent, AI_INTENTS.SESSION_PREPARE) === AI_INTENTS.SESSION_PREPARE
      ? AI_INTENTS.SESSION_PREPARE
      : AI_INTENTS.SESSION_PREPARE;
  }
  if (normalizedMode === "adjust" || normalizedMode === "tool") {
    return normalizeAiIntent(requestedIntent, AI_INTENTS.SESSION_ADAPT) === AI_INTENTS.SESSION_ADAPT
      ? AI_INTENTS.SESSION_ADAPT
      : AI_INTENTS.SESSION_ADAPT;
  }
  return normalizeAiIntent(requestedIntent, AI_INTENTS.SESSION_PREPARE);
}

export function resolveAiIntentForChatContext({
  mode = COACH_CHAT_MODES.CARD,
  requestedIntent = null,
  planningState = null,
  message = "",
} = {}) {
  const normalizedMode = normalizeCoachChatMode(mode, COACH_CHAT_MODES.CARD);
  if (normalizedMode === COACH_CHAT_MODES.CARD) return AI_INTENTS.REVIEW;
  return resolveAiIntentForCoachRequest({
    mode: normalizedMode,
    requestedIntent,
    planningState,
    message,
  });
}
