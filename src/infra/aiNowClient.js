import {
  TODAY_DIAGNOSTIC_REJECTION_REASON,
  TODAY_INTERVENTION_TYPE,
  TODAY_BACKEND_RESOLUTION_STATUS,
} from "../domain/todayIntervention";
import { buildAiTransportMeta, logAiTransportIssue } from "./aiTransportDiagnostics";
import { readAiBackendBaseUrl as readAiBackendBaseUrlFromEnv } from "./frontendEnv";
import { resolveAiIntentForNow } from "../domain/aiIntent";

const DATE_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;
const AI_NOW_SURFACES = new Set(["today", "session"]);
const AI_NOW_TRIGGERS = new Set(["manual", "screen_open", "resume"]);
const ACTION_INTENTS = new Set([
  "start_occurrence",
  "resume_session",
  "open_library",
  "open_pilotage",
  "open_today",
]);
const UI_TONES = new Set(["steady", "direct", "reset"]);
const URGENCY_LEVELS = new Set(["low", "medium", "high"]);
const TOOL_INTENTS = new Set([
  "suggest_start_occurrence",
  "suggest_resume_session",
  "suggest_recovery_action",
  "suggest_reschedule_option",
  "suggest_open_library",
]);
const REWARD_KINDS = new Set(["none", "micro_action", "coins_preview", "light_reset"]);
const DECISION_SOURCES = new Set(["ai", "rules"]);
const COACH_KINDS = new Set(["now", "recovery"]);
const INTERVENTION_TYPES = new Set(Object.values(TODAY_INTERVENTION_TYPE));
const META_FALLBACK_REASONS = new Set(["none", "quota", "timeout", "invalid_model_output", "backend_error"]);
const META_TRIGGERS = new Set(["manual", "screen_open", "resume", "auto_slip", "resume_after_gap"]);
const DIAGNOSTIC_RESOLUTION_STATUSES = new Set(Object.values(TODAY_BACKEND_RESOLUTION_STATUS));
const DIAGNOSTIC_REJECTION_REASONS = new Set(Object.values(TODAY_DIAGNOSTIC_REJECTION_REASON));

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isDateKey(value) {
  return typeof value === "string" && DATE_KEY_RE.test(value);
}

function hasEnumValue(set, value) {
  return typeof value === "string" && set.has(value);
}

function isNullableString(value) {
  return value === null || typeof value === "string";
}

export function readAiBackendBaseUrl(rawValue) {
  return readAiBackendBaseUrlFromEnv(rawValue);
}

export function isAiBackendConfigured(rawValue) {
  return Boolean(readAiBackendBaseUrl(rawValue));
}

export function normalizeAiNowPayload(input) {
  const source = isPlainObject(input) ? input : {};
  const selectedDateKey = source.selectedDateKey;
  const activeCategoryId = source.activeCategoryId ?? null;
  const surface = source.surface ?? "today";
  const trigger = source.trigger ?? "screen_open";

  if (!isDateKey(selectedDateKey)) {
    const error = new Error("selectedDateKey must be YYYY-MM-DD");
    error.code = "INVALID_REQUEST";
    throw error;
  }
  if (!isNullableString(activeCategoryId)) {
    const error = new Error("activeCategoryId must be a string or null");
    error.code = "INVALID_REQUEST";
    throw error;
  }
  if (!hasEnumValue(AI_NOW_SURFACES, surface)) {
    const error = new Error("surface must be today or session");
    error.code = "INVALID_REQUEST";
    throw error;
  }
  if (!hasEnumValue(AI_NOW_TRIGGERS, trigger)) {
    const error = new Error("trigger must be manual, screen_open or resume");
    error.code = "INVALID_REQUEST";
    throw error;
  }

  return {
    selectedDateKey,
    activeCategoryId,
    surface,
    trigger,
    aiIntent: resolveAiIntentForNow({ requestedIntent: source.aiIntent }),
  };
}

function isCoachAction(value) {
  return (
    isPlainObject(value) &&
    typeof value.label === "string" &&
    value.label.length <= 32 &&
    hasEnumValue(ACTION_INTENTS, value.intent) &&
    isNullableString(value.categoryId) &&
    isNullableString(value.actionId) &&
    isNullableString(value.occurrenceId) &&
    (value.dateKey === null || isDateKey(value.dateKey))
  );
}

function isRewardSuggestion(value) {
  return isPlainObject(value) && hasEnumValue(REWARD_KINDS, value.kind) && isNullableString(value.label);
}

function isCoachMeta(value) {
  return (
    isPlainObject(value) &&
    value.coachVersion === "v1" &&
    typeof value.requestId === "string" &&
    isDateKey(value.selectedDateKey) &&
    isNullableString(value.activeCategoryId) &&
    isNullableString(value.occurrenceId) &&
    isNullableString(value.sessionId) &&
    (value.quotaRemaining === null || Number.isInteger(value.quotaRemaining)) &&
    hasEnumValue(META_FALLBACK_REASONS, value.fallbackReason) &&
    hasEnumValue(META_TRIGGERS, value.trigger) &&
    isPlainObject(value.diagnostics) &&
    hasEnumValue(DIAGNOSTIC_RESOLUTION_STATUSES, value.diagnostics.resolutionStatus) &&
    hasEnumValue(DIAGNOSTIC_REJECTION_REASONS, value.diagnostics.rejectionReason) &&
    isDateKey(value.diagnostics.canonicalContextSummary?.activeDate) &&
    typeof value.diagnostics.canonicalContextSummary?.isToday === "boolean" &&
    typeof value.diagnostics.canonicalContextSummary?.hasActiveSessionForActiveDate === "boolean" &&
    typeof value.diagnostics.canonicalContextSummary?.hasOpenSessionOutsideActiveDate === "boolean" &&
    Number.isInteger(value.diagnostics.canonicalContextSummary?.futureSessionsCount) &&
    value.diagnostics.canonicalContextSummary.futureSessionsCount >= 0 &&
    typeof value.diagnostics.canonicalContextSummary?.hasPlannedActionsForActiveDate === "boolean" &&
    typeof value.diagnostics.canonicalContextSummary?.hasFocusOccurrenceForActiveDate === "boolean"
  );
}

export function isAiCoachResponse(value) {
  return (
    isPlainObject(value) &&
    hasEnumValue(COACH_KINDS, value.kind) &&
    hasEnumValue(DECISION_SOURCES, value.decisionSource) &&
    (value.interventionType === null || hasEnumValue(INTERVENTION_TYPES, value.interventionType)) &&
    typeof value.headline === "string" &&
    value.headline.length <= 72 &&
    typeof value.reason === "string" &&
    value.reason.length <= 160 &&
    isCoachAction(value.primaryAction) &&
    (value.secondaryAction === null || isCoachAction(value.secondaryAction)) &&
    (value.suggestedDurationMin === null ||
      (Number.isInteger(value.suggestedDurationMin) &&
        value.suggestedDurationMin >= 1 &&
        value.suggestedDurationMin <= 240)) &&
    typeof value.confidence === "number" &&
    value.confidence >= 0 &&
    value.confidence <= 1 &&
    hasEnumValue(URGENCY_LEVELS, value.urgency) &&
    hasEnumValue(UI_TONES, value.uiTone) &&
    hasEnumValue(TOOL_INTENTS, value.toolIntent) &&
    isRewardSuggestion(value.rewardSuggestion) &&
    isCoachMeta(value.meta)
  );
}

function normalizeBackendErrorCode(status, backendErrorCode) {
  const code = String(backendErrorCode || "").trim().toUpperCase();
  if (code === "AUTH_MISSING" || code === "AUTH_INVALID" || code === "UNAUTHORIZED") return "UNAUTHORIZED";
  if (code === "RATE_LIMITED") return "RATE_LIMITED";
  if (code === "QUOTA_EXCEEDED") return "QUOTA_EXCEEDED";
  if (code === "BACKEND_SCHEMA_MISSING") return "BACKEND_SCHEMA_MISSING";
  if (code === "INVALID_RESPONSE") return "INVALID_RESPONSE";
  if (code === "BACKEND_ERROR") return "BACKEND_ERROR";
  if (
    code === "SNAPSHOT_LOAD_FAILED" ||
    code === "QUOTA_LOAD_FAILED" ||
    code === "CONTEXT_BUILD_FAILED" ||
    code === "PROVIDER_FAILED" ||
    code === "UNKNOWN_BACKEND_ERROR"
  ) {
    return "BACKEND_ERROR";
  }
  if (status === 401) return "UNAUTHORIZED";
  if (status === 429) return "RATE_LIMITED";
  if (status === 503) return "BACKEND_ERROR";
  return "BACKEND_ERROR";
}

async function safeParseJson(response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

export async function requestAiNow({
  accessToken,
  payload,
  baseUrl,
  fetchImpl = globalThis.fetch,
}) {
  const resolvedBaseUrl = readAiBackendBaseUrl(baseUrl);
  const buildTransport = (errorCode = null) => buildAiTransportMeta({ baseUrl: resolvedBaseUrl, errorCode });
  if (!resolvedBaseUrl) {
    return {
      ok: false,
      errorCode: "DISABLED",
      coach: null,
      status: null,
      transportMeta: buildTransport("DISABLED"),
    };
  }
  if (typeof fetchImpl !== "function") {
    const transportMeta = buildTransport("NETWORK_ERROR");
    logAiTransportIssue({ endpoint: "/ai/now", errorCode: "NETWORK_ERROR", transportMeta });
    return { ok: false, errorCode: "NETWORK_ERROR", coach: null, status: null, transportMeta };
  }
  if (!String(accessToken || "").trim()) {
    return {
      ok: false,
      errorCode: "UNAUTHORIZED",
      coach: null,
      status: 401,
      transportMeta: buildTransport("UNAUTHORIZED"),
    };
  }

  let normalizedPayload;
  try {
    normalizedPayload = normalizeAiNowPayload(payload);
  } catch {
    return {
      ok: false,
      errorCode: "INVALID_RESPONSE",
      coach: null,
      status: null,
      transportMeta: buildTransport("INVALID_RESPONSE"),
    };
  }

  let response;
  try {
    response = await fetchImpl(`${resolvedBaseUrl}/ai/now`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(normalizedPayload),
    });
  } catch {
    const transportMeta = buildTransport("NETWORK_ERROR");
    logAiTransportIssue({ endpoint: "/ai/now", errorCode: "NETWORK_ERROR", transportMeta });
    return { ok: false, errorCode: "NETWORK_ERROR", coach: null, status: null, transportMeta };
  }

  const body = await safeParseJson(response);
  if (!response.ok) {
    const errorCode = normalizeBackendErrorCode(response.status, body?.error);
    return {
      ok: false,
      errorCode,
      coach: null,
      status: response.status,
      requestId: typeof body?.requestId === "string" ? body.requestId : null,
      transportMeta: buildTransport(errorCode),
    };
  }

  if (!isAiCoachResponse(body)) {
    return {
      ok: false,
      errorCode: "INVALID_RESPONSE",
      coach: null,
      status: response.status,
      requestId: typeof body?.meta?.requestId === "string" ? body.meta.requestId : null,
      transportMeta: buildTransport("INVALID_RESPONSE"),
    };
  }

  return {
    ok: true,
    errorCode: null,
    coach: body,
    status: response.status,
    requestId: body.meta.requestId,
    transportMeta: buildTransport(null),
  };
}
