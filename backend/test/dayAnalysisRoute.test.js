import test from "node:test";
import assert from "node:assert/strict";
import { APIConnectionTimeoutError } from "openai";
import { buildApp } from "../src/app.js";

const TEST_CONFIG = {
  APP_ENV: "test",
  PORT: 3001,
  SUPABASE_URL: "https://example.supabase.co",
  SUPABASE_SECRET_KEY: "service-role-test",
  OPENAI_API_KEY: "test-openai-key",
  OPENAI_MODEL: "gpt-4.1-mini",
  OPENAI_DEFAULT_TIMEOUT_MS: 20000,
  AI_MODEL_FAST_LOW_COST_TEXT: "",
  AI_MODEL_STRUCTURED_JSON_SMALL: "",
  AI_MODEL_REASONING_MEDIUM: "gpt-reasoning-medium",
  AI_MODEL_REASONING_DEEP: "",
  AI_MODEL_PREMIUM_DEEP_ANALYSIS: "",
  AI_TIMEOUT_FAST_LOW_COST_TEXT_MS: "",
  AI_TIMEOUT_STRUCTURED_JSON_SMALL_MS: "",
  AI_TIMEOUT_REASONING_MEDIUM_MS: 33000,
  AI_TIMEOUT_REASONING_DEEP_MS: "",
  AI_TIMEOUT_PREMIUM_DEEP_ANALYSIS_MS: "",
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
  SYSTEM_ANALYSIS_PROMPT_VERSION: "system_analysis_v2_0",
  DAY_ANALYSIS_PROMPT_VERSION: "day_analysis_test_v1",
  AI_QUOTA_MODE: "normal",
  CORS_ALLOW_PRIVATE_NETWORK_DEV: false,
  CORS_ALLOWED_ORIGINS: ["http://localhost:5173", "http://127.0.0.1:5173"],
  LOG_LEVEL: "silent",
};

function createFakeSupabase({
  userData = {},
  entitlement = { plan_tier: "premium" },
  dailyCount = 0,
  monthlyCount = 0,
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
          upsert: async () => {
            throw new Error("day analysis must not mutate user_data");
          },
          update: async () => {
            throw new Error("day analysis must not mutate user_data");
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
              return {
                eq() {
                  return {
                    gte() {
                      return {
                        lt: async () => {
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

async function createDayAnalysisApp({
  insertedLogs = [],
  dailyCount = 0,
  monthlyCount = 0,
  entitlement = { plan_tier: "premium" },
  openAiParse,
  config = TEST_CONFIG,
  authUserId = `user-day-analysis-${Math.random().toString(36).slice(2)}`,
} = {}) {
  const app = await buildApp({
    config,
    logger: false,
    verifyAccessToken: async () => ({ id: authUserId }),
  });
  app.supabase = createFakeSupabase({
    entitlement,
    dailyCount,
    monthlyCount,
    insertedLogs,
  });
  app.openai = {
    chat: {
      completions: {
        parse: openAiParse || (async () => ({ choices: [{ message: { parsed: createProviderResult() } }] })),
      },
    },
  };
  return app;
}

function candidate(overrides = {}) {
  return {
    id: "recover_block:late:occ-1",
    type: "recover_block",
    label: "Récupérer ce bloc",
    description: "Ouvre les options de récupération.",
    targetType: "occurrence",
    targetId: "occ-1",
    supportStatus: "recovery_sheet",
    deterministicAction: {
      kind: "recovery",
      occurrenceId: "occ-1",
      context: "late",
    },
    confirmationRequired: true,
    preview: { summary: "Ce bloc est en retard." },
    ...overrides,
  };
}

function planningCandidate() {
  return {
    id: "open_planning:2026-04-19",
    type: "open_planning",
    label: "Ouvrir Planning",
    description: "Voir la journée et choisir l’ajustement manuellement.",
    targetType: "planning",
    targetId: "2026-04-19",
    supportStatus: "navigation_only",
    deterministicAction: { kind: "navigation", route: "planning", dayKey: "2026-04-19" },
    confirmationRequired: false,
    preview: { summary: "Aucune modification automatique." },
  };
}

function createSnapshot(overrides = {}) {
  return {
    version: 1,
    dayKey: "2026-04-19",
    nowIso: "2026-04-19T10:00:00.000Z",
    timezone: "Europe/Paris",
    activeCategoryId: "work",
    primaryGoal: { id: "obj-1", title: "Publier l’app", categoryId: "work", type: "OUTCOME" },
    whyText: "Je veux publier l’app sans perdre le fil.",
    firstRun: {
      status: "completed",
      appliedAt: "2026-04-19T08:00:00.000Z",
      planSource: "local",
      createdActionCount: 1,
      createdOccurrenceCount: 1,
    },
    primaryAction: {
      status: "late",
      occurrenceId: "occ-1",
      actionId: "act-1",
      title: "Préparer la publication",
      description: "",
      timingLabel: "08:30",
      durationLabel: "30 min",
      primaryLabel: "Récupérer",
      reason: "Bloc en retard",
    },
    occurrences: [
      {
        id: "occ-1",
        actionId: "act-1",
        objectiveId: "obj-1",
        categoryId: "work",
        title: "Préparer la publication",
        dateKey: "2026-04-19",
        start: "08:30",
        durationMinutes: 30,
        persistedStatus: "planned",
        derivedStatus: "planned",
        executionSource: "occurrence",
        executionReason: "occurrence_planned",
        historyId: null,
      },
    ],
    sessionHistory: [],
    activeSession: null,
    systemSignals: [],
    deterministicActions: [candidate(), planningCandidate()],
    dataLimitations: [],
    ...overrides,
  };
}

function createRequest(overrides = {}) {
  return {
    snapshot: createSnapshot(),
    snapshotHash: "dah_test_hash",
    clientRequestId: "client_req_1",
    ...overrides,
  };
}

function responseAction(source = candidate()) {
  return {
    id: source.id,
    type: source.type,
    label: source.label,
    description: source.description,
    targetType: source.targetType,
    targetId: source.targetId,
    supportStatus: source.supportStatus,
    deterministicAction: source.deterministicAction,
    confirmationRequired: source.confirmationRequired,
    preview: source.preview,
  };
}

function createProviderResult(overrides = {}) {
  return {
    version: 1,
    dayKey: "2026-04-19",
    diagnosis: {
      title: "Un bloc est à récupérer",
      explanation: "Le bloc prévu ce matin est encore récupérable en version simple.",
      evidence: ["Bloc prévu à 08:30", "Action : Préparer la publication"],
      confidence: 0.84,
    },
    recommendedAction: responseAction(),
    alternatives: [responseAction(planningCandidate())],
    dataLimitations: [],
    userConfirmationRequired: true,
    ...overrides,
  };
}

test("POST /ai/day-analysis returns normalized V1 result and logs safely", async () => {
  let requestedModel = null;
  let requestedTimeout = null;
  let requestedPrompt = "";
  const insertedLogs = [];
  const app = await createDayAnalysisApp({
    insertedLogs,
    openAiParse: async (input, options) => {
      requestedModel = input?.model || null;
      requestedTimeout = options?.timeout || null;
      requestedPrompt = input?.messages?.map((message) => message.content).join("\n") || "";
      return { choices: [{ message: { parsed: createProviderResult() } }] };
    },
  });

  const response = await app.inject({
    method: "POST",
    url: "/ai/day-analysis",
    headers: { authorization: "Bearer token", "x-forwarded-for": "198.51.100.201" },
    payload: createRequest(),
  });

  const body = response.json();
  assert.equal(response.statusCode, 200);
  assert.equal(body.version, 1);
  assert.equal(body.dayKey, "2026-04-19");
  assert.equal(body.recommendedAction.id, "recover_block:late:occ-1");
  assert.deepEqual(body.recommendedAction.deterministicAction, candidate().deterministicAction);
  assert.equal(body.modelMeta.model, "gpt-reasoning-medium");
  assert.equal(body.modelMeta.modelClass, "reasoning_medium");
  assert.equal(body.modelMeta.promptVersion, "day_analysis_test_v1");
  assert.equal(body.quota.featureId, "today_ai_insight");
  assert.equal(requestedModel, "gpt-reasoning-medium");
  assert.equal(requestedTimeout, 33000);
  assert.match(requestedPrompt, /today only|Analyse IA du jour|deterministicActions/i);
  assert.equal(insertedLogs[0]?.route, "/ai/day-analysis");
  assert.equal(insertedLogs[0]?.feature_id, "today_ai_insight");
  assert.equal(insertedLogs[0]?.model_class, "reasoning_medium");
  assert.equal(insertedLogs[0]?.counts_for_quota, true);
  assert.equal(insertedLogs[0]?.provider_status, "ok");
  assert.equal(JSON.stringify(insertedLogs[0]).includes("Je veux publier l’app"), false);
  await app.close();
});

test("POST /ai/day-analysis rejects raw or non-today snapshots before provider call", async () => {
  let providerCalls = 0;
  const app = await createDayAnalysisApp({
    openAiParse: async () => {
      providerCalls += 1;
      return { choices: [{ message: { parsed: createProviderResult() } }] };
    },
  });

  const response = await app.inject({
    method: "POST",
    url: "/ai/day-analysis",
    headers: { authorization: "Bearer token" },
    payload: createRequest({
      snapshot: createSnapshot({
        messages: [{ role: "user", content: "raw chat" }],
        occurrences: [
          {
            ...createSnapshot().occurrences[0],
            dateKey: "2026-04-20",
          },
        ],
      }),
    }),
  });

  assert.equal(response.statusCode, 400);
  assert.equal(response.json().error, "DAY_ANALYSIS_SNAPSHOT_INVALID");
  assert.equal(providerCalls, 0);
  await app.close();
});

test("POST /ai/day-analysis rejects unknown provider candidate ids", async () => {
  const insertedLogs = [];
  const app = await createDayAnalysisApp({
    insertedLogs,
    openAiParse: async () => ({
      choices: [
        {
          message: {
            parsed: createProviderResult({
              recommendedAction: {
                ...responseAction(),
                id: "unknown-candidate",
              },
            }),
          },
        },
      ],
    }),
  });

  const response = await app.inject({
    method: "POST",
    url: "/ai/day-analysis",
    headers: { authorization: "Bearer token" },
    payload: createRequest(),
  });

  assert.equal(response.statusCode, 502);
  assert.equal(response.json().error, "INVALID_DAY_ANALYSIS_RESPONSE");
  assert.equal(insertedLogs[0]?.counts_for_quota, false);
  assert.equal(insertedLogs[0]?.provider_status, "invalid_response");
  await app.close();
});

test("POST /ai/day-analysis rejects unsafe provider claims", async () => {
  for (const explanation of [
    "Il faut refaire tout le système cette semaine complète.",
    "J’ai déplacé ton bloc automatiquement.",
    "Supprimer cette action est prioritaire.",
    "Ce comportement ressemble à une dépression clinique.",
    "C’est ta faute si ce bloc bloque.",
  ]) {
    const app = await createDayAnalysisApp({
      openAiParse: async () => ({
        choices: [{ message: { parsed: createProviderResult({ diagnosis: { ...createProviderResult().diagnosis, explanation } }) } }],
      }),
    });

    const response = await app.inject({
      method: "POST",
      url: "/ai/day-analysis",
      headers: { authorization: "Bearer token" },
      payload: createRequest(),
    });

    assert.equal(response.statusCode, 502);
    assert.equal(response.json().error, "INVALID_DAY_ANALYSIS_RESPONSE");
    await app.close();
  }
});

test("POST /ai/day-analysis maps quota exhaustion and provider timeout safely", async () => {
  const quotaApp = await createDayAnalysisApp({ dailyCount: 30 });
  const quotaResponse = await quotaApp.inject({
    method: "POST",
    url: "/ai/day-analysis",
    headers: { authorization: "Bearer token" },
    payload: createRequest(),
  });
  assert.equal(quotaResponse.statusCode, 429);
  assert.equal(quotaResponse.json().error, "QUOTA_EXCEEDED");
  await quotaApp.close();

  const timeoutApp = await createDayAnalysisApp({
    openAiParse: async () => {
      throw new APIConnectionTimeoutError({ message: "request timed out" });
    },
  });
  const timeoutResponse = await timeoutApp.inject({
    method: "POST",
    url: "/ai/day-analysis",
    headers: { authorization: "Bearer token" },
    payload: createRequest(),
  });
  assert.equal(timeoutResponse.statusCode, 504);
  assert.equal(timeoutResponse.json().error, "DAY_ANALYSIS_PROVIDER_TIMEOUT");
  await timeoutApp.close();
});
