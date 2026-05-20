import test from "node:test";
import assert from "node:assert/strict";
import {
  buildUtcCalendarMonthPeriod,
  resolveAiFeatureQuotaState,
} from "../src/services/aiFeatureQuota.js";
import { AI_FEATURE_IDS, AI_TIERS } from "../../src/domain/aiPolicy.js";

const NOW = new Date("2026-05-20T12:00:00.000Z");

function createSupabaseForLogs(rows = [], { captured = [] } = {}) {
  return {
    from(table) {
      assert.equal(table, "ai_request_logs");
      return {
        select(_columns, options = {}) {
          assert.equal(options.head, true);
          assert.equal(options.count, "exact");
          const filters = [];
          const builder = {
            eq(column, value) {
              filters.push({ type: "eq", column, value });
              return builder;
            },
            gte(column, value) {
              filters.push({ type: "gte", column, value });
              return builder;
            },
            async lt(column, value) {
              filters.push({ type: "lt", column, value });
              captured.push(filters);
              const count = rows.filter((row) =>
                filters.every((filter) => {
                  const rowValue = row[filter.column];
                  if (filter.type === "eq") return rowValue === filter.value;
                  if (filter.type === "gte") return String(rowValue) >= String(filter.value);
                  if (filter.type === "lt") return String(rowValue) < String(filter.value);
                  return false;
                })
              ).length;
              return { count, error: null };
            },
          };
          return builder;
        },
      };
    },
  };
}

function quotaLog(overrides = {}) {
  return {
    user_id: "user-1",
    feature_id: AI_FEATURE_IDS.SYSTEM_ANALYSIS,
    counts_for_quota: true,
    cache_hit: false,
    created_at: "2026-05-20T10:00:00.000Z",
    ...overrides,
  };
}

test("buildUtcCalendarMonthPeriod uses UTC calendar boundaries", () => {
  assert.deepEqual(buildUtcCalendarMonthPeriod("2026-05-20T12:00:00.000Z"), {
    periodStart: "2026-05-01T00:00:00.000Z",
    periodEnd: "2026-06-01T00:00:00.000Z",
    resetAt: "2026-06-01T00:00:00.000Z",
  });
});

test("resolveAiFeatureQuotaState allows premium users below the 2/month quota", async () => {
  const state = await resolveAiFeatureQuotaState({
    supabase: createSupabaseForLogs([]),
    userId: "user-1",
    featureId: AI_FEATURE_IDS.SYSTEM_ANALYSIS,
    tier: AI_TIERS.PREMIUM,
    now: NOW,
  });

  assert.equal(state.allowed, true);
  assert.equal(state.used, 0);
  assert.equal(state.limit, 2);
  assert.equal(state.remaining, 2);
  assert.equal(state.resetAt, "2026-06-01T00:00:00.000Z");
});

test("resolveAiFeatureQuotaState rejects premium users at 2/month", async () => {
  const state = await resolveAiFeatureQuotaState({
    supabase: createSupabaseForLogs([quotaLog({ created_at: "2026-05-02T09:00:00.000Z" }), quotaLog()]),
    userId: "user-1",
    featureId: AI_FEATURE_IDS.SYSTEM_ANALYSIS,
    tier: AI_TIERS.PREMIUM,
    now: NOW,
  });

  assert.equal(state.allowed, false);
  assert.equal(state.used, 2);
  assert.equal(state.limit, 2);
  assert.equal(state.remaining, 0);
  assert.equal(state.reason, "quota_exceeded");
});

test("resolveAiFeatureQuotaState applies the 5/month premium plus quota", async () => {
  const fourLogs = [1, 2, 3, 4].map((index) =>
    quotaLog({ created_at: `2026-05-0${index}T09:00:00.000Z` })
  );
  const allowed = await resolveAiFeatureQuotaState({
    supabase: createSupabaseForLogs(fourLogs),
    userId: "user-1",
    featureId: AI_FEATURE_IDS.SYSTEM_ANALYSIS,
    tier: AI_TIERS.PREMIUM_PLUS,
    now: NOW,
  });
  const rejected = await resolveAiFeatureQuotaState({
    supabase: createSupabaseForLogs([...fourLogs, quotaLog({ created_at: "2026-05-05T09:00:00.000Z" })]),
    userId: "user-1",
    featureId: AI_FEATURE_IDS.SYSTEM_ANALYSIS,
    tier: AI_TIERS.PREMIUM_PLUS,
    now: NOW,
  });

  assert.equal(allowed.allowed, true);
  assert.equal(allowed.used, 4);
  assert.equal(allowed.limit, 5);
  assert.equal(allowed.remaining, 1);
  assert.equal(rejected.allowed, false);
  assert.equal(rejected.used, 5);
  assert.equal(rejected.limit, 5);
});

test("resolveAiFeatureQuotaState ignores cache hits, non-counting rows, and out-of-period rows", async () => {
  const state = await resolveAiFeatureQuotaState({
    supabase: createSupabaseForLogs([
      quotaLog({ created_at: "2026-05-01T00:00:00.000Z" }),
      quotaLog({ created_at: "2026-05-31T23:59:59.999Z" }),
      quotaLog({ created_at: "2026-06-01T00:00:00.000Z" }),
      quotaLog({ created_at: "2026-04-30T23:59:59.999Z" }),
      quotaLog({ counts_for_quota: false }),
      quotaLog({ cache_hit: true }),
      quotaLog({ feature_id: AI_FEATURE_IDS.COACH_PLAN }),
      quotaLog({ user_id: "other-user" }),
    ]),
    userId: "user-1",
    featureId: AI_FEATURE_IDS.SYSTEM_ANALYSIS,
    tier: AI_TIERS.PREMIUM_PLUS,
    now: NOW,
  });

  assert.equal(state.allowed, true);
  assert.equal(state.used, 2);
  assert.equal(state.remaining, 3);
});

test("resolveAiFeatureQuotaState queries the feature-scoped quota fields", async () => {
  const captured = [];
  await resolveAiFeatureQuotaState({
    supabase: createSupabaseForLogs([], { captured }),
    userId: "user-1",
    featureId: AI_FEATURE_IDS.SYSTEM_ANALYSIS,
    tier: AI_TIERS.PREMIUM,
    now: NOW,
  });

  assert.deepEqual(captured[0], [
    { type: "eq", column: "user_id", value: "user-1" },
    { type: "eq", column: "feature_id", value: AI_FEATURE_IDS.SYSTEM_ANALYSIS },
    { type: "eq", column: "counts_for_quota", value: true },
    { type: "eq", column: "cache_hit", value: false },
    { type: "gte", column: "created_at", value: "2026-05-01T00:00:00.000Z" },
    { type: "lt", column: "created_at", value: "2026-06-01T00:00:00.000Z" },
  ]);
});

test("resolveAiFeatureQuotaState locks free, trial, and unknown system analysis tiers", async () => {
  for (const tier of [AI_TIERS.FREE, AI_TIERS.TRIAL, "unknown"]) {
    const state = await resolveAiFeatureQuotaState({
      supabase: createSupabaseForLogs([quotaLog()]),
      userId: "user-1",
      featureId: AI_FEATURE_IDS.SYSTEM_ANALYSIS,
      tier,
      now: NOW,
    });
    assert.equal(state.allowed, false);
    assert.equal(state.used, 0);
    assert.equal(state.limit, 0);
    assert.equal(state.reason, "feature_locked");
  }
});
