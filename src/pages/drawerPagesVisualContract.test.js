import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const SRC_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function readSrc(relPath) {
  return fs.readFileSync(path.join(SRC_ROOT, relPath), "utf8");
}

describe("drawer pages visual contract", () => {
  it("declasses GatePage into a neutral compatibility wrapper", () => {
    const gatePageSource = readSrc("shared/ui/gate/GatePage.jsx");

    expect(gatePageSource).not.toContain("GateHeader");
    expect(gatePageSource).not.toContain("GateMainSectionCard");
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

  it("keeps drawer and secondary pages on the shared premium surface family", () => {
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
      expect(source).toContain("GateSecondarySectionCard");
    }

    expect(microActions).toContain("headerTitle");
    expect(microActions).toContain("GateSectionIntro");
    expect(microActions).not.toContain("<GatePage");
    expect(drawer).toContain("drawerMenuPanel");
    expect(drawer).toContain('title="Menu"');
    expect(drawer).toContain("GateHeader");
  });

  it("keeps section intros on the drawer-linked simple pages", () => {
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
      expect(source).toContain("GateSectionIntro");
    }
  });
});
