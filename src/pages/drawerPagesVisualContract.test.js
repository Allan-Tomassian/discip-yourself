import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const SRC_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function readSrc(relPath) {
  return fs.readFileSync(path.join(SRC_ROOT, relPath), "utf8");
}

describe("drawer pages visual contract", () => {
  it("uses the shared premium main container for drawer pages", () => {
    const gatePageSource = readSrc("shared/ui/gate/GatePage.jsx");

    expect(gatePageSource).toContain("GateMainSection GateSurfacePremium GateCardPremium");
  });

  it("keeps the main drawer pages on the shared GatePage shell", () => {
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
      expect(source).toContain("<GatePage");
    }
  });
});
