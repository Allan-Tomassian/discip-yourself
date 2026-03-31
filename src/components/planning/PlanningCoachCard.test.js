import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const SRC_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

function readSrc(relPath) {
  return fs.readFileSync(path.join(SRC_ROOT, relPath), "utf8");
}

describe("PlanningCoachCard contract", () => {
  it("clears the live reply when returning to the local diagnostic", () => {
    const source = readSrc("components/planning/PlanningCoachCard.jsx");

    expect(source).toContain("function handleDismissPlanningAnalysis() {");
    expect(source).toContain("setReply(null);");
    expect(source).toContain("setIgnoredDraftKey(\"\");");
    expect(source).toContain("setDraftMessage(\"\");");
    expect(source).toContain("manualPlanningAnalysis.dismissAnalysis();");
    expect(source).toContain("<Button variant=\"ghost\" onClick={handleDismissPlanningAnalysis}>");
  });

  it("uses the shared IA status component and surface-specific loading stages", () => {
    const source = readSrc("components/planning/PlanningCoachCard.jsx");

    expect(source).toContain("import ManualAiStatus");
    expect(source).toContain("surface: \"planning\"");
    expect(source).toContain("<ManualAiStatus");
    expect(source).toContain("statusLabel={planningAnalysisState.label}");
    expect(source).toContain("stageLabel={manualPlanningAnalysis.loadingStageLabel}");
    expect(source).toContain("manualPlanningAnalysis.loadingStageLabel || \"Analyse...\"");
    expect(source).toContain("Observer ma semaine");
    expect(source).toContain("Observer ma journée");
  });

  it("opens assistant creation for coach draft proposals instead of applying new objects directly", () => {
    const source = readSrc("components/planning/PlanningCoachCard.jsx");

    expect(source).toContain("buildCreationProposalFromDraftChanges");
    expect(source).toContain("mode: \"card\"");
    expect(source).toContain("if (proposal && typeof onOpenAssistantCreate === \"function\") {");
    expect(source).toContain("onOpenAssistantCreate(proposal);");
    expect(source).toContain("setDraftMessage(\"Proposition ouverte pour validation.\");");
  });
});
