import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { BRAND_ACCENT, DEFAULT_THEME, getThemeAccent, getThemeName, listThemes } from "./themeTokens";

const SRC_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function readSrc(relPath) {
  return fs.readFileSync(path.join(SRC_ROOT, relPath), "utf8");
}

describe("design system contract", () => {
  it("locks the app to a single shipped theme", () => {
    expect(listThemes()).toEqual([DEFAULT_THEME]);
    expect(getThemeName({}, "home")).toBe(DEFAULT_THEME);
    expect(getThemeName({ ui: { theme: "aurora", pageThemes: { home: "bitcoin" } } }, "pilotage")).toBe(
      DEFAULT_THEME
    );
    expect(getThemeAccent({}, "home")).toBe(BRAND_ACCENT);
  });

  it("removes the old theme picker flow from user-facing settings", () => {
    const preferences = readSrc("pages/Preferences.jsx");

    expect(preferences).toContain("Système visuel actif");
    expect(preferences).not.toContain("preferences-theme-select");
    expect(preferences).not.toContain("Choisis le thème de l'app");
    expect(preferences).not.toContain("ThemePicker");
  });

  it("keeps the canonical navigation labels and app-wide theme bootstrapping", () => {
    const tabBar = readSrc("components/navigation/LovableTabBar.jsx");
    const app = readSrc("App.jsx");
    const main = readSrc("main.jsx");
    const tokens = readSrc("styles/tokens.css");
    const themeTokens = readSrc("theme/themeTokens.js");

    expect(tabBar).toContain('label: "Today"');
    expect(tabBar).toContain('label: "Objectives"');
    expect(tabBar).toContain('label: "Timeline"');
    expect(tabBar).toContain('label: "Insights"');
    expect(tabBar).toContain('label: "Coach"');
    expect(app).toContain("theme: DEFAULT_THEME");
    expect(main).toContain('import "@fontsource-variable/geist";');
    expect(app).toContain("applyThemeTokens(DEFAULT_THEME, BRAND_ACCENT);");
    expect(main).toContain("applyThemeTokens(DEFAULT_THEME, BRAND_ACCENT);");
    expect(tokens).toContain('--font-family-ui: "Geist Variable"');
    expect(themeTokens).not.toContain('"page-max"');
    expect(themeTokens).not.toContain('"font-title"');
    expect(themeTokens).not.toContain("buttonHeight");
  });
});
