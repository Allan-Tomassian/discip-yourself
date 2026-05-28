import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const SRC_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function readSrc(relPath) {
  return fs.readFileSync(path.join(SRC_ROOT, relPath), "utf8");
}

describe("Adjust recovery integration contract", () => {
  it("opens recovery only before the primary concrete recommendation fallback", () => {
    const adjust = readSrc("pages/Adjust.jsx");
    const handlerStart = adjust.indexOf("const handlePrimaryRecommendationAction = useCallback(() => {");
    const handlerEnd = adjust.indexOf("const systemAnalysisSnapshot = useMemo", handlerStart);
    const handler = adjust.slice(handlerStart, handlerEnd);

    expect(adjust).toContain("resolveAdjustRecoveryRequest");
    expect(adjust).toContain("onOpenRecoverySheet");
    expect(handler).toContain("if (recoveryRequest && typeof onOpenRecoverySheet === \"function\")");
    expect(handler.indexOf("onOpenRecoverySheet(recoveryRequest)")).toBeLessThan(
      handler.indexOf("onAdjustAction?.(recommendation?.actionId")
    );
    expect(handler).toContain("if (opened) return;");
  });

  it("changes only the concrete recovery CTA and preserves general Ajuster routing", () => {
    const adjust = readSrc("pages/Adjust.jsx");

    expect(adjust).toContain('onClick={handlePrimaryRecommendationAction}');
    expect(adjust).toContain('recoveryRequest ? "Réparer ce bloc"');
    expect(adjust).toContain('recommendationAction ? recommendationAction.label : "Lancer cette correction"');
    expect(adjust).toContain("<SystemAnalysisCommandSheet");
    expect(adjust).toContain("quickActions.map((action) => (");
    expect(adjust).toContain("onAction={onAdjustAction}");
  });
});
