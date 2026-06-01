import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const root = new URL("../", import.meta.url);

function readSrc(path) {
  return readFileSync(new URL(path, root), "utf8");
}

describe("account isolation contract", () => {
  it("does not render Home while user data is still loading", () => {
    const app = readSrc("App.jsx");

    expect(app).not.toContain("renderTodayDuringDataLoad");
    expect(app).toContain("if (dataLoading)");
    expect(app).toContain('data-testid="user-data-loading-screen"');
  });

  it("keeps authenticated first-run and session writes on setData instead of global saveState", () => {
    expect(readSrc("features/first-run/FirstRunFlow.jsx")).not.toContain("saveState(");
    expect(readSrc("pages/Session.jsx")).not.toContain("saveState(");
  });

  it("cleans local user caches on sign-out without remote deletion", () => {
    const authProvider = readSrc("auth/AuthProvider.jsx");

    expect(authProvider).toContain("clearState()");
    expect(authProvider).toContain("clearUserScopedLocalData(signedOutUserId)");
    expect(authProvider).toContain("clearUserScopedProfile(signedOutUserId)");
    expect(authProvider).toContain("clearJournalStorageForUser({ userId: signedOutUserId })");
    expect(authProvider).not.toContain("deleteUser");
  });
});
