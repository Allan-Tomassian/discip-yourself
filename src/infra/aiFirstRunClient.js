import { buildAiTransportMeta, logAiTransportIssue } from "./aiTransportDiagnostics";
import { ensureAiBackendWarm } from "./aiBackendWarmup";
import { fetchJsonWithTimeout } from "./aiRequest";
import { readAiBackendBaseUrl } from "./aiNowClient";
import {
  FIRST_RUN_PLAN_RESPONSE_VERSION,
  FIRST_RUN_PLAN_VARIANTS,
  normalizeFirstRunPlanRequestPayload,
  serializeFirstRunPlanInput,
} from "../features/first-run/firstRunPlanContract";

const AI_SURFACE = "onboarding";
export const DEFAULT_AI_FIRST_RUN_TIMEOUT_MS = 60000;

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isNullableString(value) {
  return value === null || typeof value === "string";
}

function isDateKey(value) {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function isTime(value) {
  return typeof value === "string" && /^([01]\d|2[0-3]):([0-5]\d)$/.test(value);
}

async function sha256Hex(value) {
  const source = String(value || "");
  try {
    if (typeof globalThis?.crypto?.subtle?.digest === "function" && typeof TextEncoder === "function") {
      const encoded = new TextEncoder().encode(source);
      const digest = await globalThis.crypto.subtle.digest("SHA-256", encoded);
      return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
    }
  } catch {
    // ignore and fall back to the raw serialized signature
  }
  return source;
}

function normalizeBackendErrorCode(status, backendErrorCode) {
  const code = String(backendErrorCode || "").trim().toUpperCase();
  if (code === "FIRST_RUN_PLAN_PROVIDER_TIMEOUT") return "TIMEOUT";
  if (code === "FIRST_RUN_PLAN_BACKEND_UNAVAILABLE") return "BACKEND_UNAVAILABLE";
  if (code === "AUTH_MISSING") return "AUTH_MISSING";
  if (code === "AUTH_INVALID" || code === "UNAUTHORIZED") return "AUTH_INVALID";
  if (code === "RATE_LIMITED") return "RATE_LIMITED";
  if (code === "QUOTA_EXCEEDED") return "QUOTA_EXCEEDED";
  if (code === "BACKEND_SCHEMA_MISSING") return "BACKEND_UNAVAILABLE";
  if (code === "INVALID_FIRST_RUN_PLAN_RESPONSE" || code === "INVALID_RESPONSE") return "INVALID_RESPONSE";
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
  if (status === 404 || status === 405 || status === 503) return "BACKEND_UNAVAILABLE";
  if (status === 429) return "RATE_LIMITED";
  if (status === 502) return "INVALID_RESPONSE";
  if (status === 504) return "TIMEOUT";
  return "BACKEND_UNAVAILABLE";
}

async function safeParseJson(response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function isPreviewEntry(value) {
  return (
    isPlainObject(value) &&
    typeof value.title === "string" &&
    value.title.length > 0 &&
    typeof value.dayLabel === "string" &&
    typeof value.slotLabel === "string" &&
    typeof value.categoryLabel === "string" &&
    (value.dayKey === "" || isDateKey(value.dayKey)) &&
    (value.minutes === null || Number.isInteger(value.minutes))
  );
}

function isPlanCategorySummaryEntry(value) {
  return (
    isPlainObject(value) &&
    typeof value.id === "string" &&
    typeof value.label === "string" &&
    (value.role === "primary" || value.role === "support") &&
    Number.isInteger(value.blockCount)
  );
}

function isCommitDraftCategory(value) {
  return (
    isPlainObject(value) &&
    typeof value.id === "string" &&
    typeof value.templateId === "string" &&
    typeof value.name === "string" &&
    typeof value.color === "string" &&
    Number.isInteger(value.order)
  );
}

function isCommitDraftGoal(value) {
  return (
    isPlainObject(value) &&
    typeof value.id === "string" &&
    typeof value.categoryId === "string" &&
    typeof value.title === "string" &&
    value.type === "OUTCOME" &&
    Number.isInteger(value.order)
  );
}

function isCommitDraftAction(value) {
  return (
    isPlainObject(value) &&
    typeof value.id === "string" &&
    typeof value.categoryId === "string" &&
    isNullableString(value.parentGoalId) &&
    typeof value.title === "string" &&
    value.type === "PROCESS" &&
    Number.isInteger(value.order) &&
    typeof value.repeat === "string" &&
    Array.isArray(value.daysOfWeek) &&
    (value.timeMode === "FIXED" || value.timeMode === "NONE") &&
    (value.startTime === "" || isTime(value.startTime)) &&
    Array.isArray(value.timeSlots) &&
    Number.isInteger(value.durationMinutes) &&
    Number.isInteger(value.sessionMinutes)
  );
}

function isCommitDraftOccurrence(value) {
  return (
    isPlainObject(value) &&
    typeof value.id === "string" &&
    (typeof value.actionId === "string" || typeof value.goalId === "string") &&
    isDateKey(value.date) &&
    isTime(value.start) &&
    Number.isInteger(value.durationMinutes) &&
    value.status === "planned"
  );
}

function isCommitDraft(value) {
  return (
    isPlainObject(value) &&
    value.version === 1 &&
    Array.isArray(value.categories) &&
    value.categories.every(isCommitDraftCategory) &&
    Array.isArray(value.goals) &&
    value.goals.every(isCommitDraftGoal) &&
    Array.isArray(value.actions) &&
    value.actions.every(isCommitDraftAction) &&
    Array.isArray(value.occurrences) &&
    value.occurrences.every(isCommitDraftOccurrence)
  );
}

function isPlan(value) {
  return (
    isPlainObject(value) &&
    FIRST_RUN_PLAN_VARIANTS.includes(value.id) &&
    FIRST_RUN_PLAN_VARIANTS.includes(value.variant) &&
    typeof value.title === "string" &&
    typeof value.summary === "string" &&
    isPlainObject(value.comparisonMetrics) &&
    Array.isArray(value.categories) &&
    value.categories.every(isPlanCategorySummaryEntry) &&
    Array.isArray(value.preview) &&
    value.preview.every(isPreviewEntry) &&
    Array.isArray(value.todayPreview) &&
    value.todayPreview.every(isPreviewEntry) &&
    isPlainObject(value.rationale) &&
    typeof value.rationale.whyFit === "string" &&
    typeof value.rationale.capacityFit === "string" &&
    typeof value.rationale.constraintFit === "string" &&
    isCommitDraft(value.commitDraft)
  );
}

export function isAiFirstRunPlanResponse(value) {
  return (
    isPlainObject(value) &&
    Number(value.version) === FIRST_RUN_PLAN_RESPONSE_VERSION &&
    value.source === "ai_backend" &&
    typeof value.inputHash === "string" &&
    typeof value.generatedAt === "string" &&
    typeof value.requestId === "string" &&
    typeof value.model === "string" &&
    typeof value.promptVersion === "string" &&
    Array.isArray(value.plans) &&
    value.plans.length === 2 &&
    value.plans.every(isPlan)
  );
}

export async function buildAiFirstRunPlanRequest(input) {
  const payload = normalizeFirstRunPlanRequestPayload(input);
  const inputHash = await sha256Hex(serializeFirstRunPlanInput(payload));
  return { payload, inputHash };
}

export function normalizeAiFirstRunPayloadForTest(input) {
  return normalizeFirstRunPlanRequestPayload(input);
}

export async function requestAiFirstRunPlan({
  accessToken,
  payload,
  baseUrl,
  fetchImpl = globalThis.fetch,
  timeoutMs = DEFAULT_AI_FIRST_RUN_TIMEOUT_MS,
}) {
  const resolvedBaseUrl = readAiBackendBaseUrl(baseUrl);
  let latestWarmupState = null;
  const buildTransport = (errorCode = null, probableCause = null) =>
    buildAiTransportMeta({
      baseUrl: resolvedBaseUrl,
      errorCode,
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
      errorCode: "DISABLED",
      payload: null,
      status: null,
      requestId: null,
      errorMessage: null,
      errorDetails: null,
      backendErrorCode: null,
      transportMeta,
      ...buildResultMeta(transportMeta),
    };
  }

  if (typeof fetchImpl !== "function") {
    const transportMeta = buildTransport("NETWORK_ERROR");
    logAiTransportIssue({ endpoint: "/ai/first-run-plan", errorCode: "NETWORK_ERROR", transportMeta });
    return {
      ok: false,
      errorCode: "NETWORK_ERROR",
      payload: null,
      status: null,
      requestId: null,
      errorMessage: null,
      errorDetails: null,
      backendErrorCode: null,
      transportMeta,
      ...buildResultMeta(transportMeta),
    };
  }

  if (!String(accessToken || "").trim()) {
    const transportMeta = buildTransport("AUTH_MISSING");
    return {
      ok: false,
      errorCode: "AUTH_MISSING",
      payload: null,
      status: 401,
      requestId: null,
      errorMessage: null,
      errorDetails: null,
      backendErrorCode: "AUTH_MISSING",
      transportMeta,
      ...buildResultMeta(transportMeta),
    };
  }

  let normalizedPayload;
  try {
    normalizedPayload = normalizeFirstRunPlanRequestPayload(payload);
  } catch {
    const transportMeta = buildTransport("INVALID_RESPONSE");
    return {
      ok: false,
      errorCode: "INVALID_RESPONSE",
      payload: null,
      status: null,
      requestId: null,
      errorMessage: null,
      errorDetails: null,
      backendErrorCode: null,
      transportMeta,
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
    const transportMeta = buildTransport(errorCode, warmupResult?.probableCause || null);
    logAiTransportIssue({
      endpoint: "/ai/first-run-plan",
      errorCode,
      status: Number.isInteger(warmupResult?.status) ? warmupResult.status : null,
      mode: "first_run_plan",
      transportMeta,
    });
    return {
      ok: false,
      errorCode,
      payload: null,
      status: Number.isInteger(warmupResult?.status) ? warmupResult.status : null,
      requestId: null,
      errorMessage: null,
      errorDetails: null,
      backendErrorCode: null,
      transportMeta,
      ...buildResultMeta(transportMeta),
    };
  }

  const requestResult = await fetchJsonWithTimeout({
    fetchImpl,
    url: `${resolvedBaseUrl}/ai/first-run-plan`,
    timeoutMs,
    defaultTimeoutMs: DEFAULT_AI_FIRST_RUN_TIMEOUT_MS,
    options: {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
        "x-discip-surface": AI_SURFACE,
      },
      body: JSON.stringify(normalizedPayload),
    },
  });
  if (!requestResult.ok) {
    const errorCode = requestResult.timedOut ? "TIMEOUT" : "NETWORK_ERROR";
    const transportMeta = buildTransport(errorCode);
    logAiTransportIssue({ endpoint: "/ai/first-run-plan", errorCode, transportMeta });
    return {
      ok: false,
      errorCode,
      payload: null,
      status: null,
      requestId: null,
      errorMessage: null,
      errorDetails: null,
      backendErrorCode: null,
      transportMeta,
      ...buildResultMeta(transportMeta),
    };
  }
  const response = requestResult.response;

  const body = await safeParseJson(response);
  const requestId =
    typeof body?.requestId === "string"
      ? body.requestId
      : typeof body?.meta?.requestId === "string"
        ? body.meta.requestId
        : null;
  const rawBackendErrorCode =
    typeof body?.error === "string" ? body.error
    : typeof body?.errorCode === "string" ? body.errorCode
    : null;
  const errorCode = normalizeBackendErrorCode(response.status, rawBackendErrorCode);
  const transportMeta = buildTransport(response.ok ? null : errorCode);

  if (!response.ok) {
    logAiTransportIssue({
      endpoint: "/ai/first-run-plan",
      errorCode,
      status: response.status,
      requestId,
      backendErrorCode: rawBackendErrorCode,
      bodyKeys: isPlainObject(body) ? Object.keys(body) : [],
      mode: "first_run_plan",
      transportMeta,
    });
    return {
      ok: false,
      errorCode,
      payload: null,
      status: response.status,
      requestId,
      errorMessage: typeof body?.message === "string" ? body.message : null,
      errorDetails: isPlainObject(body?.details) ? body.details : null,
      backendErrorCode: rawBackendErrorCode,
      transportMeta,
      ...buildResultMeta(transportMeta),
    };
  }

  if (!isAiFirstRunPlanResponse(body)) {
    logAiTransportIssue({
      endpoint: "/ai/first-run-plan",
      errorCode: "INVALID_RESPONSE",
      status: response.status,
      requestId,
      bodyKeys: isPlainObject(body) ? Object.keys(body) : [],
      mode: "first_run_plan",
      transportMeta,
    });
    return {
      ok: false,
      errorCode: "INVALID_RESPONSE",
      payload: null,
      status: response.status,
      requestId,
      errorMessage: null,
      errorDetails: null,
      backendErrorCode: null,
      transportMeta,
      ...buildResultMeta(transportMeta),
    };
  }

  return {
    ok: true,
    errorCode: null,
    payload: body,
    status: response.status,
    requestId,
    errorMessage: null,
    errorDetails: null,
    backendErrorCode: null,
    transportMeta,
    ...buildResultMeta(transportMeta),
  };
}
