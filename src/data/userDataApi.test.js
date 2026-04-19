import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { E2E_AUTH_SESSION_KEY } from "../auth/constants";

function createLocalStorageMock() {
  const store = new Map();
  return {
    getItem(key) {
      return store.has(key) ? store.get(key) : null;
    },
    setItem(key, value) {
      store.set(key, String(value));
    },
    removeItem(key) {
      store.delete(key);
    },
    clear() {
      store.clear();
    },
  };
}

function buildGuidedPayload(overrides = {}) {
  return {
    profile: { whyText: "Pourquoi local" },
    ui: {
      activeSession: {
        id: "sess-guided",
        occurrenceId: "occ-guided",
        objectiveId: null,
        habitIds: ["goal-guided"],
        dateKey: "2026-04-11",
        runtimePhase: "in_progress",
        status: "partial",
        timerRunning: true,
        timerStartedAt: "2026-04-11T10:00:00.000Z",
        timerAccumulatedSec: 180,
        isOpen: true,
        experienceMode: "guided",
        guidedRuntimeV1: {
          version: 1,
          occurrenceId: "occ-guided",
          guidedSpatialState: {
            mode: "active",
            viewedStepIndex: 0,
            activeStepIndex: 0,
          },
        },
        ...overrides,
      },
    },
  };
}

function buildPremiumPrepareCache() {
  return {
    version: 1,
    entriesByKey: {
      "v1:occ-guided:goal-guided:2026-04-11:sport:20:abc123:gpt-5.4:session_guidance_prepare_v2": {
        cacheKey: "v1:occ-guided:goal-guided:2026-04-11:sport:20:abc123:gpt-5.4:session_guidance_prepare_v2",
        occurrenceId: "occ-guided",
        actionId: "goal-guided",
        dateKey: "2026-04-11",
        protocolType: "sport",
        targetDurationMinutes: 20,
        blueprintHash: "abc123",
        preparedRunbook: {
          version: 2,
          protocolType: "sport",
          occurrenceId: "occ-guided",
          actionId: "goal-guided",
          dateKey: "2026-04-11",
          title: "Circuit jambes",
          categoryName: "Sport",
          objective: {
            why: "tenir le bloc",
            successDefinition: "séance tenue",
          },
          steps: [
            {
              id: "step-1",
              label: "Échauffement",
              purpose: "ouvrir les appuis",
              successCue: "souffle posé",
              items: [
                {
                  id: "step-1-item-1",
                  kind: "warmup",
                  label: "Montées de genoux",
                  minutes: 3,
                  guidance: "30 sec rapides puis 30 sec plus calmes",
                  successCue: "buste haut",
                  restSec: 0,
                  transitionLabel: "enchaîne",
                  execution: null,
                },
                {
                  id: "step-1-item-2",
                  kind: "activation",
                  label: "Squats",
                  minutes: 2,
                  guidance: "2 séries de 12 reps",
                  successCue: "genoux stables",
                  restSec: 0,
                  transitionLabel: "souffle 15 sec",
                  execution: null,
                },
              ],
            },
            {
              id: "step-2",
              label: "Bloc effort",
              purpose: "tenir le coeur utile",
              successCue: "gainage propre",
              items: [
                {
                  id: "step-2-item-1",
                  kind: "effort",
                  label: "Fentes alternées",
                  minutes: 4,
                  guidance: "2 x 10 par jambe",
                  successCue: "appuis nets",
                  restSec: 20,
                  transitionLabel: "20 sec avant la planche",
                  execution: {
                    reps: "2 x 10/jambe",
                    durationSec: null,
                    tempo: null,
                    deliverable: null,
                    doneWhen: null,
                    relaunchCue: null,
                    restSec: 20,
                  },
                },
                {
                  id: "step-2-item-2",
                  kind: "effort",
                  label: "Planche avant",
                  minutes: 4,
                  guidance: "3 x 40 sec",
                  successCue: "bassin aligné",
                  restSec: 20,
                  transitionLabel: "relâche puis repars",
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
              ],
            },
            {
              id: "step-3",
              label: "Retour au calme",
              purpose: "faire redescendre proprement",
              successCue: "souffle ralenti",
              items: [
                {
                  id: "step-3-item-1",
                  kind: "cooldown",
                  label: "Marche lente",
                  minutes: 4,
                  guidance: "marche 2 min puis allonge l’expiration",
                  successCue: "rythme cardiaque en baisse",
                  restSec: 0,
                  transitionLabel: "puis étire doucement",
                  execution: {
                    reps: null,
                    durationSec: 120,
                    tempo: null,
                    deliverable: null,
                    doneWhen: null,
                    relaunchCue: null,
                    restSec: 0,
                  },
                },
                {
                  id: "step-3-item-2",
                  kind: "cooldown",
                  label: "Étirement quadriceps",
                  minutes: 3,
                  guidance: "45 sec par côté",
                  successCue: "relâchement progressif",
                  restSec: 0,
                  transitionLabel: "termine en secouant les jambes",
                  execution: {
                    reps: null,
                    durationSec: 90,
                    tempo: null,
                    deliverable: null,
                    doneWhen: null,
                    relaunchCue: null,
                    restSec: 0,
                  },
                },
              ],
            },
          ],
        },
        toolPlan: {
          version: 1,
          catalog: [],
          recommendations: [],
        },
        quality: {
          isPremiumReady: true,
          validationPassed: true,
          richnessPassed: true,
          reason: null,
          rejectionReason: null,
          rejectionStage: null,
          stepCount: 3,
          itemCount: 6,
          issuePaths: [],
        },
        requestId: "req-guided-cache",
        preparedAt: 1713091200000,
        lastUsedAt: 1713091200000,
        source: "ai_fresh",
        model: "gpt-5.4",
        promptVersion: "session_guidance_prepare_v2",
      },
    },
    order: ["v1:occ-guided:goal-guided:2026-04-11:sport:20:abc123:gpt-5.4:session_guidance_prepare_v2"],
  };
}

async function importUserDataApi() {
  return import("./userDataApi");
}

describe("userDataApi mocked session fallback", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubGlobal("window", { localStorage: createLocalStorageMock() });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it("writes locally when the session is mocked in E2E", async () => {
    const userId = "e2e-user-id";
    const payload = { profile: { whyText: "Pourquoi local" } };
    const { buildLocalUserDataKey, upsertUserData } = await importUserDataApi();

    window.localStorage.setItem(E2E_AUTH_SESSION_KEY, JSON.stringify({ user: { id: userId } }));

    await upsertUserData(userId, payload);

    expect(JSON.parse(window.localStorage.getItem(buildLocalUserDataKey(userId)) || "null")).toEqual(payload);
  });

  it("reports a local_fallback storage scope for mocked E2E persistence", async () => {
    const userId = "e2e-user-id";
    const payload = { profile: { whyText: "Pourquoi local" } };
    const { loadUserDataWithMeta, upsertUserDataWithMeta } = await importUserDataApi();

    window.localStorage.setItem(E2E_AUTH_SESSION_KEY, JSON.stringify({ user: { id: userId } }));

    const writeResult = await upsertUserDataWithMeta(userId, payload);
    const readResult = await loadUserDataWithMeta(userId);

    expect(writeResult.storageScope).toBe("local_fallback");
    expect(readResult.storageScope).toBe("local_fallback");
    expect(readResult.data).toEqual(payload);
  });
});

describe("userDataApi remote sync boundary", () => {
  let remotePayload = {};
  let upsertCalls = [];

  beforeEach(() => {
    vi.resetModules();
    vi.stubGlobal("window", { localStorage: createLocalStorageMock() });
    remotePayload = {};
    upsertCalls = [];
    vi.doMock("../infra/supabaseClient", () => ({
      supabase: {
        from(table) {
          if (table !== "user_data") throw new Error(`Unexpected table ${table}`);
          return {
            select() {
              return {
                eq() {
                  return {
                    maybeSingle: async () => ({
                      data: { data: remotePayload },
                      error: null,
                    }),
                  };
                },
              };
            },
            async upsert(payload) {
              upsertCalls.push(payload);
              remotePayload = payload.data;
              return { error: null };
            },
          };
        },
      },
    }));
  });

  afterEach(() => {
    vi.doUnmock("../infra/supabaseClient");
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it("sends a cloud-safe activeSession while keeping the full guided runtime locally", async () => {
    const userId = "cloud-user";
    const payload = {
      ...buildGuidedPayload(),
      ui: {
        ...buildGuidedPayload().ui,
        sessionPremiumPrepareCacheV1: buildPremiumPrepareCache(),
      },
    };
    const { buildLocalUserDataKey, upsertUserDataWithMeta } = await importUserDataApi();

    const result = await upsertUserDataWithMeta(userId, payload);

    expect(result.storageScope).toBe("cloud");
    expect(upsertCalls).toHaveLength(1);
    expect(upsertCalls[0].data.ui.activeSession.experienceMode).toBeUndefined();
    expect(upsertCalls[0].data.ui.activeSession.guidedRuntimeV1).toBeUndefined();
    expect(upsertCalls[0].data.ui.sessionPremiumPrepareCacheV1).toBeUndefined();
    expect(upsertCalls[0].data.ui.activeSession.occurrenceId).toBe("occ-guided");
    expect(JSON.parse(window.localStorage.getItem(buildLocalUserDataKey(userId)) || "null")).toEqual(payload);
  });

  it("rehydrates a compatible guided snapshot from the local cache after a cloud load", async () => {
    const userId = "cloud-user";
    const payload = {
      ...buildGuidedPayload(),
      ui: {
        ...buildGuidedPayload().ui,
        sessionPremiumPrepareCacheV1: buildPremiumPrepareCache(),
      },
    };
    const { loadUserDataWithMeta, upsertUserDataWithMeta } = await importUserDataApi();

    await upsertUserDataWithMeta(userId, payload);
    const readResult = await loadUserDataWithMeta(userId);

    expect(readResult.storageScope).toBe("cloud");
    expect(readResult.data.ui.activeSession.experienceMode).toBe("guided");
    expect(readResult.data.ui.activeSession.guidedRuntimeV1).toEqual(payload.ui.activeSession.guidedRuntimeV1);
    expect(readResult.data.ui.sessionPremiumPrepareCacheV1).toEqual(payload.ui.sessionPremiumPrepareCacheV1);
    expect(readResult.data.ui.activeSession.timerAccumulatedSec).toBe(payload.ui.activeSession.timerAccumulatedSec);
  });

  it("does not rehydrate guided runtime when the local snapshot targets another active session", async () => {
    const userId = "cloud-user";
    const remoteState = buildGuidedPayload();
    const localState = buildGuidedPayload({
      id: "sess-other",
      occurrenceId: "occ-other",
      guidedRuntimeV1: {
        version: 1,
        occurrenceId: "occ-other",
      },
    });
    const { buildLocalUserDataKey, loadUserDataWithMeta, sanitizeUserDataForCloudSync } = await importUserDataApi();

    remotePayload = sanitizeUserDataForCloudSync(remoteState);
    window.localStorage.setItem(buildLocalUserDataKey(userId), JSON.stringify(localState));

    const readResult = await loadUserDataWithMeta(userId);

    expect(readResult.storageScope).toBe("cloud");
    expect(readResult.data.ui.activeSession.experienceMode).toBeUndefined();
    expect(readResult.data.ui.activeSession.guidedRuntimeV1).toBeUndefined();
    expect(readResult.data.ui.activeSession.occurrenceId).toBe("occ-guided");
  });

  it("reuses the local guided activeSession when the loaded source is stale and has no open session", async () => {
    const staleRemoteState = { profile: { whyText: "Cloud stale" }, ui: { activeSession: null } };
    const localState = buildGuidedPayload();
    const { rehydrateUserDataWithLocalGuidedRuntime } = await importUserDataApi();

    const next = rehydrateUserDataWithLocalGuidedRuntime({
      data: staleRemoteState,
      localData: localState,
    });

    expect(next.ui.activeSession).toEqual(localState.ui.activeSession);
    expect(next.ui.activeSession.experienceMode).toBe("guided");
  });

  it("rehydrates a more recent local first-run draft when the user snapshot is stale", async () => {
    const remoteState = {
      ui: {
        onboardingCompleted: false,
        firstRunV1: {
          version: 1,
          status: "intro",
          draftAnswers: {
            whyText: "",
            primaryGoal: "",
            unavailableWindows: [],
            preferredWindows: [],
            currentCapacity: null,
            priorityCategoryIds: [],
          },
          generatedPlans: null,
          selectedPlanId: null,
          discoveryDone: false,
          lastUpdatedAt: null,
        },
      },
    };
    const localState = {
      ui: {
        onboardingCompleted: false,
        firstRunV1: {
          version: 1,
          status: "signals",
          draftAnswers: {
            whyText: "Reprendre le controle",
            primaryGoal: "Relancer mon projet",
            unavailableWindows: [],
            preferredWindows: [],
            currentCapacity: "stable",
            priorityCategoryIds: ["business"],
          },
          generatedPlans: null,
          selectedPlanId: null,
          discoveryDone: false,
          lastUpdatedAt: "2026-04-18T12:00:00.000Z",
        },
      },
    };
    const { rehydrateUserDataWithLocalGuidedRuntime } = await importUserDataApi();

    const next = rehydrateUserDataWithLocalGuidedRuntime({
      data: remoteState,
      localData: localState,
    });

    expect(next.ui.firstRunV1.status).toBe("signals");
    expect(next.ui.firstRunV1.draftAnswers.whyText).toBe("Reprendre le controle");
    expect(next.ui.onboardingCompleted).toBe(false);
  });
});
