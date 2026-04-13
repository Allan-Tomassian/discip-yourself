import test from "node:test";
import assert from "node:assert/strict";
import { buildApp } from "../src/app.js";
import {
  coachChatResponseSchema,
  coachLocalAnalysisResponseSchema,
  coachResponseSchema,
} from "../src/schemas/coach.js";

const TEST_CONFIG = {
  APP_ENV: "test",
  PORT: 3001,
  SUPABASE_URL: "https://example.supabase.co",
  SUPABASE_SECRET_KEY: "service-role-test",
  OPENAI_API_KEY: "",
  OPENAI_MODEL: "gpt-4.1-mini",
  AI_QUOTA_MODE: "normal",
  CORS_ALLOW_PRIVATE_NETWORK_DEV: false,
  CORS_ALLOWED_ORIGINS: ["http://localhost:5173", "http://127.0.0.1:5173"],
  LOG_LEVEL: "silent",
};

const TEST_CONFIG_WITH_OPENAI = {
  ...TEST_CONFIG,
  OPENAI_API_KEY: "test-openai-key",
};

function toDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function dateKeyFromOffset(days = 0) {
  const date = new Date();
  date.setHours(12, 0, 0, 0);
  date.setDate(date.getDate() + days);
  return toDateKey(date);
}

const TODAY_KEY = dateKeyFromOffset(0);
const FUTURE_KEY = dateKeyFromOffset(1);
const PAST_KEY = dateKeyFromOffset(-1);

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
          upsert: async (payload) => {
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
      occurrences || [{ id: "occ-1", goalId: "goal-1", date: TODAY_KEY, status: "planned", start: "09:00" }],
    ui: { activeSession },
    sessionHistory: [],
  };
}

function createValidCoachPayload({ dateKey = TODAY_KEY } = {}) {
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
      dateKey,
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
  assert.match(String(response.headers["access-control-allow-headers"] || ""), /X-Discip-Surface/i);
  await app.close();
});

test("OPTIONS /ai/now accepts a private LAN origin when private network dev CORS is enabled", async () => {
  const app = await buildApp({
    config: {
      ...TEST_CONFIG,
      CORS_ALLOW_PRIVATE_NETWORK_DEV: true,
    },
    verifyAccessToken: async () => ({ id: "user-1" }),
  });
  const response = await app.inject({
    method: "OPTIONS",
    url: "/ai/now",
    headers: {
      origin: "http://192.168.1.183:5173",
      "access-control-request-method": "POST",
      "access-control-request-headers": "authorization,content-type",
    },
  });
  assert.equal(response.statusCode, 204);
  assert.equal(response.headers["access-control-allow-origin"], "http://192.168.1.183:5173");
  await app.close();
});

test("OPTIONS /ai/chat accepts a private LAN origin when private network dev CORS is enabled", async () => {
  const app = await buildApp({
    config: {
      ...TEST_CONFIG,
      CORS_ALLOW_PRIVATE_NETWORK_DEV: true,
    },
    verifyAccessToken: async () => ({ id: "user-chat-lan" }),
  });
  const response = await app.inject({
    method: "OPTIONS",
    url: "/ai/chat",
    headers: {
      origin: "http://192.168.1.183:5173",
      "access-control-request-method": "POST",
      "access-control-request-headers": "authorization,content-type",
    },
  });
  assert.equal(response.statusCode, 204);
  assert.equal(response.headers["access-control-allow-origin"], "http://192.168.1.183:5173");
  await app.close();
});

test("OPTIONS /ai/chat accepts an explicit public staging frontend origin", async () => {
  const app = await buildApp({
    config: {
      ...TEST_CONFIG,
      CORS_ALLOWED_ORIGINS: [...TEST_CONFIG.CORS_ALLOWED_ORIGINS, "https://staging-discip-yourself.netlify.app"],
    },
    verifyAccessToken: async () => ({ id: "user-chat-staging" }),
  });
  const response = await app.inject({
    method: "OPTIONS",
    url: "/ai/chat",
    headers: {
      origin: "https://staging-discip-yourself.netlify.app",
      "access-control-request-method": "POST",
      "access-control-request-headers": "authorization,content-type",
    },
  });
  assert.equal(response.statusCode, 204);
  assert.equal(response.headers["access-control-allow-origin"], "https://staging-discip-yourself.netlify.app");
  await app.close();
});

test("OPTIONS /ai/local-analysis accepts a private LAN origin when private network dev CORS is enabled", async () => {
  const app = await buildApp({
    config: {
      ...TEST_CONFIG,
      CORS_ALLOW_PRIVATE_NETWORK_DEV: true,
    },
    verifyAccessToken: async () => ({ id: "user-local-analysis-lan" }),
  });
  const response = await app.inject({
    method: "OPTIONS",
    url: "/ai/local-analysis",
    headers: {
      origin: "http://192.168.1.183:5173",
      "access-control-request-method": "POST",
      "access-control-request-headers": "authorization,content-type",
    },
  });
  assert.equal(response.statusCode, 204);
  assert.equal(response.headers["access-control-allow-origin"], "http://192.168.1.183:5173");
  await app.close();
});

test("OPTIONS private LAN preflight stays blocked when private network dev CORS is disabled", async () => {
  const app = await buildApp({
    config: TEST_CONFIG,
    verifyAccessToken: async () => ({ id: "user-1" }),
  });
  const response = await app.inject({
    method: "OPTIONS",
    url: "/ai/now",
    headers: {
      origin: "http://192.168.1.183:5173",
      "access-control-request-method": "POST",
      "access-control-request-headers": "authorization,content-type",
    },
  });
  assert.notEqual(response.headers["access-control-allow-origin"], "http://192.168.1.183:5173");
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
      selectedDateKey: TODAY_KEY,
      activeCategoryId: null,
      surface: "today",
      trigger: "manual",
    },
  });
  assert.equal(response.statusCode, 401);
  assert.equal(response.json().error, "AUTH_MISSING");
  await app.close();
});

test("POST /ai/now with an invalid bearer returns AUTH_INVALID", async () => {
  const app = await buildApp({
    config: TEST_CONFIG,
    verifyAccessToken: async () => null,
  });
  const response = await app.inject({
    method: "POST",
    url: "/ai/now",
    headers: {
      authorization: "Bearer invalid-token",
    },
    payload: {
      selectedDateKey: TODAY_KEY,
      activeCategoryId: null,
      surface: "today",
      trigger: "manual",
    },
  });
  assert.equal(response.statusCode, 401);
  assert.equal(response.json().error, "AUTH_INVALID");
  await app.close();
});

test("POST /ai/chat rejects an empty message with 400", async () => {
  const app = await buildApp({
    config: TEST_CONFIG,
    verifyAccessToken: async () => ({ id: "user-chat-invalid" }),
  });

  const response = await app.inject({
    method: "POST",
    url: "/ai/chat",
    headers: { authorization: "Bearer token", "x-forwarded-for": "198.51.100.21" },
    payload: {
      selectedDateKey: TODAY_KEY,
      activeCategoryId: "cat-1",
      message: "   ",
      recentMessages: [],
    },
  });

  assert.equal(response.statusCode, 400);
  assert.equal(response.json().error, "INVALID_BODY");
  await app.close();
});

test("POST /ai/chat returns a structured rules fallback", async () => {
  const app = await buildApp({
    config: TEST_CONFIG,
    verifyAccessToken: async () => ({ id: "user-chat-1" }),
  });
  app.supabase = createFakeSupabase({
    userData: createCoachContextUserData(),
    entitlement: null,
    dailyCount: 0,
    monthlyCount: 0,
  });

  const response = await app.inject({
    method: "POST",
    url: "/ai/chat",
    headers: { authorization: "Bearer token", "x-forwarded-for": "198.51.100.22" },
    payload: {
      selectedDateKey: TODAY_KEY,
      activeCategoryId: "cat-1",
      message: "Je suis en retard, quel est le meilleur prochain bloc ?",
      recentMessages: [{ role: "user", content: "Je suis en retard." }],
    },
  });

  assert.equal(response.statusCode, 200);
  const payload = coachChatResponseSchema.parse(response.json());
  assert.equal(payload.kind, "chat");
  assert.equal(payload.decisionSource, "rules");
  assert.equal(payload.meta.selectedDateKey, TODAY_KEY);
  assert.equal(payload.meta.messagePreview, "Je suis en retard, quel est le meilleur prochain bloc ?");
  assert.equal("draftChanges" in payload, false);
  assert.match(payload.primaryAction.intent, /start_occurrence|open_today|open_pilotage|resume_session|open_library/);
  await app.close();
});

test("POST /ai/chat returns a free conversation fallback when mode is free", async () => {
  const app = await buildApp({
    config: TEST_CONFIG,
    verifyAccessToken: async () => ({ id: "user-chat-free" }),
  });
  app.supabase = createFakeSupabase({
    userData: createCoachContextUserData(),
    entitlement: null,
    dailyCount: 0,
    monthlyCount: 0,
  });

  const response = await app.inject({
    method: "POST",
    url: "/ai/chat",
    headers: { authorization: "Bearer token", "x-forwarded-for": "198.51.100.23" },
    payload: {
      selectedDateKey: TODAY_KEY,
      activeCategoryId: "cat-1",
      mode: "free",
      message: "Je doute de mon prochain pas.",
      recentMessages: [{ role: "user", content: "Je doute." }],
    },
  });

  assert.equal(response.statusCode, 200);
  const payload = coachChatResponseSchema.parse(response.json());
  assert.equal(payload.kind, "conversation");
  assert.equal(payload.mode, "free");
  assert.equal(payload.decisionSource, "rules");
  assert.equal(payload.meta.selectedDateKey, TODAY_KEY);
  await app.close();
});

test("POST /ai/chat returns a plan conversation fallback when mode is plan", async () => {
  const app = await buildApp({
    config: TEST_CONFIG,
    verifyAccessToken: async () => ({ id: "user-chat-plan" }),
  });
  app.supabase = createFakeSupabase({
    userData: createCoachContextUserData(),
    entitlement: null,
    dailyCount: 0,
    monthlyCount: 0,
  });

  const response = await app.inject({
    method: "POST",
    url: "/ai/chat",
    headers: { authorization: "Bearer token", "x-forwarded-for": "198.51.100.24" },
    payload: {
      selectedDateKey: TODAY_KEY,
      activeCategoryId: "cat-1",
      mode: "plan",
      message: "Aide-moi à structurer ce projet.",
      recentMessages: [{ role: "user", content: "J’ai un projet flou." }],
    },
  });

  assert.equal(response.statusCode, 200);
  const payload = coachChatResponseSchema.parse(response.json());
  assert.equal(payload.kind, "conversation");
  assert.equal(payload.mode, "plan");
  assert.equal(payload.decisionSource, "rules");
  assert.equal(payload.meta.selectedDateKey, TODAY_KEY);
  await app.close();
});

test("POST /ai/chat accepts locale, useCase, and aiIntent without returning INVALID_BODY", async () => {
  const insertedLogs = [];
  const app = await buildApp({
    config: TEST_CONFIG,
    verifyAccessToken: async () => ({ id: "user-chat-contract" }),
  });
  app.supabase = createFakeSupabase({
    userData: createCoachContextUserData(),
    entitlement: null,
    dailyCount: 0,
    monthlyCount: 0,
    insertedLogs,
  });

  const response = await app.inject({
    method: "POST",
    url: "/ai/chat",
    headers: { authorization: "Bearer token", "x-forwarded-for": "198.51.100.27" },
    payload: {
      selectedDateKey: TODAY_KEY,
      activeCategoryId: "cat-1",
      mode: "free",
      aiIntent: "explore",
      locale: "fr-FR",
      useCase: "life_plan",
      message: "Aide-moi à clarifier mon prochain pas.",
      recentMessages: [{ role: "user", content: "Je veux avancer sans me disperser." }],
    },
  });

  assert.equal(response.statusCode, 200);
  const payload = coachChatResponseSchema.parse(response.json());
  assert.equal(payload.kind, "conversation");
  assert.equal(payload.mode, "free");
  assert.equal(insertedLogs[0]?.coach_kind, "chat");
  assert.equal(insertedLogs[0]?.route, "/ai/chat");
  await app.close();
});

test("POST /ai/chat stays available when user_data carries guided runtime extras in activeSession", async () => {
  const app = await buildApp({
    config: TEST_CONFIG,
    verifyAccessToken: async () => ({ id: "user-chat-guided-runtime" }),
  });
  app.supabase = createFakeSupabase({
    userData: createCoachContextUserData({
      activeSession: {
        id: "sess-guided",
        dateKey: TODAY_KEY,
        occurrenceId: "occ-1",
        habitIds: ["goal-1"],
        runtimePhase: "in_progress",
        status: "partial",
        timerRunning: true,
        timerStartedAt: `${TODAY_KEY}T09:00:00.000Z`,
        timerAccumulatedSec: 180,
        experienceMode: "guided",
        guidedRuntimeV1: {
          version: 1,
          occurrenceId: "occ-1",
          guidedSpatialState: {
            mode: "active",
            viewedStepIndex: 0,
            activeStepIndex: 0,
          },
        },
      },
    }),
    entitlement: null,
    dailyCount: 0,
    monthlyCount: 0,
  });

  const response = await app.inject({
    method: "POST",
    url: "/ai/chat",
    headers: { authorization: "Bearer token", "x-forwarded-for": "198.51.100.28" },
    payload: {
      selectedDateKey: TODAY_KEY,
      activeCategoryId: "cat-1",
      mode: "free",
      message: "Aide-moi à reprendre proprement.",
      recentMessages: [{ role: "user", content: "Je veux reprendre." }],
    },
  });

  assert.equal(response.statusCode, 200);
  const payload = coachChatResponseSchema.parse(response.json());
  assert.equal(payload.kind, "conversation");
  assert.equal(payload.mode, "free");
  await app.close();
});

test("POST /ai/local-analysis returns a planning fallback without using the Coach conversation contract", async () => {
  const app = await buildApp({
    config: TEST_CONFIG,
    verifyAccessToken: async () => ({ id: "user-local-analysis-planning" }),
  });
  app.supabase = createFakeSupabase({
    userData: createCoachContextUserData(),
    entitlement: null,
    dailyCount: 0,
    monthlyCount: 0,
  });

  const response = await app.inject({
    method: "POST",
    url: "/ai/local-analysis",
    headers: { authorization: "Bearer token", "x-forwarded-for": "198.51.100.25" },
    payload: {
      selectedDateKey: TODAY_KEY,
      activeCategoryId: "cat-1",
      surface: "planning",
      message: "Relis mon rythme cette semaine.",
    },
  });

  assert.equal(response.statusCode, 200);
  const payload = coachLocalAnalysisResponseSchema.parse(response.json());
  assert.equal(payload.kind, "chat");
  assert.equal(payload.decisionSource, "rules");
  assert.equal(payload.meta.selectedDateKey, TODAY_KEY);
  assert.match(payload.primaryAction.intent, /open_today|open_library|open_pilotage/);
  await app.close();
});

test("POST /ai/local-analysis returns a pilotage fallback scoped to pilotage guidance", async () => {
  const app = await buildApp({
    config: TEST_CONFIG,
    verifyAccessToken: async () => ({ id: "user-local-analysis-pilotage" }),
  });
  app.supabase = createFakeSupabase({
    userData: createCoachContextUserData(),
    entitlement: null,
    dailyCount: 0,
    monthlyCount: 0,
  });

  const response = await app.inject({
    method: "POST",
    url: "/ai/local-analysis",
    headers: { authorization: "Bearer token", "x-forwarded-for": "198.51.100.26" },
    payload: {
      selectedDateKey: TODAY_KEY,
      activeCategoryId: "cat-1",
      surface: "pilotage",
      message: "Lis mon équilibre récent.",
    },
  });

  assert.equal(response.statusCode, 200);
  const payload = coachLocalAnalysisResponseSchema.parse(response.json());
  assert.equal(payload.kind, "chat");
  assert.equal(payload.decisionSource, "rules");
  assert.equal(payload.meta.selectedDateKey, TODAY_KEY);
  assert.match(payload.primaryAction.intent, /open_today|open_pilotage|open_library/);
  await app.close();
});

test("POST /ai/local-analysis accepts an AI response that includes direction", async () => {
  const insertedLogs = [];
  const app = await buildApp({
    config: TEST_CONFIG_WITH_OPENAI,
    verifyAccessToken: async () => ({ id: "user-local-analysis-ai-direction" }),
  });
  app.supabase = createFakeSupabase({
    userData: createCoachContextUserData(),
    entitlement: null,
    dailyCount: 0,
    monthlyCount: 0,
    insertedLogs,
  });
  app.openai = {
    chat: {
      completions: {
        parse: async () => ({
          choices: [
            {
              message: {
                parsed: {
                  kind: "chat",
                  headline: "Recalibre ton rythme",
                  reason: "Ton effort récent mérite un ajustement léger avant d'accélérer.",
                  direction: "recalibrer",
                  primaryAction: {
                    label: "Voir pilotage",
                    intent: "open_pilotage",
                    categoryId: "cat-1",
                    actionId: null,
                    occurrenceId: null,
                    dateKey: TODAY_KEY,
                  },
                  secondaryAction: null,
                  suggestedDurationMin: null,
                },
              },
            },
          ],
        }),
      },
    },
  };

  const response = await app.inject({
    method: "POST",
    url: "/ai/local-analysis",
    headers: { authorization: "Bearer token", "x-forwarded-for": "198.51.100.28" },
    payload: {
      selectedDateKey: TODAY_KEY,
      activeCategoryId: "cat-1",
      surface: "pilotage",
      message: "Analyse ma trajectoire récente et donne une direction claire.",
    },
  });

  assert.equal(response.statusCode, 200);
  const payload = coachLocalAnalysisResponseSchema.parse(response.json());
  assert.equal(payload.kind, "chat");
  assert.equal(payload.decisionSource, "ai");
  assert.equal(payload.direction, "recalibrer");
  assert.equal(insertedLogs[0]?.coach_kind, "local-analysis");
  assert.equal(insertedLogs[0]?.route, "/ai/local-analysis");
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
      selectedDateKey: TODAY_KEY,
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
    headers: { authorization: "Bearer token", "x-forwarded-for": "198.51.100.44" },
    payload: {
      selectedDateKey: TODAY_KEY,
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
      selectedDateKey: TODAY_KEY,
      activeCategoryId: null,
      surface: "today",
      trigger: "manual",
    },
  });

  assert.equal(response.statusCode, 503);
  assert.equal(response.json().error, "BACKEND_SCHEMA_MISSING");
  await app.close();
});

test("POST /ai/now returns SNAPSHOT_LOAD_FAILED when snapshot loading fails outside schema errors", async () => {
  const app = await buildApp({
    config: TEST_CONFIG,
    verifyAccessToken: async () => ({ id: "user-1" }),
  });
  app.supabase = createFakeSupabase({
    snapshotError: {
      code: "500",
      message: "boom",
    },
  });

  const response = await app.inject({
    method: "POST",
    url: "/ai/now",
    headers: { authorization: "Bearer token" },
    payload: {
      selectedDateKey: TODAY_KEY,
      activeCategoryId: null,
      surface: "today",
      trigger: "manual",
    },
  });

  assert.equal(response.statusCode, 503);
  assert.equal(response.json().error, "SNAPSHOT_LOAD_FAILED");
  await app.close();
});

test("POST /ai/now returns QUOTA_LOAD_FAILED when quota resolution fails outside schema errors", async () => {
  const app = await buildApp({
    config: TEST_CONFIG,
    verifyAccessToken: async () => ({ id: "user-1" }),
  });
  app.supabase = createFakeSupabase({
    userData: createCoachContextUserData(),
    quotaError: {
      code: "500",
      message: "quota boom",
    },
  });

  const response = await app.inject({
    method: "POST",
    url: "/ai/now",
    headers: { authorization: "Bearer token" },
    payload: {
      selectedDateKey: TODAY_KEY,
      activeCategoryId: null,
      surface: "today",
      trigger: "manual",
    },
  });

  assert.equal(response.statusCode, 503);
  assert.equal(response.json().error, "QUOTA_LOAD_FAILED");
  await app.close();
});

test("POST /ai/now returns rules fallback when OpenAI is disabled", async () => {
  const app = await buildApp({
    config: TEST_CONFIG,
    verifyAccessToken: async () => ({ id: "user-openai-disabled" }),
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
      selectedDateKey: TODAY_KEY,
      activeCategoryId: "cat-1",
      surface: "today",
      trigger: "manual",
    },
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.json().decisionSource, "rules");
  assert.equal(response.json().interventionType, "today_recommendation");
  assert.equal(response.json().primaryAction.intent, "start_occurrence");
  assert.equal(response.json().meta.fallbackReason, "none");
  assert.equal(response.json().meta.diagnostics.resolutionStatus, "rules_fallback");
  assert.equal(response.json().meta.diagnostics.rejectionReason, "none");
  assert.equal(response.headers["access-control-allow-origin"], "http://localhost:5173");
  await app.close();
});

test("POST /ai/now maps a future open session to a schedule warning", async () => {
  const app = await buildApp({
    config: TEST_CONFIG,
    verifyAccessToken: async () => ({ id: "user-future-session" }),
  });
  app.supabase = createFakeSupabase({
    userData: createCoachContextUserData({
      activeSession: {
        id: "sess-future",
        dateKey: FUTURE_KEY,
        occurrenceId: "occ-future",
        habitIds: ["goal-1"],
        runtimePhase: "in_progress",
      },
      occurrences: [],
    }),
  });

  const response = await app.inject({
    method: "POST",
    url: "/ai/now",
    headers: { authorization: "Bearer token" },
    payload: {
      selectedDateKey: TODAY_KEY,
      activeCategoryId: "cat-1",
      surface: "today",
      trigger: "screen_open",
    },
  });

  assert.equal(response.statusCode, 200);
  const payload = coachResponseSchema.parse(response.json());
  assert.equal(payload.decisionSource, "rules");
  assert.equal(payload.interventionType, "schedule_warning");
  assert.equal(payload.primaryAction.intent, "open_pilotage");
  assert.equal(payload.meta.sessionId, null);
  assert.equal(payload.meta.diagnostics.resolutionStatus, "rules_fallback");
  assert.equal(payload.meta.diagnostics.rejectionReason, "none");
});

test("POST /ai/now prefers a direct start over a warning when a same-day occurrence is executable", async () => {
  const app = await buildApp({
    config: TEST_CONFIG,
    verifyAccessToken: async () => ({ id: "user-start-before-warning" }),
  });
  app.supabase = createFakeSupabase({
    userData: createCoachContextUserData({
      activeSession: {
        id: "sess-future",
        dateKey: FUTURE_KEY,
        occurrenceId: "occ-future",
        habitIds: ["goal-1"],
        runtimePhase: "in_progress",
      },
      occurrences: [{ id: "occ-1", goalId: "goal-1", date: TODAY_KEY, status: "planned", start: "09:00" }],
    }),
  });

  const response = await app.inject({
    method: "POST",
    url: "/ai/now",
    headers: { authorization: "Bearer token" },
    payload: {
      selectedDateKey: TODAY_KEY,
      activeCategoryId: "cat-1",
      surface: "today",
      trigger: "screen_open",
    },
  });

  assert.equal(response.statusCode, 200);
  const payload = coachResponseSchema.parse(response.json());
  assert.equal(payload.interventionType, "today_recommendation");
  assert.equal(payload.primaryAction.intent, "start_occurrence");
  await app.close();
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
        dateKey: TODAY_KEY,
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
      selectedDateKey: TODAY_KEY,
      activeCategoryId: "cat-1",
      surface: "today",
      trigger: "resume",
    },
  });

  assert.equal(response.statusCode, 200);
  const payload = coachResponseSchema.parse(response.json());
  assert.equal(payload.decisionSource, "rules");
  assert.equal(payload.interventionType, "session_resume");
  assert.equal(payload.primaryAction.intent, "resume_session");
  assert.equal(payload.meta.sessionId, "sess-today");
  assert.equal(payload.meta.diagnostics.resolutionStatus, "rules_fallback");
  assert.equal(payload.meta.diagnostics.rejectionReason, "none");
});

test("POST /ai/now routes a future planned occurrence to pilotage instead of direct start", async () => {
  const app = await buildApp({
    config: TEST_CONFIG,
    verifyAccessToken: async () => ({ id: "user-future-plan" }),
  });
  app.supabase = createFakeSupabase({
    userData: createCoachContextUserData({
      occurrences: [{ id: "occ-1", goalId: "goal-1", date: FUTURE_KEY, status: "planned", start: "09:00" }],
    }),
  });

  const response = await app.inject({
    method: "POST",
    url: "/ai/now",
    headers: { authorization: "Bearer token" },
    payload: {
      selectedDateKey: FUTURE_KEY,
      activeCategoryId: "cat-1",
      surface: "today",
      trigger: "manual",
    },
  });

  assert.equal(response.statusCode, 200);
  const payload = coachResponseSchema.parse(response.json());
  assert.equal(payload.decisionSource, "rules");
  assert.equal(payload.interventionType, "today_recommendation");
  assert.equal(payload.primaryAction.intent, "open_pilotage");
  assert.equal(payload.primaryAction.label, "Replanifier aujourd’hui");
  assert.match(payload.reason, /Deep work/i);
  assert.match(payload.reason, /09:00/);
  assert.equal(payload.toolIntent, "suggest_reschedule_option");
  await app.close();
});

test("POST /ai/now routes a past planned occurrence to pilotage instead of direct start", async () => {
  const app = await buildApp({
    config: TEST_CONFIG,
    verifyAccessToken: async () => ({ id: "user-past-plan" }),
  });
  app.supabase = createFakeSupabase({
    userData: createCoachContextUserData({
      occurrences: [{ id: "occ-1", goalId: "goal-1", date: PAST_KEY, status: "planned", start: "09:00" }],
    }),
  });

  const response = await app.inject({
    method: "POST",
    url: "/ai/now",
    headers: { authorization: "Bearer token" },
    payload: {
      selectedDateKey: PAST_KEY,
      activeCategoryId: "cat-1",
      surface: "today",
      trigger: "manual",
    },
  });

  assert.equal(response.statusCode, 200);
  const payload = coachResponseSchema.parse(response.json());
  assert.equal(payload.decisionSource, "rules");
  assert.equal(payload.interventionType, "today_recommendation");
  assert.equal(payload.primaryAction.intent, "open_pilotage");
  assert.equal(payload.primaryAction.label, "Replanifier");
  assert.match(payload.reason, /Deep work/i);
  assert.match(payload.reason, /09:00/);
  assert.equal(payload.toolIntent, "suggest_reschedule_option");
  await app.close();
});

test("POST /ai/now proposes planning an existing action when today is empty", async () => {
  const app = await buildApp({
    config: TEST_CONFIG,
    verifyAccessToken: async () => ({ id: "user-gap-empty-day" }),
  });
  app.supabase = createFakeSupabase({
    userData: {
      categories: [{ id: "cat-1", name: "Focus" }],
      goals: [{ id: "goal-1", title: "Deep work", type: "PROCESS", categoryId: "cat-1", status: "active", sessionMinutes: 25 }],
      occurrences: [{ id: "occ-old", goalId: "goal-1", date: PAST_KEY, status: "done", start: "09:00", durationMinutes: 25 }],
      ui: { activeSession: null },
      sessionHistory: [],
    },
  });

  const response = await app.inject({
    method: "POST",
    url: "/ai/now",
    headers: { authorization: "Bearer token" },
    payload: {
      selectedDateKey: TODAY_KEY,
      activeCategoryId: "cat-1",
      surface: "today",
      trigger: "screen_open",
    },
  });

  assert.equal(response.statusCode, 200);
  const payload = coachResponseSchema.parse(response.json());
  assert.equal(payload.interventionType, "today_recommendation");
  assert.equal(payload.primaryAction.intent, "open_pilotage");
  assert.equal(payload.primaryAction.label, "Planifier aujourd’hui");
  assert.equal(payload.toolIntent, "suggest_reschedule_option");
  assert.match(payload.headline, /Aucune action prévue aujourd’hui/i);
  assert.match(payload.reason, /Deep work/i);
  await app.close();
});

test("POST /ai/now prioritizes structure_missing before a proven cross-category fallback", async () => {
  const app = await buildApp({
    config: TEST_CONFIG,
    verifyAccessToken: async () => ({ id: "user-gap-cross-category" }),
  });
  app.supabase = createFakeSupabase({
    userData: {
      categories: [
        { id: "cat-1", name: "Finance", mainGoalId: "goal-1" },
        { id: "cat-2", name: "Work" },
      ],
      goals: [
        { id: "goal-1", title: "Augmenter les revenus", type: "OUTCOME", categoryId: "cat-1", status: "active" },
        { id: "goal-2", title: "Travailler l'offre", type: "PROCESS", categoryId: "cat-2", status: "active", sessionMinutes: 30 },
      ],
      occurrences: [],
      ui: { activeSession: null },
      sessionHistory: [],
    },
  });

  const response = await app.inject({
    method: "POST",
    url: "/ai/now",
    headers: { authorization: "Bearer token" },
    payload: {
      selectedDateKey: TODAY_KEY,
      activeCategoryId: "cat-1",
      surface: "today",
      trigger: "screen_open",
    },
  });

  assert.equal(response.statusCode, 200);
  const payload = coachResponseSchema.parse(response.json());
  assert.equal(payload.interventionType, "today_recommendation");
  assert.equal(payload.primaryAction.intent, "open_pilotage");
  assert.equal(payload.primaryAction.label, "Structurer");
  assert.match(payload.reason, /clarifier l['’]objectif/i);
  assert.match(payload.reason, /premi[eè]re action/i);
  assert.match(payload.reason, /Augmenter les revenus/i);
  await app.close();
});

test("POST /ai/now returns ai decision when OpenAI returns valid structured output", async () => {
  let capturedPrompt = "";
  const app = await buildApp({
    config: TEST_CONFIG_WITH_OPENAI,
    verifyAccessToken: async () => ({ id: "user-openai-valid" }),
  });
  app.supabase = createFakeSupabase({
    userData: createCoachContextUserData(),
  });
  app.openai = {
    chat: {
      completions: {
        parse: async (input) => {
          capturedPrompt = input?.messages?.map((message) => message?.content || "").join("\n");
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
      selectedDateKey: TODAY_KEY,
      activeCategoryId: "cat-1",
      surface: "today",
      trigger: "manual",
    },
  });

  assert.equal(response.statusCode, 200);
  const payload = coachResponseSchema.parse(response.json());
  assert.equal(payload.decisionSource, "ai");
  assert.equal(payload.interventionType, "today_recommendation");
  assert.equal(payload.meta.fallbackReason, "none");
  assert.equal(payload.meta.diagnostics.resolutionStatus, "accepted_ai");
  assert.equal(payload.meta.diagnostics.rejectionReason, "none");
  assert.equal(payload.kind, "now");
  assert.equal(payload.headline, "Lance ta session de concentration maintenant");
  assert.equal(payload.reason, "C'est ton meilleur créneau disponible aujourd'hui.");
  assert.equal(payload.primaryAction.label, "Commencer maintenant");
  assert.equal(payload.primaryAction.intent, "start_occurrence");
  assert.equal(payload.toolIntent, "suggest_start_occurrence");
  assert.equal(payload.rewardSuggestion.kind, "none");
  assert.match(capturedPrompt, /written in French/i);
  assert.match(capturedPrompt, /headline, reason, primaryAction\.label/i);
  assert.match(capturedPrompt, /Return all keys exactly once/i);
  assert.match(capturedPrompt, /Use null for nullable fields/i);
  assert.match(capturedPrompt, /focusOccurrenceSummary/i);
  assert.match(capturedPrompt, /alternativeOccurrenceSummaries/i);
  assert.match(capturedPrompt, /focusSelectionReason/i);
  assert.match(capturedPrompt, /gapSummary/i);
  assert.match(capturedPrompt, /When using start_occurrence, headline and reason must mention the exact action title/i);
  assert.match(capturedPrompt, /When using open_pilotage for replanification, headline or reason must mention the exact action title/i);
  assert.match(capturedPrompt, /Valid JSON example/i);
  await app.close();
});

test("POST /ai/now includes gap-fill prompt rules when today has no planned action", async () => {
  let capturedPrompt = "";
  const app = await buildApp({
    config: TEST_CONFIG_WITH_OPENAI,
    verifyAccessToken: async () => ({ id: "user-gap-prompt" }),
  });
  app.supabase = createFakeSupabase({
    userData: {
      categories: [{ id: "cat-1", name: "Focus" }],
      goals: [{ id: "goal-1", title: "Deep work", type: "PROCESS", categoryId: "cat-1", status: "active", sessionMinutes: 25 }],
      occurrences: [],
      ui: { activeSession: null },
      sessionHistory: [],
    },
  });
  app.openai = {
    chat: {
      completions: {
        parse: async (input) => {
          capturedPrompt = input?.messages?.map((message) => message?.content || "").join("\n");
          return {
            choices: [
              {
                message: {
                  parsed: {
                    ...createValidCoachPayload(),
                    headline: "Planifie Deep work",
                    reason: "Deep work n'est pas encore planifiée aujourd'hui. Programme-la maintenant.",
                    primaryAction: {
                      ...createValidCoachPayload().primaryAction,
                      label: "Planifier aujourd’hui",
                      intent: "open_pilotage",
                      occurrenceId: null,
                    },
                    toolIntent: "suggest_reschedule_option",
                  },
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
      selectedDateKey: TODAY_KEY,
      activeCategoryId: "cat-1",
      surface: "today",
      trigger: "screen_open",
    },
  });

  assert.equal(response.statusCode, 200);
  assert.match(capturedPrompt, /not yet planned today/i);
  assert.match(capturedPrompt, /gapSummary\.candidateActionSummaries/i);
  assert.match(capturedPrompt, /selectionScope is active_category/i);
  assert.match(capturedPrompt, /selectionScope is cross_category/i);
  assert.match(capturedPrompt, /selectionScope is structure_missing/i);
  assert.match(capturedPrompt, /categoryCoherence/i);
  await app.close();
});

test("POST /ai/now repairs minor model output omissions and still returns an ai decision", async () => {
  const app = await buildApp({
    config: TEST_CONFIG_WITH_OPENAI,
    verifyAccessToken: async () => ({ id: "user-2b" }),
  });
  app.supabase = createFakeSupabase({
    userData: createCoachContextUserData(),
  });
  const repairedCandidate = {
    ...createValidCoachPayload(),
    headline: "H".repeat(90),
    primaryAction: {
      label: "L".repeat(40),
      intent: "start_occurrence",
      occurrenceId: "occ-1",
      dateKey: TODAY_KEY,
    },
  };
  delete repairedCandidate.secondaryAction;
  delete repairedCandidate.rewardSuggestion;

  app.openai = {
    chat: {
      completions: {
        parse: async () => ({
          choices: [
            {
              message: {
                parsed: null,
                content: JSON.stringify(repairedCandidate),
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
      selectedDateKey: TODAY_KEY,
      activeCategoryId: "cat-1",
      surface: "today",
      trigger: "manual",
    },
  });

  assert.equal(response.statusCode, 200);
  const payload = coachResponseSchema.parse(response.json());
  assert.equal(payload.decisionSource, "ai");
  assert.equal(payload.meta.fallbackReason, "none");
  assert.equal(payload.meta.diagnostics.resolutionStatus, "accepted_ai");
  assert.equal(payload.headline.length, 72);
  assert.equal(payload.primaryAction.label.length, 32);
  assert.equal(payload.primaryAction.categoryId, null);
  assert.equal(payload.secondaryAction, null);
  assert.deepEqual(payload.rewardSuggestion, { kind: "none", label: null });
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
      selectedDateKey: TODAY_KEY,
      activeCategoryId: "cat-1",
      surface: "today",
      trigger: "manual",
    },
  });

  assert.equal(response.statusCode, 200);
  const payload = coachResponseSchema.parse(response.json());
  assert.equal(payload.decisionSource, "rules");
  assert.equal(payload.interventionType, "today_recommendation");
  assert.equal(payload.meta.fallbackReason, "invalid_model_output");
  assert.equal(payload.meta.diagnostics.resolutionStatus, "rejected_to_rules");
  assert.equal(payload.meta.diagnostics.rejectionReason, "invalid_model_output");
  assert.equal(payload.primaryAction.intent, "start_occurrence");
  await app.close();
});

test("POST /ai/now rejects an AI direct start when the selected date is not today", async () => {
  const app = await buildApp({
    config: TEST_CONFIG_WITH_OPENAI,
    verifyAccessToken: async () => ({ id: "user-future-ai-start" }),
  });
  app.supabase = createFakeSupabase({
    userData: createCoachContextUserData({
      occurrences: [{ id: "occ-1", goalId: "goal-1", date: FUTURE_KEY, status: "planned", start: "09:00" }],
    }),
  });
  app.openai = {
    chat: {
      completions: {
        parse: async () => ({
          choices: [
            {
              message: {
                parsed: createValidCoachPayload({ dateKey: FUTURE_KEY }),
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
      selectedDateKey: FUTURE_KEY,
      activeCategoryId: "cat-1",
      surface: "today",
      trigger: "manual",
    },
  });

  assert.equal(response.statusCode, 200);
  const payload = coachResponseSchema.parse(response.json());
  assert.equal(payload.decisionSource, "rules");
  assert.equal(payload.meta.fallbackReason, "none");
  assert.equal(payload.meta.diagnostics.resolutionStatus, "rejected_to_rules");
  assert.equal(payload.meta.diagnostics.rejectionReason, "invalid_intervention_type");
  assert.equal(payload.primaryAction.intent, "open_pilotage");
  await app.close();
});

test("POST /ai/now rejects an AI warning without a deterministic warning signal", async () => {
  const app = await buildApp({
    config: TEST_CONFIG_WITH_OPENAI,
    verifyAccessToken: async () => ({ id: "user-3b" }),
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
                parsed: {
                  ...createValidCoachPayload(),
                  primaryAction: {
                    label: "Voir pilotage",
                    intent: "open_pilotage",
                    categoryId: "cat-1",
                    actionId: null,
                    occurrenceId: null,
                    dateKey: TODAY_KEY,
                  },
                  toolIntent: "suggest_reschedule_option",
                },
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
      selectedDateKey: TODAY_KEY,
      activeCategoryId: "cat-1",
      surface: "today",
      trigger: "manual",
    },
  });

  assert.equal(response.statusCode, 200);
  const payload = coachResponseSchema.parse(response.json());
  assert.equal(payload.decisionSource, "rules");
  assert.equal(payload.meta.diagnostics.resolutionStatus, "rejected_to_rules");
  assert.equal(payload.meta.diagnostics.rejectionReason, "no_deterministic_signal");
  assert.equal(payload.primaryAction.intent, "start_occurrence");
  await app.close();
});

test("POST /ai/now rejects an AI resume without active session for the selected date", async () => {
  const app = await buildApp({
    config: TEST_CONFIG_WITH_OPENAI,
    verifyAccessToken: async () => ({ id: "user-3" }),
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
                parsed: {
                  ...createValidCoachPayload(),
                  primaryAction: {
                    label: "Reprendre",
                    intent: "resume_session",
                    categoryId: "cat-1",
                    actionId: "goal-1",
                    occurrenceId: "occ-1",
                    dateKey: TODAY_KEY,
                  },
                  toolIntent: "suggest_resume_session",
                },
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
      selectedDateKey: TODAY_KEY,
      activeCategoryId: "cat-1",
      surface: "today",
      trigger: "manual",
    },
  });

  assert.equal(response.statusCode, 200);
  const payload = coachResponseSchema.parse(response.json());
  assert.equal(payload.decisionSource, "rules");
  assert.equal(payload.interventionType, "today_recommendation");
  assert.equal(payload.meta.diagnostics.resolutionStatus, "rejected_to_rules");
  assert.equal(payload.meta.diagnostics.rejectionReason, "no_active_session_for_date");
  assert.equal(payload.primaryAction.intent, "start_occurrence");
  await app.close();
});

test("POST /ai/now rejects open_today as an invalid primary intent for Today and falls back to rules", async () => {
  const app = await buildApp({
    config: TEST_CONFIG_WITH_OPENAI,
    verifyAccessToken: async () => ({ id: "user-4" }),
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
                parsed: {
                  ...createValidCoachPayload(),
                  primaryAction: {
                    label: "Voir aujourd'hui",
                    intent: "open_today",
                    categoryId: "cat-1",
                    actionId: "goal-1",
                    occurrenceId: "occ-1",
                    dateKey: TODAY_KEY,
                  },
                },
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
      selectedDateKey: TODAY_KEY,
      activeCategoryId: "cat-1",
      surface: "today",
      trigger: "manual",
    },
  });

  assert.equal(response.statusCode, 200);
  const payload = coachResponseSchema.parse(response.json());
  assert.equal(payload.decisionSource, "rules");
  assert.equal(payload.interventionType, "today_recommendation");
  assert.equal(payload.meta.diagnostics.resolutionStatus, "rejected_to_rules");
  assert.equal(payload.meta.diagnostics.rejectionReason, "invalid_intervention_type");
  assert.equal(payload.primaryAction.intent, "start_occurrence");
  await app.close();
});
