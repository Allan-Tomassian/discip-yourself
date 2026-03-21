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
    expect(home).toContain("plannedActionsForActiveDate");
    expect(home).toContain("focusOccurrenceForActiveDate");
    expect(home).toContain("const aiNowContextSignature = useMemo(");
    expect(home).toContain("createAiNowContextSignature({");
    expect(home).toContain("activeSessionId: activeSessionForActiveDate?.id || activeSessionForActiveDate?.occurrenceId || null");
    expect(home).toContain("contextSignature: aiNowContextSignature");
    expect(home).toContain("const localGapSummary = useMemo(");
    expect(home).toContain("buildLocalGapSummary({");
    expect(home).toContain("gapSummary: localGapSummary");
  });

  it("shows the focus block only when it has adjustment value", () => {
    const home = readSrc("pages/Home.jsx");

    expect(home).toContain("const shouldShowFocusCard = isFocusOverride || alternativeCandidates.length > 0;");
    expect(home).toContain("const visibleBlockOrder = useMemo(");
    expect(home).toContain('blockOrder.filter((id) => id !== "focus" || shouldShowFocusCard)');
    expect(home).toContain("onReorder={handleVisibleReorder}");
  });

  it("logs today coach diagnostics in local dev with a visible console log", () => {
    const home = readSrc("pages/Home.jsx");

    expect(home).toContain("const todayDecisionDiagnostics = useMemo(");
    expect(home).toContain("const isLocalHost =");
    expect(home).toContain('window.location?.hostname === "localhost"');
    expect(home).toContain('window.location?.hostname === "127.0.0.1"');
    expect(home).toContain("if (!isDev && !isLocalHost) return;");
    expect(home).toContain('console.log("[today-coach]", todayDecisionDiagnostics);');
  });

  it("guards session start with the shared temporal policy and wires the typing reveal", () => {
    const home = readSrc("pages/Home.jsx");

    expect(home).toContain("resolveTodayOccurrenceStartPolicy");
    expect(home).toContain("if (!startPolicy.canStartDirectly) return;");
    expect(home).toContain("const typedHeroTitle = useTypingReveal(");
    expect(home).toContain("const shouldAnimateCoachResponse =");
    expect(home).toContain('aiNow.requestDiagnostics.deliverySource === "network"');
    expect(home).toContain("aiNow.requestDiagnostics.hadVisibleLoading");
    expect(home).toContain("deriveTodayHeroChrome({");
    expect(home).toContain("todayDecisionDiagnostics");
    expect(home).not.toContain("const typedHeroHint = useTypingReveal(");
  });

  it("keeps a concrete planifier aujourd'hui fallback for passive Today states", () => {
    const adapter = readSrc("features/today/aiNowHeroAdapter.js");
    const home = readSrc("pages/Home.jsx");

    expect(adapter).toContain('primaryLabel: "Planifier aujourd’hui"');
    expect(adapter).toContain("gapSummary?.hasGapToday");
    expect(adapter).toContain("gapCandidate.title");
    expect(adapter).toContain("gapSummary.selectionScope === \"cross_category_fallback\"");
    expect(home).toContain("const activeCategoryCandidates = allCandidateActionSummaries.filter(");
    expect(home).toContain("const crossCategoryCandidates = allCandidateActionSummaries.filter(");
    expect(home).toContain("selectionScope");
    expect(adapter).not.toContain('primaryLabel: "Aucune action active"');
  });
});
