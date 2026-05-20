import test from "node:test";
import assert from "node:assert/strict";
import { insertAiRequestLog, resolveAiRequestCountsForQuota } from "../src/services/logging.js";
import { AI_FEATURE_IDS, AI_COST_CLASSES, AI_MODEL_CLASSES } from "../../src/domain/aiPolicy.js";

test("insertAiRequestLog uses an idempotent upsert on request_id", async () => {
  let capturedTable = null;
  let capturedPayload = null;
  let capturedOptions = null;

  const supabase = {
    from(table) {
      capturedTable = table;
      return {
        upsert: async (payload, options) => {
          capturedPayload = payload;
          capturedOptions = options;
          return { error: null };
        },
      };
    },
  };

  await insertAiRequestLog(supabase, {
    requestId: "req-1",
    userId: "user-1",
    coachKind: "chat",
    route: "/ai/chat",
    planTier: "free",
    decisionSource: "rules",
    statusCode: 200,
    mode: "prepare",
    protocolType: "sport",
    providerStatus: "ok",
    providerMs: 31,
    rejectionStage: null,
    rejectionReason: null,
    repairedOccurrenceCount: 2,
    repairedMinutesDelta: -25,
    activeDays: [4, 5],
    lightDays: [2, 1],
    denseDays: [0, 2],
    validationPassed: true,
    richnessPassed: true,
    stepCount: 3,
    itemCount: 7,
    zodIssuePaths: [],
    requestHash: "hash-1",
    ipHash: "hash-ip",
    userAgent: "node-test",
    latencyMs: 42,
    errorCode: null,
  });

  assert.equal(capturedTable, "ai_request_logs");
  assert.deepEqual(capturedOptions, {
    onConflict: "request_id",
    ignoreDuplicates: true,
  });
  assert.equal(capturedPayload.request_id, "req-1");
  assert.equal(capturedPayload.coach_kind, "chat");
  assert.equal(capturedPayload.route, "/ai/chat");
  assert.equal(capturedPayload.mode, "prepare");
  assert.equal(capturedPayload.protocol_type, "sport");
  assert.equal(capturedPayload.provider_ms, 31);
  assert.equal(capturedPayload.repaired_occurrence_count, 2);
  assert.equal(capturedPayload.repaired_minutes_delta, -25);
  assert.deepEqual(capturedPayload.active_days, [4, 5]);
  assert.equal(capturedPayload.step_count, 3);
});

test("insertAiRequestLog writes feature policy and usage metadata without requiring enforcement", async () => {
  let capturedPayload = null;

  const supabase = {
    from() {
      return {
        upsert: async (payload) => {
          capturedPayload = payload;
          return { error: null };
        },
      };
    },
  };

  await insertAiRequestLog(supabase, {
    requestId: "req-feature-1",
    userId: "user-1",
    coachKind: "system-analysis",
    route: "/ai/system-analysis",
    routeName: "system-analysis",
    featureId: AI_FEATURE_IDS.SYSTEM_ANALYSIS,
    planTier: "premium",
    decisionSource: "ai",
    statusCode: 200,
    providerStatus: "ok",
    validationPassed: true,
    model: "gpt-system",
    promptVersion: "system_analysis_v1_0",
    inputBytes: 1024,
    outputBytes: 2048,
    providerInputTokens: 3000,
    providerOutputTokens: 900,
    requestHash: "hash-system-analysis",
  });

  assert.equal(capturedPayload.feature_id, AI_FEATURE_IDS.SYSTEM_ANALYSIS);
  assert.equal(capturedPayload.cost_class, AI_COST_CLASSES.PREMIUM_DEEP);
  assert.equal(capturedPayload.model_class, AI_MODEL_CLASSES.PREMIUM_DEEP_ANALYSIS);
  assert.equal(capturedPayload.model, "gpt-system");
  assert.equal(capturedPayload.prompt_version, "system_analysis_v1_0");
  assert.equal(capturedPayload.route_name, "system-analysis");
  assert.equal(capturedPayload.counts_for_quota, true);
  assert.equal(capturedPayload.usage_units, 1);
  assert.equal(capturedPayload.cache_hit, false);
  assert.equal(capturedPayload.input_bytes, 1024);
  assert.equal(capturedPayload.output_bytes, 2048);
  assert.equal(capturedPayload.provider_input_tokens, 3000);
  assert.equal(capturedPayload.provider_output_tokens, 900);
});

test("resolveAiRequestCountsForQuota only counts successful validated visible outputs", () => {
  assert.equal(
    resolveAiRequestCountsForQuota({ statusCode: 200, providerStatus: "ok", validationOk: true }),
    true
  );
  assert.equal(
    resolveAiRequestCountsForQuota({ statusCode: 200, providerStatus: "ok", validationOk: true, cacheHit: true }),
    false
  );
  assert.equal(resolveAiRequestCountsForQuota({ statusCode: 403, errorCode: "PREMIUM_REQUIRED" }), false);
  assert.equal(resolveAiRequestCountsForQuota({ statusCode: 422, errorCode: "SYSTEM_ANALYSIS_INELIGIBLE" }), false);
  assert.equal(resolveAiRequestCountsForQuota({ statusCode: 429, errorCode: "QUOTA_EXCEEDED" }), false);
  assert.equal(resolveAiRequestCountsForQuota({ statusCode: 429, errorCode: "RATE_LIMITED" }), false);
  assert.equal(resolveAiRequestCountsForQuota({ statusCode: 502, providerStatus: "invalid_response" }), false);
  assert.equal(resolveAiRequestCountsForQuota({ statusCode: 504, providerStatus: "timeout" }), false);
});

test("insertAiRequestLog swallows observability failures", async () => {
  const originalConsoleError = console.error;
  console.error = () => {};

  const supabase = {
    rest: { url: "https://example.supabase.co/rest/v1" },
    from() {
      return {
        upsert: async () => ({ error: new Error("duplicate key value violates unique constraint") }),
      };
    },
  };

  try {
    await assert.doesNotReject(() =>
      insertAiRequestLog(supabase, {
        requestId: "req-1",
        userId: "user-1",
        coachKind: "chat",
        route: "/ai/chat",
      }),
    );
  } finally {
    console.error = originalConsoleError;
  }
});

test("insertAiRequestLog retries without diagnostics when the schema is missing item_count", async () => {
  const capturedPayloads = [];

  const supabase = {
    rest: { url: "https://example.supabase.co/rest/v1" },
    from() {
      return {
        upsert: async (payload) => {
          capturedPayloads.push(payload);
          if (capturedPayloads.length === 1) {
            return {
              error: {
                code: "PGRST204",
                message: "Could not find the 'item_count' column of 'ai_request_logs' in the schema cache",
              },
            };
          }
          return { error: null };
        },
      };
    },
  };

  await assert.doesNotReject(() =>
    insertAiRequestLog(supabase, {
      requestId: "req-2",
      userId: "user-2",
      coachKind: "session-guidance",
      route: "/ai/session-guidance",
      planTier: "premium",
      decisionSource: "ai",
      statusCode: 504,
      mode: "prepare",
      protocolType: "sport",
      providerStatus: "timeout",
      stepCount: 3,
      itemCount: 7,
      errorCode: "SESSION_GUIDANCE_PROVIDER_TIMEOUT",
    }),
  );

  assert.equal(capturedPayloads.length, 2);
  assert.equal(capturedPayloads[0].item_count, 7);
  assert.equal(capturedPayloads[1].item_count, undefined);
  assert.equal(capturedPayloads[1].mode, undefined);
  assert.equal(capturedPayloads[1].error_code, "SESSION_GUIDANCE_PROVIDER_TIMEOUT");
});

test("insertAiRequestLog retries without new feature diagnostics when the schema is missing feature_id", async () => {
  const capturedPayloads = [];

  const supabase = {
    rest: { url: "https://example.supabase.co/rest/v1" },
    from() {
      return {
        upsert: async (payload) => {
          capturedPayloads.push(payload);
          if (capturedPayloads.length === 1) {
            return {
              error: {
                code: "PGRST204",
                message: "Could not find the 'feature_id' column of 'ai_request_logs' in the schema cache",
              },
            };
          }
          return { error: null };
        },
      };
    },
  };

  await assert.doesNotReject(() =>
    insertAiRequestLog(supabase, {
      requestId: "req-feature-fallback",
      userId: "user-2",
      coachKind: "system-analysis",
      route: "/ai/system-analysis",
      featureId: AI_FEATURE_IDS.SYSTEM_ANALYSIS,
      statusCode: 200,
      providerStatus: "ok",
      validationPassed: true,
    }),
  );

  assert.equal(capturedPayloads.length, 2);
  assert.equal(capturedPayloads[0].feature_id, AI_FEATURE_IDS.SYSTEM_ANALYSIS);
  assert.equal(capturedPayloads[0].counts_for_quota, true);
  assert.equal(capturedPayloads[1].feature_id, undefined);
  assert.equal(capturedPayloads[1].counts_for_quota, undefined);
  assert.equal(capturedPayloads[1].coach_kind, "system-analysis");
});
