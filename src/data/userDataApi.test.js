import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { E2E_AUTH_SESSION_KEY } from "../auth/constants";
import { buildLocalUserDataKey, upsertUserData } from "./userDataApi";

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

describe("userDataApi mocked session fallback", () => {
  beforeEach(() => {
    vi.stubGlobal("window", { localStorage: createLocalStorageMock() });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("writes locally when the session is mocked in E2E", async () => {
    const userId = "e2e-user-id";
    const payload = { profile: { whyText: "Pourquoi local" } };

    window.localStorage.setItem(
      E2E_AUTH_SESSION_KEY,
      JSON.stringify({ user: { id: userId } })
    );

    await upsertUserData(userId, payload);

    expect(
      JSON.parse(window.localStorage.getItem(buildLocalUserDataKey(userId)) || "null")
    ).toEqual(payload);
  });
});
