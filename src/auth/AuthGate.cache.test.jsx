import { describe, expect, it, vi, afterEach } from "vitest";
import { buildLocalUserDataKey } from "../data/userDataApi";
import { LS_KEY } from "../utils/storage";
import { readCachedFirstRunSummary } from "./authGateCache";

function createLocalStorageMock(initial = {}) {
  const store = new Map(Object.entries(initial));
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
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("AuthGate cached first-run routing", () => {
  it("ignores global first-run state when an authenticated user id exists", () => {
    vi.stubGlobal("window", {
      location: { pathname: "/", search: "" },
      localStorage: createLocalStorageMock({
        [LS_KEY]: JSON.stringify({
          ui: {
            onboardingCompleted: true,
            firstRunV1: { status: "done" },
          },
        }),
      }),
    });

    expect(readCachedFirstRunSummary("account-b")).toBeNull();
  });

  it("uses only the matching user-scoped first-run cache for authenticated routing", () => {
    vi.stubGlobal("window", {
      location: { pathname: "/", search: "" },
      localStorage: createLocalStorageMock({
        [LS_KEY]: JSON.stringify({
          ui: {
            onboardingCompleted: true,
            firstRunV1: { status: "done" },
          },
        }),
        [buildLocalUserDataKey("account-b")]: JSON.stringify({
          ui: {
            onboardingCompleted: false,
            firstRunV1: { status: "signals" },
          },
        }),
      }),
    });

    expect(readCachedFirstRunSummary("account-b")).toMatchObject({
      firstRunDone: false,
      onboardingCompleted: false,
      hasMeaningfulFirstRun: true,
    });
  });
});
