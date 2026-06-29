import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const SRC_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function readSrc(relPath) {
  return fs.readFileSync(path.join(SRC_ROOT, relPath), "utf8");
}

describe("release doctrine cleanup contract", () => {
  it("keeps Micro-actions out of visible app navigation and routing", () => {
    const app = readSrc("App.jsx");
    const drawer = readSrc("components/navigation/MainDrawer.jsx");
    const navigation = readSrc("hooks/useAppNavigation.js");

    expect(app).not.toContain('from "./pages/MicroActions"');
    expect(app).not.toContain("<MicroActions");
    expect(drawer).not.toContain('"micro-actions"');
    expect(drawer).not.toContain("Micro-actions");
    expect(navigation).not.toContain('if (tab === "micro-actions") return "/micro-actions";');
    expect(navigation).not.toContain('initialPath.startsWith("/micro-actions")');
    expect(navigation).toContain('pathname === "/micro-actions"');
    expect(navigation).toContain('window.history.replaceState({}, "", "/")');
  });

  it("keeps wallet, coins, rewarded ads, and totem cosmetics out of the visible shell", () => {
    const app = readSrc("App.jsx");
    const topNav = readSrc("components/TopNav.jsx");
    const home = readSrc("pages/Home.jsx");

    for (const source of [app, topNav, home]) {
      expect(source).not.toContain("WalletBadge");
      expect(source).not.toContain("topnav-coins");
      expect(source).not.toContain("RewardedAdModal");
      expect(source).not.toContain("showRewardedAd");
      expect(source).not.toContain("TotemDockLayer");
      expect(source).not.toContain("MicroActionsCard");
    }

    expect(topNav).not.toContain("coinsBalance");
    expect(topNav).not.toContain("coinDelta");
  });

  it("keeps Settings copy user-facing instead of implementation-facing", () => {
    const preferences = readSrc("pages/Preferences.jsx");

    expect(preferences).toContain('title="Interface"');
    expect(preferences).toContain("Confort visuel et lisibilité.");
    expect(preferences).not.toMatch(/design system/i);
    expect(preferences).not.toMatch(/\bmigration\b/i);
    expect(preferences).not.toMatch(/\blegacy\b/i);
    expect(preferences).not.toMatch(/compatibilité technique/i);
    expect(preferences).not.toMatch(/anciennes préférences/i);
  });
});
