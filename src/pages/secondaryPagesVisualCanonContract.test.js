import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const SRC_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function readSrc(relPath) {
  return fs.readFileSync(path.join(SRC_ROOT, relPath), "utf8");
}

describe("secondary pages visual canon contract", () => {
  it("keeps menu-linked pages on shared secondary surfaces", () => {
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
      "ui/today/MicroActionsCard.jsx",
    ].map(readSrc);

    for (const source of pages) {
      expect(source).toContain("GateSecondarySectionCard");
    }
  });

  it("uses inline meta cards for compact secondary page content", () => {
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
      expect(source).toContain("GateInlineMetaCard");
    }
  });

  it("keeps secondary page helper text on Gate roles instead of feature-level font overrides", () => {
    const accountCss = readSrc("features/account/accountGate.css");
    const preferencesCss = readSrc("features/preferences/preferencesGate.css");
    const todayCss = readSrc("features/today/today.css");

    expect(accountCss).not.toContain("font-size: 12px;");
    expect(preferencesCss).not.toContain("font-size: 12px;");
    expect(todayCss).not.toContain(".microCard,\n.calendarCard");
  });
});
