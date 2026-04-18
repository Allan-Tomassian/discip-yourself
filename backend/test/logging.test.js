import test from "node:test";
import assert from "node:assert/strict";
import { insertAiRequestLog } from "../src/services/logging.js";

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
    rejectionStage: null,
    rejectionReason: null,
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
  assert.equal(capturedPayload.step_count, 3);
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
