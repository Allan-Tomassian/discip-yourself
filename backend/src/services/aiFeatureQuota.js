import {
  AI_FEATURE_IDS,
  getAiFeaturePolicy,
  getAiFeatureQuotaPolicy,
  normalizeAiTier,
} from "../../../src/domain/aiPolicy.js";

function coerceDate(value) {
  const date = value instanceof Date ? new Date(value.getTime()) : new Date(value || Date.now());
  return Number.isNaN(date.getTime()) ? new Date() : date;
}

export function buildUtcCalendarMonthPeriod(now = new Date()) {
  const date = coerceDate(now);
  const periodStart = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1, 0, 0, 0, 0));
  const periodEnd = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1, 0, 0, 0, 0));
  return {
    periodStart: periodStart.toISOString(),
    periodEnd: periodEnd.toISOString(),
    resetAt: periodEnd.toISOString(),
  };
}

function normalizeFeatureId(value) {
  return String(value || "").trim();
}

function readMonthlyQuotaLimit({ featureId, tier, policy }) {
  const normalizedFeatureId = normalizeFeatureId(featureId);
  const normalizedTier = normalizeAiTier(tier);
  const resolvedPolicy = policy || getAiFeaturePolicy(normalizedFeatureId);
  if (!resolvedPolicy || resolvedPolicy.featureId !== normalizedFeatureId) {
    return { enabled: false, limit: 0, reason: "unknown_feature" };
  }

  const quotaPolicy =
    resolvedPolicy.quotaByTier?.[normalizedTier] ||
    getAiFeatureQuotaPolicy(normalizedFeatureId, normalizedTier);
  if (!quotaPolicy?.enabled) {
    return { enabled: false, limit: 0, reason: "feature_locked" };
  }

  if (!Number.isFinite(quotaPolicy.monthly)) {
    return { enabled: true, limit: null, reason: "unmetered" };
  }

  return {
    enabled: true,
    limit: Math.max(0, Math.floor(quotaPolicy.monthly)),
    reason: null,
  };
}

export async function resolveAiFeatureQuotaState({
  supabase,
  userId,
  featureId,
  tier,
  now = new Date(),
  policy,
} = {}) {
  const normalizedFeatureId = normalizeFeatureId(featureId);
  const normalizedTier = normalizeAiTier(tier);
  const period = buildUtcCalendarMonthPeriod(now);
  const quota = readMonthlyQuotaLimit({
    featureId: normalizedFeatureId,
    tier: normalizedTier,
    policy,
  });

  const lockedState = {
    allowed: false,
    tier: normalizedTier,
    featureId: normalizedFeatureId,
    used: 0,
    limit: quota.limit,
    remaining: 0,
    periodStart: period.periodStart,
    periodEnd: period.periodEnd,
    resetAt: period.resetAt,
    reason: quota.reason || "feature_locked",
  };

  if (!quota.enabled) return lockedState;
  if (!String(userId || "").trim()) {
    return {
      ...lockedState,
      reason: "missing_user",
    };
  }

  if (quota.limit === null) {
    return {
      allowed: true,
      tier: normalizedTier,
      featureId: normalizedFeatureId,
      used: 0,
      limit: null,
      remaining: null,
      periodStart: period.periodStart,
      periodEnd: period.periodEnd,
      resetAt: period.resetAt,
      reason: "unmetered",
    };
  }

  const result = await supabase
    .from("ai_request_logs")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("feature_id", normalizedFeatureId)
    .eq("counts_for_quota", true)
    .eq("cache_hit", false)
    .gte("created_at", period.periodStart)
    .lt("created_at", period.periodEnd);

  if (result.error) throw result.error;

  const used = Math.max(0, Math.floor(Number(result.count) || 0));
  const remaining = Math.max(0, quota.limit - used);
  const allowed = used < quota.limit;
  return {
    allowed,
    tier: normalizedTier,
    featureId: normalizedFeatureId,
    used,
    limit: quota.limit,
    remaining,
    periodStart: period.periodStart,
    periodEnd: period.periodEnd,
    resetAt: period.resetAt,
    reason: allowed ? null : "quota_exceeded",
  };
}

export function isSystemAnalysisFeatureQuota(featureId) {
  return normalizeFeatureId(featureId) === AI_FEATURE_IDS.SYSTEM_ANALYSIS;
}
