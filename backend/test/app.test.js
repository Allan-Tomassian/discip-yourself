import test from "node:test";
import assert from "node:assert/strict";
import { buildApp } from "../src/app.js";
import { coachResponseSchema } from "../src/schemas/coach.js";

const TEST_CONFIG = {
  PORT: 3001,
  SUPABASE_URL: "https://example.supabase.co",
  SUPABASE_SERVICE_ROLE_KEY: "service-role-test",
  OPENAI_API_KEY: "",
  OPENAI_MODEL: "gpt-4.1-mini",
  AI_QUOTA_MODE: "normal",
  CORS_ALLOWED_ORIGINS: ["http://localhost:5173", "http://127.0.0.1:5173"],
  LOG_LEVEL: "silent",
};

const TEST_CONFIG_WITH_OPENAI = {
  ...TEST_CONFIG,
  OPENAI_API_KEY: "test-openai-key",
};

function createFakeSupabase({
  profile = { id: "user-1" },
  userData = {},
  entitlement = null,
  dailyCount = 0,
  monthlyCount = 0,
  snapshotError = null,
  quotaError = null,
  insertedLogs = null,
} = {}) {
  let quotaSelectIndex = 0;

  return {
    from(table) {
      if (table === "profiles") {
        return {
          select() {
            return {
              eq() {
                return {
                  maybeSingle: async () => ({ data: snapshotError ? null : profile, error: snapshotError }),
                };
              },
            };
          },
        };
      }

      if (table === "user_data") {
        return {
          select() {
            return {
              eq() {
                return {
                  maybeSingle: async () => ({
                    data: snapshotError ? null : { data: userData },
                    error: snapshotError,
                  }),
                };
              },
            };
          },
        };
      }

      if (table === "billing_entitlements") {
        return {
          select() {
            return {
              eq() {
                return {
                  order() {
                    return {
                      limit() {
                        return {
                          maybeSingle: async () => ({ data: snapshotError ? null : entitlement, error: snapshotError }),
                        };
                      },
                    };
                  },
                };
              },
            };
          },
        };
      }

      if (table === "ai_request_logs") {
        return {
          select(_columns, options = {}) {
            if (options?.head) {
              return {
                eq() {
                  return {
                    gte() {
                      return {
                        lt: async () => {
                          if (quotaError) return { count: 0, error: quotaError };
                          quotaSelectIndex += 1;
                          return { count: quotaSelectIndex === 1 ? dailyCount : monthlyCount, error: null };
                        },
                      };
                    },
                  };
                },
              };
            }
            throw new Error("Unexpected ai_request_logs select usage");
          },
          insert: async (payload) => {
            if (Array.isArray(insertedLogs)) insertedLogs.push(payload);
            return { error: null };
          },
        };
      }

      throw new Error(`Unexpected table ${table}`);
    },
  };
}

function createCoachContextUserData({ activeSession = null, occurrences = null } = {}) {
  return {
    categories: [{ id: "cat-1", name: "Focus" }],
    goals: [{ id: "goal-1", title: "Deep work", type: "PROCESS", categoryId: "cat-1" }],
    occurrences:
      occurrences || [{ id: "occ-1", goalId: "goal-1", date: "2026-03-06", status: "planned", start: "09:00" }],
    ui: { activeSession },
    sessionHistory: [],
  };
}

function createValidCoachPayload() {
  return {
    kind: "now",
    headline: "Lance ta session de concentration maintenant",
    reason: "C'est ton meilleur créneau disponible aujourd'hui.",
    primaryAction: {
      label: "Commencer maintenant",
      intent: "start_occurrence",
      categoryId: "cat-1",
      actionId: "goal-1",
      occurrenceId: "occ-1",
      dateKey: "2026-03-06",
    },
    secondaryAction: null,
    suggestedDurationMin: 25,
    confidence: 0.91,
    urgency: "high",
    uiTone: "direct",
    toolIntent: "suggest_start_occurrence",
    rewardSuggestion: {
      kind: "none",
      label: null,
    },
  };
}

test("app boots", async () => {
  const app = await buildApp({
    config: TEST_CONFIG,
    verifyAccessToken: async () => ({ id: "user-1" }),
  });
  await app.ready();
  assert.equal(app.initialConfig.bodyLimit, 16 * 1024);
  await app.close();
});

test("GET /health returns ok", async () => {
  const app = await buildApp({
    config: TEST_CONFIG,
    verifyAccessToken: async () => ({ id: "user-1" }),
  });
  const response = await app.inject({ method: "GET", url: "/health" });
  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json(), { ok: true });
  await app.close();
});

test("OPTIONS /ai/now responds to local frontend preflight", async () => {
  const app = await buildApp({
    config: TEST_CONFIG,
    verifyAccessToken: async () => ({ id: "user-1" }),
  });
  const response = await app.inject({
    method: "OPTIONS",
    url: "/ai/now",
    headers: {
      origin: "http://localhost:5173",
      "access-control-request-method": "POST",
      "access-control-request-headers": "authorization,content-type",
    },
  });
  assert.equal(response.statusCode, 204);
  assert.equal(response.headers["access-control-allow-origin"], "http://localhost:5173");
  assert.match(String(response.headers["access-control-allow-methods"] || ""), /POST/);
  assert.match(String(response.headers["access-control-allow-headers"] || ""), /Authorization/i);
  await app.close();
});

test("POST /ai/now without bearer returns 401", async () => {
  const app = await buildApp({
    config: TEST_CONFIG,
    verifyAccessToken: async () => ({ id: "user-1" }),
  });
  const response = await app.inject({
    method: "POST",
    url: "/ai/now",
    payload: {
      selectedDateKey: "2026-03-06",
      activeCategoryId: null,
      surface: "today",
      trigger: "manual",
    },
  });
  assert.equal(response.statusCode, 401);
  assert.equal(response.json().error, "UNAUTHORIZED");
  await app.close();
});

test("POST /ai/now returns 429 from server-trusted free quota even if profile.plan says premium", async () => {
  const insertedLogs = [];
  const app = await buildApp({
    config: TEST_CONFIG,
    verifyAccessToken: async () => ({ id: "user-1" }),
  });
  app.supabase = createFakeSupabase({
    profile: { id: "user-1", plan: "premium" },
    userData: {},
    entitlement: null,
    dailyCount: 4,
    monthlyCount: 4,
    insertedLogs,
  });

  const response = await app.inject({
    method: "POST",
    url: "/ai/now",
    headers: { authorization: "Bearer token" },
    payload: {
      selectedDateKey: "2026-03-06",
      activeCategoryId: null,
      surface: "today",
      trigger: "manual",
    },
  });

  assert.equal(response.statusCode, 429);
  assert.equal(response.json().error, "QUOTA_EXCEEDED");
  assert.equal(insertedLogs[0]?.plan_tier, "free");
  await app.close();
});

test("POST /ai/now allows higher dev quota without changing the real plan tier", async () => {
  const app = await buildApp({
    config: {
      ...TEST_CONFIG,
      AI_QUOTA_MODE: "dev_relaxed",
    },
    verifyAccessToken: async () => ({ id: "user-1" }),
  });
  app.supabase = createFakeSupabase({
    userData: createCoachContextUserData(),
    entitlement: null,
    dailyCount: 10,
    monthlyCount: 120,
  });

  const response = await app.inject({
    method: "POST",
    url: "/ai/now",
    headers: { authorization: "Bearer token" },
    payload: {
      selectedDateKey: "2026-03-06",
      activeCategoryId: "cat-1",
      surface: "today",
      trigger: "manual",
    },
  });

  assert.equal(response.statusCode, 200);
  const payload = coachResponseSchema.parse(response.json());
  assert.equal(payload.decisionSource, "rules");
  assert.equal(payload.meta.quotaRemaining > 0, true);
  await app.close();
});

test("POST /ai/now returns 503 when required snapshot tables are missing", async () => {
  const app = await buildApp({
    config: TEST_CONFIG,
    verifyAccessToken: async () => ({ id: "user-1" }),
  });
  app.supabase = createFakeSupabase({
    snapshotError: {
      code: "PGRST205",
      message: "Could not find the table 'public.user_data' in the schema cache",
    },
  });

  const response = await app.inject({
    method: "POST",
    url: "/ai/now",
    headers: { authorization: "Bearer token" },
    payload: {
      selectedDateKey: "2026-03-06",
      activeCategoryId: null,
      surface: "today",
      trigger: "manual",
    },
  });

  assert.equal(response.statusCode, 503);
  assert.equal(response.json().error, "BACKEND_SCHEMA_MISSING");
  await app.close();
});

test("POST /ai/now returns rules fallback when OpenAI is disabled", async () => {
  const app = await buildApp({
    config: TEST_CONFIG,
    verifyAccessToken: async () => ({ id: "user-1" }),
  });
  app.supabase = createFakeSupabase({
    userData: createCoachContextUserData(),
  });

  const response = await app.inject({
    method: "POST",
    url: "/ai/now",
    headers: {
      authorization: "Bearer token",
      origin: "http://localhost:5173",
    },
    payload: {
      selectedDateKey: "2026-03-06",
      activeCategoryId: "cat-1",
      surface: "today",
      trigger: "manual",
    },
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.json().decisionSource, "rules");
  assert.equal(response.json().primaryAction.intent, "start_occurrence");
  assert.equal(response.json().meta.fallbackReason, "none");
  assert.equal(response.headers["access-control-allow-origin"], "http://localhost:5173");
  await app.close();
});

test("POST /ai/now does not resume a future session when today's context has a planned action", async () => {
  const app = await buildApp({
    config: TEST_CONFIG,
    verifyAccessToken: async () => ({ id: "user-future-session" }),
  });
  app.supabase = createFakeSupabase({
    userData: createCoachContextUserData({
      activeSession: {
        id: "sess-future",
        dateKey: "2026-03-07",
        occurrenceId: "occ-future",
        habitIds: ["goal-1"],
        runtimePhase: "in_progress",
      },
    }),
  });

  const response = await app.inject({
    method: "POST",
    url: "/ai/now",
    headers: { authorization: "Bearer token" },
    payload: {
      selectedDateKey: "2026-03-06",
      activeCategoryId: "cat-1",
      surface: "today",
      trigger: "screen_open",
    },
  });

  assert.equal(response.statusCode, 200);
  const payload = coachResponseSchema.parse(response.json());
  assert.equal(payload.decisionSource, "rules");
  assert.equal(payload.primaryAction.intent, "start_occurrence");
  assert.equal(payload.meta.sessionId, null);
});

test("POST /ai/now resumes the session only when it belongs to the active date", async () => {
  const app = await buildApp({
    config: TEST_CONFIG,
    verifyAccessToken: async () => ({ id: "user-same-day-session" }),
  });
  app.supabase = createFakeSupabase({
    userData: createCoachContextUserData({
      activeSession: {
        id: "sess-today",
        dateKey: "2026-03-06",
        occurrenceId: "occ-1",
        habitIds: ["goal-1"],
        runtimePhase: "in_progress",
      },
    }),
  });

  const response = await app.inject({
    method: "POST",
    url: "/ai/now",
    headers: { authorization: "Bearer token" },
    payload: {
      selectedDateKey: "2026-03-06",
      activeCategoryId: "cat-1",
      surface: "today",
      trigger: "resume",
    },
  });

  assert.equal(response.statusCode, 200);
  const payload = coachResponseSchema.parse(response.json());
  assert.equal(payload.decisionSource, "rules");
  assert.equal(payload.primaryAction.intent, "resume_session");
  assert.equal(payload.meta.sessionId, "sess-today");
});

test("POST /ai/now returns ai decision when OpenAI returns valid structured output", async () => {
  let capturedSystemPrompt = "";
  const app = await buildApp({
    config: TEST_CONFIG_WITH_OPENAI,
    verifyAccessToken: async () => ({ id: "user-1" }),
  });
  app.supabase = createFakeSupabase({
    userData: createCoachContextUserData(),
  });
  app.openai = {
    chat: {
      completions: {
        parse: async (input) => {
          capturedSystemPrompt = input?.messages?.[0]?.content || "";
          return {
          choices: [
            {
              message: {
                parsed: createValidCoachPayload(),
              },
            },
          ],
        };
        },
      },
    },
  };

  const response = await app.inject({
    method: "POST",
    url: "/ai/now",
    headers: { authorization: "Bearer token" },
    payload: {
      selectedDateKey: "2026-03-06",
      activeCategoryId: "cat-1",
      surface: "today",
      trigger: "manual",
    },
  });

  assert.equal(response.statusCode, 200);
  const payload = coachResponseSchema.parse(response.json());
  assert.equal(payload.decisionSource, "ai");
  assert.equal(payload.meta.fallbackReason, "none");
  assert.equal(payload.kind, "now");
  assert.equal(payload.headline, "Lance ta session de concentration maintenant");
  assert.equal(payload.reason, "C'est ton meilleur créneau disponible aujourd'hui.");
  assert.equal(payload.primaryAction.label, "Commencer maintenant");
  assert.equal(payload.primaryAction.intent, "start_occurrence");
  assert.equal(payload.toolIntent, "suggest_start_occurrence");
  assert.equal(payload.rewardSuggestion.kind, "none");
  assert.match(capturedSystemPrompt, /written in French/i);
  assert.match(capturedSystemPrompt, /headline, reason, primaryAction\.label/i);
  await app.close();
});

test("POST /ai/now falls back to rules when OpenAI structured output is invalid", async () => {
  const app = await buildApp({
    config: TEST_CONFIG_WITH_OPENAI,
    verifyAccessToken: async () => ({ id: "user-2" }),
  });
  app.supabase = createFakeSupabase({
    userData: createCoachContextUserData(),
  });
  app.openai = {
    chat: {
      completions: {
        parse: async () => ({
          choices: [
            {
              message: {
                parsed: null,
              },
            },
          ],
        }),
      },
    },
  };

  const response = await app.inject({
    method: "POST",
    url: "/ai/now",
    headers: { authorization: "Bearer token" },
    payload: {
      selectedDateKey: "2026-03-06",
      activeCategoryId: "cat-1",
      surface: "today",
      trigger: "manual",
    },
  });

  assert.equal(response.statusCode, 200);
  const payload = coachResponseSchema.parse(response.json());
  assert.equal(payload.decisionSource, "rules");
  assert.equal(payload.meta.fallbackReason, "invalid_model_output");
  assert.equal(payload.primaryAction.intent, "start_occurrence");
  await app.close();
});
