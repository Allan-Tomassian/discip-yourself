import { validateDayAnalysisResult } from "../features/day-analysis/dayAnalysisContract";
import { buildAiTransportMeta, logAiTransportIssue } from "./aiTransportDiagnostics";
import { ensureAiBackendWarm } from "./aiBackendWarmup";
import { fetchJsonWithTimeout } from "./aiRequest";
import { readAiBackendBaseUrl } from "./aiNowClient";

const AI_SURFACE = "day_analysis";
const DATE_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;

export const DEFAULT_AI_DAY_ANALYSIS_TIMEOUT_MS = 45000;

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function resolveTimeoutMs(timeoutMs) {
  if (Number.isFinite(timeoutMs)) return Math.max(250, Math.round(timeoutMs));
  return DEFAULT_AI_DAY_ANALYSIS_TIMEOUT_MS;
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
  if (code === "AUTH_MISSING") return "AUTH_MISSING";
  if (code === "AUTH_INVALID" || code === "UNAUTHORIZED") return "AUTH_INVALID";
  if (code === "RATE_LIMITED") return "RATE_LIMITED";
  if (code === "QUOTA_EXCEEDED") return "QUOTA_EXCEEDED";
  if (code === "DAY_ANALYSIS_SNAPSHOT_INVALID" || code === "SNAPSHOT_INVALID") return "SNAPSHOT_INVALID";
  if (code === "DAY_ANALYSIS_PROVIDER_TIMEOUT") return "DAY_ANALYSIS_PROVIDER_TIMEOUT";
  if (code === "INVALID_DAY_ANALYSIS_RESPONSE" || code === "INVALID_RESPONSE") {
    return "INVALID_DAY_ANALYSIS_RESPONSE";
  }
  if (code === "DAY_ANALYSIS_BACKEND_UNAVAILABLE") return "BACKEND_UNAVAILABLE";
  if (code === "BACKEND_SCHEMA_MISSING") return "BACKEND_UNAVAILABLE";
  if (code === "SNAPSHOT_LOAD_FAILED" || code === "QUOTA_LOAD_FAILED" || code === "PROVIDER_FAILED") {
    return "BACKEND_UNAVAILABLE";
  }
  if (status === 400 || status === 422) return "SNAPSHOT_INVALID";
  if (status === 401) return "AUTH_INVALID";
  if (status === 403) return "PREMIUM_REQUIRED";
  if (status === 429) return "RATE_LIMITED";
  if (status === 502) return "INVALID_DAY_ANALYSIS_RESPONSE";
  if (status === 503 || status === 404 || status === 405) return "BACKEND_UNAVAILABLE";
  if (status === 504) return "DAY_ANALYSIS_PROVIDER_TIMEOUT";
  return "UNKNOWN";
}

function toTransportErrorCode(errorCode) {
  const code = String(errorCode || "").trim().toUpperCase();
  if (code === "DAY_ANALYSIS_PROVIDER_TIMEOUT") return "TIMEOUT";
  if (code === "INVALID_DAY_ANALYSIS_RESPONSE") return "INVALID_RESPONSE";
  return code || null;
}

async function safeParseJson(response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function normalizeRequestPayload({ snapshot, snapshotHash, clientRequestId }) {
  if (!isPlainObject(snapshot) || snapshot.version !== 1 || !DATE_KEY_RE.test(String(snapshot.dayKey || ""))) {
    const error = new Error("Day analysis request requires a version 1 snapshot with a valid dayKey.");
    error.code = "INVALID_REQUEST";
    throw error;
  }
  const normalizedSnapshotHash = String(snapshotHash || snapshot.snapshotHash || "").trim();
  if (normalizedSnapshotHash.length < 4) {
    const error = new Error("Day analysis request requires a snapshotHash.");
    error.code = "INVALID_REQUEST";
    throw error;
  }

  return {
    snapshot,
    snapshotHash: normalizedSnapshotHash,
    ...(typeof clientRequestId === "string" && clientRequestId.trim()
      ? { clientRequestId: clientRequestId.trim() }
      : {}),
  };
}

export async function requestAiDayAnalysis({
  snapshot,
  snapshotHash,
  clientRequestId,
  accessToken,
  signal,
  timeoutMs,
  baseUrl,
  fetchImpl = globalThis.fetch,
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
    logAiTransportIssue({ endpoint: "/ai/day-analysis", errorCode: "NETWORK_ERROR", transportMeta });
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
    payload = normalizeRequestPayload({ snapshot, snapshotHash, clientRequestId });
  } catch (error) {
    const transportMeta = buildTransport("SNAPSHOT_INVALID");
    return {
      ok: false,
      errorCode: "SNAPSHOT_INVALID",
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
    const normalizedErrorCode = errorCode === "TIMEOUT" ? "DAY_ANALYSIS_PROVIDER_TIMEOUT" : "BACKEND_UNAVAILABLE";
    const transportMeta = buildTransport(normalizedErrorCode, warmupResult?.probableCause || null);
    logAiTransportIssue({
      endpoint: "/ai/day-analysis",
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
    url: `${resolvedBaseUrl}/ai/day-analysis`,
    timeoutMs: resolveTimeoutMs(timeoutMs),
    defaultTimeoutMs: DEFAULT_AI_DAY_ANALYSIS_TIMEOUT_MS,
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
    const errorCode = requestResult.timedOut ? "DAY_ANALYSIS_PROVIDER_TIMEOUT" : "BACKEND_UNAVAILABLE";
    const transportMeta = buildTransport(errorCode);
    logAiTransportIssue({ endpoint: "/ai/day-analysis", errorCode, transportMeta });
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
      endpoint: "/ai/day-analysis",
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
        : null,
      backendErrorCode: rawBackendErrorCode,
      transportMeta,
      validationIssues: [],
      ...buildResultMeta(transportMeta),
    };
  }

  const validation = validateDayAnalysisResult(body, {
    candidates: payload.snapshot.deterministicActions,
    dayKey: payload.snapshot.dayKey,
  });
  if (!validation.ok) {
    const invalidTransportMeta = buildTransport("INVALID_DAY_ANALYSIS_RESPONSE");
    logAiTransportIssue({
      endpoint: "/ai/day-analysis",
      errorCode: "INVALID_DAY_ANALYSIS_RESPONSE",
      status: response.status,
      requestId: shape.requestId,
      bodyKeys: shape.bodyKeys,
      transportMeta: invalidTransportMeta,
    });
    return {
      ok: false,
      errorCode: "INVALID_DAY_ANALYSIS_RESPONSE",
      result: null,
      status: response.status,
      requestId: shape.requestId,
      errorMessage: "Day analysis response failed frontend validation.",
      errorDetails: { validationIssues: validation.issues },
      backendErrorCode: null,
      transportMeta: invalidTransportMeta,
      validationIssues: validation.issues,
      ...buildResultMeta(invalidTransportMeta),
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
