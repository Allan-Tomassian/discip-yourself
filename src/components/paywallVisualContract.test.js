import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const SRC_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function readSrc(relPath) {
  return fs.readFileSync(path.join(SRC_ROOT, relPath), "utf8");
}

describe("paywall visual contract", () => {
  it("keeps the paywall on an overlay shell with internal premium section intros", () => {
    const paywall = readSrc("components/PaywallModal.jsx");

    expect(paywall).toContain("GateHeader");
    expect(paywall).toContain("GateSectionIntro");
    expect(paywall).toContain("paywallSection");
    expect(paywall).not.toContain("small2");
  });

  it("uses the refreshed paywall layout helpers instead of a plain old modal stack", () => {
    const css = readSrc("features/paywall/paywall.css");

    expect(css).toContain(".paywallSection");
    expect(css).toContain(".paywallFeatureCard");
    expect(css).toContain(".paywallSummaryCard");
  });
});
