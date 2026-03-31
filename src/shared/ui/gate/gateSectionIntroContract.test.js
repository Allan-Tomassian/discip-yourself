import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const SRC_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

function readSrc(relPath) {
  return fs.readFileSync(path.join(SRC_ROOT, relPath), "utf8");
}

describe("GateSectionIntro contract", () => {
  it("exports a shared external section intro primitive", () => {
    const gate = readSrc("shared/ui/gate/Gate.jsx");

    expect(gate).toContain("export function GateSectionIntro");
    expect(gate).toContain('className={cx("gateSectionIntro", className)}');
    expect(gate).toContain("gateSectionIntroText");
    expect(gate).toContain("gateSectionIntroActions");
  });

  it("styles the section intro in shared gate styles", () => {
    const gateCss = readSrc("shared/ui/gate/gate.css");
    const premiumCss = readSrc("shared/ui/gate/gate-premium.css");

    expect(gateCss).toContain(".gateSectionIntro");
    expect(gateCss).toContain(".gateSectionIntroTitle");
    expect(gateCss).toContain(".gateSectionIntroSubtitle");
    expect(gateCss).toContain(".gateSectionIntroActions");
    expect(premiumCss).toContain(".gateSectionIntro");
    expect(premiumCss).toContain(".gateSectionIntroTitle");
    expect(premiumCss).toContain(".gateSectionIntroSubtitle");
  });
});
