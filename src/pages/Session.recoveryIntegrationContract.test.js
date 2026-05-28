import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const SRC_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function readSrc(relPath) {
  return fs.readFileSync(path.join(SRC_ROOT, relPath), "utf8");
}

describe("Session recovery integration contract", () => {
  it("records blocked outcome before queueing recovery", () => {
    const session = readSrc("pages/Session.jsx");
    const blockStart = session.indexOf("const blockSession = () => {");
    const blockEnd = session.indexOf("const reportSession = () => {", blockStart);
    const block = session.slice(blockStart, blockEnd);

    expect(block).toContain('context: RECOVERY_CONTEXT.BLOCKED');
    expect(block.indexOf('type: "block"')).toBeLessThan(block.indexOf("onQueueRecoveryAfterSessionCommit?.(recoveryRequest)"));
    expect(block).toContain("source: SESSION_RECOVERY_SOURCE.BLOCK");
  });

  it("records reported outcome before queueing recovery without legacy direct move", () => {
    const session = readSrc("pages/Session.jsx");
    const reportStart = session.indexOf("const reportSession = () => {");
    const reportEnd = session.indexOf("if (!selectedOccurrence && !session)", reportStart);
    const report = session.slice(reportStart, reportEnd);

    expect(report).toContain('context: RECOVERY_CONTEXT.REPORTED');
    expect(report).toContain('occurrenceStatus: "planned"');
    expect(report.indexOf('type: "report"')).toBeLessThan(report.indexOf("onQueueRecoveryAfterSessionCommit?.(recoveryRequest)"));
    expect(session).not.toContain("applyQuickReport");
    expect(session).not.toContain("updateOccurrence(");
    expect(session).not.toContain("resolveConflictNearest(");
  });

  it("App opens queued Session recovery only after committed history is visible", () => {
    const app = readSrc("App.jsx");
    const effectStart = app.indexOf("const request = queuedSessionRecoveryRequest;");
    const effectEnd = app.indexOf("const commitRecoveryOption = useCallback", effectStart);
    const queueEffect = app.slice(effectStart, effectEnd);

    expect(queueEffect.indexOf("hasCommittedSessionRecoveryOutcome(currentData, request)")).toBeLessThan(
      queueEffect.indexOf("buildRecoveryContext({")
    );
    expect(queueEffect.indexOf("setQueuedSessionRecoveryRequest(null)")).toBeLessThan(
      queueEffect.indexOf("if (!model.ok || !model.options.length) return;")
    );
    expect(queueEffect).toContain('setTab("today")');
    expect(app).toContain("onQueueRecoveryAfterSessionCommit={queueRecoveryAfterSessionCommit}");
  });
});
