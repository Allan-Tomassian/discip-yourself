import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const SRC_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function readSrc(relPath) {
  return fs.readFileSync(path.join(SRC_ROOT, relPath), "utf8");
}

describe("edit item canonical contract", () => {
  it("keeps editing on planning and out of objectives", () => {
    const app = readSrc("App.jsx");
    const objectives = readSrc("pages/Objectives.jsx");
    const timeline = readSrc("pages/Timeline.jsx");

    expect(objectives).not.toContain("onEditItem");
    expect(objectives).not.toContain("onOpenCreateAction");
    expect(objectives).not.toContain("onOpenCreateMenu");
    expect(objectives).not.toContain("objectives-universal-capture-button");
    expect(objectives).toContain("onOpenPlanning");
    expect(objectives).toContain("requestAiLocalAnalysis");
    expect(objectives).toContain('surface: "objectives"');
    expect(timeline).toContain("onEditItem?.({");
    expect(timeline).toContain("TIMELINE_SCREEN_COPY.inlineEditAction");
    expect(timeline).toContain("TIMELINE_SCREEN_COPY.inlineEditObjective");
    expect(objectives).not.toContain("EditItemPanel");
    expect(objectives).not.toContain("editPanelGoalId");
    expect(app).toContain("returnTab: \"objectives\"");
    expect(app).toContain("returnToCategoryView: Boolean(goal.categoryId)");
    expect(app).toContain("returnToCategoryView: false");
    expect(app).toContain('setTab("edit-item", {');
    expect(app).toContain("editItemId: id");
    expect(app).not.toContain('tab === "library"');
  });

  it("uses the split canonical screens and removes legacy edit panel recipes", () => {
    const page = readSrc("pages/EditItem.jsx");
    const screens = readSrc("features/edit-item/EditItemScreens.jsx");
    const shared = readSrc("features/edit-item/editItemShared.js");
    const index = readSrc("index.css");

    expect(page).toContain('pageId="edit-item"');
    expect(page).toContain("ActionEditScreen");
    expect(page).toContain("OutcomeEditScreen");
    expect(page).toContain("buildPlanSignature");
    expect(page).toContain("updateActionModel");
    expect(screens).toContain("AppFormSection");
    expect(screens).toContain("AppStickyFooter");
    expect(screens).toContain("AppInlineMetaCard");
    expect(shared).toContain("updateRemindersForGoal");
    expect(shared).toContain("MEASURE_OPTIONS");
    expect(index).not.toContain(".editPanel{");
    expect(index).not.toContain(".editSection{");
    expect(index).not.toContain(".editPanelFooter{");
  });
});
