import { describe, expect, it } from "vitest";
import {
  createAiNowRequestKey,
  getAiNowEligibility,
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

  it("construit une cle de cache stable", () => {
    expect(
      createAiNowRequestKey({
        selectedDateKey: "2026-03-13",
        activeCategoryId: "c1",
        activeSessionId: "s1",
        trigger: "resume",
      })
    ).toBe("2026-03-13|c1|s1|resume");
  });
});
