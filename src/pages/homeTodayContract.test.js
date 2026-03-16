import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const SRC_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function readSrc(relPath) {
  return fs.readFileSync(path.join(SRC_ROOT, relPath), "utf8");
}

describe("home today canonical contract", () => {
  it("wires canonical session and future session fields from todayNowModel", () => {
    const home = readSrc("pages/Home.jsx");

    expect(home).toContain("activeSessionForActiveDate");
    expect(home).toContain("openSessionOutsideActiveDate");
    expect(home).toContain("futureSessions");
    expect(home).toContain("activeSessionId: activeSessionForActiveDate?.id || activeSessionForActiveDate?.occurrenceId || null");
  });
});
