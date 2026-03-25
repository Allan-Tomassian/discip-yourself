import { describe, expect, it } from "vitest";
import {
  AI_NOW_CACHE_TTL_MS,
  createAiNowContextSignature,
  createAiNowRequestKey,
  deriveAiNowRequestDiagnostics,
  getAiNowEligibility,
  isAiNowCacheFresh,
  resolveAiNowTrigger,
} from "./useAiNow";
import { todayLocalKey } from "../utils/dateKey";

describe("useAiNow helpers", () => {
  it("desactive la requete si la date n'est pas aujourd'hui", () => {
    const result = getAiNowEligibility({
      enabled: true,
      isAuthenticated: true,
      selectedDateKey: "2026-03-12",
      backendConfigured: true,
      accessToken: "token",
    });

    expect(result).toEqual({
      shouldFetch: false,
      state: "idle",
      reason: "not_today",
    });
  });

  it("desactive la requete si le backend n'est pas configure", () => {
    const result = getAiNowEligibility({
      enabled: true,
      isAuthenticated: true,
      selectedDateKey: todayLocalKey(),
      backendConfigured: false,
      accessToken: "token",
    });

    expect(result).toEqual({
      shouldFetch: false,
      state: "disabled",
      reason: "backend_disabled",
    });
  });

  it("autorise la requete pour aujourd'hui avec backend et auth", () => {
    const result = getAiNowEligibility({
      enabled: true,
      isAuthenticated: true,
      selectedDateKey: todayLocalKey(),
      backendConfigured: true,
      accessToken: "token",
    });

    expect(result).toEqual({
      shouldFetch: true,
      state: "idle",
      reason: "ready",
    });
  });

  it("utilise screen_open au premier chargement", () => {
    expect(
      resolveAiNowTrigger({
        previous: { initialized: false },
        selectedDateKey: todayLocalKey(),
        activeCategoryId: "c1",
        activeSessionId: null,
      })
    ).toBe("screen_open");
  });

  it("utilise screen_open quand Today devient eligible apres hydratation auth", () => {
    expect(
      resolveAiNowTrigger({
        previous: {
          initialized: true,
          shouldFetch: false,
          selectedDateKey: todayLocalKey(),
          activeCategoryId: "c1",
          activeSessionId: null,
          contextSignature: "ctx_1",
        },
        eligibilityDidBecomeReady: true,
        selectedDateKey: todayLocalKey(),
        activeCategoryId: "c1",
        activeSessionId: null,
        contextSignature: "ctx_1",
      })
    ).toBe("screen_open");
  });

  it("utilise resume si une session active apparait", () => {
    expect(
      resolveAiNowTrigger({
        previous: {
          initialized: true,
          selectedDateKey: todayLocalKey(),
          activeCategoryId: "c1",
          activeSessionId: null,
        },
        selectedDateKey: todayLocalKey(),
        activeCategoryId: "c1",
        activeSessionId: "session_1",
      })
    ).toBe("resume");
  });

  it("utilise screen_open si la categorie change", () => {
    expect(
      resolveAiNowTrigger({
        previous: {
          initialized: true,
          selectedDateKey: todayLocalKey(),
          activeCategoryId: "c1",
          activeSessionId: null,
        },
        selectedDateKey: todayLocalKey(),
        activeCategoryId: "c2",
        activeSessionId: null,
      })
    ).toBe("screen_open");
  });

  it("utilise screen_open si la signature canonique Today change", () => {
    expect(
      resolveAiNowTrigger({
        previous: {
          initialized: true,
          shouldFetch: true,
          selectedDateKey: todayLocalKey(),
          activeCategoryId: "c1",
          activeSessionId: null,
          contextSignature: "ctx_1",
        },
        selectedDateKey: todayLocalKey(),
        activeCategoryId: "c1",
        activeSessionId: null,
        contextSignature: "ctx_2",
      })
    ).toBe("screen_open");
  });

  it("construit une cle de cache stable", () => {
    expect(
      createAiNowRequestKey({
        selectedDateKey: "2026-03-13",
        activeCategoryId: "c1",
        activeSessionId: "s1",
        trigger: "resume",
        contextSignature: "ctx_1",
      })
    ).toBe("2026-03-13|c1|s1|resume|ctx_1");
  });

  it("construit une signature canonique Today stable", () => {
    expect(
      createAiNowContextSignature({
        activeDate: "2026-03-13",
        activeCategoryId: "cat-1",
        activeSessionForActiveDate: {
          id: "sess-1",
          occurrenceId: "occ-1",
          dateKey: "2026-03-13",
          runtimePhase: "in_progress",
        },
        openSessionOutsideActiveDate: {
          id: "sess-2",
          dateKey: "2026-03-14",
        },
        futureSessions: [{ id: "sess-2", dateKey: "2026-03-14" }],
        focusOccurrenceForActiveDate: {
          id: "occ-1",
          date: "2026-03-13",
          status: "planned",
          start: "09:00",
        },
        plannedActionsForActiveDate: [
          { id: "occ-2", date: "2026-03-13", status: "planned", start: "11:00" },
          { id: "occ-1", date: "2026-03-13", status: "planned", start: "09:00" },
        ],
      })
    ).toBe(
      [
        "2026-03-13",
        "cat-1",
        "sess-1:occ-1:2026-03-13:in_progress",
        "sess-2::2026-03-14",
        "sess-2::2026-03-14",
        "occ-1:2026-03-13:planned:09:00",
        "occ-1:2026-03-13:planned:09:00,occ-2:2026-03-13:planned:11:00",
      ].join("|")
    );
  });

  it("reconnait une entree de cache fraiche ou stale", () => {
    const nowMs = 1_000_000;
    expect(isAiNowCacheFresh({ fetchedAt: nowMs - 500 }, nowMs)).toBe(true);
    expect(isAiNowCacheFresh({ fetchedAt: nowMs - AI_NOW_CACHE_TTL_MS - 1 }, nowMs)).toBe(false);
  });

  it("expose le diagnostic backend quand la reponse coach est disponible", () => {
    const diagnostics = deriveAiNowRequestDiagnostics({
      state: "success",
      deliverySource: "network",
      hadVisibleLoading: true,
      fetchedAt: 1234,
      coach: {
        meta: {
          diagnostics: {
            resolutionStatus: "accepted_ai",
            rejectionReason: "none",
          },
        },
      },
    });

    expect(diagnostics).toEqual({
      requestState: "success",
      errorCode: null,
      backendDiagnostics: {
        resolutionStatus: "accepted_ai",
        rejectionReason: "none",
      },
      deliverySource: "network",
      isRefreshing: false,
      hadVisibleLoading: true,
      fetchedAt: 1234,
    });
  });

  it("traite les statuts fresh et stale comme des succes visibles", () => {
    const fresh = deriveAiNowRequestDiagnostics({
      status: "fresh",
      deliverySource: "network",
      fetchedAt: 2345,
      coach: {
        meta: {
          diagnostics: {
            resolutionStatus: "accepted_ai",
          },
        },
      },
    });
    const stale = deriveAiNowRequestDiagnostics({
      status: "stale",
      deliverySource: "cache",
      isRefreshing: true,
      fetchedAt: 3456,
      coach: {
        meta: {
          diagnostics: {
            resolutionStatus: "rules_fallback",
          },
        },
      },
    });

    expect(fresh.requestState).toBe("success");
    expect(fresh.deliverySource).toBe("network");
    expect(stale.requestState).toBe("success");
    expect(stale.deliverySource).toBe("cache");
    expect(stale.isRefreshing).toBe(true);
    expect(stale.backendDiagnostics).toEqual({
      resolutionStatus: "rules_fallback",
    });
  });
});
