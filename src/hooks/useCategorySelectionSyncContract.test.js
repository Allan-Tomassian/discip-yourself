import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const SRC_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function readSrc(relPath) {
  return fs.readFileSync(path.join(SRC_ROOT, relPath), "utf8");
}

describe("useCategorySelectionSync contract", () => {
  it("routes execution surfaces through the shared execution context and library through local context", () => {
    const source = readSrc("hooks/useCategorySelectionSync.js");

    expect(source).toContain("resolveLibraryEntryCategoryId");
    expect(source).toContain("withExecutionActiveCategoryId");
    expect(source).toContain("withLibraryActiveCategoryId");
    expect(source).toContain("if (tab === \"today\") {");
    expect(source).toContain("if (tab === \"planning\" || tab === \"timeline\") {");
    expect(source).toContain("if (tab === \"pilotage\" || tab === \"insights\") {");
    expect(source).toContain("syncExecutionCategorySelection();");
    expect(source).toContain("if (tab === \"library\" || tab === \"objectives\") {");
    expect(source).toContain("if (tab === \"category-detail\") {");
    expect(source).toContain("if (tab === \"category-progress\") {");
    expect(source).toContain("if (tab === \"edit-item\") {");
    expect(source).toContain("syncLibraryCategorySelection();");
    expect(source).toContain("if (tab === \"session\") {");
    expect(source).toContain("setSessionCategoryId(categoryId);");
    expect(source).not.toContain("library:selectedCategoryTouched");
  });
});
