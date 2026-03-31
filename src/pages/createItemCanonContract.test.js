import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const SRC_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function readSrc(relPath) {
  return fs.readFileSync(path.join(SRC_ROOT, relPath), "utf8");
}

describe("create item canonical contract", () => {
  it("routes all creation through the canonical create-item task host", () => {
    const app = readSrc("App.jsx");
    const orchestration = readSrc("hooks/useCreateFlowOrchestration.js");
    const navigation = readSrc("hooks/useAppNavigation.js");

    expect(app).toContain("<CreateItem");
    expect(app).not.toContain("<CreateFlowModal");
    expect(orchestration).toContain("export function dispatchOpenCreateTask");
    expect(orchestration).toContain('setTab?.("create-item"');
    expect(orchestration).toContain("createEmptyCreateItemDraft");
    expect(orchestration).toContain(
      "const normalizedProposal = proposal ? normalizeCreationProposal(proposal, nextOrigin) : null;"
    );
    expect(navigation).toContain('"create-item"');
    expect(navigation).toContain('else if (initialPath.startsWith("/create")) initialTab = "create-item";');
    expect(navigation).toContain("function buildPathForTab({");
    expect(navigation).toContain('if (tab === "create-item") return "/create";');
  });

  it("keeps creation draft-first and assistant creation proposal-based", () => {
    const createPage = readSrc("pages/CreateItem.jsx");
    const coachPanel = readSrc("features/coach/CoachPanel.jsx");
    const planningCoachCard = readSrc("components/planning/PlanningCoachCard.jsx");
    const commitService = readSrc("features/create-item/createItemCommit.js");

    expect(createPage).toContain("createEmptyCreateItemDraft");
    expect(createPage).toContain("prepareCreateCommit");
    expect(createPage).toContain("commitPreparedCreatePlan");
    expect(createPage).toContain("persistCoachSummary");
    expect(coachPanel).toContain("createFromPlanReply");
    expect(coachPanel).toContain("openAssistantReview");
    expect(coachPanel).toContain("onOpenAssistantCreate");
    expect(coachPanel).toContain('sourceSurface: "coach"');
    expect(coachPanel).not.toContain('sourceSurface: "coach-chat"');
    expect(coachPanel).not.toContain('sourceSurface: "coach-panel"');
    expect(planningCoachCard).toContain("buildCreationProposalFromDraftChanges");
    expect(planningCoachCard).toContain("onOpenAssistantCreate");
    expect(commitService).toContain("buildCreationViewTarget");
  });
});
