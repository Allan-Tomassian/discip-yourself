import test from "node:test";
import assert from "node:assert/strict";
import { APIConnectionTimeoutError } from "openai";
import { buildApp } from "../src/app.js";

const TEST_CONFIG = {
  APP_ENV: "test",
  PORT: 3001,
  SUPABASE_URL: "https://example.supabase.co",
  SUPABASE_SECRET_KEY: "service-role-test",
  OPENAI_API_KEY: "",
  OPENAI_MODEL: "gpt-4.1-mini",
  OPENAI_DEFAULT_TIMEOUT_MS: 20000,
  FIRST_RUN_PLAN_OPENAI_MODEL: "",
  FIRST_RUN_PLAN_OPENAI_TIMEOUT_MS: 55000,
  FIRST_RUN_STARTER_HINTS_OPENAI_MODEL: "",
  FIRST_RUN_STARTER_HINTS_OPENAI_TIMEOUT_MS: 10000,
  FIRST_RUN_WHY_CLARIFICATION_OPENAI_MODEL: "",
  FIRST_RUN_WHY_CLARIFICATION_OPENAI_TIMEOUT_MS: 8000,
  SESSION_GUIDANCE_PREPARE_OPENAI_MODEL: "",
  SESSION_GUIDANCE_PREPARE_OPENAI_TIMEOUT_MS: 60000,
  SYSTEM_ANALYSIS_MODEL: "",
  SYSTEM_ANALYSIS_TIMEOUT_MS: 65000,
  SYSTEM_ANALYSIS_PROMPT_VERSION: "system_analysis_v1_0",
  AI_QUOTA_MODE: "normal",
  CORS_ALLOW_PRIVATE_NETWORK_DEV: false,
  CORS_ALLOWED_ORIGINS: ["http://localhost:5173", "http://127.0.0.1:5173"],
  LOG_LEVEL: "silent",
};

const TEST_CONFIG_WITH_OPENAI = {
  ...TEST_CONFIG,
  OPENAI_API_KEY: "test-openai-key",
};

const PERIOD = { startDateKey: "2026-05-07", endDateKey: "2026-05-20", days: 14 };
let authUserIndex = 0;

function createFakeSupabase({
  userData = createServerUserData(),
  entitlement = { plan_tier: "premium" },
  dailyCount = 0,
  monthlyCount = 0,
  systemAnalysisQuotaCount = 0,
  insertedLogs = null,
  mutations = null,
} = {}) {
  let quotaSelectIndex = 0;
  return {
    from(table) {
      if (table === "profiles") {
        return {
          select() {
            return {
              eq() {
                return { maybeSingle: async () => ({ data: { id: "user-1" }, error: null }) };
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
                return { maybeSingle: async () => ({ data: { data: userData }, error: null }) };
              },
            };
          },
          upsert: async (payload) => {
            if (Array.isArray(mutations)) mutations.push({ table, method: "upsert", payload });
            throw new Error("system analysis must not mutate user_data");
          },
          update: async (payload) => {
            if (Array.isArray(mutations)) mutations.push({ table, method: "update", payload });
            throw new Error("system analysis must not mutate user_data");
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
                        return { maybeSingle: async () => ({ data: entitlement, error: null }) };
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
                  const isFeatureQuotaQuery = filters.some(
                    (filter) => filter.type === "eq" && filter.column === "feature_id"
                  );
                  if (isFeatureQuotaQuery) {
                    return { count: systemAnalysisQuotaCount, error: null };
                  }
                  quotaSelectIndex += 1;
                  return { count: quotaSelectIndex === 1 ? dailyCount : monthlyCount, error: null };
                },
              };
              return builder;
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

function createServerUserData() {
  return {
    categories: [{ id: "cat-1", name: "Focus" }],
    goals: [
      { id: "out-1", type: "OUTCOME", title: "Ship", categoryId: "cat-1" },
      { id: "act-1", type: "PROCESS", parentId: "out-1", title: "Deep work", categoryId: "cat-1" },
    ],
    occurrences: [
      { id: "occ-1", goalId: "act-1", date: "2026-05-20", start: "09:00", status: "planned" },
    ],
    sessionHistory: [
      { id: "hist-1", occurrenceId: "occ-1", endedReason: "done", dateKey: "2026-05-17" },
    ],
    ui: {
      firstRunV1: {
        commitV1: { status: "applied", appliedAt: "2026-05-01T09:00:00.000Z" },
      },
    },
  };
}

function createSnapshot(overrides = {}) {
  return {
    version: 1,
    period: PERIOD,
    generatedAt: "2026-05-20T10:00:00.000Z",
    referenceDateKey: "2026-05-20",
    userWhy: "Construire un système d'exécution fiable.",
    firstRunSummary: { commitStatus: "applied", appliedAt: "2026-05-01" },
    goalsSummary: { totalCount: 2, outcomeCount: 1, processActionCount: 1 },
    actionsSummary: { totalCount: 1, tooManyActions: false },
    executionStats: { expectedCount: 12, outcomeCount: 6, completedCount: 4, frictionCount: 2, activeDayCount: 4 },
    sessionStats: { endedCount: 6, frictionCount: 1 },
    timePatterns: { weakWindows: [] },
    frictionPatterns: { blockedCount: 1, reportedCount: 1, byAction: [] },
    objectiveSignals: { neglectedObjectives: [] },
    planningLoadSignals: { overloadedDays: [] },
    systemSignals: [],
    adjustDiagnosticSummary: { state: "attention" },
    coachThemes: { rawTranscriptIncluded: false, messageCount: 0 },
    profilePreferences: { hasProfile: true },
    dataLimitations: [{ code: "missing_coach_themes", message: "No transcript included." }],
    sourceCounts: { categories: 1, goals: 2, occurrences: 12, sessionHistory: 6 },
    snapshotHash: "sas_route1234",
    ...overrides,
  };
}

function createRequest(overrides = {}) {
  return {
    version: 1,
    snapshot: createSnapshot(),
    locale: "fr-FR",
    timezone: "Europe/Paris",
    referenceDateKey: "2026-05-20",
    ...overrides,
  };
}

function createValidResult(overrides = {}) {
  return {
    version: 1,
    period: PERIOD,
    executiveSummary: "Le système tient mieux quand la charge reste courte et claire.",
    invisibleFriction: [
      {
        title: "Charge concentrée",
        message: "Plusieurs blocs se concentrent sur peu de jours.",
        evidence: [{
          source: "planningLoadSignals",
          dateKey: null,
          occurrenceId: null,
          historyId: null,
          actionId: null,
          goalId: null,
          objectiveId: null,
          count: 2,
          facts: ["2 jours chargés"],
        }],
        confidence: 0.72,
      },
    ],
    systemWeaknesses: [],
    strongestPatterns: [],
    recommendedCorrections: [],
    correctionDraft: {
      correctedLoad: {
        targetBlocksPerDay: 2,
        maxDailyMinutes: 60,
        reason: "Réduire la charge pour protéger l'exécution.",
      },
      occurrenceAdjustments: [
        {
          occurrenceId: "occ-1",
          action: "move",
          proposedDateKey: "2026-05-21",
          proposedStart: "10:00",
          proposedDurationMinutes: null,
          reason: "Déplacer le bloc vers un créneau plus stable.",
          confidence: 0.8,
        },
      ],
      objectiveAdjustments: [{ goalId: "out-1", action: "keep", reason: "Objectif encore cohérent.", confidence: null }],
      actionAdjustments: [{ actionId: "act-1", action: "protect", reason: "Action motrice du système.", confidence: null }],
      next7DaysPlan: [],
      validationRequirements: ["user_confirmation"],
      userConfirmationRequired: true,
    },
    next7DaysFocus: [],
    coachQuestions: ["Quel créneau reste réellement protégé ?"],
    confidence: 0.74,
    dataLimitations: ["Pas de transcription Coach brute incluse."],
    safetyNotes: ["Aucune correction n'a été appliquée."],
    generatedAt: "2026-05-20T10:01:00.000Z",
    modelMeta: {
      model: "provider-model",
      promptVersion: "provider-version",
      requestId: "provider-request",
      snapshotHash: null,
    },
    ...overrides,
  };
}

async function createSystemAnalysisApp({
  config = TEST_CONFIG_WITH_OPENAI,
  entitlement,
  dailyCount,
  monthlyCount,
  systemAnalysisQuotaCount,
  insertedLogs,
  mutations,
  openAiParse,
  authUser = null,
} = {}) {
  authUserIndex += 1;
  const app = await buildApp({
    config,
    verifyAccessToken: async () => authUser || ({ id: `user-system-analysis-${authUserIndex}` }),
  });
  app.supabase = createFakeSupabase({
    entitlement,
    dailyCount,
    monthlyCount,
    systemAnalysisQuotaCount,
    insertedLogs,
    mutations,
  });
  if (openAiParse) {
    app.openai = {
      chat: {
        completions: {
          parse: openAiParse,
        },
      },
    };
  }
  return app;
}

test("POST /ai/system-analysis rejects invalid snapshots", async () => {
  const app = await createSystemAnalysisApp();

  const response = await app.inject({
    method: "POST",
    url: "/ai/system-analysis",
    headers: { authorization: "Bearer token" },
    payload: { version: 1, snapshot: { version: 1 }, locale: "fr-FR", timezone: "Europe/Paris", referenceDateKey: "2026-05-20" },
  });

  assert.equal(response.statusCode, 400);
  assert.equal(response.json().error, "INVALID_SYSTEM_ANALYSIS_SNAPSHOT");
  await app.close();
});

test("POST /ai/system-analysis rejects oversized payloads", async () => {
  const app = await createSystemAnalysisApp();

  const response = await app.inject({
    method: "POST",
    url: "/ai/system-analysis",
    headers: { authorization: "Bearer token" },
    payload: createRequest({
      snapshot: createSnapshot({ userWhy: "x".repeat(70 * 1024) }),
    }),
  });

  assert.equal(response.statusCode, 413);
  await app.close();
});

test("POST /ai/system-analysis rejects thin data unless test bypass is enabled", async () => {
  const insertedLogs = [];
  const app = await createSystemAnalysisApp({
    insertedLogs,
    openAiParse: async () => {
      throw new Error("provider should not be called for thin data");
    },
  });

  const response = await app.inject({
    method: "POST",
    url: "/ai/system-analysis",
    headers: { authorization: "Bearer token", "x-forwarded-for": "198.51.100.101" },
    payload: createRequest({
      snapshot: createSnapshot({
        firstRunSummary: { commitStatus: "applied", appliedAt: "2026-05-19" },
        executionStats: { expectedCount: 2, outcomeCount: 1, completedCount: 0, frictionCount: 0, activeDayCount: 1 },
        sessionStats: { endedCount: 1, frictionCount: 0 },
      }),
    }),
  });

  assert.equal(response.statusCode, 422);
  assert.equal(response.json().error, "SYSTEM_ANALYSIS_INELIGIBLE");
  assert.equal(insertedLogs[0]?.feature_id, "system_analysis");
  assert.equal(insertedLogs[0]?.counts_for_quota, false);
  await app.close();
});

test("POST /ai/system-analysis rejects free users with PREMIUM_REQUIRED", async () => {
  const insertedLogs = [];
  const app = await createSystemAnalysisApp({
    config: TEST_CONFIG,
    entitlement: null,
    insertedLogs,
  });

  const response = await app.inject({
    method: "POST",
    url: "/ai/system-analysis",
    headers: { authorization: "Bearer token", "x-forwarded-for": "198.51.100.102" },
    payload: createRequest(),
  });

  assert.equal(response.statusCode, 403);
  assert.equal(response.json().error, "PREMIUM_REQUIRED");
  assert.equal(insertedLogs[0]?.plan_tier, "free");
  assert.equal(insertedLogs[0]?.feature_id, "system_analysis");
  assert.equal(insertedLogs[0]?.counts_for_quota, false);
  await app.close();
});

test("POST /ai/system-analysis rejects trial users with PREMIUM_REQUIRED", async () => {
  const insertedLogs = [];
  const app = await createSystemAnalysisApp({
    entitlement: { plan_tier: "trial" },
    insertedLogs,
  });

  const response = await app.inject({
    method: "POST",
    url: "/ai/system-analysis",
    headers: { authorization: "Bearer token", "x-forwarded-for": "198.51.100.112" },
    payload: createRequest(),
  });

  assert.equal(response.statusCode, 403);
  assert.equal(response.json().error, "PREMIUM_REQUIRED");
  assert.equal(insertedLogs[0]?.plan_tier, "trial");
  assert.equal(insertedLogs[0]?.counts_for_quota, false);
  await app.close();
});

test("POST /ai/system-analysis rejects premium users over the 2/month quota before provider call", async () => {
  const insertedLogs = [];
  let providerCalls = 0;
  const app = await createSystemAnalysisApp({
    entitlement: { plan_tier: "premium" },
    systemAnalysisQuotaCount: 2,
    insertedLogs,
    openAiParse: async () => {
      providerCalls += 1;
      return { choices: [{ message: { parsed: createValidResult() } }] };
    },
  });

  const response = await app.inject({
    method: "POST",
    url: "/ai/system-analysis",
    headers: { authorization: "Bearer token", "x-forwarded-for": "198.51.100.113" },
    payload: createRequest(),
  });

  const body = response.json();
  assert.equal(response.statusCode, 429);
  assert.equal(body.error, "SYSTEM_ANALYSIS_QUOTA_EXCEEDED");
  assert.equal(body.quota.used, 2);
  assert.equal(body.quota.limit, 2);
  assert.equal(body.quota.remaining, 0);
  assert.match(body.quota.resetAt, /^\d{4}-\d{2}-\d{2}T00:00:00\.000Z$/);
  assert.equal(providerCalls, 0);
  assert.equal(insertedLogs[0]?.feature_id, "system_analysis");
  assert.equal(insertedLogs[0]?.status_code, 429);
  assert.equal(insertedLogs[0]?.error_code, "SYSTEM_ANALYSIS_QUOTA_EXCEEDED");
  assert.equal(insertedLogs[0]?.counts_for_quota, false);
  assert.equal(insertedLogs[0]?.cache_hit, false);
  await app.close();
});

test("POST /ai/system-analysis allows premium plus users below the 5/month quota", async () => {
  const insertedLogs = [];
  let providerCalls = 0;
  const app = await createSystemAnalysisApp({
    entitlement: { plan_tier: "premium_plus" },
    systemAnalysisQuotaCount: 4,
    insertedLogs,
    openAiParse: async () => {
      providerCalls += 1;
      return { choices: [{ message: { parsed: createValidResult() } }] };
    },
  });

  const response = await app.inject({
    method: "POST",
    url: "/ai/system-analysis",
    headers: { authorization: "Bearer token", "x-forwarded-for": "198.51.100.114" },
    payload: createRequest(),
  });

  assert.equal(response.statusCode, 200);
  assert.equal(providerCalls, 1);
  assert.equal(insertedLogs[0]?.plan_tier, "premium_plus");
  assert.equal(insertedLogs[0]?.counts_for_quota, true);
  await app.close();
});

test("POST /ai/system-analysis rejects premium plus users at the 5/month quota", async () => {
  const insertedLogs = [];
  let providerCalls = 0;
  const app = await createSystemAnalysisApp({
    entitlement: { plan_tier: "premium_plus" },
    systemAnalysisQuotaCount: 5,
    insertedLogs,
    openAiParse: async () => {
      providerCalls += 1;
      return { choices: [{ message: { parsed: createValidResult() } }] };
    },
  });

  const response = await app.inject({
    method: "POST",
    url: "/ai/system-analysis",
    headers: { authorization: "Bearer token", "x-forwarded-for": "198.51.100.115" },
    payload: createRequest(),
  });

  const body = response.json();
  assert.equal(response.statusCode, 429);
  assert.equal(body.error, "SYSTEM_ANALYSIS_QUOTA_EXCEEDED");
  assert.equal(body.quota.used, 5);
  assert.equal(body.quota.limit, 5);
  assert.equal(body.quota.tier, "premium_plus");
  assert.equal(providerCalls, 0);
  assert.equal(insertedLogs[0]?.plan_tier, "premium_plus");
  assert.equal(insertedLogs[0]?.counts_for_quota, false);
  await app.close();
});

test("POST /ai/system-analysis maps founder/admin override to premium plus quota", async () => {
  const insertedLogs = [];
  let providerCalls = 0;
  const app = await createSystemAnalysisApp({
    entitlement: null,
    systemAnalysisQuotaCount: 4,
    insertedLogs,
    authUser: {
      id: "user-system-analysis-founder",
      app_metadata: { role: "admin" },
    },
    openAiParse: async () => {
      providerCalls += 1;
      return { choices: [{ message: { parsed: createValidResult() } }] };
    },
  });

  const response = await app.inject({
    method: "POST",
    url: "/ai/system-analysis",
    headers: { authorization: "Bearer token", "x-forwarded-for": "198.51.100.116" },
    payload: createRequest(),
  });

  assert.equal(response.statusCode, 200);
  assert.equal(providerCalls, 1);
  assert.equal(insertedLogs[0]?.plan_tier, "premium_plus");
  assert.equal(insertedLogs[0]?.counts_for_quota, true);
  await app.close();
});

test("POST /ai/system-analysis returns structured result for mocked provider and logs safely", async () => {
  let requestedModel = null;
  let requestedTimeout = null;
  let requestedPrompt = "";
  const insertedLogs = [];
  const mutations = [];
  const app = await createSystemAnalysisApp({
    config: {
      ...TEST_CONFIG_WITH_OPENAI,
      SYSTEM_ANALYSIS_MODEL: "gpt-system-route",
      SYSTEM_ANALYSIS_TIMEOUT_MS: 87000,
      SYSTEM_ANALYSIS_PROMPT_VERSION: "system_analysis_route_v1",
    },
    insertedLogs,
    mutations,
    openAiParse: async (input, options) => {
      requestedModel = input?.model || null;
      requestedTimeout = options?.timeout ?? null;
      requestedPrompt = input?.messages?.map((message) => message.content).join("\n") || "";
      return { choices: [{ message: { parsed: createValidResult() } }] };
    },
  });

  const response = await app.inject({
    method: "POST",
    url: "/ai/system-analysis",
    headers: { authorization: "Bearer token", "x-forwarded-for": "198.51.100.103" },
    payload: createRequest(),
  });

  const body = response.json();
  assert.equal(response.statusCode, 200);
  assert.equal(body.version, 1);
  assert.equal(body.correctionDraft.userConfirmationRequired, true);
  assert.equal(body.modelMeta.model, "gpt-system-route");
  assert.equal(body.modelMeta.promptVersion, "system_analysis_route_v1");
  assert.equal(requestedModel, "gpt-system-route");
  assert.equal(requestedTimeout, 87000);
  assert.match(requestedPrompt, /French|fr-FR|Do not mutate|medical|evidence/i);
  assert.equal(mutations.length, 0);
  assert.equal(insertedLogs[0]?.coach_kind, "system-analysis");
  assert.equal(insertedLogs[0]?.route, "/ai/system-analysis");
  assert.equal(insertedLogs[0]?.feature_id, "system_analysis");
  assert.equal(insertedLogs[0]?.cost_class, "premium_deep");
  assert.equal(insertedLogs[0]?.model_class, "premium_deep_analysis");
  assert.equal(insertedLogs[0]?.model, "gpt-system-route");
  assert.equal(insertedLogs[0]?.prompt_version, "system_analysis_route_v1");
  assert.equal(insertedLogs[0]?.counts_for_quota, true);
  assert.equal(insertedLogs[0]?.provider_status, "ok");
  assert.equal(insertedLogs[0]?.protocol_type, "system_analysis_route_v1");
  assert.equal(JSON.stringify(insertedLogs[0]).includes("Construire un système"), false);
  await app.close();
});

test("POST /ai/system-analysis rejects a correction draft without user confirmation", async () => {
  const app = await createSystemAnalysisApp({
    openAiParse: async () => ({
      choices: [
        {
          message: {
            parsed: createValidResult({
              correctionDraft: {
                ...createValidResult().correctionDraft,
                userConfirmationRequired: false,
              },
            }),
          },
        },
      ],
    }),
  });

  const response = await app.inject({
    method: "POST",
    url: "/ai/system-analysis",
    headers: { authorization: "Bearer token", "x-forwarded-for": "198.51.100.104" },
    payload: createRequest(),
  });

  assert.equal(response.statusCode, 502);
  assert.equal(response.json().error, "INVALID_SYSTEM_ANALYSIS_RESPONSE");
  await app.close();
});

test("POST /ai/system-analysis rejects direct persisted occurrence objects", async () => {
  const app = await createSystemAnalysisApp({
    openAiParse: async () => ({
      choices: [
        {
          message: {
            parsed: {
              ...createValidResult(),
              correctionDraft: {
                ...createValidResult().correctionDraft,
                occurrences: [{ id: "occ-1", status: "planned" }],
              },
            },
          },
        },
      ],
    }),
  });

  const response = await app.inject({
    method: "POST",
    url: "/ai/system-analysis",
    headers: { authorization: "Bearer token", "x-forwarded-for": "198.51.100.105" },
    payload: createRequest(),
  });

  assert.equal(response.statusCode, 502);
  assert.equal(response.json().error, "INVALID_SYSTEM_ANALYSIS_RESPONSE");
  await app.close();
});

test("POST /ai/system-analysis rejects missing occurrence IDs when server state is available", async () => {
  const app = await createSystemAnalysisApp({
    openAiParse: async () => ({
      choices: [
        {
          message: {
            parsed: createValidResult({
              correctionDraft: {
                ...createValidResult().correctionDraft,
                occurrenceAdjustments: [
                  {
                    occurrenceId: "missing-occ",
                    action: "move",
                    proposedDateKey: "2026-05-21",
                    proposedStart: "10:00",
                    proposedDurationMinutes: null,
                    reason: "Déplacer ce bloc.",
                    confidence: null,
                  },
                ],
              },
            }),
          },
        },
      ],
    }),
  });

  const response = await app.inject({
    method: "POST",
    url: "/ai/system-analysis",
    headers: { authorization: "Bearer token", "x-forwarded-for": "198.51.100.106" },
    payload: createRequest(),
  });

  assert.equal(response.statusCode, 502);
  assert.equal(response.json().error, "INVALID_SYSTEM_ANALYSIS_RESPONSE");
  assert.equal(
    response.json().details.governanceIssues.some((issue) => issue.code === "UNKNOWN_OCCURRENCE_REFERENCE"),
    true
  );
  await app.close();
});

test("POST /ai/system-analysis rejects unsupported medical claims", async () => {
  const app = await createSystemAnalysisApp({
    openAiParse: async () => ({
      choices: [
        {
          message: {
            parsed: createValidResult({
              executiveSummary: "Ce système diagnostique une dépression clinique.",
            }),
          },
        },
      ],
    }),
  });

  const response = await app.inject({
    method: "POST",
    url: "/ai/system-analysis",
    headers: { authorization: "Bearer token", "x-forwarded-for": "198.51.100.107" },
    payload: createRequest(),
  });

  assert.equal(response.statusCode, 502);
  assert.equal(response.json().error, "INVALID_SYSTEM_ANALYSIS_RESPONSE");
  assert.equal(
    response.json().details.governanceIssues.some((issue) => issue.code === "UNSUPPORTED_MEDICAL_CLAIM"),
    true
  );
  await app.close();
});

test("POST /ai/system-analysis maps provider timeout to 504", async () => {
  const insertedLogs = [];
  const app = await createSystemAnalysisApp({
    insertedLogs,
    openAiParse: async () => {
      throw new APIConnectionTimeoutError();
    },
  });

  const response = await app.inject({
    method: "POST",
    url: "/ai/system-analysis",
    headers: { authorization: "Bearer token", "x-forwarded-for": "198.51.100.108" },
    payload: createRequest(),
  });

  assert.equal(response.statusCode, 504);
  assert.equal(response.json().error, "SYSTEM_ANALYSIS_PROVIDER_TIMEOUT");
  assert.equal(insertedLogs[0]?.provider_status, "timeout");
  assert.equal(insertedLogs[0]?.feature_id, "system_analysis");
  assert.equal(insertedLogs[0]?.counts_for_quota, false);
  await app.close();
});

test("POST /ai/system-analysis maps provider failure to structured 503", async () => {
  const insertedLogs = [];
  const app = await createSystemAnalysisApp({
    insertedLogs,
    openAiParse: async () => {
      throw new Error("provider down");
    },
  });

  const response = await app.inject({
    method: "POST",
    url: "/ai/system-analysis",
    headers: { authorization: "Bearer token", "x-forwarded-for": "198.51.100.109" },
    payload: createRequest(),
  });

  assert.equal(response.statusCode, 503);
  assert.equal(response.json().error, "SYSTEM_ANALYSIS_BACKEND_UNAVAILABLE");
  assert.equal(insertedLogs[0]?.feature_id, "system_analysis");
  assert.equal(insertedLogs[0]?.counts_for_quota, false);
  await app.close();
});
