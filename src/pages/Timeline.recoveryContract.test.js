import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const SRC_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function readSrc(relPath) {
  return fs.readFileSync(path.join(SRC_ROOT, relPath), "utf8");
}

describe("Planning Timeline recovery integration contract", () => {
  it("derives concrete recovery requests for expanded problematic entries", () => {
    const timeline = readSrc("pages/Timeline.jsx");

    expect(timeline).toContain("resolvePlanningEntryRecoveryRequest");
    expect(timeline).toContain("onOpenRecoverySheet");
    expect(timeline).toContain("const recoveryRequest = resolvePlanningEntryRecoveryRequest({");
    expect(timeline).toContain("selectedDateKey,");
    expect(timeline).toContain("now: new Date()");
  });

  it("shows Réparer instead of starting Session for recoverable entries", () => {
    const timeline = readSrc("pages/Timeline.jsx");
    const actionsStart = timeline.indexOf("{recoveryRequest ? (");
    const actionsEnd = timeline.indexOf(") : (", actionsStart);
    const recoveryBranch = timeline.slice(actionsStart, actionsEnd);

    expect(recoveryBranch).toContain("Réparer");
    expect(recoveryBranch).toContain("onOpenRecoverySheet?.(recoveryRequest)");
    expect(recoveryBranch).not.toContain("openSessionForOccurrence");
    expect(timeline).toContain("openSessionForOccurrence(targetOccurrence, entry.category?.id || null)");
  });

  it("keeps V1E routing scoped through App recovery state", () => {
    const app = readSrc("App.jsx");

    expect(app).toContain("onOpenRecoverySheet={openRecoverySheet}");
    expect(app).toContain("<Adjust");
    expect(app).toContain("<Timeline");
    expect(app).toContain("successCtaLabel={getRecoverySuccessCtaLabel(recoverySheetState.request?.successTab)}");
  });
});
