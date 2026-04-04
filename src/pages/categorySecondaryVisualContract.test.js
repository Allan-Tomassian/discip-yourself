import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const SRC_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function readSrc(relPath) {
  return fs.readFileSync(path.join(SRC_ROOT, relPath), "utf8");
}

describe("category secondary visual contract", () => {
  it("keeps CategoryView on AppScreen headers and category-focused management content", () => {
    const source = readSrc("pages/CategoryView.jsx");

    expect(source).toContain("AppScreen");
    expect(source).toContain("SectionHeader");
    expect(source).toContain("GhostButton");
    expect(source).toContain("manage-category-name");
    expect(source).not.toContain("GateSectionIntro");
  });

  it("uses AppUI section and form primitives for category management sections", () => {
    const manage = readSrc("features/library/CategoryManageInline.jsx");

    expect(manage).toContain("SectionHeader");
    expect(manage).toContain("AppCard");
    expect(manage).toContain("AppInput");
    expect(manage).toContain("AppTextarea");
    expect(manage).toContain("GhostButton");
    expect(manage).toContain("StatusBadge");
    expect(manage).not.toContain("GateSectionIntro");
  });

  it("keeps CategoryDetailView on the same AppUI header and card language", () => {
    const detail = readSrc("pages/CategoryDetailView.jsx");

    expect(detail).toContain("SectionHeader");
    expect(detail).toContain("AppCard");
    expect(detail).toContain("StatusBadge");
    expect(detail).toContain("headerTitle={category.name");
    expect(detail).not.toContain("GateSectionIntro");
  });
});
