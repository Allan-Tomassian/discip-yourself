import { describe, expect, it, vi } from "vitest";
import { E2E_AUTH_SESSION_KEY } from "../auth/constants";
import { LOCAL_USER_DATA_PREFIX } from "../data/userDataApi";
import {
  LOCAL_PROFILE_PREFIX,
  LOCAL_PROFILE_USERNAME_MAP_KEY,
} from "../profile/profileApi";
import { CLICK_SOUND_STORAGE_KEY } from "../shared/ui/sound/useClickSound";
import { LS_KEY } from "../utils/storage";
import {
  clearLocalAppStorage,
  isLocalDataResetEnvironment,
  runLocalDataReset,
} from "./localDataResetModel";

function createStorage(initial = {}) {
  const entries = new Map(Object.entries(initial));
  return {
    removed: [],
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
      this.removed.push(key);
      entries.delete(key);
    },
    has(key) {
      return entries.has(key);
    },
  };
}

describe("local data reset model", () => {
  it("enables reset controls only in local, staging, or dev-like environments", () => {
    expect(isLocalDataResetEnvironment({ appEnv: "production", mode: "production", prod: true })).toBe(false);
    expect(isLocalDataResetEnvironment({ appEnv: "prod", mode: "staging", dev: true })).toBe(false);
    expect(isLocalDataResetEnvironment({ appEnv: "local", mode: "production", prod: true })).toBe(false);
    expect(isLocalDataResetEnvironment({ appEnv: "local", mode: "development", dev: true })).toBe(true);
    expect(isLocalDataResetEnvironment({ appEnv: "staging", mode: "production", prod: true })).toBe(true);
    expect(isLocalDataResetEnvironment({ appEnv: "", mode: "test", dev: false, hostname: "127.0.0.1" })).toBe(true);
  });

  it("clears local app data keys while preserving auth for a simple reset", () => {
    const localStorageRef = createStorage({
      [LS_KEY]: "{}",
      [`${LS_KEY}__bak`]: "{}",
      [`${LOCAL_USER_DATA_PREFIX}user-1`]: "{}",
      [`${LOCAL_PROFILE_PREFIX}user-1`]: "{}",
      [LOCAL_PROFILE_USERNAME_MAP_KEY]: "{}",
      "dailyNote:cat:2026-06-01": "note",
      "dailyNoteMeta:cat:2026-06-01": "{}",
      "dailyNoteHistory:cat": "[]",
      [CLICK_SOUND_STORAGE_KEY]: "1",
      [E2E_AUTH_SESSION_KEY]: "{}",
      "sb-project-auth-token": "{}",
      unrelated: "keep",
    });
    const sessionStorageRef = createStorage({
      "discip.auth.recovery_mode": "1",
      "__discip_e2e_seed_state_applied__": "1",
      unrelatedSession: "keep",
    });

    const result = clearLocalAppStorage({ localStorageRef, sessionStorageRef });

    expect(result.localStorageKeys).toEqual(
      expect.arrayContaining([
        LS_KEY,
        `${LS_KEY}__bak`,
        `${LOCAL_USER_DATA_PREFIX}user-1`,
        `${LOCAL_PROFILE_PREFIX}user-1`,
        LOCAL_PROFILE_USERNAME_MAP_KEY,
        "dailyNote:cat:2026-06-01",
        "dailyNoteMeta:cat:2026-06-01",
        "dailyNoteHistory:cat",
        CLICK_SOUND_STORAGE_KEY,
      ])
    );
    expect(localStorageRef.has(E2E_AUTH_SESSION_KEY)).toBe(true);
    expect(localStorageRef.has("sb-project-auth-token")).toBe(true);
    expect(localStorageRef.has("unrelated")).toBe(true);
    expect(sessionStorageRef.has("discip.auth.recovery_mode")).toBe(false);
    expect(sessionStorageRef.has("__discip_e2e_seed_state_applied__")).toBe(false);
    expect(sessionStorageRef.has("unrelatedSession")).toBe(true);
  });

  it("clears auth keys too for logout reset, calls signOut, and reloads toward welcome", async () => {
    const localStorageRef = createStorage({
      [LS_KEY]: "{}",
      [E2E_AUTH_SESSION_KEY]: "{}",
      "sb-project-auth-token": "{}",
    });
    const sessionStorageRef = createStorage({});
    const signOut = vi.fn(async () => {});
    const reload = vi.fn();

    const result = await runLocalDataReset({
      includeLogout: true,
      signOut,
      localStorageRef,
      sessionStorageRef,
      reload,
    });

    expect(result.ok).toBe(true);
    expect(signOut).toHaveBeenCalledTimes(1);
    expect(localStorageRef.has(LS_KEY)).toBe(false);
    expect(localStorageRef.has(E2E_AUTH_SESSION_KEY)).toBe(false);
    expect(localStorageRef.has("sb-project-auth-token")).toBe(false);
    expect(reload).toHaveBeenCalledWith({ includeLogout: true });
  });

  it("runs simple reset without signOut and reloads the app", async () => {
    const localStorageRef = createStorage({ [LS_KEY]: "{}" });
    const signOut = vi.fn(async () => {});
    const reload = vi.fn();

    const result = await runLocalDataReset({
      includeLogout: false,
      signOut,
      localStorageRef,
      sessionStorageRef: createStorage({}),
      reload,
    });

    expect(result.ok).toBe(true);
    expect(signOut).not.toHaveBeenCalled();
    expect(localStorageRef.has(LS_KEY)).toBe(false);
    expect(reload).toHaveBeenCalledWith({ includeLogout: false });
  });
});
