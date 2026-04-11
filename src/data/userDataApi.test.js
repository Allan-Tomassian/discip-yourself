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
    const payload = buildGuidedPayload();
    const { buildLocalUserDataKey, upsertUserDataWithMeta } = await importUserDataApi();

    const result = await upsertUserDataWithMeta(userId, payload);

    expect(result.storageScope).toBe("cloud");
    expect(upsertCalls).toHaveLength(1);
    expect(upsertCalls[0].data.ui.activeSession.experienceMode).toBeUndefined();
    expect(upsertCalls[0].data.ui.activeSession.guidedRuntimeV1).toBeUndefined();
    expect(upsertCalls[0].data.ui.activeSession.occurrenceId).toBe("occ-guided");
    expect(JSON.parse(window.localStorage.getItem(buildLocalUserDataKey(userId)) || "null")).toEqual(payload);
  });

  it("rehydrates a compatible guided snapshot from the local cache after a cloud load", async () => {
    const userId = "cloud-user";
    const payload = buildGuidedPayload();
    const { loadUserDataWithMeta, upsertUserDataWithMeta } = await importUserDataApi();

    await upsertUserDataWithMeta(userId, payload);
    const readResult = await loadUserDataWithMeta(userId);

    expect(readResult.storageScope).toBe("cloud");
    expect(readResult.data.ui.activeSession.experienceMode).toBe("guided");
    expect(readResult.data.ui.activeSession.guidedRuntimeV1).toEqual(payload.ui.activeSession.guidedRuntimeV1);
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
});
