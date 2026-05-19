import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const SRC_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function readSrc(relPath) {
  return fs.readFileSync(path.join(SRC_ROOT, relPath), "utf8");
}

describe("command design tokens", () => {
  it("adds semantic command tokens while keeping legacy accent compatibility", () => {
    const tokens = readSrc("styles/tokens.css");
    const themeTokens = readSrc("theme/themeTokens.js");

    expect(tokens).toContain("--command-execution");
    expect(tokens).toContain("--command-ai");
    expect(tokens).toContain("--command-attention");
    expect(tokens).toContain("--command-critical");
    expect(tokens).toContain("--command-cta-bg");
    expect(tokens).toContain("--accent-primary");
    expect(themeTokens).toContain('BRAND_ACCENT = "#8B78FF"');
  });

  it("does not use the old yellow warning token or purple shared CTA defaults", () => {
    const tokens = readSrc("styles/tokens.css");
    const gatePremium = readSrc("shared/ui/gate/gate-premium.css");
    const appCss = readSrc("shared/ui/app/app.css");

    expect(tokens).not.toContain("--warning: #f4b74a");
    expect(tokens).toContain("--warning: #ff8a3d");
    expect(tokens).toContain("--buttonBg: var(--command-cta-bg)");
    expect(tokens).toContain("--focus: var(--command-execution)");
    expect(gatePremium).toContain("var(--focus)");
    expect(gatePremium).not.toContain("rgba(139, 120, 255, 0.34)");
    expect(appCss).toContain("accent-color: var(--command-execution)");
  });
});
