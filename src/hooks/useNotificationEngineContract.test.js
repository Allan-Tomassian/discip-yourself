import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const SRC_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function readSrc(relPath) {
  return fs.readFileSync(path.join(SRC_ROOT, relPath), "utf8");
}

describe("notification engine recovery routing contract", () => {
  it("marks recovery notifications routeable without changing normal target routing", () => {
    const hook = readSrc("hooks/useNotificationEngine.js");

    expect(hook).toContain("onOpenRecoverySheet");
    expect(hook).toContain("resolveNotificationRecoveryRequest(item) || resolveNotificationTargetNavigation(item)");
    expect(hook).toContain("resolveNotificationTargetNavigation(candidate)");
  });

  it("records toast clicks before opening recovery and keeps existing route fallback", () => {
    const hook = readSrc("hooks/useNotificationEngine.js");
    const clickStart = hook.indexOf("const clickNudge = useCallback(() => {");
    const clickEnd = hook.indexOf("const markNotificationCenterViewed", clickStart);
    const clickBlock = hook.slice(clickStart, clickEnd);

    expect(clickBlock.indexOf("clickNotification({")).toBeLessThan(
      clickBlock.indexOf("resolveNotificationRecoveryRequest(nudge.candidate || nudge)")
    );
    expect(clickBlock.indexOf("resolveNotificationRecoveryRequest(nudge.candidate || nudge)")).toBeLessThan(
      clickBlock.indexOf("resolveNotificationTargetNavigation(nudge.candidate || nudge)")
    );
    expect(clickBlock).toContain("onOpenRecoverySheet(recoveryRequest)");
    expect(clickBlock).toContain("setTab(target.tab, target.options)");
  });

  it("records notification center clicks before opening recovery and keeps existing route fallback", () => {
    const hook = readSrc("hooks/useNotificationEngine.js");
    const clickStart = hook.indexOf("const clickNotificationCenterItem = useCallback(");
    const clickEnd = hook.indexOf("return {", clickStart);
    const clickBlock = hook.slice(clickStart, clickEnd);

    expect(clickBlock.indexOf("clickNotification({")).toBeLessThan(
      clickBlock.indexOf("resolveNotificationRecoveryRequest(item)")
    );
    expect(clickBlock.indexOf("resolveNotificationRecoveryRequest(item)")).toBeLessThan(
      clickBlock.indexOf("resolveNotificationTargetNavigation(item)")
    );
    expect(clickBlock).toContain("onOpenRecoverySheet(recoveryRequest)");
    expect(clickBlock).toContain("setTab(target.tab, target.options)");
  });
});
