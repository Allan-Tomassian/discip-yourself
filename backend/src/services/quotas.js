const QUOTA_LIMITS = {
  free: { daily: 4, monthly: 60 },
  premium: { daily: 30, monthly: 600 },
};

const memoryWindowStore = new Map();

function getPlanTier(entitlement) {
  return entitlement?.plan_tier === "premium" ? "premium" : "free";
}

function pruneWindow(key, nowMs) {
  const bucket = memoryWindowStore.get(key) || [];
  const next = bucket.filter((ts) => nowMs - ts.ts < ts.windowMs);
  memoryWindowStore.set(key, next);
  return next;
}

export function enforceMemoryRateLimit({ key, limit, windowMs, now = Date.now() }) {
  const normalizedKey = String(key || "").trim();
  if (!normalizedKey || !Number.isFinite(limit) || !Number.isFinite(windowMs)) return false;
  const current = pruneWindow(normalizedKey, now);
  if (current.length >= limit) return true;
  current.push({ ts: now, windowMs });
  memoryWindowStore.set(normalizedKey, current);
  return false;
}

export async function resolveQuotaState(supabase, { userId, entitlement, now = new Date() }) {
  const planTier = getPlanTier(entitlement);
  const limits = QUOTA_LIMITS[planTier];
  const dailyStart = new Date(now);
  dailyStart.setHours(0, 0, 0, 0);
  const monthlyStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const [dailyResult, monthlyResult] = await Promise.all([
    supabase
      .from("ai_request_logs")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .gte("created_at", dailyStart.toISOString())
      .lt("status_code", 500),
    supabase
      .from("ai_request_logs")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .gte("created_at", monthlyStart.toISOString())
      .lt("status_code", 500),
  ]);

  if (dailyResult.error) throw dailyResult.error;
  if (monthlyResult.error) throw monthlyResult.error;

  const usedDaily = Number(dailyResult.count) || 0;
  const usedMonthly = Number(monthlyResult.count) || 0;
  const remainingDaily = Math.max(0, limits.daily - usedDaily);
  const remainingMonthly = Math.max(0, limits.monthly - usedMonthly);

  return {
    planTier,
    limits,
    usedDaily,
    usedMonthly,
    remaining: Math.min(remainingDaily, remainingMonthly),
    exceeded: remainingDaily <= 0 || remainingMonthly <= 0,
  };
}
