import { readAiBackendBaseUrl } from "./aiNowClient";

const DATE_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;
const ACTION_INTENTS = new Set([
  "start_occurrence",
  "resume_session",
  "open_library",
  "open_pilotage",
  "open_today",
]);
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

export function isAiCoachChatResponse(value) {
  return (
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

export function normalizeAiCoachChatPayload(input) {
  const source = isPlainObject(input) ? input : {};
  const selectedDateKey = source.selectedDateKey;
  const activeCategoryId = source.activeCategoryId ?? null;
  const message = typeof source.message === "string" ? source.message.trim() : "";
  const recentMessages = Array.isArray(source.recentMessages) ? source.recentMessages : [];

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
  if (!resolvedBaseUrl) {
    return { ok: false, errorCode: "DISABLED", reply: null, status: null };
  }
  if (typeof fetchImpl !== "function") {
    return { ok: false, errorCode: "NETWORK_ERROR", reply: null, status: null };
  }
  if (!String(accessToken || "").trim()) {
    return { ok: false, errorCode: "UNAUTHORIZED", reply: null, status: 401 };
  }

  let normalizedPayload;
  try {
    normalizedPayload = normalizeAiCoachChatPayload(payload);
  } catch {
    return { ok: false, errorCode: "INVALID_RESPONSE", reply: null, status: null };
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
    return { ok: false, errorCode: "NETWORK_ERROR", reply: null, status: null };
  }

  const body = await safeParseJson(response);
  if (!response.ok) {
    return {
      ok: false,
      errorCode: normalizeBackendErrorCode(response.status, body?.error),
      reply: null,
      status: response.status,
      requestId: typeof body?.requestId === "string" ? body.requestId : null,
    };
  }

  if (!isAiCoachChatResponse(body)) {
    return {
      ok: false,
      errorCode: "INVALID_RESPONSE",
      reply: null,
      status: response.status,
    };
  }

  return {
    ok: true,
    errorCode: null,
    reply: body,
    status: response.status,
  };
}
