import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const SRC_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function readSrc(relPath) {
  return fs.readFileSync(path.join(SRC_ROOT, relPath), "utf8");
}

describe("navigation back safety contract", () => {
  it("keeps secondary pages from being dead ends", () => {
    const pages = [
      "pages/Account.jsx",
      "pages/Preferences.jsx",
      "pages/Subscription.jsx",
      "pages/Data.jsx",
      "pages/Privacy.jsx",
      "pages/Legal.jsx",
      "pages/Support.jsx",
      "pages/Faq.jsx",
      "pages/Journal.jsx",
      "pages/MicroActions.jsx",
      "pages/History.jsx",
    ];

    for (const page of pages) {
      const source = readSrc(page);
      expect(source).toContain("onBack");
      expect(source).toContain("AppBackButton");
      expect(source).toContain("headerRight");
    }
  });

  it("uses app navigation for settings links instead of a full page reload", () => {
    const source = readSrc("pages/Preferences.jsx");

    expect(source).toContain("onNavigate");
    expect(source).not.toContain("window.location.assign");
    expect(source).toContain('navigateTo("billing")');
    expect(source).toContain('navigateTo("data")');
    expect(source).toContain('navigateTo("privacy")');
    expect(source).toContain('navigateTo("legal")');
    expect(source).toContain('navigateTo("support")');
  });

  it("keeps category detail and missing-category states escapable", () => {
    const source = readSrc("pages/CategoryDetailView.jsx");

    expect(source).toContain("onBack");
    expect(source).toContain("AppBackButton");
    expect(source).toContain('label="Objectifs"');
    expect(source).toContain("headerTitle=\"Catégorie\"");
    expect(source).toContain("headerTitle={category.name");
    expect(source).toContain("Gérer");
  });

  it("passes a single safe secondary back callback from App", () => {
    const app = readSrc("App.jsx");
    const navigation = readSrc("hooks/useAppNavigation.js");

    expect(app).toContain("getSafeBackTarget");
    expect(app).toContain("handleSecondaryBack");
    expect(app).toContain("lastMainTab");
    expect(app).toContain("onBack={handleSecondaryBack}");
    expect(app).toContain('setTab("objectives")');
    expect(navigation).toContain("initialLastMainTab");
    expect(navigation).toContain("lastMainTab: nextLastMainTab");
  });
});
