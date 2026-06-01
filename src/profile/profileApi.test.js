import { afterEach, describe, expect, it, vi } from "vitest";
import {
  LOCAL_PROFILE_USERNAME_MAP_KEY,
  buildLocalProfileKey,
  clearUserScopedProfile,
  normalizeProfilePayload,
} from "./profileApi";

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
    has(key) {
      return store.has(key);
    },
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("profileApi", () => {
  it("autorise un username vide dans les updates de profil", () => {
    expect(
      normalizeProfilePayload("user-1", {
        email: "user@example.com",
        username: "",
        full_name: "Allan",
      })
    ).toEqual({
      id: "user-1",
      email: "user@example.com",
      username: null,
      full_name: "Allan",
    });
  });

  it("normalise un username non vide", () => {
    expect(
      normalizeProfilePayload("user-1", {
        username: " Allan_User ",
      })
    ).toEqual({
      id: "user-1",
      username: "allan_user",
    });
  });

  it("rejette un username invalide", () => {
    expect(() =>
      normalizeProfilePayload("user-1", {
        username: "a",
      })
    ).toThrow("Le nom d'utilisateur doit contenir 3 à 30 caractères.");
  });

  it("clears the selected local profile and username map entries on sign-out cleanup", () => {
    const localStorage = createLocalStorageMock({
      [buildLocalProfileKey("user-1")]: JSON.stringify({ id: "user-1", username: "allan" }),
      [buildLocalProfileKey("user-2")]: JSON.stringify({ id: "user-2", username: "other" }),
      [LOCAL_PROFILE_USERNAME_MAP_KEY]: JSON.stringify({ allan: "user-1", other: "user-2" }),
    });
    vi.stubGlobal("window", { localStorage });

    expect(clearUserScopedProfile("user-1")).toBe(true);

    expect(localStorage.has(buildLocalProfileKey("user-1"))).toBe(false);
    expect(localStorage.has(buildLocalProfileKey("user-2"))).toBe(true);
    expect(JSON.parse(localStorage.getItem(LOCAL_PROFILE_USERNAME_MAP_KEY))).toEqual({ other: "user-2" });
  });
});
