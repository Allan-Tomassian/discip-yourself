import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const SRC_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function readSrc(relPath) {
  return fs.readFileSync(path.join(SRC_ROOT, relPath), "utf8");
}

describe("categories library focus contract", () => {
  it("consumes coach library focus targets from the root Bibliotheque surface", () => {
    const source = readSrc("pages/Categories.jsx");

    expect(source).toContain("libraryFocusTarget");
    expect(source).toContain("data-library-focus-category");
    expect(source).toContain("data-library-focus-section=\"objectives\"");
    expect(source).toContain("data-library-focus-section=\"actions\"");
    expect(source).toContain("data-library-focus-row={`outcome:${g.id}`}");
    expect(source).toContain("data-library-focus-row={`action:${goal.id}`}");
  });
});
