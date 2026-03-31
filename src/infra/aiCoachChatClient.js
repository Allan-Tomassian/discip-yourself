import { readAiBackendBaseUrl } from "./aiNowClient";
import { buildAiTransportMeta, logAiTransportIssue } from "./aiTransportDiagnostics";

const DATE_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;
const ACTION_INTENTS = new Set([
  "start_occurrence",
  "resume_session",
  "open_library",
  "open_pilotage",
  "open_today",
  "open_support",
]);
const CHAT_MODES = new Set(["card", "free", "plan"]);
const DRAFT_CHANGE_TYPES = new Set([
  "create_action",
  "update_action",
  "schedule_action",
  "reschedule_occurrence",
  "archive_action",
]);
const DRAFT_REPEAT_TYPES = new Set(["none", "daily", "weekly"]);
const DECISION_SOURCES = new Set(["ai", "rules"]);
const META_FALLBACK_REASONS = new Set(["none", "quota", "timeout", "invalid_model_output", "backend_error"]);
const CHAT_ROLES = new Set(["user", "assistant"]);

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isDateKey(value) {
  return typeof value === "string" && DATE_KEY_RE.test(value);
}

function isNullableString(value) {
  return value === null || typeof value === "string";
}

function isNullableTime(value) {
  return value === null || (typeof value === "string" && /^([01]\d|2[0-3]):([0-5]\d)$/.test(value));
}

function isNullableRepeat(value) {
  return value === null || DRAFT_REPEAT_TYPES.has(value);
}

function isChatAction(value) {
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

function isDraftChange(value) {
  if (!isPlainObject(value)) return false;
  if (!DRAFT_CHANGE_TYPES.has(value.type)) return false;
  if (!isNullableString(value.title)) return false;
  if (!isNullableString(value.categoryId)) return false;
  if (!isNullableString(value.actionId)) return false;
  if (!isNullableString(value.occurrenceId)) return false;
  if (!isNullableRepeat(value.repeat)) return false;
  if (!isNullableTime(value.startTime)) return false;
  if (!(value.dateKey === null || isDateKey(value.dateKey))) return false;
  if (
    value.durationMin !== null &&
    (!Number.isInteger(value.durationMin) || value.durationMin < 1 || value.durationMin > 240)
  ) {
    return false;
  }
  if (!Array.isArray(value.daysOfWeek)) return false;
  if (
    value.daysOfWeek.some(
      (day) => !Number.isInteger(day) || day < 1 || day > 7
    )
  ) {
    return false;
  }
  if (value.type === "create_action" && !value.title) return false;
  if (
    (value.type === "update_action" || value.type === "schedule_action" || value.type === "archive_action") &&
    !value.actionId
  ) {
    return false;
  }
  if (value.type === "reschedule_occurrence" && !value.occurrenceId) return false;
  return true;
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

function logCoachChatIssue({
  errorCode,
  status = null,
  transportMeta = null,
  requestId = null,
  mode = null,
  backendErrorCode = null,
  responseKind = null,
  responseMode = null,
  bodyKeys = null,
} = {}) {
  logAiTransportIssue({
    endpoint: "/ai/chat",
    errorCode,
    status,
    requestId,
    mode,
    backendErrorCode,
    responseKind,
    responseMode,
    bodyKeys,
    transportMeta,
  });
}

export function isAiCoachChatResponse(value) {
  const isCardResponse =
    isPlainObject(value) &&
    value.kind === "chat" &&
    DECISION_SOURCES.has(value.decisionSource) &&
    typeof value.headline === "string" &&
    value.headline.length <= 72 &&
    typeof value.reason === "string" &&
    value.reason.length <= 160 &&
    isChatAction(value.primaryAction) &&
    (value.secondaryAction === null || isChatAction(value.secondaryAction)) &&
    (value.suggestedDurationMin === null ||
      (Number.isInteger(value.suggestedDurationMin) &&
        value.suggestedDurationMin >= 1 &&
        value.suggestedDurationMin <= 240)) &&
    Array.isArray(value.draftChanges) &&
    value.draftChanges.length <= 4 &&
    value.draftChanges.every(isDraftChange) &&
    isPlainObject(value.meta) &&
    value.meta.coachVersion === "v1" &&
    typeof value.meta.requestId === "string" &&
    isDateKey(value.meta.selectedDateKey) &&
    isNullableString(value.meta.activeCategoryId) &&
    (value.meta.quotaRemaining === null || Number.isInteger(value.meta.quotaRemaining)) &&
    META_FALLBACK_REASONS.has(value.meta.fallbackReason) &&
    isNullableString(value.meta.messagePreview)
  ;

  const isConversationResponse =
    isPlainObject(value) &&
    value.kind === "conversation" &&
    (value.mode === "free" || value.mode === "plan") &&
    DECISION_SOURCES.has(value.decisionSource) &&
    typeof value.message === "string" &&
    value.message.length > 0 &&
    value.message.length <= 1200 &&
    (value.primaryAction === null || isChatAction(value.primaryAction)) &&
    (value.secondaryAction === null || isChatAction(value.secondaryAction)) &&
    (value.proposal === null || isPlainObject(value.proposal)) &&
    isPlainObject(value.meta) &&
    value.meta.coachVersion === "v1" &&
    typeof value.meta.requestId === "string" &&
    isDateKey(value.meta.selectedDateKey) &&
    isNullableString(value.meta.activeCategoryId) &&
    (value.meta.quotaRemaining === null || Number.isInteger(value.meta.quotaRemaining)) &&
    META_FALLBACK_REASONS.has(value.meta.fallbackReason) &&
    isNullableString(value.meta.messagePreview);

  return isCardResponse || isConversationResponse;
}

export function normalizeAiCoachChatPayload(input) {
  const source = isPlainObject(input) ? input : {};
  const selectedDateKey = source.selectedDateKey;
  const activeCategoryId = source.activeCategoryId ?? null;
  const message = typeof source.message === "string" ? source.message.trim() : "";
  const recentMessages = Array.isArray(source.recentMessages) ? source.recentMessages : [];
  const mode = CHAT_MODES.has(source.mode) ? source.mode : "card";

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

  return {
    selectedDateKey,
    activeCategoryId,
    message,
    mode,
    recentMessages: recentMessages
      .filter((entry) => isPlainObject(entry) && CHAT_ROLES.has(entry.role))
      .map((entry) => ({
        role: entry.role,
        content: typeof entry.content === "string" ? entry.content.slice(0, 500) : "",
      }))
      .filter((entry) => entry.content)
      .slice(-6),
  };
}

function normalizeBackendErrorCode(status, backendErrorCode) {
  const code = String(backendErrorCode || "").trim().toUpperCase();
  if (code === "UNAUTHORIZED") return "UNAUTHORIZED";
  if (code === "RATE_LIMITED") return "RATE_LIMITED";
  if (code === "QUOTA_EXCEEDED") return "QUOTA_EXCEEDED";
  if (code === "BACKEND_SCHEMA_MISSING") return "BACKEND_SCHEMA_MISSING";
  if (code === "BACKEND_ERROR") return "BACKEND_ERROR";
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

export async function requestAiCoachChat({
  accessToken,
  payload,
  baseUrl,
  fetchImpl = globalThis.fetch,
}) {
  const resolvedBaseUrl = readAiBackendBaseUrl(baseUrl);
  const buildTransport = (errorCode = null) => buildAiTransportMeta({ baseUrl: resolvedBaseUrl, errorCode });
  if (!resolvedBaseUrl) {
    const transportMeta = buildTransport("DISABLED");
    logCoachChatIssue({ errorCode: "DISABLED", transportMeta, mode: payload?.mode || null });
    return {
      ok: false,
      errorCode: "DISABLED",
      reply: null,
      status: null,
      requestId: null,
      backendErrorCode: null,
      responseKind: null,
      responseMode: null,
      transportMeta,
    };
  }
  if (typeof fetchImpl !== "function") {
    const transportMeta = buildTransport("NETWORK_ERROR");
    logCoachChatIssue({ errorCode: "NETWORK_ERROR", transportMeta, mode: payload?.mode || null });
    return {
      ok: false,
      errorCode: "NETWORK_ERROR",
      reply: null,
      status: null,
      requestId: null,
      backendErrorCode: null,
      responseKind: null,
      responseMode: null,
      transportMeta,
    };
  }
  if (!String(accessToken || "").trim()) {
    const transportMeta = buildTransport("UNAUTHORIZED");
    logCoachChatIssue({ errorCode: "UNAUTHORIZED", status: 401, transportMeta, mode: payload?.mode || null });
    return {
      ok: false,
      errorCode: "UNAUTHORIZED",
      reply: null,
      status: 401,
      requestId: null,
      backendErrorCode: "UNAUTHORIZED",
      responseKind: null,
      responseMode: null,
      transportMeta,
    };
  }

  let normalizedPayload;
  try {
    normalizedPayload = normalizeAiCoachChatPayload(payload);
  } catch {
    const transportMeta = buildTransport("INVALID_RESPONSE");
    logCoachChatIssue({ errorCode: "INVALID_RESPONSE", transportMeta, mode: payload?.mode || null });
    return {
      ok: false,
      errorCode: "INVALID_RESPONSE",
      reply: null,
      status: null,
      requestId: null,
      backendErrorCode: null,
      responseKind: null,
      responseMode: null,
      transportMeta,
    };
  }

  let response;
  try {
    response = await fetchImpl(`${resolvedBaseUrl}/ai/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(normalizedPayload),
    });
  } catch {
    const transportMeta = buildTransport("NETWORK_ERROR");
    logCoachChatIssue({ errorCode: "NETWORK_ERROR", transportMeta, mode: normalizedPayload.mode });
    return {
      ok: false,
      errorCode: "NETWORK_ERROR",
      reply: null,
      status: null,
      requestId: null,
      backendErrorCode: null,
      responseKind: null,
      responseMode: null,
      transportMeta,
    };
  }

  const body = await safeParseJson(response);
  const bodySummary = summarizeBodyShape(body);
  if (!response.ok) {
    const errorCode = normalizeBackendErrorCode(response.status, body?.error);
    const transportMeta = buildTransport(errorCode);
    logCoachChatIssue({
      errorCode,
      status: response.status,
      requestId: bodySummary.requestId,
      mode: normalizedPayload.mode,
      backendErrorCode: body?.error || null,
      responseKind: bodySummary.responseKind,
      responseMode: bodySummary.responseMode,
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
      responseMode: bodySummary.responseMode,
      transportMeta,
    };
  }

  if (!isAiCoachChatResponse(body)) {
    const transportMeta = buildTransport("INVALID_RESPONSE");
    logCoachChatIssue({
      errorCode: "INVALID_RESPONSE",
      status: response.status,
      requestId: bodySummary.requestId,
      mode: normalizedPayload.mode,
      responseKind: bodySummary.responseKind,
      responseMode: bodySummary.responseMode,
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
      responseMode: bodySummary.responseMode,
      transportMeta,
    };
  }

  return {
    ok: true,
    errorCode: null,
    reply: body,
    status: response.status,
    requestId: bodySummary.requestId,
    backendErrorCode: null,
    responseKind: bodySummary.responseKind,
    responseMode: bodySummary.responseMode,
    transportMeta: buildTransport(null),
  };
}
