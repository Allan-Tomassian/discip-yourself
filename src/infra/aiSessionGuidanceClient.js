import { buildAiTransportMeta, logAiTransportIssue } from "./aiTransportDiagnostics";
import { readAiBackendBaseUrl } from "./aiNowClient";

const DATE_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;
const GUIDANCE_MODES = new Set(["prepare", "adjust", "tool"]);

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isDateKey(value) {
  return typeof value === "string" && DATE_KEY_RE.test(value);
}

function isNullableString(value) {
  return value === null || typeof value === "string";
}

function normalizeRuntimeContext(value) {
  const source = isPlainObject(value) ? value : {};
  return {
    currentStepId: isNullableString(source.currentStepId) ? source.currentStepId : null,
    currentItemId: isNullableString(source.currentItemId) ? source.currentItemId : null,
    elapsedSec: Number.isFinite(source.elapsedSec) ? Math.max(0, Math.round(source.elapsedSec)) : 0,
    remainingSec: Number.isFinite(source.remainingSec) ? Math.max(0, Math.round(source.remainingSec)) : 0,
  };
}

export function normalizeAiSessionGuidancePayload(input) {
  const source = isPlainObject(input) ? input : {};
  const mode = typeof source.mode === "string" && GUIDANCE_MODES.has(source.mode) ? source.mode : "";
  if (!mode) {
    const error = new Error("mode must be prepare, adjust, or tool");
    error.code = "INVALID_REQUEST";
    throw error;
  }

  const dateKey = source.dateKey;
  if (!isDateKey(dateKey)) {
    const error = new Error("dateKey must be YYYY-MM-DD");
    error.code = "INVALID_REQUEST";
    throw error;
  }

  const occurrenceId = typeof source.occurrenceId === "string" ? source.occurrenceId.trim() : "";
  const actionId = typeof source.actionId === "string" ? source.actionId.trim() : "";
  if (!occurrenceId || !actionId) {
    const error = new Error("occurrenceId and actionId are required");
    error.code = "INVALID_REQUEST";
    throw error;
  }

  const toolId = typeof source.toolId === "string" ? source.toolId.trim() : "";
  if (mode === "tool" && !toolId) {
    const error = new Error("toolId is required");
    error.code = "INVALID_REQUEST";
    throw error;
  }

  return {
    mode,
    dateKey,
    occurrenceId,
    actionId,
    categoryId: isNullableString(source.categoryId) ? source.categoryId : null,
    blueprintSnapshot: isPlainObject(source.blueprintSnapshot) ? source.blueprintSnapshot : null,
    fallbackRunbook: isPlainObject(source.fallbackRunbook) ? source.fallbackRunbook : null,
    sessionRunbook: isPlainObject(source.sessionRunbook) ? source.sessionRunbook : null,
    toolId,
    cause: typeof source.cause === "string" ? source.cause.trim() : "",
    strategyId: typeof source.strategyId === "string" ? source.strategyId.trim() : "",
    notes: typeof source.notes === "string" ? source.notes.trim().slice(0, 400) : "",
    runtimeContext: normalizeRuntimeContext(source.runtimeContext),
  };
}

export function isAiSessionGuidanceResponse(value) {
  return (
    isPlainObject(value) &&
    value.kind === "session_guidance" &&
    typeof value.mode === "string" &&
    GUIDANCE_MODES.has(value.mode) &&
    isPlainObject(value.payload) &&
    isPlainObject(value.meta)
  );
}

function summarizeBodyShape(body) {
  const source = isPlainObject(body) ? body : {};
  return {
    responseKind: typeof source.kind === "string" ? source.kind : null,
    responseMode: typeof source.mode === "string" ? source.mode : null,
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

export async function requestAiSessionGuidance({
  accessToken,
  payload,
  baseUrl,
  fetchImpl = globalThis.fetch,
  timeoutMs = 2500,
}) {
  const resolvedBaseUrl = readAiBackendBaseUrl(baseUrl);
  const buildTransport = (errorCode = null) => buildAiTransportMeta({ baseUrl: resolvedBaseUrl, errorCode });

  if (!resolvedBaseUrl) {
    return {
      ok: false,
      errorCode: "DISABLED",
      payload: null,
      status: null,
      requestId: null,
      backendErrorCode: null,
      transportMeta: buildTransport("DISABLED"),
    };
  }

  if (typeof fetchImpl !== "function") {
    const transportMeta = buildTransport("NETWORK_ERROR");
    logAiTransportIssue({ endpoint: "/ai/session-guidance", errorCode: "NETWORK_ERROR", transportMeta });
    return {
      ok: false,
      errorCode: "NETWORK_ERROR",
      payload: null,
      status: null,
      requestId: null,
      backendErrorCode: null,
      transportMeta,
    };
  }

  if (!String(accessToken || "").trim()) {
    return {
      ok: false,
      errorCode: "UNAUTHORIZED",
      payload: null,
      status: 401,
      requestId: null,
      backendErrorCode: "UNAUTHORIZED",
      transportMeta: buildTransport("UNAUTHORIZED"),
    };
  }

  let normalizedPayload;
  try {
    normalizedPayload = normalizeAiSessionGuidancePayload(payload);
  } catch {
    return {
      ok: false,
      errorCode: "INVALID_RESPONSE",
      payload: null,
      status: null,
      requestId: null,
      backendErrorCode: null,
      transportMeta: buildTransport("INVALID_RESPONSE"),
    };
  }

  let response;
  const supportsAbortController = typeof AbortController === "function";
  const controller = supportsAbortController ? new AbortController() : null;
  const safeTimeoutMs = Number.isFinite(timeoutMs) ? Math.max(250, Math.round(timeoutMs)) : 2500;
  const timeoutId =
    controller
      ? setTimeout(() => {
          controller.abort();
        }, safeTimeoutMs)
      : 0;
  try {
    response = await fetchImpl(`${resolvedBaseUrl}/ai/session-guidance`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(normalizedPayload),
      signal: controller?.signal,
    });
  } catch {
    if (timeoutId) clearTimeout(timeoutId);
    const errorCode = controller?.signal?.aborted ? "TIMEOUT" : "NETWORK_ERROR";
    const transportMeta = buildTransport(errorCode);
    logAiTransportIssue({ endpoint: "/ai/session-guidance", errorCode, transportMeta });
    return {
      ok: false,
      errorCode,
      payload: null,
      status: null,
      requestId: null,
      backendErrorCode: null,
      transportMeta,
    };
  }
  if (timeoutId) clearTimeout(timeoutId);

  const body = await safeParseJson(response);
  const shape = summarizeBodyShape(body);
  const requestId = shape.requestId;
  const backendErrorCode = normalizeBackendErrorCode(response.status, body?.errorCode);
  const transportMeta = buildTransport(response.ok ? null : backendErrorCode);

  if (!response.ok) {
    logAiTransportIssue({
      endpoint: "/ai/session-guidance",
      errorCode: backendErrorCode,
      status: response.status,
      requestId,
      responseKind: shape.responseKind,
      responseMode: shape.responseMode,
      bodyKeys: shape.bodyKeys,
      transportMeta,
    });
    return {
      ok: false,
      errorCode: backendErrorCode,
      payload: null,
      status: response.status,
      requestId,
      backendErrorCode,
      transportMeta,
    };
  }

  if (!isAiSessionGuidanceResponse(body)) {
    logAiTransportIssue({
      endpoint: "/ai/session-guidance",
      errorCode: "INVALID_RESPONSE",
      status: response.status,
      requestId,
      responseKind: shape.responseKind,
      responseMode: shape.responseMode,
      bodyKeys: shape.bodyKeys,
      transportMeta,
    });
    return {
      ok: false,
      errorCode: "INVALID_RESPONSE",
      payload: null,
      status: response.status,
      requestId,
      backendErrorCode: null,
      transportMeta,
    };
  }

  return {
    ok: true,
    errorCode: null,
    payload: body.payload,
    status: response.status,
    requestId,
    backendErrorCode: null,
    transportMeta,
  };
}
