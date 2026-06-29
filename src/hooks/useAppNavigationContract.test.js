import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { parseNavigationState } from "./useAppNavigation";

const SRC_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function readSrc(relPath) {
  return fs.readFileSync(path.join(SRC_ROOT, relPath), "utf8");
}

describe("useAppNavigation contract", () => {
  it("normalizes legacy aliases and exposes the release drawer routes", () => {
    const source = readSrc("hooks/useAppNavigation.js");

    expect(source).toContain('if (t === "preferences") return "settings";');
    expect(source).toContain('if (t === "subscription") return "billing";');
    expect(source).toContain('if (t === "terms") return "legal";');
    expect(source).toContain('"journal"');
    expect(source).toContain('"history"');
    expect(source).toContain('"faq"');
    expect(source).toContain('"legal"');
    expect(source).toContain('"billing"');
    expect(source).toContain('"settings"');
    expect(source).toContain('"adjust"');
    expect(source).toContain('"create-item"');
    expect(source).toContain('if (t === "tools") return "adjust";');
    expect(source).toContain('if (t === "pilotage") return "adjust";');
    expect(source).toContain('if (t === "insights") return "adjust";');
    expect(source).toContain('if (t === "create") return "create-item";');
    expect(source).not.toContain('"coach-chat"');
    expect(source).not.toContain('if (tab === "micro-actions") return "/micro-actions";');
    expect(source).not.toContain('initialPath.startsWith("/micro-actions")');
  });

  it("supports the canonical session occurrence route and rewires the legacy coach path as an alias", () => {
    const source = readSrc("hooks/useAppNavigation.js");

    expect(source).toContain('pathParts[0] === "session" && pathParts[1]');
    expect(source).toContain('`/session/${encodeURIComponent(sessionOccurrenceId)}`');
    expect(source).toContain("function buildPathForTab({");
    expect(source).toContain('initialPath.startsWith("/create")');
    expect(source).toContain('if (tab === "create-item") return "/create";');
    expect(source).toContain('initialPath.startsWith("/coach/chat")');
    expect(source).toContain('initialPath.startsWith("/adjust")');
    expect(source).toContain('initialPath.startsWith("/insights")');
    expect(source).toContain('initialPath.startsWith("/pilotage")');
    expect(source).toContain('initialPath.startsWith("/tools")');
    expect(source).toContain('if (tab === "adjust") return "/adjust";');
    expect(source).toContain('window.history.replaceState({}, "", "/adjust")');
    expect(source).toContain("initialCoachAliasRequest");
    expect(source).toContain("consumeCoachAliasRequest");
    expect(source).not.toContain('else if (t === "coach-chat") nextPath = "/coach/chat";');
    expect(source).toContain('pathname === "/preferences"');
    expect(source).toContain('pathname === "/subscription"');
    expect(source).toContain('pathname === "/terms"');
    expect(source).toContain('window.history.replaceState({}, "", "/settings")');
    expect(source).toContain('window.history.replaceState({}, "", "/billing")');
    expect(source).toContain('window.history.replaceState({}, "", "/legal")');
    expect(source).toContain('pathname === "/micro-actions"');
    expect(source).toContain('window.history.replaceState({}, "", "/")');
  });

  it("quarantines the dormant micro-actions route to Today", () => {
    expect(parseNavigationState("/micro-actions", "")).toMatchObject({
      initialTab: "today",
      initialLastMainTab: "today",
    });
  });
});
