import { createHash } from "node:crypto";
import { AI_FEATURE_POLICY } from "../../../src/domain/aiPolicy.js";

const AI_REQUEST_LOG_DIAGNOSTIC_COLUMNS = Object.freeze([
  "feature_id",
  "cost_class",
  "model_class",
  "model",
  "prompt_version",
  "counts_for_quota",
  "usage_units",
  "cache_hit",
  "input_bytes",
  "output_bytes",
  "provider_input_tokens",
  "provider_output_tokens",
  "route_name",
  "mode",
  "protocol_type",
  "provider_status",
  "provider_ms",
  "rejection_stage",
  "rejection_reason",
  "repaired_occurrence_count",
  "repaired_minutes_delta",
  "active_days",
  "light_days",
  "dense_days",
  "validation_passed",
  "richness_passed",
  "step_count",
  "item_count",
  "zod_issue_paths",
]);

function sha256(value) {
  return createHash("sha256").update(String(value || "")).digest("hex");
}

export function hashValue(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  return sha256(raw);
}

function toNonNegativeInteger(value, fallback = null) {
  if (!Number.isFinite(value)) return fallback;
  return Math.max(0, Math.round(value));
}

function normalizeOptionalString(value) {
  const raw = String(value || "").trim();
  return raw || null;
}

function resolveFeaturePolicy(featureId) {
  const normalizedFeatureId = normalizeOptionalString(featureId);
  if (!normalizedFeatureId) return null;
  return AI_FEATURE_POLICY[normalizedFeatureId] || null;
}

export function resolveAiRequestCountsForQuota({
  statusCode = 200,
  cacheHit = false,
  validationOk = undefined,
  providerStatus = null,
  errorCode = null,
} = {}) {
  const status = Number.isFinite(statusCode) ? Math.round(statusCode) : 200;
  if (cacheHit === true) return false;
  if (status < 200 || status >= 300) return false;
  if (validationOk === false) return false;

  const normalizedProviderStatus = String(providerStatus || "").trim().toLowerCase();
  if (["blocked", "timeout", "error", "invalid_response"].includes(normalizedProviderStatus)) return false;

  const normalizedErrorCode = String(errorCode || "").trim().toUpperCase();
  if (
    [
      "PREMIUM_REQUIRED",
      "SYSTEM_ANALYSIS_INELIGIBLE",
      "QUOTA_EXCEEDED",
      "RATE_LIMITED",
      "INVALID_BODY",
      "INVALID_RESPONSE",
    ].includes(normalizedErrorCode)
  ) {
    return false;
  }

  return true;
}

function buildAiRequestLogPayload(entry = {}, { includeDiagnostics = true } = {}) {
  const featureId = normalizeOptionalString(entry.featureId);
  const featurePolicy = resolveFeaturePolicy(featureId);
  const statusCode = Number.isFinite(entry.statusCode) ? Math.round(entry.statusCode) : 200;
  const cacheHit = entry.cacheHit === true;
  const validationOk =
    typeof entry.validationOk === "boolean"
      ? entry.validationOk
      : typeof entry.validationPassed === "boolean"
        ? entry.validationPassed
        : undefined;
  const countsForQuota =
    typeof entry.countsForQuota === "boolean"
      ? entry.countsForQuota
      : resolveAiRequestCountsForQuota({
          statusCode,
          cacheHit,
          validationOk,
          providerStatus: entry.providerStatus,
          errorCode: entry.errorCode,
        });
  const payload = {
    request_id: entry.requestId,
    user_id: entry.userId,
    coach_kind: entry.coachKind,
    route: entry.route,
    plan_tier: entry.planTier || "free",
    decision_source: entry.decisionSource || null,
    status_code: statusCode,
    request_hash: entry.requestHash || null,
    ip_hash: entry.ipHash || null,
    user_agent: entry.userAgent || null,
    latency_ms: Number.isFinite(entry.latencyMs) ? Math.max(0, Math.round(entry.latencyMs)) : null,
    error_code: entry.errorCode || null,
  };
  if (!includeDiagnostics) return payload;
  return {
    ...payload,
    feature_id: featureId,
    cost_class: normalizeOptionalString(entry.costClass) || featurePolicy?.costClass || null,
    model_class: normalizeOptionalString(entry.modelClass) || featurePolicy?.modelClass || null,
    model: normalizeOptionalString(entry.model),
    prompt_version: normalizeOptionalString(entry.promptVersion),
    counts_for_quota: countsForQuota,
    usage_units: toNonNegativeInteger(entry.usageUnits, countsForQuota ? 1 : 0),
    cache_hit: cacheHit,
    input_bytes: toNonNegativeInteger(entry.inputBytes),
    output_bytes: toNonNegativeInteger(entry.outputBytes),
    provider_input_tokens: toNonNegativeInteger(entry.providerInputTokens),
    provider_output_tokens: toNonNegativeInteger(entry.providerOutputTokens),
    route_name: normalizeOptionalString(entry.routeName),
    mode: entry.mode || null,
    protocol_type: entry.protocolType || null,
    provider_status: entry.providerStatus || null,
    provider_ms: Number.isFinite(entry.providerMs) ? Math.max(0, Math.round(entry.providerMs)) : null,
    rejection_stage: entry.rejectionStage || null,
    rejection_reason: entry.rejectionReason || null,
    repaired_occurrence_count:
      Number.isFinite(entry.repairedOccurrenceCount) ? Math.max(0, Math.round(entry.repairedOccurrenceCount)) : null,
    repaired_minutes_delta:
      Number.isFinite(entry.repairedMinutesDelta) ? Math.round(entry.repairedMinutesDelta) : null,
    active_days: Array.isArray(entry.activeDays) ? entry.activeDays : null,
    light_days: Array.isArray(entry.lightDays) ? entry.lightDays : null,
    dense_days: Array.isArray(entry.denseDays) ? entry.denseDays : null,
    validation_passed: typeof entry.validationPassed === "boolean" ? entry.validationPassed : null,
    richness_passed: typeof entry.richnessPassed === "boolean" ? entry.richnessPassed : null,
    step_count: Number.isFinite(entry.stepCount) ? Math.max(0, Math.round(entry.stepCount)) : null,
    item_count: Number.isFinite(entry.itemCount) ? Math.max(0, Math.round(entry.itemCount)) : null,
    zod_issue_paths: Array.isArray(entry.zodIssuePaths) ? entry.zodIssuePaths : null,
  };
}

function shouldRetryAiRequestLogWithoutDiagnostics(error) {
  const code = String(error?.code || "").trim().toUpperCase();
  if (code && code !== "PGRST204" && code !== "42703") return false;
  const rawText = [error?.message, error?.details, error?.hint]
    .map((value) => String(value || "").trim().toLowerCase())
    .filter(Boolean)
    .join(" ");
  if (!rawText) return false;
  return AI_REQUEST_LOG_DIAGNOSTIC_COLUMNS.some((column) => rawText.includes(column));
}

export async function insertAiRequestLog(supabase, entry = {}) {
  try {
    const payload = buildAiRequestLogPayload(entry, { includeDiagnostics: true });
    // request_id can repeat across local server restarts, so observability inserts must stay idempotent.
    const { error } = await supabase
      .from("ai_request_logs")
      .upsert(payload, { onConflict: "request_id", ignoreDuplicates: true });
    if (!error) return;
    if (shouldRetryAiRequestLogWithoutDiagnostics(error)) {
      const fallbackPayload = buildAiRequestLogPayload(entry, { includeDiagnostics: false });
      const retry = await supabase
        .from("ai_request_logs")
        .upsert(fallbackPayload, { onConflict: "request_id", ignoreDuplicates: true });
      if (!retry?.error) return;
      throw retry.error;
    }
    throw error;
  } catch (error) {
    if (supabase?.rest?.url) {
      // Keep request handling alive even if logging fails.
      // eslint-disable-next-line no-console
      console.error("[ai-log] insert failed", error);
    }
  }
}
