import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const SRC_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function readSrc(relPath) {
  return fs.readFileSync(path.join(SRC_ROOT, relPath), "utf8");
}

describe("create flow host contract", () => {
  it("keeps a single modal host in App instead of rendering legacy create pages inline", () => {
    const source = readSrc("App.jsx");

    expect(source).toContain("<CreateFlowModal");
    expect(source).not.toContain('tab === "create-goal" ? (');
    expect(source).not.toContain('tab === "create-habit-type" ? (');
    expect(source).not.toContain('tab === "create-link-outcome" ? (');
    expect(source).not.toContain('tab === "create-goal" ||');
  });

  it("does not keep legacy create-route compatibility tabs alive in orchestration", () => {
    const source = readSrc("hooks/useCreateFlowOrchestration.js");

    expect(source).not.toContain("resolveLegacyCreateRouteIntent");
    expect(source).not.toContain("legacyIntent.baseTab");
  });
});
