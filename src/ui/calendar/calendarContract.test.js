import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const SRC_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

function readSrc(relPath) {
  return fs.readFileSync(path.join(SRC_ROOT, relPath), "utf8");
}

describe("calendar contract", () => {
  it("removes selectedGoalId from CalendarCard and Home wiring", () => {
    const calendarCard = readSrc("ui/calendar/CalendarCard.jsx");
    const home = readSrc("pages/Home.jsx");

    expect(calendarCard).not.toContain("selectedGoalId");
    expect(home).not.toContain("selectedGoalId={");
  });
});
