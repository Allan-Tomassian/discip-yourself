import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const SRC_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

function walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const nextPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...walk(nextPath));
      continue;
    }
    if (!/\.(js|jsx)$/.test(entry.name)) continue;
    files.push(nextPath);
  }
  return files;
}

function readSrc(relPath) {
  return fs.readFileSync(path.join(SRC_ROOT, relPath), "utf8");
}

describe("UI convergence contract", () => {
  it("keeps the canonical app wrapper layer and removes deleted compatibility files", () => {
    const appUi = readSrc("shared/ui/app/AppUI.jsx");
    const appIndex = readSrc("shared/ui/app/index.js");

    expect(fs.existsSync(path.join(SRC_ROOT, "shared", "ui", "app", "AppUI.jsx"))).toBe(true);
    expect(fs.existsSync(path.join(SRC_ROOT, "shared", "ui", "app", "index.js"))).toBe(true);
    expect(fs.existsSync(path.join(SRC_ROOT, "components", "UI.jsx"))).toBe(false);
    expect(fs.existsSync(path.join(SRC_ROOT, "ui", "LiquidGlassSurface.jsx"))).toBe(false);
    expect(fs.existsSync(path.join(SRC_ROOT, "shared", "ui", "gate", "GatePage.jsx"))).toBe(false);
    expect(appUi).toContain("export function AppScreen");
    expect(appUi).toContain("export function AppCard");
    expect(appUi).toContain("export function PrimaryButton");
    expect(appUi).toContain("export function AppInput");
    expect(appUi).toContain("export function AppDrawer");
    expect(appIndex).toContain("AppScreen");
    expect(appIndex).toContain("AppCard");
    expect(appIndex).toContain("PrimaryButton");
  });

  it("removes active imports of the legacy UI wrapper", () => {
    const offenders = walk(SRC_ROOT)
      .filter((file) => /src[\\/](auth|pages|features|ui|components|profile)[\\/]/.test(file))
      .filter((file) => {
        const source = fs.readFileSync(file, "utf8");
        return /from ["'](?:\.\/UI|(?:\.\.\/)+components\/UI)["']/.test(source);
      })
      .map((file) => path.relative(SRC_ROOT, file));

    expect(offenders).toEqual([]);
  });

  it("locks Gate button density and premium icon button sizing", () => {
    const gate = readSrc("shared/ui/gate/Gate.jsx");
    const gateCss = readSrc("shared/ui/gate/gate.css");
    const premiumCss = readSrc("shared/ui/gate/gate-premium.css");

    expect(gate).toContain('size = "md"');
    expect(gate).toContain('size === "sm"');
    expect(gate).toContain('"gateButton--icon"');
    expect(gateCss).toContain(".gateButton--sm");
    expect(gateCss).toContain(".gateButton--md");
    expect(gateCss).toContain(".gateButton--icon");
    expect(gateCss).toContain("width: 40px;");
    expect(premiumCss).toContain(".GateIconButtonPremium");
    expect(premiumCss).toContain("width: 40px;");
    expect(premiumCss).toContain("height: 40px;");
  });
});
