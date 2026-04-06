import { createHash } from "node:crypto";

function sha256(value) {
  return createHash("sha256").update(String(value || "")).digest("hex");
}

export function hashValue(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  return sha256(raw);
}

export async function insertAiRequestLog(supabase, entry = {}) {
  try {
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
    // request_id can repeat across local server restarts, so observability inserts must stay idempotent.
    const { error } = await supabase
      .from("ai_request_logs")
      .upsert(payload, { onConflict: "request_id", ignoreDuplicates: true });
    if (error) throw error;
  } catch (error) {
    if (supabase?.rest?.url) {
      // Keep request handling alive even if logging fails.
      // eslint-disable-next-line no-console
      console.error("[ai-log] insert failed", error);
    }
  }
}
