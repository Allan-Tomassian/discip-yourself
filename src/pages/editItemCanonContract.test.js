import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const SRC_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function readSrc(relPath) {
  return fs.readFileSync(path.join(SRC_ROOT, relPath), "utf8");
}

describe("edit item canonical contract", () => {
  it("routes library editing through the canonical edit-item page", () => {
    const app = readSrc("App.jsx");
    const categories = readSrc("pages/Categories.jsx");

    expect(categories).toContain("onEditItem,");
    expect(categories).toContain("function openEditItemRoute(goal)");
    expect(categories).not.toContain("EditItemPanel");
    expect(categories).not.toContain("editPanelGoalId");
    expect(app).toContain("returnToCategoryView: true");
    expect(app).toContain("returnToCategoryView: false");
    expect(app).toContain('setTab("edit-item")');
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
    expect(screens).toContain("GateMainSectionCard");
    expect(screens).toContain("GateSecondarySectionCard");
    expect(screens).toContain("GateFooter");
    expect(shared).toContain("updateRemindersForGoal");
    expect(shared).toContain("MEASURE_OPTIONS");
    expect(index).not.toContain(".editPanel{");
    expect(index).not.toContain(".editSection{");
    expect(index).not.toContain(".editPanelFooter{");
  });
});
