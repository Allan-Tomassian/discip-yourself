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
