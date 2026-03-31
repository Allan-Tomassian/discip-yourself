import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const SRC_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function readSrc(relPath) {
  return fs.readFileSync(path.join(SRC_ROOT, relPath), "utf8");
}

describe("secondary pages visual canon contract", () => {
  it("keeps menu-linked pages on shared secondary surfaces without GatePage shells", () => {
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
      "pages/MicroActions.jsx",
    ].map(readSrc);

    for (const source of pages) {
      expect(source).toContain("headerTitle");
      expect(source).not.toContain("<GatePage");
    }
  });

  it("keeps MicroActions on the same secondary page grammar", () => {
    const page = readSrc("pages/MicroActions.jsx");
    const card = readSrc("ui/today/MicroActionsCard.jsx");

    expect(page).toContain("headerTitle");
    expect(page).toContain("GateSectionIntro");
    expect(page).not.toContain("<GatePage");
    expect(card).toContain("GateSecondarySectionCard");
    expect(card).toContain("GateRoleCardTitle");
    expect(card).toContain("GateRoleCardMeta");
    expect(card).not.toContain('<div className="cardSectionTitle">Micro-actions</div>');
  });

  it("uses external section intros on simple secondary pages", () => {
    const pages = [
      "pages/Preferences.jsx",
      "pages/Account.jsx",
      "pages/Subscription.jsx",
      "pages/Support.jsx",
      "pages/Faq.jsx",
      "pages/Privacy.jsx",
      "pages/Legal.jsx",
      "pages/Data.jsx",
      "pages/History.jsx",
      "pages/Journal.jsx",
    ].map(readSrc);

    for (const source of pages) {
      expect(source).toContain("GateSectionIntro");
      expect(source).toContain("GateSecondarySectionCard");
    }
  });

  it("keeps compact content on shared meta cards and premium helper roles", () => {
    const pages = [
      "pages/Preferences.jsx",
      "pages/Account.jsx",
      "pages/Subscription.jsx",
      "pages/Support.jsx",
      "pages/Faq.jsx",
      "pages/Privacy.jsx",
      "pages/Legal.jsx",
      "pages/Data.jsx",
      "pages/History.jsx",
      "pages/Journal.jsx",
    ].map(readSrc);
    const accountCss = readSrc("features/account/accountGate.css");
    const preferencesCss = readSrc("features/preferences/preferencesGate.css");
    const todayCss = readSrc("features/today/today.css");

    for (const source of pages) {
      expect(source).toContain("GateInlineMetaCard");
    }

    expect(accountCss).not.toContain("font-size: 12px;");
    expect(preferencesCss).not.toContain("font-size: 12px;");
    expect(todayCss).not.toContain(".microCard,\n.calendarCard");
  });
});
