import { buildAiTransportMeta, logAiTransportIssue } from "./aiTransportDiagnostics";
import { readAiBackendBaseUrl } from "./aiNowClient";
import { LOCAL_ANALYSIS_SURFACES, normalizeLocalAnalysisSurface } from "../domain/aiPolicy";
import { resolveAiIntentForLocalAnalysis } from "../domain/aiIntent";

const DATE_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;
const ACTION_INTENTS = new Set([
  "start_occurrence",
  "resume_session",
  "open_library",
  "open_planning",
  "open_pilotage",
  "open_today",
  "open_support",
]);
const DECISION_SOURCES = new Set(["ai", "rules"]);
const META_FALLBACK_REASONS = new Set(["none", "quota", "timeout", "invalid_model_output", "backend_error"]);
const DIRECTION_KEYS = new Set(["maintenir", "recalibrer", "accélérer", "alléger"]);
const AI_SURFACE = "analysis";

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isDateKey(value) {
  return typeof value === "string" && DATE_KEY_RE.test(value);
}

function isNullableString(value) {
  return value === null || typeof value === "string";
}

function isLocalAnalysisAction(value) {
  return (
    isPlainObject(value) &&
    typeof value.label === "string" &&
    value.label.length <= 32 &&
    ACTION_INTENTS.has(value.intent) &&
    isNullableString(value.categoryId) &&
    isNullableString(value.actionId) &&
    isNullableString(value.occurrenceId) &&
    (value.dateKey === null || isDateKey(value.dateKey))
  );
}

function summarizeBodyShape(body) {
  const source = isPlainObject(body) ? body : {};
  return {
    responseKind: typeof source.kind === "string" ? source.kind : null,
    requestId:
      typeof source.requestId === "string"
        ? source.requestId
        : typeof source.meta?.requestId === "string"
          ? source.meta.requestId
          : null,
    bodyKeys: Object.keys(source),
  };
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

function logLocalAnalysisIssue({
  errorCode,
  status = null,
  transportMeta = null,
  requestId = null,
  surface = null,
  backendErrorCode = null,
  responseKind = null,
  bodyKeys = null,
} = {}) {
  logAiTransportIssue({
    endpoint: "/ai/local-analysis",
    errorCode,
    status,
    requestId,
    mode: surface,
    backendErrorCode,
    responseKind,
    responseMode: null,
    bodyKeys,
    transportMeta,
  });
}

export function isAiLocalAnalysisResponse(value) {
  return (
    isPlainObject(value) &&
    value.kind === "chat" &&
    DECISION_SOURCES.has(value.decisionSource) &&
    typeof value.headline === "string" &&
    value.headline.length <= 72 &&
    typeof value.reason === "string" &&
    value.reason.length <= 160 &&
    (value.direction === undefined || value.direction === null || DIRECTION_KEYS.has(value.direction)) &&
    isLocalAnalysisAction(value.primaryAction) &&
    (value.secondaryAction === null || isLocalAnalysisAction(value.secondaryAction)) &&
    (value.suggestedDurationMin === null ||
      (Number.isInteger(value.suggestedDurationMin) &&
        value.suggestedDurationMin >= 1 &&
        value.suggestedDurationMin <= 240)) &&
    isPlainObject(value.meta) &&
    value.meta.coachVersion === "v1" &&
    typeof value.meta.requestId === "string" &&
    isDateKey(value.meta.selectedDateKey) &&
    isNullableString(value.meta.activeCategoryId) &&
    (value.meta.quotaRemaining === null || Number.isInteger(value.meta.quotaRemaining)) &&
    META_FALLBACK_REASONS.has(value.meta.fallbackReason) &&
    isNullableString(value.meta.messagePreview)
  );
}

export function normalizeAiLocalAnalysisPayload(input) {
  const source = isPlainObject(input) ? input : {};
  const selectedDateKey = source.selectedDateKey;
  const activeCategoryId = source.activeCategoryId ?? null;
  const message = typeof source.message === "string" ? source.message.trim() : "";
  const surface = normalizeLocalAnalysisSurface(source.surface, LOCAL_ANALYSIS_SURFACES.GENERIC);

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
  if (!message || message.length > 500) {
    const error = new Error("message must be 1..500 chars");
    error.code = "INVALID_REQUEST";
    throw error;
  }
  if (
    surface !== LOCAL_ANALYSIS_SURFACES.PLANNING &&
    surface !== LOCAL_ANALYSIS_SURFACES.PILOTAGE &&
    surface !== LOCAL_ANALYSIS_SURFACES.OBJECTIVES
  ) {
    const error = new Error("surface must be planning, objectives, or pilotage");
    error.code = "INVALID_REQUEST";
    throw error;
  }

  return {
    selectedDateKey,
    activeCategoryId,
    surface,
    aiIntent: resolveAiIntentForLocalAnalysis({
      requestedIntent: source.aiIntent,
      surface,
    }),
    message,
  };
}

export async function requestAiLocalAnalysis({
  accessToken,
  payload,
  baseUrl,
  fetchImpl = globalThis.fetch,
}) {
  const resolvedBaseUrl = readAiBackendBaseUrl(baseUrl);
  const buildTransport = (errorCode = null) => buildAiTransportMeta({ baseUrl: resolvedBaseUrl, errorCode });
  const buildResultMeta = (transportMeta, analysisSurface = payload?.surface || null) => ({
    surface: AI_SURFACE,
    analysisSurface,
    probableCause: transportMeta?.probableCause || null,
    baseUrlUsed: transportMeta?.backendBaseUrl || resolvedBaseUrl || "",
    originUsed: transportMeta?.frontendOrigin || "",
  });
  if (!resolvedBaseUrl) {
    const transportMeta = buildTransport("DISABLED");
    logLocalAnalysisIssue({ errorCode: "DISABLED", transportMeta, surface: payload?.surface || null });
    return {
      ok: false,
      errorCode: "DISABLED",
      reply: null,
      status: null,
      requestId: null,
      backendErrorCode: null,
      responseKind: null,
      transportMeta,
      ...buildResultMeta(transportMeta),
    };
  }
  if (typeof fetchImpl !== "function") {
    const transportMeta = buildTransport("NETWORK_ERROR");
    logLocalAnalysisIssue({ errorCode: "NETWORK_ERROR", transportMeta, surface: payload?.surface || null });
    return {
      ok: false,
      errorCode: "NETWORK_ERROR",
      reply: null,
      status: null,
      requestId: null,
      backendErrorCode: null,
      responseKind: null,
      transportMeta,
      ...buildResultMeta(transportMeta),
    };
  }
  if (!String(accessToken || "").trim()) {
    const transportMeta = buildTransport("UNAUTHORIZED");
    logLocalAnalysisIssue({ errorCode: "UNAUTHORIZED", status: 401, transportMeta, surface: payload?.surface || null });
    return {
      ok: false,
      errorCode: "UNAUTHORIZED",
      reply: null,
      status: 401,
      requestId: null,
      backendErrorCode: "UNAUTHORIZED",
      responseKind: null,
      transportMeta,
      ...buildResultMeta(transportMeta),
    };
  }

  let normalizedPayload;
  try {
    normalizedPayload = normalizeAiLocalAnalysisPayload(payload);
  } catch {
    const transportMeta = buildTransport("INVALID_RESPONSE");
    logLocalAnalysisIssue({ errorCode: "INVALID_RESPONSE", transportMeta, surface: payload?.surface || null });
    return {
      ok: false,
      errorCode: "INVALID_RESPONSE",
      reply: null,
      status: null,
      requestId: null,
      backendErrorCode: null,
      responseKind: null,
      transportMeta,
      ...buildResultMeta(transportMeta),
    };
  }

  let response;
  try {
    response = await fetchImpl(`${resolvedBaseUrl}/ai/local-analysis`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
        "x-discip-surface": AI_SURFACE,
      },
      body: JSON.stringify(normalizedPayload),
    });
  } catch {
    const transportMeta = buildTransport("NETWORK_ERROR");
    logLocalAnalysisIssue({ errorCode: "NETWORK_ERROR", transportMeta, surface: normalizedPayload.surface });
    return {
      ok: false,
      errorCode: "NETWORK_ERROR",
      reply: null,
      status: null,
      requestId: null,
      backendErrorCode: null,
      responseKind: null,
      transportMeta,
      ...buildResultMeta(transportMeta, normalizedPayload.surface),
    };
  }

  const body = await safeParseJson(response);
  const bodySummary = summarizeBodyShape(body);
  if (!response.ok) {
    const errorCode = normalizeBackendErrorCode(response.status, body?.error);
    const transportMeta = buildTransport(errorCode);
    logLocalAnalysisIssue({
      errorCode,
      status: response.status,
      requestId: bodySummary.requestId,
      surface: normalizedPayload.surface,
      backendErrorCode: body?.error || null,
      responseKind: bodySummary.responseKind,
      bodyKeys: bodySummary.bodyKeys,
      transportMeta,
    });
    return {
      ok: false,
      errorCode,
      reply: null,
      status: response.status,
      requestId: bodySummary.requestId,
      backendErrorCode: typeof body?.error === "string" ? body.error : null,
      responseKind: bodySummary.responseKind,
      transportMeta,
      ...buildResultMeta(transportMeta, normalizedPayload.surface),
    };
  }

  if (!isAiLocalAnalysisResponse(body)) {
    const transportMeta = buildTransport("INVALID_RESPONSE");
    logLocalAnalysisIssue({
      errorCode: "INVALID_RESPONSE",
      status: response.status,
      requestId: bodySummary.requestId,
      surface: normalizedPayload.surface,
      responseKind: bodySummary.responseKind,
      bodyKeys: bodySummary.bodyKeys,
      transportMeta,
    });
    return {
      ok: false,
      errorCode: "INVALID_RESPONSE",
      reply: null,
      status: response.status,
      requestId: bodySummary.requestId,
      backendErrorCode: null,
      responseKind: bodySummary.responseKind,
      transportMeta,
      ...buildResultMeta(transportMeta, normalizedPayload.surface),
    };
  }

  const transportMeta = buildTransport(null);
  return {
    ok: true,
    errorCode: null,
    reply: body,
    status: response.status,
    requestId: bodySummary.requestId,
    backendErrorCode: null,
    responseKind: bodySummary.responseKind,
    transportMeta,
    ...buildResultMeta(transportMeta, normalizedPayload.surface),
  };
}
