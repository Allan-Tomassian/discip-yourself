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
    const themePicker = readSrc("components/ThemePicker.jsx");

    expect(preferences).toContain("Système visuel actif");
    expect(preferences).not.toContain("preferences-theme-select");
    expect(preferences).not.toContain("Choisis le thème de l'app");
    expect(themePicker).toContain("Confirmer le thème global");
    expect(themePicker).not.toContain("SelectMenu");
  });

  it("keeps the canonical navigation labels and app-wide theme bootstrapping", () => {
    const topNav = readSrc("components/TopNav.jsx");
    const app = readSrc("App.jsx");
    const main = readSrc("main.jsx");

    expect(topNav).toContain('{ id: "today", label: "Today" }');
    expect(topNav).not.toContain("Aujourd’hui");
    expect(app).toContain("theme: DEFAULT_THEME");
    expect(app).toContain("applyThemeTokens(DEFAULT_THEME, BRAND_ACCENT);");
    expect(main).toContain("applyThemeTokens(DEFAULT_THEME, BRAND_ACCENT);");
  });
});
