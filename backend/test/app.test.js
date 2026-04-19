import test from "node:test";
import assert from "node:assert/strict";
import { APIConnectionTimeoutError } from "openai";
import { buildApp } from "../src/app.js";
import {
  coachChatResponseSchema,
  coachLocalAnalysisResponseSchema,
  coachResponseSchema,
  sessionGuidanceResponseSchema,
} from "../src/schemas/coach.js";
import { firstRunPlanResponseSchema } from "../src/schemas/firstRun.js";

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
  SESSION_GUIDANCE_PREPARE_OPENAI_MODEL: "",
  SESSION_GUIDANCE_PREPARE_OPENAI_TIMEOUT_MS: 60000,
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

function addDateKeyOffset(dateKey, days = 0) {
  const [year, month, day] = String(dateKey || "").split("-").map((value) => Number(value));
  const date = new Date(year, month - 1, day, 12, 0, 0, 0);
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

function createValidFirstRunPlanResponse({ requestId = "req-first-run", inputHash = "hash-first-run" } = {}) {
  return {
    version: 2,
    source: "ai_backend",
    inputHash,
    generatedAt: "2026-04-19T08:00:00.000Z",
    requestId,
    model: "gpt-5.4",
    promptVersion: "first_run_plan_v1",
    plans: [
      {
        id: "tenable",
        variant: "tenable",
        title: "Plan tenable",
        summary: "Une semaine tenable, dense juste ce qu'il faut.",
        comparisonMetrics: {
          weeklyMinutes: 150,
          totalBlocks: 5,
          activeDays: 4,
          recoverySlots: 3,
          dailyDensity: "respirable",
          engagementLevel: "tenable",
        },
        categories: [
          { id: "cat_business", label: "Business", role: "primary", blockCount: 3 },
          { id: "cat_health", label: "Santé", role: "support", blockCount: 2 },
        ],
        preview: [
          {
            dayKey: TODAY_KEY,
            dayLabel: "DIM 19/04",
            slotLabel: "08:00 - 08:25",
            categoryId: "cat_business",
            categoryLabel: "Business",
            title: "Bloc roadmap",
            minutes: 25,
          },
        ],
        todayPreview: [
          {
            dayKey: TODAY_KEY,
            dayLabel: "DIM 19/04",
            slotLabel: "08:00 - 08:25",
            categoryId: "cat_business",
            categoryLabel: "Business",
            title: "Bloc roadmap",
            minutes: 25,
          },
        ],
        rationale: {
          whyFit: "Le plan protège l'élan.",
          capacityFit: "La charge reste respirable.",
          constraintFit: "Les contraintes sont respectées.",
        },
        commitDraft: {
          version: 1,
          categories: [
            { id: "cat_business", templateId: "business", name: "Business", color: "#0ea5e9", order: 0 },
            { id: "cat_health", templateId: "health", name: "Santé", color: "#22c55e", order: 1 },
          ],
          goals: [
            { id: "goal_business", categoryId: "cat_business", title: "Relancer le projet", type: "OUTCOME", order: 0 },
          ],
          actions: [
            {
              id: "action_roadmap",
              categoryId: "cat_business",
              parentGoalId: "goal_business",
              title: "Bloc roadmap",
              type: "PROCESS",
              order: 0,
              repeat: "weekly",
              daysOfWeek: [1, 2, 3, 4, 5, 6, 7],
              timeMode: "FIXED",
              startTime: "08:00",
              timeSlots: ["08:00"],
              durationMinutes: 25,
              sessionMinutes: 25,
            },
            {
              id: "action_walk",
              categoryId: "cat_health",
              parentGoalId: null,
              title: "Marche active",
              type: "PROCESS",
              order: 1,
              repeat: "weekly",
              daysOfWeek: [1, 2, 3, 4, 5, 6, 7],
              timeMode: "FIXED",
              startTime: "18:30",
              timeSlots: ["18:30"],
              durationMinutes: 25,
              sessionMinutes: 25,
            },
          ],
          occurrences: [
            { id: "occ_t_1", actionId: "action_roadmap", date: TODAY_KEY, start: "08:00", durationMinutes: 25, status: "planned" },
            { id: "occ_t_2", actionId: "action_walk", date: FUTURE_KEY, start: "18:30", durationMinutes: 25, status: "planned" },
            { id: "occ_t_3", actionId: "action_roadmap", date: addDateKeyOffset(TODAY_KEY, 2), start: "08:00", durationMinutes: 35, status: "planned" },
            { id: "occ_t_4", actionId: "action_walk", date: addDateKeyOffset(TODAY_KEY, 3), start: "18:30", durationMinutes: 30, status: "planned" },
            { id: "occ_t_5", actionId: "action_roadmap", date: addDateKeyOffset(TODAY_KEY, 4), start: "08:00", durationMinutes: 35, status: "planned" },
          ],
        },
      },
      {
        id: "ambitious",
        variant: "ambitious",
        title: "Plan ambitieux",
        summary: "Une semaine plus structurée et plus dense.",
        comparisonMetrics: {
          weeklyMinutes: 225,
          totalBlocks: 7,
          activeDays: 5,
          recoverySlots: 2,
          dailyDensity: "soutenue",
          engagementLevel: "ambitious",
        },
        categories: [
          { id: "cat_business", label: "Business", role: "primary", blockCount: 4 },
          { id: "cat_health", label: "Santé", role: "support", blockCount: 3 },
        ],
        preview: [
          {
            dayKey: TODAY_KEY,
            dayLabel: "DIM 19/04",
            slotLabel: "07:30 - 08:15",
            categoryId: "cat_business",
            categoryLabel: "Business",
            title: "Bloc roadmap",
            minutes: 45,
          },
        ],
        todayPreview: [
          {
            dayKey: TODAY_KEY,
            dayLabel: "DIM 19/04",
            slotLabel: "07:30 - 08:15",
            categoryId: "cat_business",
            categoryLabel: "Business",
            title: "Bloc roadmap",
            minutes: 45,
          },
        ],
        rationale: {
          whyFit: "Le plan accélère dès la première semaine.",
          capacityFit: "La charge est plus engagée.",
          constraintFit: "Les créneaux favorables sont maximisés.",
        },
        commitDraft: {
          version: 1,
          categories: [
            { id: "cat_business", templateId: "business", name: "Business", color: "#0ea5e9", order: 0 },
            { id: "cat_health", templateId: "health", name: "Santé", color: "#22c55e", order: 1 },
          ],
          goals: [
            { id: "goal_business", categoryId: "cat_business", title: "Relancer le projet", type: "OUTCOME", order: 0 },
          ],
          actions: [
            {
              id: "action_roadmap",
              categoryId: "cat_business",
              parentGoalId: "goal_business",
              title: "Bloc roadmap",
              type: "PROCESS",
              order: 0,
              repeat: "weekly",
              daysOfWeek: [1, 2, 3, 4, 5, 6, 7],
              timeMode: "FIXED",
              startTime: "07:30",
              timeSlots: ["07:30"],
              durationMinutes: 45,
              sessionMinutes: 45,
            },
            {
              id: "action_walk",
              categoryId: "cat_health",
              parentGoalId: null,
              title: "Marche active",
              type: "PROCESS",
              order: 1,
              repeat: "weekly",
              daysOfWeek: [1, 2, 3, 4, 5, 6, 7],
              timeMode: "FIXED",
              startTime: "18:30",
              timeSlots: ["18:30"],
              durationMinutes: 30,
              sessionMinutes: 30,
            },
          ],
          occurrences: [
            { id: "occ_a_1", actionId: "action_roadmap", date: TODAY_KEY, start: "07:30", durationMinutes: 45, status: "planned" },
            { id: "occ_a_2", actionId: "action_walk", date: FUTURE_KEY, start: "18:30", durationMinutes: 30, status: "planned" },
            { id: "occ_a_3", actionId: "action_roadmap", date: addDateKeyOffset(TODAY_KEY, 2), start: "07:30", durationMinutes: 45, status: "planned" },
            { id: "occ_a_4", actionId: "action_walk", date: addDateKeyOffset(TODAY_KEY, 3), start: "18:30", durationMinutes: 30, status: "planned" },
            { id: "occ_a_5", actionId: "action_roadmap", date: addDateKeyOffset(TODAY_KEY, 4), start: "07:30", durationMinutes: 45, status: "planned" },
            { id: "occ_a_6", actionId: "action_walk", date: addDateKeyOffset(TODAY_KEY, 5), start: "18:30", durationMinutes: 30, status: "planned" },
            { id: "occ_a_7", actionId: "action_roadmap", date: addDateKeyOffset(TODAY_KEY, 6), start: "07:30", durationMinutes: 30, status: "planned" },
          ],
        },
      },
    ],
  };
}

function createValidFirstRunPlanRequest(overrides = {}) {
  return {
    whyText: "Je veux retrouver une semaine sous contrôle.",
    primaryGoal: "Relancer le projet principal",
    unavailableWindows: [
      {
        id: "window_work",
        daysOfWeek: [1, 2, 3, 4, 5],
        startTime: "09:00",
        endTime: "18:00",
        label: "Travail",
      },
    ],
    preferredWindows: [
      {
        id: "window_morning",
        daysOfWeek: [1, 3, 5, 6],
        startTime: "07:00",
        endTime: "09:00",
        label: "Matin",
      },
    ],
    currentCapacity: "stable",
    priorityCategoryIds: ["business", "health"],
    timezone: "Europe/Paris",
    locale: "fr-FR",
    referenceDateKey: TODAY_KEY,
    ...overrides,
  };
}

function createValidSessionPreparedRunbook({
  protocolType = "sport",
  dateKey = TODAY_KEY,
  occurrenceId = "occ-1",
  actionId = "goal-1",
  title = "Circuit jambes et gainage",
  categoryName = "Sport",
} = {}) {
  return {
    version: 2,
    protocolType,
    occurrenceId,
    actionId,
    dateKey,
    title,
    categoryName,
    objective: {
      why: "tenir un bloc cardio-force net",
      successDefinition: "le circuit est tenu sans casser la forme",
    },
    steps: [
      {
        id: "step_1",
        label: "Mise en route",
        purpose: "préparer les appuis",
        successCue: "souffle posé",
        items: [
          {
            id: "step_1_item_1",
            kind: "warmup",
            label: "Montées de genoux",
            minutes: 3,
            guidance: "alterne 30 sec dynamiques puis 30 sec plus calmes pour monter en température",
            successCue: "respiration stable",
            restSec: 0,
            transitionLabel: null,
            execution: null,
          },
          {
            id: "step_1_item_2",
            kind: "activation",
            label: "Squats au poids du corps",
            minutes: 2,
            guidance: "2 séries de 12 reps en gardant le buste haut",
            successCue: "genoux stables",
            restSec: 0,
            transitionLabel: null,
            execution: null,
          },
        ],
      },
      {
        id: "step_2",
        label: "Bloc force",
        purpose: "tenir le coeur utile",
        successCue: "gainage propre",
        items: [
          {
            id: "step_2_item_1",
            kind: "effort",
            label: "Fentes alternées",
            minutes: 4,
            guidance: "2 séries de 10 reps par jambe sans te précipiter",
            successCue: "appuis nets",
            restSec: 25,
            transitionLabel: null,
            execution: {
              reps: "2 x 10/jambe",
              durationSec: null,
              tempo: null,
              deliverable: null,
              doneWhen: null,
              relaunchCue: null,
              restSec: 25,
            },
          },
          {
            id: "step_2_item_2",
            kind: "effort",
            label: "Planche avant",
            minutes: 4,
            guidance: "3 passages de 40 sec avec 20 sec de repos entre les passages",
            successCue: "bassin aligné",
            restSec: 20,
            transitionLabel: null,
            execution: {
              reps: null,
              durationSec: 40,
              tempo: null,
              deliverable: null,
              doneWhen: null,
              relaunchCue: null,
              restSec: 20,
            },
          },
          {
            id: "step_2_item_3",
            kind: "effort",
            label: "Pont fessier",
            minutes: 3,
            guidance: "2 séries de 15 reps avec montée contrôlée et pause d’une seconde en haut",
            successCue: "fessiers engagés",
            restSec: 20,
            transitionLabel: null,
            execution: null,
          },
        ],
      },
      {
        id: "step_3",
        label: "Retour au calme",
        purpose: "faire redescendre proprement",
        successCue: "souffle revenu",
        items: [
          {
            id: "step_3_item_1",
            kind: "cooldown",
            label: "Marche lente",
            minutes: 2,
            guidance: "marche en récupérant le souffle avant de t’arrêter",
            successCue: "fréquence calmée",
            restSec: 0,
            transitionLabel: null,
            execution: null,
          },
          {
            id: "step_3_item_2",
            kind: "breath",
            label: "Étirements hanches et mollets",
            minutes: 2,
            guidance: "tiens 30 sec par côté sans forcer",
            successCue: "tension relâchée",
            restSec: 0,
            transitionLabel: null,
            execution: null,
          },
        ],
      },
    ],
  };
}

function createValidSessionAdjustCandidate() {
  return {
    currentRunbook: createValidSessionPreparedRunbook(),
    impactNote: "On raccourcit légèrement le coeur du bloc sans perdre l’objectif.",
    guardrails: ["Garde le même ordre", "Ralentis si la forme casse"],
  };
}

function createValidSessionToolCandidate() {
  return {
    toolResult: {
      artifactType: "cues_card",
      title: "Repères d’exécution",
      blocks: [
        {
          type: "list",
          title: "Repères utiles",
          items: ["Appuis nets", "Buste haut", "Relance propre"],
        },
      ],
      copyText: "- Appuis nets\n- Buste haut\n- Relance propre",
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
  assert.deepEqual(response.json(), {
    ok: true,
    service: "ai-backend",
    appEnv: "test",
    requestId: response.headers["x-request-id"],
    openAiConfigured: false,
    cors: {
      allowPrivateNetworkDev: false,
    },
  });
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

test("OPTIONS /ai/chat accepts a .local dev origin when private network dev CORS is enabled", async () => {
  const app = await buildApp({
    config: {
      ...TEST_CONFIG,
      CORS_ALLOW_PRIVATE_NETWORK_DEV: true,
    },
    verifyAccessToken: async () => ({ id: "user-chat-local-domain" }),
  });
  const response = await app.inject({
    method: "OPTIONS",
    url: "/ai/chat",
    headers: {
      origin: "http://discip.local:5173",
      "access-control-request-method": "POST",
      "access-control-request-headers": "authorization,content-type",
    },
  });
  assert.equal(response.statusCode, 204);
  assert.equal(response.headers["access-control-allow-origin"], "http://discip.local:5173");
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

test("OPTIONS private LAN preflight stays blocked outside local/test even when private network dev CORS is enabled", async () => {
  const app = await buildApp({
    config: {
      ...TEST_CONFIG,
      APP_ENV: "prod",
      CORS_ALLOW_PRIVATE_NETWORK_DEV: true,
    },
    verifyAccessToken: async () => ({ id: "user-prod-lan" }),
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

test("POST /ai/first-run-plan returns backend unavailable when OpenAI is missing", async () => {
  const app = await buildApp({
    config: TEST_CONFIG,
    verifyAccessToken: async () => ({ id: "user-first-run-noai" }),
  });
  app.supabase = createFakeSupabase({
    userData: createCoachContextUserData(),
    entitlement: null,
    dailyCount: 0,
    monthlyCount: 0,
  });

  const response = await app.inject({
    method: "POST",
    url: "/ai/first-run-plan",
    headers: { authorization: "Bearer token", "x-forwarded-for": "198.51.100.33" },
    payload: createValidFirstRunPlanRequest(),
  });

  assert.equal(response.statusCode, 503);
  assert.equal(response.json().error, "FIRST_RUN_PLAN_BACKEND_UNAVAILABLE");
  await app.close();
});

test("POST /ai/first-run-plan uses gpt-5.4 with a dedicated timeout by default", async () => {
  let requestedModel = null;
  let requestedTimeout = null;
  const app = await buildApp({
    config: TEST_CONFIG_WITH_OPENAI,
    verifyAccessToken: async () => ({ id: "user-first-run-default-model" }),
  });
  app.supabase = createFakeSupabase({
    userData: createCoachContextUserData(),
    entitlement: null,
    dailyCount: 0,
    monthlyCount: 0,
  });
  app.openai = {
    chat: {
      completions: {
        parse: async (input, options) => {
          requestedModel = input?.model || null;
          requestedTimeout = options?.timeout ?? null;
          return {
            choices: [
              {
                message: {
                  parsed: {
                    plans: createValidFirstRunPlanResponse().plans.map((plan) => ({
                      variant: plan.variant,
                      summary: plan.summary,
                      rationale: plan.rationale,
                      commitDraft: plan.commitDraft,
                    })),
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
    url: "/ai/first-run-plan",
    headers: { authorization: "Bearer token", "x-forwarded-for": "198.51.100.34" },
    payload: createValidFirstRunPlanRequest(),
  });

  assert.equal(response.statusCode, 200);
  assert.equal(requestedModel, "gpt-5.4");
  assert.equal(requestedTimeout, 55000);
  await app.close();
});

test("POST /ai/first-run-plan applies a 30000ms floor to the dedicated timeout", async () => {
  let requestedTimeout = null;
  const app = await buildApp({
    config: {
      ...TEST_CONFIG_WITH_OPENAI,
      FIRST_RUN_PLAN_OPENAI_TIMEOUT_MS: 12000,
    },
    verifyAccessToken: async () => ({ id: "user-first-run-timeout-floor" }),
  });
  app.supabase = createFakeSupabase({
    userData: createCoachContextUserData(),
    entitlement: null,
    dailyCount: 0,
    monthlyCount: 0,
  });
  app.openai = {
    chat: {
      completions: {
        parse: async (_input, options) => {
          requestedTimeout = options?.timeout ?? null;
          return {
            choices: [
              {
                message: {
                  parsed: {
                    plans: createValidFirstRunPlanResponse().plans.map((plan) => ({
                      variant: plan.variant,
                      summary: plan.summary,
                      rationale: plan.rationale,
                      commitDraft: plan.commitDraft,
                    })),
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
    url: "/ai/first-run-plan",
    headers: { authorization: "Bearer token", "x-forwarded-for": "198.51.100.35" },
    payload: createValidFirstRunPlanRequest(),
  });

  assert.equal(response.statusCode, 200);
  assert.equal(requestedTimeout, 30000);
  await app.close();
});

test("POST /ai/first-run-plan returns an explicit provider timeout error", async () => {
  const insertedLogs = [];
  const app = await buildApp({
    config: TEST_CONFIG_WITH_OPENAI,
    verifyAccessToken: async () => ({ id: "user-first-run-provider-timeout" }),
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
        parse: async () => {
          throw new APIConnectionTimeoutError();
        },
      },
    },
  };

  const response = await app.inject({
    method: "POST",
    url: "/ai/first-run-plan",
    headers: { authorization: "Bearer token", "x-forwarded-for": "198.51.100.36" },
    payload: createValidFirstRunPlanRequest(),
  });

  assert.equal(response.statusCode, 504);
  assert.equal(response.json().error, "FIRST_RUN_PLAN_PROVIDER_TIMEOUT");
  assert.equal(insertedLogs[0]?.coach_kind, "first-run-plan");
  assert.equal(insertedLogs[0]?.route, "/ai/first-run-plan");
  await app.close();
});

test("POST /ai/first-run-plan rejects plans that do not diverge enough", async () => {
  const app = await buildApp({
    config: TEST_CONFIG_WITH_OPENAI,
    verifyAccessToken: async () => ({ id: "user-first-run-no-divergence" }),
  });
  app.supabase = createFakeSupabase({
    userData: createCoachContextUserData(),
    entitlement: null,
    dailyCount: 0,
    monthlyCount: 0,
  });
  app.openai = {
    chat: {
      completions: {
        parse: async () => {
          const basePlans = createValidFirstRunPlanResponse().plans;
          const baseTenable = basePlans[0];
          const validTenableDraft = {
            ...baseTenable.commitDraft,
            occurrences: [
              { id: "div_t_1", actionId: "action_roadmap", date: TODAY_KEY, start: "08:00", durationMinutes: 40, status: "planned" },
              { id: "div_t_2", actionId: "action_walk", date: FUTURE_KEY, start: "18:30", durationMinutes: 30, status: "planned" },
              { id: "div_t_3", actionId: "action_roadmap", date: addDateKeyOffset(TODAY_KEY, 2), start: "08:00", durationMinutes: 50, status: "planned" },
              { id: "div_t_4", actionId: "action_walk", date: addDateKeyOffset(TODAY_KEY, 3), start: "18:30", durationMinutes: 40, status: "planned" },
              { id: "div_t_5", actionId: "action_roadmap", date: addDateKeyOffset(TODAY_KEY, 4), start: "08:00", durationMinutes: 50, status: "planned" },
            ],
          };
          return {
            choices: [
              {
                message: {
                  parsed: {
                    plans: [
                      {
                        variant: "tenable",
                        summary: baseTenable.summary,
                        rationale: baseTenable.rationale,
                        commitDraft: validTenableDraft,
                      },
                      {
                        variant: "ambitious",
                        summary: "Plan ambitieux trop proche",
                        rationale: basePlans[1].rationale,
                        commitDraft: {
                          ...validTenableDraft,
                          occurrences: [
                            ...validTenableDraft.occurrences,
                            {
                              id: "weak_a_6",
                              actionId: "action_roadmap",
                              date: addDateKeyOffset(TODAY_KEY, 6),
                              start: "08:00",
                              durationMinutes: 15,
                              status: "planned",
                            },
                          ],
                        },
                      },
                    ],
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
    url: "/ai/first-run-plan",
    headers: { authorization: "Bearer token", "x-forwarded-for": "198.51.100.37" },
    payload: createValidFirstRunPlanRequest(),
  });

  assert.equal(response.statusCode, 502);
  assert.equal(response.json().error, "INVALID_FIRST_RUN_PLAN_RESPONSE");
  assert.equal(response.json().details?.rejectionStage, "variant_divergence");
  await app.close();
});

test("POST /ai/first-run-plan accepts valid plans even when preview and recovery remain close", async () => {
  const app = await buildApp({
    config: TEST_CONFIG_WITH_OPENAI,
    verifyAccessToken: async () => ({ id: "user-first-run-close-variants" }),
  });
  app.supabase = createFakeSupabase({
    userData: createCoachContextUserData(),
    entitlement: null,
    dailyCount: 0,
    monthlyCount: 0,
  });
  app.openai = {
    chat: {
      completions: {
        parse: async () => {
          const basePlans = createValidFirstRunPlanResponse().plans;
          const tenable = basePlans[0];
          const ambitious = basePlans[1];
          const closeTenableDraft = {
            ...tenable.commitDraft,
            occurrences: [
              { id: "close_t_1", actionId: "action_roadmap", date: TODAY_KEY, start: "08:00", durationMinutes: 40, status: "planned" },
              { id: "close_t_2", actionId: "action_walk", date: FUTURE_KEY, start: "18:30", durationMinutes: 30, status: "planned" },
              { id: "close_t_3", actionId: "action_roadmap", date: addDateKeyOffset(TODAY_KEY, 2), start: "08:00", durationMinutes: 50, status: "planned" },
              { id: "close_t_4", actionId: "action_walk", date: addDateKeyOffset(TODAY_KEY, 3), start: "18:30", durationMinutes: 40, status: "planned" },
              { id: "close_t_5", actionId: "action_roadmap", date: addDateKeyOffset(TODAY_KEY, 4), start: "08:00", durationMinutes: 50, status: "planned" },
            ],
          };
          return {
            choices: [
              {
                message: {
                  parsed: {
                    plans: [
                      {
                        variant: "tenable",
                        summary: tenable.summary,
                        rationale: tenable.rationale,
                        commitDraft: closeTenableDraft,
                      },
                      {
                        variant: "ambitious",
                        summary: ambitious.summary,
                        rationale: ambitious.rationale,
                        commitDraft: {
                          ...closeTenableDraft,
                          occurrences: [
                            ...closeTenableDraft.occurrences,
                            {
                              id: "occ_close_a_6",
                              actionId: "action_roadmap",
                              date: addDateKeyOffset(TODAY_KEY, 6),
                              start: "08:00",
                              durationMinutes: 45,
                              status: "planned",
                            },
                          ],
                        },
                      },
                    ],
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
    url: "/ai/first-run-plan",
    headers: { authorization: "Bearer token", "x-forwarded-for": "198.51.100.38" },
    payload: createValidFirstRunPlanRequest(),
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.json().plans?.length, 2);
  await app.close();
});

test("POST /ai/first-run-plan repairs legacy occurrence.goalId when it still carries an action id", async () => {
  const app = await buildApp({
    config: TEST_CONFIG_WITH_OPENAI,
    verifyAccessToken: async () => ({ id: "user-first-run-legacy-goal-id-alias" }),
  });
  app.supabase = createFakeSupabase({
    userData: createCoachContextUserData(),
    entitlement: null,
    dailyCount: 0,
    monthlyCount: 0,
  });
  app.openai = {
    chat: {
      completions: {
        parse: async () => ({
          choices: [
            {
              message: {
                parsed: {
                  plans: createValidFirstRunPlanResponse().plans.map((plan) => ({
                    variant: plan.variant,
                    summary: plan.summary,
                    rationale: plan.rationale,
                    commitDraft: {
                      ...plan.commitDraft,
                      occurrences: plan.commitDraft.occurrences.map(({ actionId, ...occurrence }) => ({
                        ...occurrence,
                        goalId: actionId,
                      })),
                    },
                  })),
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
    url: "/ai/first-run-plan",
    headers: { authorization: "Bearer token", "x-forwarded-for": "198.51.100.39" },
    payload: createValidFirstRunPlanRequest(),
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.json().plans?.[0]?.commitDraft?.occurrences?.[0]?.actionId, "action_roadmap");
  await app.close();
});

test("POST /ai/first-run-plan repairs occurrences when the model uses a parent goal id", async () => {
  const app = await buildApp({
    config: TEST_CONFIG_WITH_OPENAI,
    verifyAccessToken: async () => ({ id: "user-first-run-parent-goal-reference" }),
  });
  app.supabase = createFakeSupabase({
    userData: createCoachContextUserData(),
    entitlement: null,
    dailyCount: 0,
    monthlyCount: 0,
  });
  app.openai = {
    chat: {
      completions: {
        parse: async () => ({
          choices: [
            {
              message: {
                parsed: {
                  plans: createValidFirstRunPlanResponse().plans.map((plan) => ({
                    variant: plan.variant,
                    summary: plan.summary,
                    rationale: plan.rationale,
                    commitDraft: {
                      ...plan.commitDraft,
                      occurrences: plan.commitDraft.occurrences.map((occurrence) =>
                        occurrence.actionId === "action_roadmap"
                          ? {
                              id: occurrence.id,
                              goalId: "goal_business",
                              date: occurrence.date,
                              start: occurrence.start,
                              durationMinutes: occurrence.durationMinutes,
                              status: occurrence.status,
                            }
                          : occurrence
                      ),
                    },
                  })),
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
    url: "/ai/first-run-plan",
    headers: { authorization: "Bearer token", "x-forwarded-for": "198.51.100.40" },
    payload: createValidFirstRunPlanRequest(),
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.json().plans?.[0]?.commitDraft?.occurrences?.[0]?.actionId, "action_roadmap");
  assert.equal(response.json().plans?.[0]?.preview?.[0]?.title, "Bloc roadmap");
  await app.close();
});

test("POST /ai/first-run-plan repairs occurrences from category and title hints before deriving compare data", async () => {
  const app = await buildApp({
    config: TEST_CONFIG_WITH_OPENAI,
    verifyAccessToken: async () => ({ id: "user-first-run-title-category-repair" }),
  });
  app.supabase = createFakeSupabase({
    userData: createCoachContextUserData(),
    entitlement: null,
    dailyCount: 0,
    monthlyCount: 0,
  });
  app.openai = {
    chat: {
      completions: {
        parse: async () => ({
          choices: [
            {
              message: {
                parsed: {
                  plans: createValidFirstRunPlanResponse().plans.map((plan) => {
                    const actionsById = new Map(plan.commitDraft.actions.map((action) => [action.id, action]));
                    return {
                      variant: plan.variant,
                      summary: plan.summary,
                      rationale: plan.rationale,
                      commitDraft: {
                        ...plan.commitDraft,
                        occurrences: plan.commitDraft.occurrences.map(({ actionId, ...occurrence }) => {
                          const action = actionsById.get(actionId);
                          return {
                            ...occurrence,
                            actionTitle: action?.title,
                            categoryId: action?.categoryId,
                          };
                        }),
                      },
                    };
                  }),
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
    url: "/ai/first-run-plan",
    headers: { authorization: "Bearer token", "x-forwarded-for": "198.51.100.41" },
    payload: createValidFirstRunPlanRequest(),
  });

  const body = response.json();
  assert.equal(response.statusCode, 200);
  assert.equal(body.plans?.[0]?.commitDraft?.occurrences?.[0]?.actionId, "action_roadmap");
  assert.equal(body.plans?.[0]?.comparisonMetrics?.totalBlocks, body.plans?.[0]?.commitDraft?.occurrences?.length);
  assert.equal(body.plans?.[0]?.preview?.[0]?.title, "Bloc roadmap");
  await app.close();
});

test("POST /ai/first-run-plan rejects occurrences that remain ambiguous after repair attempts", async () => {
  const app = await buildApp({
    config: TEST_CONFIG_WITH_OPENAI,
    verifyAccessToken: async () => ({ id: "user-first-run-ambiguous-occurrence" }),
  });
  app.supabase = createFakeSupabase({
    userData: createCoachContextUserData(),
    entitlement: null,
    dailyCount: 0,
    monthlyCount: 0,
  });
  app.openai = {
    chat: {
      completions: {
        parse: async () => {
          const basePlans = createValidFirstRunPlanResponse().plans;
          const tenable = basePlans[0];
          const ambiguousTenableDraft = {
            ...tenable.commitDraft,
            actions: [
              ...tenable.commitDraft.actions,
              {
                id: "action_review",
                categoryId: "cat_business",
                parentGoalId: "goal_business",
                title: "Bloc review",
                type: "PROCESS",
                order: 2,
                repeat: "weekly",
                daysOfWeek: [1, 2, 3, 4, 5, 6, 7],
                timeMode: "FIXED",
                startTime: "12:00",
                timeSlots: ["12:00"],
                durationMinutes: 20,
                sessionMinutes: 20,
              },
            ],
            occurrences: tenable.commitDraft.occurrences.map(({ actionId, ...occurrence }) => ({
              ...occurrence,
              goalId: actionId === "action_roadmap" ? "goal_business" : actionId,
            })),
          };

          return {
            choices: [
              {
                message: {
                  parsed: {
                    plans: [
                      {
                        variant: "tenable",
                        summary: tenable.summary,
                        rationale: tenable.rationale,
                        commitDraft: ambiguousTenableDraft,
                      },
                      {
                        variant: basePlans[1].variant,
                        summary: basePlans[1].summary,
                        rationale: basePlans[1].rationale,
                        commitDraft: basePlans[1].commitDraft,
                      },
                    ],
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
    url: "/ai/first-run-plan",
    headers: { authorization: "Bearer token", "x-forwarded-for": "198.51.100.42" },
    payload: createValidFirstRunPlanRequest(),
  });

  const body = response.json();
  assert.equal(response.statusCode, 502);
  assert.equal(body.error, "INVALID_FIRST_RUN_PLAN_RESPONSE");
  assert.equal(body.details?.rejectionReason, "occurrence_action_missing");
  assert.equal(body.details?.variant, "tenable");
  assert.ok(Array.isArray(body.details?.availableActionIds));
  assert.ok(Array.isArray(body.details?.invalidOccurrenceRefs));
  assert.equal(body.details?.rejectedOccurrenceCount > 0, true);
  assert.equal(body.details?.invalidOccurrenceRefs?.[0]?.goalId, "goal_business");
  await app.close();
});

test("POST /ai/first-run-plan returns two valid plans with commitDraft canonique", async () => {
  const insertedLogs = [];
  const app = await buildApp({
    config: TEST_CONFIG_WITH_OPENAI,
    verifyAccessToken: async () => ({ id: "user-first-run-success" }),
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
                  plans: createValidFirstRunPlanResponse().plans.map((plan) => ({
                    variant: plan.variant,
                    summary: plan.summary,
                    rationale: plan.rationale,
                    commitDraft: plan.commitDraft,
                  })),
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
    url: "/ai/first-run-plan",
    headers: { authorization: "Bearer token", "x-forwarded-for": "198.51.100.38" },
    payload: createValidFirstRunPlanRequest(),
  });

  assert.equal(response.statusCode, 200);
  const payload = firstRunPlanResponseSchema.parse(response.json());
  assert.equal(payload.plans.length, 2);
  assert.equal(payload.plans[0].id, "tenable");
  assert.equal(payload.plans[1].id, "ambitious");
  assert.equal(payload.plans[0].commitDraft.categories[0].templateId, "business");
  assert.equal(payload.plans[0].commitDraft.occurrences[0].actionId, "action_roadmap");
  assert.equal(insertedLogs[0]?.coach_kind, "first-run-plan");
  assert.equal(insertedLogs[0]?.route, "/ai/first-run-plan");
  await app.close();
});

test("POST /ai/session-guidance blocks free users from premium prepare", async () => {
  const app = await buildApp({
    config: TEST_CONFIG,
    verifyAccessToken: async () => ({ id: "user-session-free" }),
  });
  app.supabase = createFakeSupabase({
    userData: createCoachContextUserData(),
    entitlement: null,
    dailyCount: 0,
    monthlyCount: 0,
  });

  const response = await app.inject({
    method: "POST",
    url: "/ai/session-guidance",
    headers: { authorization: "Bearer token", "x-forwarded-for": "198.51.100.41" },
    payload: {
      mode: "prepare",
      dateKey: TODAY_KEY,
      occurrenceId: "occ-1",
      actionId: "goal-1",
      actionTitle: "Séance de sport rapide",
      protocolType: "sport",
      blueprintSnapshot: {
        version: 1,
        protocolType: "sport",
        why: "tenir le bloc",
        firstStep: "commence par t’échauffer",
        ifBlocked: "version courte",
        successDefinition: "séance tenue",
        estimatedMinutes: 20,
      },
    },
  });

  assert.equal(response.statusCode, 403);
  assert.equal(response.json().error, "PREMIUM_REQUIRED");
  await app.close();
});

test("POST /ai/session-guidance returns backend unavailable when premium prepare has no OpenAI provider", async () => {
  const app = await buildApp({
    config: TEST_CONFIG,
    verifyAccessToken: async () => ({ id: "user-session-premium-noai" }),
  });
  app.supabase = createFakeSupabase({
    userData: createCoachContextUserData(),
    entitlement: { plan_tier: "premium" },
    dailyCount: 0,
    monthlyCount: 0,
  });

  const response = await app.inject({
    method: "POST",
    url: "/ai/session-guidance",
    headers: { authorization: "Bearer token", "x-forwarded-for": "198.51.100.42" },
    payload: {
      mode: "prepare",
      dateKey: TODAY_KEY,
      occurrenceId: "occ-1",
      actionId: "goal-1",
      actionTitle: "Séance de sport rapide",
      protocolType: "sport",
      blueprintSnapshot: {
        version: 1,
        protocolType: "sport",
        why: "tenir le bloc",
        firstStep: "commence par t’échauffer",
        ifBlocked: "version courte",
        successDefinition: "séance tenue",
        estimatedMinutes: 20,
      },
    },
  });

  assert.equal(response.statusCode, 503);
  assert.equal(response.json().error, "SESSION_GUIDANCE_BACKEND_UNAVAILABLE");
  await app.close();
});

test("POST /ai/session-guidance allows founder override from auth metadata without billing entitlement", async () => {
  const app = await buildApp({
    config: TEST_CONFIG,
    verifyAccessToken: async () => ({
      id: "user-session-founder",
      app_metadata: { entitlement_override: "founder" },
    }),
  });
  app.supabase = createFakeSupabase({
    userData: createCoachContextUserData(),
    entitlement: null,
    dailyCount: 0,
    monthlyCount: 0,
  });

  const response = await app.inject({
    method: "POST",
    url: "/ai/session-guidance",
    headers: { authorization: "Bearer token", "x-forwarded-for": "198.51.100.43" },
    payload: {
      mode: "prepare",
      dateKey: TODAY_KEY,
      occurrenceId: "occ-1",
      actionId: "goal-1",
      actionTitle: "Séance de sport rapide",
      protocolType: "sport",
      blueprintSnapshot: {
        version: 1,
        protocolType: "sport",
        why: "tenir le bloc",
        firstStep: "commence par t’échauffer",
        ifBlocked: "version courte",
        successDefinition: "séance tenue",
        estimatedMinutes: 20,
      },
    },
  });

  assert.equal(response.statusCode, 503);
  assert.equal(response.json().error, "SESSION_GUIDANCE_BACKEND_UNAVAILABLE");
  await app.close();
});

test("POST /ai/session-guidance prepare prompt hardens sport specificity requirements", async () => {
  let capturedPrompt = "";
  const app = await buildApp({
    config: TEST_CONFIG_WITH_OPENAI,
    verifyAccessToken: async () => ({ id: "user-session-prepare-prompt-sport" }),
  });
  app.supabase = createFakeSupabase({
    userData: createCoachContextUserData(),
    entitlement: { plan_tier: "premium" },
    dailyCount: 0,
    monthlyCount: 0,
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
                    preparedRunbook: createValidSessionPreparedRunbook(),
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
    url: "/ai/session-guidance",
    headers: { authorization: "Bearer token", "x-forwarded-for": "198.51.100.46" },
    payload: {
      mode: "prepare",
      aiIntent: "session_prepare",
      dateKey: TODAY_KEY,
      occurrenceId: "occ-1",
      actionId: "goal-1",
      actionTitle: "Circuit jambes et gainage",
      categoryName: "Sport",
      protocolType: "sport",
      targetDurationMinutes: 20,
      blueprintSnapshot: {
        version: 1,
        protocolType: "sport",
        why: "tenir le bloc",
        firstStep: "commence par t’échauffer",
        ifBlocked: "version courte",
        successDefinition: "séance tenue",
        estimatedMinutes: 20,
      },
    },
  });

  assert.equal(response.statusCode, 200);
  assert.match(capturedPrompt, /Sport premium hard requirements:/i);
  assert.match(capturedPrompt, /Name real exercises on items/i);
  assert.match(capturedPrompt, /Never leave final item labels as vague placeholders/i);
  assert.match(capturedPrompt, /execution\.reps, execution\.durationSec, execution\.tempo/i);
  await app.close();
});

test("POST /ai/session-guidance prepare uses gpt-5.4 with a dedicated timeout by default", async () => {
  let requestedModel = null;
  let requestedTimeout = null;
  const app = await buildApp({
    config: TEST_CONFIG_WITH_OPENAI,
    verifyAccessToken: async () => ({ id: "user-session-prepare-default-model" }),
  });
  app.supabase = createFakeSupabase({
    userData: createCoachContextUserData(),
    entitlement: { plan_tier: "premium" },
    dailyCount: 0,
    monthlyCount: 0,
  });
  app.openai = {
    chat: {
      completions: {
        parse: async (input, options) => {
          requestedModel = input?.model || null;
          requestedTimeout = options?.timeout ?? null;
          return {
            choices: [
              {
                message: {
                  parsed: {
                    preparedRunbook: createValidSessionPreparedRunbook(),
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
    url: "/ai/session-guidance",
    headers: { authorization: "Bearer token", "x-forwarded-for": "198.51.100.47" },
    payload: {
      mode: "prepare",
      aiIntent: "session_prepare",
      dateKey: TODAY_KEY,
      occurrenceId: "occ-1",
      actionId: "goal-1",
      actionTitle: "Circuit jambes et gainage",
      categoryName: "Sport",
      protocolType: "sport",
      targetDurationMinutes: 20,
      blueprintSnapshot: {
        version: 1,
        protocolType: "sport",
        why: "tenir le bloc",
        firstStep: "commence par t’échauffer",
        ifBlocked: "version courte",
        successDefinition: "séance tenue",
        estimatedMinutes: 20,
      },
    },
  });

  assert.equal(response.statusCode, 200);
  assert.equal(requestedModel, "gpt-5.4");
  assert.equal(requestedTimeout, 60000);
  await app.close();
});

test("POST /ai/session-guidance prepare prefers dedicated model and timeout overrides when configured", async () => {
  let requestedModel = null;
  let requestedTimeout = null;
  const app = await buildApp({
    config: {
      ...TEST_CONFIG_WITH_OPENAI,
      SESSION_GUIDANCE_PREPARE_OPENAI_MODEL: "gpt-5.4-custom-prepare",
      SESSION_GUIDANCE_PREPARE_OPENAI_TIMEOUT_MS: 18000,
    },
    verifyAccessToken: async () => ({ id: "user-session-prepare-custom-model" }),
  });
  app.supabase = createFakeSupabase({
    userData: createCoachContextUserData(),
    entitlement: { plan_tier: "premium" },
    dailyCount: 0,
    monthlyCount: 0,
  });
  app.openai = {
    chat: {
      completions: {
        parse: async (input, options) => {
          requestedModel = input?.model || null;
          requestedTimeout = options?.timeout ?? null;
          return {
            choices: [
              {
                message: {
                  parsed: {
                    preparedRunbook: createValidSessionPreparedRunbook(),
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
    url: "/ai/session-guidance",
    headers: { authorization: "Bearer token", "x-forwarded-for": "198.51.100.48" },
    payload: {
      mode: "prepare",
      aiIntent: "session_prepare",
      dateKey: TODAY_KEY,
      occurrenceId: "occ-1",
      actionId: "goal-1",
      actionTitle: "Circuit jambes et gainage",
      categoryName: "Sport",
      protocolType: "sport",
      blueprintSnapshot: {
        version: 1,
        protocolType: "sport",
        why: "tenir le bloc",
        firstStep: "commence par t’échauffer",
        ifBlocked: "version courte",
        successDefinition: "séance tenue",
        estimatedMinutes: 20,
      },
    },
  });

  assert.equal(response.statusCode, 200);
  assert.equal(requestedModel, "gpt-5.4-custom-prepare");
  assert.equal(requestedTimeout, 18000);
  await app.close();
});

test("POST /ai/session-guidance prepare returns an explicit provider timeout error", async () => {
  const insertedLogs = [];
  const app = await buildApp({
    config: TEST_CONFIG_WITH_OPENAI,
    verifyAccessToken: async () => ({ id: "user-session-prepare-timeout" }),
  });
  app.supabase = createFakeSupabase({
    userData: createCoachContextUserData(),
    entitlement: { plan_tier: "premium" },
    dailyCount: 0,
    monthlyCount: 0,
    insertedLogs,
  });
  app.openai = {
    chat: {
      completions: {
        parse: async () => {
          throw new APIConnectionTimeoutError();
        },
      },
    },
  };

  const response = await app.inject({
    method: "POST",
    url: "/ai/session-guidance",
    headers: { authorization: "Bearer token", "x-forwarded-for": "198.51.100.81" },
    payload: {
      mode: "prepare",
      aiIntent: "session_prepare",
      dateKey: TODAY_KEY,
      occurrenceId: "occ-1",
      actionId: "goal-1",
      actionTitle: "Circuit jambes et gainage",
      categoryName: "Sport",
      protocolType: "sport",
      targetDurationMinutes: 20,
      blueprintSnapshot: {
        version: 1,
        protocolType: "sport",
        why: "tenir le bloc",
        firstStep: "commence par t’échauffer",
        ifBlocked: "version courte",
        successDefinition: "séance tenue",
        estimatedMinutes: 20,
      },
    },
  });

  assert.equal(response.statusCode, 504);
  assert.equal(response.json().error, "SESSION_GUIDANCE_PROVIDER_TIMEOUT");
  assert.equal(response.json().details.providerStatus, "timeout");
  assert.equal(response.json().details.timeoutMs, 60000);
  assert.equal(insertedLogs[0]?.error_code, "SESSION_GUIDANCE_PROVIDER_TIMEOUT");
  assert.equal(insertedLogs[0]?.provider_status, "timeout");
  assert.equal(insertedLogs[0]?.mode, "prepare");
  await app.close();
});

test("POST /ai/session-guidance adjust and tool keep the global OpenAI model and global timeout behavior", async () => {
  const requestedInvocations = [];
  const currentRunbook = createValidSessionPreparedRunbook();
  const app = await buildApp({
    config: {
      ...TEST_CONFIG_WITH_OPENAI,
      SESSION_GUIDANCE_PREPARE_OPENAI_MODEL: "gpt-5.4-custom-prepare",
      SESSION_GUIDANCE_PREPARE_OPENAI_TIMEOUT_MS: 18000,
    },
    verifyAccessToken: async () => ({ id: "user-session-adapt-global-model" }),
  });
  app.supabase = createFakeSupabase({
    userData: createCoachContextUserData(),
    entitlement: { plan_tier: "premium" },
    dailyCount: 0,
    monthlyCount: 0,
  });
  app.openai = {
    chat: {
      completions: {
        parse: async (input, options) => {
          requestedInvocations.push({
            model: input?.model || null,
            timeout: options?.timeout ?? null,
          });
          if (requestedInvocations.length === 1) {
            return {
              choices: [
                {
                  message: {
                    parsed: createValidSessionAdjustCandidate(),
                  },
                },
              ],
            };
          }
          return {
            choices: [
              {
                message: {
                  parsed: createValidSessionToolCandidate(),
                },
              },
            ],
          };
        },
      },
    },
  };

  const adjustResponse = await app.inject({
    method: "POST",
    url: "/ai/session-guidance",
    headers: { authorization: "Bearer token", "x-forwarded-for": "198.51.100.49" },
    payload: {
      mode: "adjust",
      aiIntent: "session_adapt",
      dateKey: TODAY_KEY,
      occurrenceId: "occ-1",
      actionId: "goal-1",
      actionTitle: "Circuit jambes et gainage",
      categoryName: "Sport",
      protocolType: "sport",
      currentRunbook,
      cause: "fatigue",
      strategyId: "shorten_intensity",
      runtimeContext: {
        currentStepId: currentRunbook.steps[1].id,
        currentItemId: currentRunbook.steps[1].items[0].id,
        elapsedSec: 300,
        remainingSec: 600,
      },
    },
  });

  const toolResponse = await app.inject({
    method: "POST",
    url: "/ai/session-guidance",
    headers: { authorization: "Bearer token", "x-forwarded-for": "198.51.100.50" },
    payload: {
      mode: "tool",
      aiIntent: "session_adapt",
      dateKey: TODAY_KEY,
      occurrenceId: "occ-1",
      actionId: "goal-1",
      actionTitle: "Circuit jambes et gainage",
      categoryName: "Sport",
      protocolType: "sport",
      toolId: "execution_cues",
      currentRunbook,
      runtimeContext: {
        currentStepId: currentRunbook.steps[1].id,
        currentItemId: currentRunbook.steps[1].items[1].id,
        elapsedSec: 420,
        remainingSec: 180,
      },
    },
  });

  assert.equal(adjustResponse.statusCode, 200);
  assert.equal(toolResponse.statusCode, 200);
  const adjustPayload = sessionGuidanceResponseSchema.parse(adjustResponse.json());
  const toolPayload = sessionGuidanceResponseSchema.parse(toolResponse.json());
  assert.equal(adjustPayload.meta.model, undefined);
  assert.equal(adjustPayload.meta.promptVersion, undefined);
  assert.equal(toolPayload.meta.model, undefined);
  assert.equal(toolPayload.meta.promptVersion, undefined);
  assert.deepEqual(requestedInvocations, [
    { model: "gpt-4.1-mini", timeout: null },
    { model: "gpt-4.1-mini", timeout: null },
  ]);
  await app.close();
});

test("POST /ai/now keeps the global OpenAI model when session prepare overrides are configured", async () => {
  let requestedModel = null;
  let requestedTimeout = null;
  const app = await buildApp({
    config: {
      ...TEST_CONFIG_WITH_OPENAI,
      SESSION_GUIDANCE_PREPARE_OPENAI_MODEL: "gpt-5.4-custom-prepare",
      SESSION_GUIDANCE_PREPARE_OPENAI_TIMEOUT_MS: 18000,
    },
    verifyAccessToken: async () => ({ id: "user-now-global-model" }),
  });
  app.supabase = createFakeSupabase({
    userData: createCoachContextUserData(),
  });
  app.openai = {
    chat: {
      completions: {
        parse: async (input, options) => {
          requestedModel = input?.model || null;
          requestedTimeout = options?.timeout ?? null;
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
    headers: { authorization: "Bearer token", "x-forwarded-for": "198.51.100.51" },
    payload: {
      selectedDateKey: TODAY_KEY,
      activeCategoryId: "cat-1",
      surface: "today",
      trigger: "manual",
    },
  });

  assert.equal(response.statusCode, 200);
  assert.equal(requestedModel, "gpt-4.1-mini");
  assert.equal(requestedTimeout, null);
  await app.close();
});

test("POST /ai/session-guidance returns an AI premium runbook with quality metadata", async () => {
  const insertedLogs = [];
  const app = await buildApp({
    config: TEST_CONFIG_WITH_OPENAI,
    verifyAccessToken: async () => ({ id: "user-session-premium-ai" }),
  });
  app.supabase = createFakeSupabase({
    userData: createCoachContextUserData(),
    entitlement: { plan_tier: "premium" },
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
                  preparedRunbook: {
                    version: 2,
                    protocolType: "sport",
                    occurrenceId: "occ-1",
                    actionId: "goal-1",
                    dateKey: TODAY_KEY,
                    title: "Circuit jambes et gainage",
                    categoryName: "Sport",
                    objective: {
                      why: "tenir un bloc cardio-force net",
                      successDefinition: "le circuit est tenu sans casser la forme",
                    },
                    steps: [
                      {
                        id: "step_1",
                        label: "Mise en route",
                        purpose: "préparer les appuis",
                        successCue: "souffle posé",
                        items: [
                          {
                            id: "step_1_item_1",
                            kind: "warmup",
                            label: "Montées de genoux",
                            minutes: 3,
                            guidance: "alterne 30 sec dynamiques puis 30 sec plus calmes pour monter en température",
                            successCue: "respiration stable",
                            restSec: 0,
                            transitionLabel: "",
                            execution: null,
                          },
                          {
                            id: "step_1_item_2",
                            kind: "activation",
                            label: "Squats au poids du corps",
                            minutes: 2,
                            guidance: "2 séries de 12 reps en gardant le buste haut",
                            successCue: "genoux stables",
                            restSec: 0,
                            transitionLabel: "",
                            execution: null,
                          },
                        ],
                      },
                      {
                        id: "step_2",
                        label: "Bloc force",
                        purpose: "tenir le coeur utile",
                        successCue: "gainage propre",
                        items: [
                          {
                            id: "step_2_item_1",
                            kind: "effort",
                            label: "Fentes alternées",
                            minutes: 4,
                            guidance: "2 séries de 10 reps par jambe sans te précipiter",
                            successCue: "appuis nets",
                            restSec: 25,
                            transitionLabel: "",
                            execution: null,
                          },
                          {
                            id: "step_2_item_2",
                            kind: "effort",
                            label: "Planche avant",
                            minutes: 4,
                            guidance: "3 passages de 40 sec avec 20 sec de repos entre les passages",
                            successCue: "bassin aligné",
                            restSec: 20,
                            transitionLabel: "",
                            execution: null,
                          },
                          {
                            id: "step_2_item_3",
                            kind: "effort",
                            label: "Pont fessier",
                            minutes: 3,
                            guidance: "2 séries de 15 reps avec montée contrôlée et pause d’une seconde en haut",
                            successCue: "fessiers engagés",
                            restSec: 20,
                            transitionLabel: "",
                            execution: null,
                          },
                        ],
                      },
                      {
                        id: "step_3",
                        label: "Retour au calme",
                        purpose: "faire redescendre proprement",
                        successCue: "souffle revenu",
                        items: [
                          {
                            id: "step_3_item_1",
                            kind: "cooldown",
                            label: "Marche lente",
                            minutes: 2,
                            guidance: "marche en récupérant le souffle avant de t’arrêter",
                            successCue: "fréquence calmée",
                            restSec: 0,
                            transitionLabel: "",
                            execution: null,
                          },
                          {
                            id: "step_3_item_2",
                            kind: "breath",
                            label: "Étirements hanches et mollets",
                            minutes: 2,
                            guidance: "tiens 30 sec par côté sans forcer",
                            successCue: "tension relâchée",
                            restSec: 0,
                            transitionLabel: "",
                            execution: null,
                          },
                        ],
                      },
                    ],
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
    url: "/ai/session-guidance",
    headers: { authorization: "Bearer token", "x-forwarded-for": "198.51.100.43" },
    payload: {
      mode: "prepare",
      aiIntent: "session_prepare",
      dateKey: TODAY_KEY,
      occurrenceId: "occ-1",
      actionId: "goal-1",
      actionTitle: "Circuit jambes et gainage",
      categoryId: "cat-1",
      categoryName: "Sport",
      protocolType: "sport",
      targetDurationMinutes: 20,
      blueprintSnapshot: {
        version: 1,
        protocolType: "sport",
        why: "tenir le bloc",
        firstStep: "commence par t’échauffer",
        ifBlocked: "version courte",
        successDefinition: "séance tenue",
        estimatedMinutes: 20,
      },
    },
  });

  assert.equal(response.statusCode, 200);
  const payload = sessionGuidanceResponseSchema.parse(response.json());
  assert.equal(payload.kind, "session_guidance");
  assert.equal(payload.mode, "prepare");
  assert.equal(payload.meta.source, "ai_premium");
  assert.equal(payload.meta.model, "gpt-5.4");
  assert.equal(payload.meta.promptVersion, "session_guidance_prepare_v2");
  assert.equal(payload.payload.quality.isPremiumReady, true);
  assert.equal(payload.payload.quality.rejectionReason, null);
  assert.equal(insertedLogs[0]?.coach_kind, "session-guidance");
  assert.equal(insertedLogs[0]?.route, "/ai/session-guidance");
  assert.equal(insertedLogs[0]?.mode, "prepare");
  assert.equal(insertedLogs[0]?.protocol_type, "sport");
  assert.equal(insertedLogs[0]?.provider_status, "ok");
  await app.close();
});

test("POST /ai/session-guidance accepts prepare payloads when UI-only fields are null", async () => {
  const app = await buildApp({
    config: TEST_CONFIG_WITH_OPENAI,
    verifyAccessToken: async () => ({ id: "user-session-premium-ai-minimal" }),
  });
  app.supabase = createFakeSupabase({
    userData: createCoachContextUserData(),
    entitlement: { plan_tier: "premium" },
    dailyCount: 0,
    monthlyCount: 0,
  });
  app.openai = {
    chat: {
      completions: {
        parse: async () => ({
          choices: [
            {
              message: {
                parsed: {
                  preparedRunbook: {
                    version: 2,
                    protocolType: "sport",
                    occurrenceId: "occ-1",
                    actionId: "goal-1",
                    dateKey: TODAY_KEY,
                    title: "Bloc cardio court",
                    categoryName: null,
                    objective: {
                      why: "tenir un bloc cardio propre",
                      successDefinition: "le bloc est fait sans casser la forme",
                    },
                    steps: [
                      {
                        id: null,
                        label: "Échauffement",
                        purpose: "monter progressivement",
                        successCue: "corps prêt",
                        items: [
                          {
                            id: null,
                            kind: null,
                            label: "Jog sur place",
                            minutes: 2,
                            guidance: "alterne 20 sec calmes puis 20 sec plus dynamiques pour monter le rythme",
                            successCue: "souffle lancé",
                            restSec: null,
                            transitionLabel: null,
                            execution: null,
                          },
                          {
                            id: null,
                            kind: null,
                            label: "Air squats",
                            minutes: 2,
                            guidance: "fais 15 reps contrôlées en gardant les appuis propres",
                            successCue: "appuis stables",
                            restSec: null,
                            transitionLabel: null,
                            execution: null,
                          },
                        ],
                      },
                      {
                        id: null,
                        label: "Bloc effort",
                        purpose: "tenir le coeur du bloc",
                        successCue: "rythme propre",
                        items: [
                          {
                            id: null,
                            kind: null,
                            label: "Pompes",
                            minutes: 3,
                            guidance: "enchaîne 10 reps propres puis récupère 20 sec avant de repartir",
                            successCue: "gainage tenu",
                            restSec: null,
                            transitionLabel: null,
                            execution: null,
                          },
                          {
                            id: null,
                            kind: null,
                            label: "Burpees",
                            minutes: 3,
                            guidance: "tiens 8 reps nettes puis prends 25 sec pour relancer proprement",
                            successCue: "relance nette",
                            restSec: null,
                            transitionLabel: null,
                            execution: null,
                          },
                          {
                            id: null,
                            kind: null,
                            label: "Sprint",
                            minutes: 2,
                            guidance: "fais 4 efforts de 20 sec avec une vraie récup entre chaque",
                            successCue: "souffle sous contrôle",
                            restSec: null,
                            transitionLabel: null,
                            execution: null,
                          },
                        ],
                      },
                      {
                        id: null,
                        label: "Retour au calme",
                        purpose: "redescendre proprement",
                        successCue: "souffle revenu",
                        items: [
                          {
                            id: null,
                            kind: null,
                            label: "Marche lente",
                            minutes: 2,
                            guidance: "marche jusqu’à sentir la respiration redescendre",
                            successCue: "rythme calmé",
                            restSec: null,
                            transitionLabel: null,
                            execution: null,
                          },
                          {
                            id: null,
                            kind: null,
                            label: "Étirements",
                            minutes: 2,
                            guidance: "tiens 30 sec par zone sans forcer pour délier les jambes",
                            successCue: "tension relâchée",
                            restSec: null,
                            transitionLabel: null,
                            execution: null,
                          },
                        ],
                      },
                    ],
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
    url: "/ai/session-guidance",
    headers: { authorization: "Bearer token", "x-forwarded-for": "198.51.100.44" },
    payload: {
      mode: "prepare",
      aiIntent: "session_prepare",
      dateKey: TODAY_KEY,
      occurrenceId: "occ-1",
      actionId: "goal-1",
      actionTitle: "Bloc cardio court",
      protocolType: "sport",
      blueprintSnapshot: {
        version: 1,
        protocolType: "sport",
        why: "tenir le bloc",
        firstStep: "commence par monter doucement",
        ifBlocked: "version courte",
        successDefinition: "séance tenue",
        estimatedMinutes: 16,
      },
    },
  });

  assert.equal(response.statusCode, 200);
  const payload = sessionGuidanceResponseSchema.parse(response.json());
  assert.equal(payload.payload.quality.isPremiumReady, true);
  assert.match(payload.payload.preparedRunbook.steps[0].id, /^goal_1_occ_1_step_1_/);
  assert.equal(payload.payload.preparedRunbook.steps[1].items[0].kind, "task");
  await app.close();
});

test("POST /ai/session-guidance returns a degraded premium quality when sport content stays generic", async () => {
  const insertedLogs = [];
  const app = await buildApp({
    config: TEST_CONFIG_WITH_OPENAI,
    verifyAccessToken: async () => ({ id: "user-session-premium-generic-sport" }),
  });
  app.supabase = createFakeSupabase({
    userData: createCoachContextUserData(),
    entitlement: { plan_tier: "premium" },
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
                  preparedRunbook: {
                    version: 2,
                    protocolType: "sport",
                    occurrenceId: "occ-1",
                    actionId: "goal-1",
                    dateKey: TODAY_KEY,
                    title: "Séance sport",
                    categoryName: null,
                    objective: {
                      why: "tenir le bloc",
                      successDefinition: "séance faite",
                    },
                    steps: [
                      {
                        id: null,
                        label: "Ouverture",
                        purpose: "te lancer",
                        successCue: "contexte rouvert",
                        items: [
                          {
                            id: null,
                            kind: null,
                            label: "Activation générale",
                            minutes: 2,
                            guidance: "prépare-toi pour la séance",
                            successCue: null,
                            restSec: null,
                            transitionLabel: null,
                            execution: null,
                          },
                          {
                            id: null,
                            kind: null,
                            label: "Mise en route",
                            minutes: 2,
                            guidance: "commence doucement avant le bloc",
                            successCue: null,
                            restSec: null,
                            transitionLabel: null,
                            execution: null,
                          },
                        ],
                      },
                      {
                        id: null,
                        label: "Bloc principal",
                        purpose: "avancer",
                        successCue: "bloc tenu",
                        items: [
                          {
                            id: null,
                            kind: null,
                            label: "Passage principal",
                            minutes: 4,
                            guidance: "travaille le coeur du bloc",
                            successCue: null,
                            restSec: null,
                            transitionLabel: null,
                            execution: null,
                          },
                          {
                            id: null,
                            kind: null,
                            label: "Deuxième passage",
                            minutes: 4,
                            guidance: "continue sur le même effort",
                            successCue: null,
                            restSec: null,
                            transitionLabel: null,
                            execution: null,
                          },
                          {
                            id: null,
                            kind: null,
                            label: "Sortie contrôlée",
                            minutes: 3,
                            guidance: "termine proprement",
                            successCue: null,
                            restSec: null,
                            transitionLabel: null,
                            execution: null,
                          },
                        ],
                      },
                      {
                        id: null,
                        label: "Retour au calme",
                        purpose: "redescendre",
                        successCue: "souffle revenu",
                        items: [
                          {
                            id: null,
                            kind: null,
                            label: "Marche lente",
                            minutes: 2,
                            guidance: "marche un peu avant de finir",
                            successCue: null,
                            restSec: null,
                            transitionLabel: null,
                            execution: null,
                          },
                          {
                            id: null,
                            kind: null,
                            label: "Respiration",
                            minutes: 2,
                            guidance: "reprends un souffle calme",
                            successCue: null,
                            restSec: null,
                            transitionLabel: null,
                            execution: null,
                          },
                        ],
                      },
                    ],
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
    url: "/ai/session-guidance",
    headers: { authorization: "Bearer token", "x-forwarded-for": "198.51.100.45" },
    payload: {
      mode: "prepare",
      aiIntent: "session_prepare",
      dateKey: TODAY_KEY,
      occurrenceId: "occ-1",
      actionId: "goal-1",
      actionTitle: "Séance sport",
      protocolType: "sport",
      blueprintSnapshot: {
        version: 1,
        protocolType: "sport",
        why: "tenir le bloc",
        firstStep: "commence doucement",
        ifBlocked: "version courte",
        successDefinition: "séance tenue",
        estimatedMinutes: 19,
      },
    },
  });

  assert.equal(response.statusCode, 200);
  const payload = sessionGuidanceResponseSchema.parse(response.json());
  assert.equal(payload.payload.quality.isPremiumReady, false);
  assert.equal(payload.payload.quality.validationPassed, true);
  assert.equal(payload.payload.quality.richnessPassed, false);
  assert.equal(payload.payload.quality.rejectionReason, "richness_failed");
  assert.equal(payload.payload.quality.rejectionStage, "quality_gate");
  assert.equal(insertedLogs[0]?.rejection_reason, "richness_failed");
  assert.equal(insertedLogs[0]?.validation_passed, true);
  assert.equal(insertedLogs[0]?.richness_passed, false);
  await app.close();
});

test("POST /ai/session-guidance returns explicit diagnostics when provider payload is structurally invalid", async () => {
  const insertedLogs = [];
  const app = await buildApp({
    config: TEST_CONFIG_WITH_OPENAI,
    verifyAccessToken: async () => ({ id: "user-session-premium-invalid-structure" }),
  });
  app.supabase = createFakeSupabase({
    userData: createCoachContextUserData(),
    entitlement: { plan_tier: "premium" },
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
                  preparedRunbook: {
                    version: 2,
                    protocolType: "sport",
                    occurrenceId: "occ-1",
                    actionId: "goal-1",
                    dateKey: TODAY_KEY,
                    title: "Séance sport",
                    steps: [
                      {
                        label: "Bloc principal",
                        items: [
                          { label: "Pompes", minutes: 3, guidance: "fais quelques répétitions" },
                        ],
                      },
                    ],
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
    url: "/ai/session-guidance",
    headers: { authorization: "Bearer token", "x-forwarded-for": "198.51.100.46" },
    payload: {
      mode: "prepare",
      aiIntent: "session_prepare",
      dateKey: TODAY_KEY,
      occurrenceId: "occ-1",
      actionId: "goal-1",
      actionTitle: "Séance sport",
      protocolType: "sport",
      blueprintSnapshot: {
        version: 1,
        protocolType: "sport",
        why: "tenir le bloc",
        firstStep: "commence doucement",
        ifBlocked: "version courte",
        successDefinition: "séance tenue",
        estimatedMinutes: 12,
      },
    },
  });

  assert.equal(response.statusCode, 502);
  assert.equal(response.json().error, "INVALID_SESSION_GUIDANCE_RESPONSE");
  assert.equal(response.json().details.rejectionReason, "provider_parse_failed");
  assert.equal(response.json().details.rejectionStage, "provider_parse");
  assert.equal(
    response.json().details.zodIssuePaths.some((entry) => /preparedRunbook\.(objective|steps)/.test(entry)),
    true
  );
  assert.equal(insertedLogs[0]?.rejection_reason, "provider_parse_failed");
  assert.equal(insertedLogs[0]?.provider_status, "invalid_response");
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
