import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const SRC_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function readSrc(relPath) {
  return fs.readFileSync(path.join(SRC_ROOT, relPath), "utf8");
}

describe("drawer pages visual contract", () => {
  it("removes GatePage once drawer-linked pages converge on ScreenShell", () => {
    expect(fs.existsSync(path.join(SRC_ROOT, "shared/ui/gate/GatePage.jsx"))).toBe(false);
  });

  it("keeps drawer-linked pages on ScreenShell headers instead of GatePage shells", () => {
    const pages = [
      "pages/Preferences.jsx",
      "pages/Account.jsx",
      "pages/Subscription.jsx",
      "pages/Faq.jsx",
      "pages/Support.jsx",
      "pages/History.jsx",
      "pages/Journal.jsx",
      "pages/MicroActions.jsx",
      "pages/Privacy.jsx",
      "pages/Legal.jsx",
      "pages/Data.jsx",
    ].map(readSrc);

    for (const source of pages) {
      expect(source).toContain("headerTitle");
      expect(source).not.toContain("<GatePage");
    }
  });

  it("keeps drawer and secondary pages on shared AppUI composition primitives", () => {
    const pages = [
      "pages/Preferences.jsx",
      "pages/Account.jsx",
      "pages/Subscription.jsx",
      "pages/Faq.jsx",
      "pages/Support.jsx",
      "pages/History.jsx",
      "pages/Journal.jsx",
      "pages/Privacy.jsx",
      "pages/Legal.jsx",
      "pages/Data.jsx",
    ].map(readSrc);
    const microActions = readSrc("pages/MicroActions.jsx");
    const drawer = readSrc("components/navigation/MainDrawer.jsx");

    for (const source of pages) {
      expect(source).toContain("SectionHeader");
      expect(source).not.toContain("GateSecondarySectionCard");
      expect(
        source.includes("AppCard") || source.includes("AppInlineMetaCard") || source.includes("AppActionRow")
      ).toBe(true);
    }

    expect(microActions).toContain("headerTitle");
    expect(microActions).toContain("SectionHeader");
    expect(microActions).not.toContain("<GatePage");
    expect(drawer).toContain("<AppDrawer");
    expect(drawer).toContain("drawerMenuPanel");
    expect(drawer).toContain('title="Menu"');
    expect(drawer).toContain("AppHeader");
  });

  it("keeps drawer-linked simple pages on shared section header primitives", () => {
    const pages = [
      "pages/Preferences.jsx",
      "pages/Account.jsx",
      "pages/Subscription.jsx",
      "pages/Faq.jsx",
      "pages/Support.jsx",
      "pages/History.jsx",
      "pages/Journal.jsx",
      "pages/Privacy.jsx",
      "pages/Legal.jsx",
      "pages/Data.jsx",
    ].map(readSrc);

    for (const source of pages) {
      expect(source.includes("SectionHeader") || source.includes("GateSectionIntro")).toBe(true);
    }
  });
});
