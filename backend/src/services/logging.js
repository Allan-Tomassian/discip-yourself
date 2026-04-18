import { createHash } from "node:crypto";

const AI_REQUEST_LOG_DIAGNOSTIC_COLUMNS = Object.freeze([
  "mode",
  "protocol_type",
  "provider_status",
  "rejection_stage",
  "rejection_reason",
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

function buildAiRequestLogPayload(entry = {}, { includeDiagnostics = true } = {}) {
  const payload = {
    request_id: entry.requestId,
    user_id: entry.userId,
    coach_kind: entry.coachKind,
    route: entry.route,
    plan_tier: entry.planTier || "free",
    decision_source: entry.decisionSource || null,
    status_code: Number.isFinite(entry.statusCode) ? entry.statusCode : 200,
    request_hash: entry.requestHash || null,
    ip_hash: entry.ipHash || null,
    user_agent: entry.userAgent || null,
    latency_ms: Number.isFinite(entry.latencyMs) ? Math.max(0, Math.round(entry.latencyMs)) : null,
    error_code: entry.errorCode || null,
  };
  if (!includeDiagnostics) return payload;
  return {
    ...payload,
    mode: entry.mode || null,
    protocol_type: entry.protocolType || null,
    provider_status: entry.providerStatus || null,
    rejection_stage: entry.rejectionStage || null,
    rejection_reason: entry.rejectionReason || null,
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
