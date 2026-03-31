import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const SRC_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function readSrc(relPath) {
  return fs.readFileSync(path.join(SRC_ROOT, relPath), "utf8");
}

describe("category secondary visual contract", () => {
  it("keeps CategoryView on ScreenShell headers and category-focused management content", () => {
    const source = readSrc("pages/CategoryView.jsx");

    expect(source).toContain("headerTitle");
    expect(source).toContain("manage-category-name");
    expect(source).not.toContain("<GatePage");
  });

  it("uses GateSectionIntro for category management sections instead of title-in-card shells", () => {
    const manage = readSrc("features/library/CategoryManageInline.jsx");

    expect(manage).toContain("GateSectionIntro");
    expect(manage).not.toContain("titleSm\">");
    expect(manage).not.toContain("sectionTitle");
  });

  it("keeps CategoryDetailView in the same intro-outside card-inside language", () => {
    const detail = readSrc("pages/CategoryDetailView.jsx");

    expect(detail).toContain("GateSectionIntro");
    expect(detail).toContain("headerTitle={category.name");
    expect(detail).not.toContain("titleSm");
    expect(detail).not.toContain("sectionTitle");
  });
});
