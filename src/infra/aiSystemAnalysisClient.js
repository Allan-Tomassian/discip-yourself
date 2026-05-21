import { validateSystemAnalysisResult } from "../features/system-analysis/systemAnalysisContract";
import { buildSystemAnalysisBackendSnapshot } from "../features/system-analysis/systemAnalysisSnapshot";
import { buildAiTransportMeta, logAiTransportIssue } from "./aiTransportDiagnostics";
import { ensureAiBackendWarm } from "./aiBackendWarmup";
import { fetchJsonWithTimeout } from "./aiRequest";
import { readAiBackendBaseUrl } from "./aiNowClient";

const AI_SURFACE = "system_analysis";
const DATE_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;

export const DEFAULT_AI_SYSTEM_ANALYSIS_TIMEOUT_MS = 70000;

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizeLocale(value) {
  const locale = String(value || "").trim();
  return locale || "fr-FR";
}

function normalizeTimezone(value) {
  const timezone = String(value || "").trim();
  return timezone || "Europe/Paris";
}

function normalizeReferenceDateKey(value, snapshot) {
  const candidate = String(value || snapshot?.referenceDateKey || snapshot?.period?.endDateKey || "").trim();
  return DATE_KEY_RE.test(candidate) ? candidate : "";
}

function resolveTimeoutMs(timeoutMs) {
  if (Number.isFinite(timeoutMs)) return Math.max(250, Math.round(timeoutMs));
  return DEFAULT_AI_SYSTEM_ANALYSIS_TIMEOUT_MS;
}

function summarizeBodyShape(body) {
  const source = isPlainObject(body) ? body : {};
  return {
    responseVersion: source.version || null,
    requestId:
      typeof source.requestId === "string"
        ? source.requestId
        : typeof source.modelMeta?.requestId === "string"
          ? source.modelMeta.requestId
          : null,
    bodyKeys: Object.keys(source),
  };
}

function normalizeBackendErrorCode(status, backendErrorCode) {
  const code = String(backendErrorCode || "").trim().toUpperCase();
  if (code === "PREMIUM_REQUIRED") return "PREMIUM_REQUIRED";
  if (code === "SYSTEM_ANALYSIS_INELIGIBLE") return "SYSTEM_ANALYSIS_INELIGIBLE";
  if (code === "SYSTEM_ANALYSIS_PROVIDER_TIMEOUT") return "SYSTEM_ANALYSIS_PROVIDER_TIMEOUT";
  if (code === "INVALID_SYSTEM_ANALYSIS_RESPONSE") return "INVALID_SYSTEM_ANALYSIS_RESPONSE";
  if (code === "SYSTEM_ANALYSIS_QUOTA_EXCEEDED") return "SYSTEM_ANALYSIS_QUOTA_EXCEEDED";
  if (code === "QUOTA_EXCEEDED") return "QUOTA_EXCEEDED";
  if (code === "RATE_LIMITED") return "RATE_LIMITED";
  if (code === "AUTH_MISSING") return "AUTH_MISSING";
  if (code === "AUTH_INVALID" || code === "UNAUTHORIZED") return "AUTH_INVALID";
  if (code === "SYSTEM_ANALYSIS_BACKEND_UNAVAILABLE") return "BACKEND_UNAVAILABLE";
  if (code === "BACKEND_SCHEMA_MISSING") return "BACKEND_UNAVAILABLE";
  if (code === "INVALID_RESPONSE") return "INVALID_SYSTEM_ANALYSIS_RESPONSE";
  if (code === "BACKEND_ERROR") return "BACKEND_UNAVAILABLE";
  if (
    code === "SNAPSHOT_LOAD_FAILED" ||
    code === "QUOTA_LOAD_FAILED" ||
    code === "PROVIDER_FAILED" ||
    code === "UNKNOWN_BACKEND_ERROR"
  ) {
    return "BACKEND_UNAVAILABLE";
  }
  if (status === 401) return "AUTH_INVALID";
  if (status === 403) return "PREMIUM_REQUIRED";
  if (status === 422) return "SYSTEM_ANALYSIS_INELIGIBLE";
  if (status === 429) return "RATE_LIMITED";
  if (status === 502) return "INVALID_SYSTEM_ANALYSIS_RESPONSE";
  if (status === 503 || status === 404 || status === 405) return "BACKEND_UNAVAILABLE";
  if (status === 504) return "SYSTEM_ANALYSIS_PROVIDER_TIMEOUT";
  return "UNKNOWN";
}

function toTransportErrorCode(errorCode) {
  const code = String(errorCode || "").trim().toUpperCase();
  if (code === "SYSTEM_ANALYSIS_PROVIDER_TIMEOUT") return "TIMEOUT";
  if (code === "INVALID_SYSTEM_ANALYSIS_RESPONSE") return "INVALID_RESPONSE";
  if (code === "SYSTEM_ANALYSIS_INELIGIBLE") return "INVALID_RESPONSE";
  return code || null;
}

async function safeParseJson(response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function normalizeRequestPayload({ snapshot, locale, timezone, referenceDateKey, requestId }) {
  const normalizedReferenceDateKey = normalizeReferenceDateKey(referenceDateKey, snapshot);
  if (!isPlainObject(snapshot) || snapshot.version !== 1 || !normalizedReferenceDateKey) {
    const error = new Error("System analysis request requires a version 1 snapshot and a reference date key.");
    error.code = "INVALID_REQUEST";
    throw error;
  }

  return {
    version: 1,
    snapshot: buildSystemAnalysisBackendSnapshot(snapshot),
    locale: normalizeLocale(locale),
    timezone: normalizeTimezone(timezone),
    referenceDateKey: normalizedReferenceDateKey,
    ...(typeof requestId === "string" && requestId.trim() ? { requestId: requestId.trim() } : {}),
  };
}

export async function requestAiSystemAnalysis({
  snapshot,
  locale,
  timezone,
  referenceDateKey,
  accessToken,
  signal,
  timeoutMs,
  baseUrl,
  fetchImpl = globalThis.fetch,
  requestId,
  state,
} = {}) {
  const resolvedBaseUrl = readAiBackendBaseUrl(baseUrl);
  let latestWarmupState = null;
  const buildTransport = (errorCode = null, probableCause = null) =>
    buildAiTransportMeta({
      baseUrl: resolvedBaseUrl,
      errorCode: toTransportErrorCode(errorCode),
      warmupState: latestWarmupState,
      probableCause,
    });
  const buildResultMeta = (transportMeta) => ({
    surface: AI_SURFACE,
    probableCause: transportMeta?.probableCause || null,
    baseUrlUsed: transportMeta?.backendBaseUrl || resolvedBaseUrl || "",
    originUsed: transportMeta?.frontendOrigin || "",
  });

  if (!resolvedBaseUrl) {
    const transportMeta = buildTransport("DISABLED");
    return {
      ok: false,
      errorCode: "BACKEND_UNAVAILABLE",
      result: null,
      status: null,
      requestId: null,
      errorMessage: null,
      errorDetails: null,
      backendErrorCode: null,
      transportMeta,
      validationIssues: [],
      ...buildResultMeta(transportMeta),
    };
  }

  if (typeof fetchImpl !== "function") {
    const transportMeta = buildTransport("NETWORK_ERROR");
    logAiTransportIssue({ endpoint: "/ai/system-analysis", errorCode: "NETWORK_ERROR", transportMeta });
    return {
      ok: false,
      errorCode: "BACKEND_UNAVAILABLE",
      result: null,
      status: null,
      requestId: null,
      errorMessage: null,
      errorDetails: null,
      backendErrorCode: null,
      transportMeta,
      validationIssues: [],
      ...buildResultMeta(transportMeta),
    };
  }

  if (!String(accessToken || "").trim()) {
    const transportMeta = buildTransport("AUTH_MISSING");
    return {
      ok: false,
      errorCode: "AUTH_MISSING",
      result: null,
      status: 401,
      requestId: null,
      errorMessage: null,
      errorDetails: null,
      backendErrorCode: "AUTH_MISSING",
      transportMeta,
      validationIssues: [],
      ...buildResultMeta(transportMeta),
    };
  }

  let payload;
  try {
    payload = normalizeRequestPayload({ snapshot, locale, timezone, referenceDateKey, requestId });
  } catch (error) {
    const transportMeta = buildTransport("INVALID_SYSTEM_ANALYSIS_RESPONSE");
    return {
      ok: false,
      errorCode: "INVALID_SYSTEM_ANALYSIS_RESPONSE",
      result: null,
      status: null,
      requestId: null,
      errorMessage: error?.message || null,
      errorDetails: null,
      backendErrorCode: null,
      transportMeta,
      validationIssues: [],
      ...buildResultMeta(transportMeta),
    };
  }

  const warmupResult = await ensureAiBackendWarm({
    baseUrl: resolvedBaseUrl,
    fetchImpl,
  });
  latestWarmupState = warmupResult?.state || latestWarmupState;
  if (!warmupResult?.ok) {
    const errorCode = String(warmupResult?.errorCode || "").trim().toUpperCase() || "BACKEND_UNAVAILABLE";
    const normalizedErrorCode = errorCode === "TIMEOUT" ? "SYSTEM_ANALYSIS_PROVIDER_TIMEOUT" : "BACKEND_UNAVAILABLE";
    const transportMeta = buildTransport(normalizedErrorCode, warmupResult?.probableCause || null);
    logAiTransportIssue({
      endpoint: "/ai/system-analysis",
      errorCode: normalizedErrorCode,
      status: Number.isInteger(warmupResult?.status) ? warmupResult.status : null,
      transportMeta,
    });
    return {
      ok: false,
      errorCode: normalizedErrorCode,
      result: null,
      status: Number.isInteger(warmupResult?.status) ? warmupResult.status : null,
      requestId: null,
      errorMessage: null,
      errorDetails: null,
      backendErrorCode: null,
      transportMeta,
      validationIssues: [],
      ...buildResultMeta(transportMeta),
    };
  }

  const requestResult = await fetchJsonWithTimeout({
    fetchImpl,
    url: `${resolvedBaseUrl}/ai/system-analysis`,
    timeoutMs: resolveTimeoutMs(timeoutMs),
    defaultTimeoutMs: DEFAULT_AI_SYSTEM_ANALYSIS_TIMEOUT_MS,
    signal,
    options: {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
        "x-discip-surface": AI_SURFACE,
      },
      body: JSON.stringify(payload),
    },
  });

  if (!requestResult.ok) {
    const errorCode = requestResult.timedOut ? "SYSTEM_ANALYSIS_PROVIDER_TIMEOUT" : "BACKEND_UNAVAILABLE";
    const transportMeta = buildTransport(errorCode);
    logAiTransportIssue({ endpoint: "/ai/system-analysis", errorCode, transportMeta });
    return {
      ok: false,
      errorCode,
      result: null,
      status: null,
      requestId: null,
      errorMessage: null,
      errorDetails: requestResult.aborted ? { aborted: true } : null,
      backendErrorCode: null,
      transportMeta,
      validationIssues: [],
      ...buildResultMeta(transportMeta),
    };
  }

  const response = requestResult.response;
  const body = await safeParseJson(response);
  const shape = summarizeBodyShape(body);
  const rawBackendErrorCode =
    typeof body?.error === "string" ? body.error
    : typeof body?.errorCode === "string" ? body.errorCode
    : null;
  const errorCode = normalizeBackendErrorCode(response.status, rawBackendErrorCode);
  const transportMeta = buildTransport(response.ok ? null : errorCode);

  if (!response.ok) {
    logAiTransportIssue({
      endpoint: "/ai/system-analysis",
      errorCode,
      status: response.status,
      requestId: shape.requestId,
      backendErrorCode: rawBackendErrorCode,
      bodyKeys: shape.bodyKeys,
      transportMeta,
    });
    return {
      ok: false,
      errorCode,
      result: null,
      status: response.status,
      requestId: shape.requestId,
      errorMessage: typeof body?.message === "string" ? body.message : null,
      errorDetails: isPlainObject(body?.details)
        ? body.details
        : isPlainObject(body?.quota)
          ? { quota: body.quota }
        : Array.isArray(body?.missingRequirements)
          ? { missingRequirements: body.missingRequirements }
          : null,
      backendErrorCode: rawBackendErrorCode,
      transportMeta,
      validationIssues: [],
      ...buildResultMeta(transportMeta),
    };
  }

  const validation = validateSystemAnalysisResult(body, {
    snapshot: payload.snapshot,
    state,
  });
  if (!validation.ok) {
    logAiTransportIssue({
      endpoint: "/ai/system-analysis",
      errorCode: "INVALID_SYSTEM_ANALYSIS_RESPONSE",
      status: response.status,
      requestId: shape.requestId,
      bodyKeys: shape.bodyKeys,
      transportMeta,
    });
    return {
      ok: false,
      errorCode: "INVALID_SYSTEM_ANALYSIS_RESPONSE",
      result: null,
      status: response.status,
      requestId: shape.requestId,
      errorMessage: "System analysis response failed frontend validation.",
      errorDetails: { validationIssues: validation.issues },
      backendErrorCode: null,
      transportMeta: buildTransport("INVALID_SYSTEM_ANALYSIS_RESPONSE"),
      validationIssues: validation.issues,
      ...buildResultMeta(buildTransport("INVALID_SYSTEM_ANALYSIS_RESPONSE")),
    };
  }

  return {
    ok: true,
    errorCode: null,
    result: validation.normalized,
    status: response.status,
    requestId: shape.requestId,
    errorMessage: null,
    errorDetails: null,
    backendErrorCode: null,
    transportMeta,
    validationIssues: validation.issues,
    ...buildResultMeta(transportMeta),
  };
}
