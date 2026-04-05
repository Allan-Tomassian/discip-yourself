import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const SRC_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function readSrc(relPath) {
  return fs.readFileSync(path.join(SRC_ROOT, relPath), "utf8");
}

describe("edit item canonical contract", () => {
  it("routes objectives editing through the canonical edit-item page", () => {
    const app = readSrc("App.jsx");
    const objectives = readSrc("pages/Objectives.jsx");

    expect(objectives).toContain("onEditItem,");
    expect(objectives).toContain("onEditItem?.({ id: action.id, type: \"PROCESS\"");
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
