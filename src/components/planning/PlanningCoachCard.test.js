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
    expect(source).toContain("manualPlanningAnalysis.dismissAnalysis();");
    expect(source).toContain("<Button size=\"sm\" variant=\"ghost\" onClick={handleDismissPlanningAnalysis}>");
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

  it("keeps planning analysis local and routes toward the canonical Coach instead of draft application", () => {
    const source = readSrc("components/planning/PlanningCoachCard.jsx");

    expect(source).toContain("requestAiLocalAnalysis");
    expect(source).toContain("surface: \"planning\"");
    expect(source).not.toContain("requestAiCoachChat");
    expect(source).toContain("handleOpenCoach(\"free\")");
    expect(source).toContain("handleOpenCoach(\"plan\")");
    expect(source).toContain("resolveLocalAnalysisActionLabel");
    expect(source).not.toContain("buildCreationProposalFromDraftChanges");
    expect(source).not.toContain("applyChatDraftChanges");
    expect(source).not.toContain("onOpenAssistantCreate");
  });
});
