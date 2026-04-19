const ENV =
  typeof import.meta !== "undefined" && import.meta.env && typeof import.meta.env === "object"
    ? import.meta.env
    : {};

function normalizeString(value) {
  return String(value || "").trim().toLowerCase();
}

export const SESSION_GUIDANCE_OPERATIONS = Object.freeze({
  PREPARE: "prepare",
  ADJUST: "adjust",
  TOOL: "tool",
});

export const SESSION_GUIDANCE_BACKEND_STATES = Object.freeze({
  UNKNOWN: "unknown",
  AVAILABLE: "available",
  UNAVAILABLE: "unavailable",
});

export const SESSION_GUIDANCE_EXECUTION_SOURCES = Object.freeze({
  LOCAL_ONLY: "local_only",
  AI_APPLIED: "ai_applied",
  AI_FAILED_FALLBACK: "ai_failed_fallback",
  BACKEND_UNAVAILABLE_FALLBACK: "backend_unavailable_fallback",
});

export function normalizeSessionGuidanceOperation(value, fallback = SESSION_GUIDANCE_OPERATIONS.PREPARE) {
  const next = normalizeString(value);
  if (next === SESSION_GUIDANCE_OPERATIONS.PREPARE) return SESSION_GUIDANCE_OPERATIONS.PREPARE;
  if (next === SESSION_GUIDANCE_OPERATIONS.ADJUST) return SESSION_GUIDANCE_OPERATIONS.ADJUST;
  if (next === SESSION_GUIDANCE_OPERATIONS.TOOL) return SESSION_GUIDANCE_OPERATIONS.TOOL;
  return next === SESSION_GUIDANCE_OPERATIONS.ADJUST || next === SESSION_GUIDANCE_OPERATIONS.TOOL
    ? next
    : fallback;
}

export function normalizeSessionGuidanceBackendState(
  value,
  fallback = SESSION_GUIDANCE_BACKEND_STATES.UNKNOWN
) {
  const next = normalizeString(value);
  if (next === SESSION_GUIDANCE_BACKEND_STATES.AVAILABLE) return SESSION_GUIDANCE_BACKEND_STATES.AVAILABLE;
  if (next === SESSION_GUIDANCE_BACKEND_STATES.UNAVAILABLE) return SESSION_GUIDANCE_BACKEND_STATES.UNAVAILABLE;
  return fallback === SESSION_GUIDANCE_BACKEND_STATES.AVAILABLE ||
    fallback === SESSION_GUIDANCE_BACKEND_STATES.UNAVAILABLE
    ? fallback
    : SESSION_GUIDANCE_BACKEND_STATES.UNKNOWN;
}

export function shouldAttemptSessionGuidanceBackend({
  backendState = SESSION_GUIDANCE_BACKEND_STATES.UNKNOWN,
  accessToken = "",
  forceAttempt = false,
} = {}) {
  if (!String(accessToken || "").trim()) return false;
  if (forceAttempt) return true;
  return normalizeSessionGuidanceBackendState(backendState) !== SESSION_GUIDANCE_BACKEND_STATES.UNAVAILABLE;
}

export function resolveSessionGuidanceBackendState(
  currentState = SESSION_GUIDANCE_BACKEND_STATES.UNKNOWN,
  result = null
) {
  const normalizedCurrent = normalizeSessionGuidanceBackendState(currentState);
  if (result?.ok) return SESSION_GUIDANCE_BACKEND_STATES.AVAILABLE;
  const code = String(result?.errorCode || result?.backendErrorCode || "").trim().toUpperCase();
  if (code === "DISABLED" || code === "BACKEND_UNAVAILABLE" || code === "SESSION_GUIDANCE_BACKEND_UNAVAILABLE") {
    return SESSION_GUIDANCE_BACKEND_STATES.UNAVAILABLE;
  }
  return normalizedCurrent;
}

export function resolveSessionGuidanceExecutionSource({
  attempted = false,
  result = null,
  applied = false,
  backendState = SESSION_GUIDANCE_BACKEND_STATES.UNKNOWN,
  cacheHit = false,
} = {}) {
  if (cacheHit) return SESSION_GUIDANCE_EXECUTION_SOURCES.LOCAL_ONLY;
  if (applied) return SESSION_GUIDANCE_EXECUTION_SOURCES.AI_APPLIED;
  if (!attempted) {
    return normalizeSessionGuidanceBackendState(backendState) === SESSION_GUIDANCE_BACKEND_STATES.UNAVAILABLE
      ? SESSION_GUIDANCE_EXECUTION_SOURCES.BACKEND_UNAVAILABLE_FALLBACK
      : SESSION_GUIDANCE_EXECUTION_SOURCES.LOCAL_ONLY;
  }

  const code = String(result?.errorCode || result?.backendErrorCode || "").trim().toUpperCase();
  if (code === "DISABLED" || code === "BACKEND_UNAVAILABLE" || code === "SESSION_GUIDANCE_BACKEND_UNAVAILABLE") {
    return SESSION_GUIDANCE_EXECUTION_SOURCES.BACKEND_UNAVAILABLE_FALLBACK;
  }
  return SESSION_GUIDANCE_EXECUTION_SOURCES.AI_FAILED_FALLBACK;
}

function shouldLogSessionGuidanceDiagnostics() {
  if (String(ENV.MODE || "").trim().toLowerCase() === "test") return false;
  if (typeof window === "undefined") return false;
  if (ENV.DEV) return true;
  const hostname = String(window.location?.hostname || "").trim();
  return hostname === "localhost" || hostname === "127.0.0.1";
}

export function logSessionGuidanceResolution({
  operation,
  source,
  planSource = null,
  backendState = SESSION_GUIDANCE_BACKEND_STATES.UNKNOWN,
  requestId = null,
  errorCode = null,
  backendErrorCode = null,
  entitlement = null,
  backendAttempted = null,
  validationPassed = null,
  richnessPassed = null,
  failoverReason = null,
  degradedStateShown = null,
  cause = null,
  toolId = null,
  cacheHit = null,
  preparedAt = null,
  model = null,
  promptVersion = null,
  cacheKey = null,
  occurrenceId = null,
  actionId = null,
  latencyMs = null,
} = {}) {
  if (!shouldLogSessionGuidanceDiagnostics()) return;
  console.info("[session-guidance]", {
    operation: normalizeSessionGuidanceOperation(operation),
    source: String(source || "").trim() || null,
    planSource: String(planSource || "").trim() || null,
    backendState: normalizeSessionGuidanceBackendState(backendState),
    requestId: String(requestId || "").trim() || null,
    errorCode: String(errorCode || "").trim().toUpperCase() || null,
    backendErrorCode: String(backendErrorCode || "").trim().toUpperCase() || null,
    entitlement: String(entitlement || "").trim() || null,
    backendAttempted: typeof backendAttempted === "boolean" ? backendAttempted : null,
    validationPassed: typeof validationPassed === "boolean" ? validationPassed : null,
    richnessPassed: typeof richnessPassed === "boolean" ? richnessPassed : null,
    failoverReason: String(failoverReason || "").trim() || null,
    degradedStateShown: typeof degradedStateShown === "boolean" ? degradedStateShown : null,
    cause: String(cause || "").trim() || null,
    toolId: String(toolId || "").trim() || null,
    cacheHit: typeof cacheHit === "boolean" ? cacheHit : null,
    preparedAt: Number.isFinite(preparedAt) ? Math.max(0, Math.round(preparedAt)) : null,
    model: String(model || "").trim() || null,
    promptVersion: String(promptVersion || "").trim() || null,
    cacheKey: String(cacheKey || "").trim() || null,
    occurrenceId: String(occurrenceId || "").trim() || null,
    actionId: String(actionId || "").trim() || null,
    latencyMs: Number.isFinite(latencyMs) ? Math.max(0, Math.round(latencyMs)) : null,
  });
}
