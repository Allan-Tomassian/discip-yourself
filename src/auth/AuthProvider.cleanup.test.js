import { afterEach, describe, expect, it, vi } from "vitest";
import { buildLocalUserDataKey } from "../data/userDataApi";
import { buildLocalProfileKey } from "../profile/profileApi";
import { LS_KEY } from "../utils/storage";
import { E2E_AUTH_SESSION_KEY } from "./constants";
import { clearSignedOutLocalState } from "./signOutCleanup";

function createStorage(initial = {}) {
  const entries = new Map(Object.entries(initial));
  return {
    get length() {
      return entries.size;
    },
    key(index) {
      return Array.from(entries.keys())[index] || null;
    },
    getItem(key) {
      return entries.has(key) ? entries.get(key) : null;
    },
    setItem(key, value) {
      entries.set(key, String(value));
    },
    removeItem(key) {
      entries.delete(key);
    },
    has(key) {
      return entries.has(key);
    },
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("AuthProvider local sign-out cleanup", () => {
  it("clears global fallback, user-scoped caches, recovery mode, and journal keys without remote deletion", () => {
    const userId = "account-a";
    const localStorageRef = createStorage({
      [LS_KEY]: "{}",
      [`${LS_KEY}__bak`]: "{}",
      [buildLocalUserDataKey(userId)]: "{}",
      [buildLocalProfileKey(userId)]: "{}",
      [`dailyNote:user:${userId}:cat-1:2026-06-08`]: "note",
      [`dailyNoteMeta:user:${userId}:cat-1:2026-06-08`]: "{}",
      [`dailyNoteHistory:user:${userId}:cat-1`]: "[]",
      [E2E_AUTH_SESSION_KEY]: "{}",
      [buildLocalUserDataKey("account-b")]: "{}",
    });
    const sessionStorageRef = createStorage({
      "discip.auth.recovery_mode": "1",
    });

    vi.stubGlobal("window", {
      localStorage: localStorageRef,
      sessionStorage: sessionStorageRef,
    });
    vi.stubGlobal("localStorage", localStorageRef);

    clearSignedOutLocalState(userId);

    expect(localStorageRef.has(LS_KEY)).toBe(false);
    expect(localStorageRef.has(`${LS_KEY}__bak`)).toBe(false);
    expect(localStorageRef.has(buildLocalUserDataKey(userId))).toBe(false);
    expect(localStorageRef.has(buildLocalProfileKey(userId))).toBe(false);
    expect(localStorageRef.has(`dailyNote:user:${userId}:cat-1:2026-06-08`)).toBe(false);
    expect(localStorageRef.has(`dailyNoteMeta:user:${userId}:cat-1:2026-06-08`)).toBe(false);
    expect(localStorageRef.has(`dailyNoteHistory:user:${userId}:cat-1`)).toBe(false);
    expect(localStorageRef.has(buildLocalUserDataKey("account-b"))).toBe(true);
    expect(sessionStorageRef.has("discip.auth.recovery_mode")).toBe(false);
  });
});
