import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const SRC_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

function readSrc(relPath) {
  return fs.readFileSync(path.join(SRC_ROOT, relPath), "utf8");
}

describe("bottom navigation command DA contract", () => {
  it("keeps canonical labels, route ids, and compatibility selectors", () => {
    const source = readSrc("components/navigation/BottomNavigation.jsx");

    expect(source).toContain('id: "objectives"');
    expect(source).toContain('id: "timeline"');
    expect(source).toContain('id: "today"');
    expect(source).toContain('id: "coach"');
    expect(source).toContain('id: "adjust"');
    expect(source).toContain('label: "Objectifs"');
    expect(source).toContain('label: "Planning"');
    expect(source).toContain('label: "Home"');
    expect(source).toContain('label: "Coach IA"');
    expect(source).toContain('label: "Ajuster"');
    expect(source).toContain("lovableTabButton");
    expect(source).toContain("is-home");
    expect(source).toContain("is-ai");
    expect(source).toContain("CommandBottomNavigation");
  });

  it("maps Home to execution green, Coach IA to AI purple, and other tabs to neutral", () => {
    const css = readSrc("styles/lovable.css");

    expect(css).toContain(".lovableTabButton.is-home");
    expect(css).toContain("var(--command-execution");
    expect(css).toContain(".lovableTabButton.is-ai");
    expect(css).toContain("var(--command-ai");
    expect(css).toContain("var(--command-neutral");
    expect(css).toContain("@media (prefers-reduced-motion: reduce)");
  });
});
