import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const SRC_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function readSrc(relPath) {
  return fs.readFileSync(path.join(SRC_ROOT, relPath), "utf8");
}

describe("main pages header contract", () => {
  it("keeps the four main pages on the same header structure", () => {
    const home = readSrc("pages/Home.jsx");
    const planning = readSrc("pages/Planning.jsx");
    const library = readSrc("pages/Categories.jsx");
    const pilotage = readSrc("pages/Pilotage.jsx");

    expect(home).toContain('pageId="today"');
    expect(home).toContain("headerSubtitle={MAIN_PAGE_COPY.today.orientation}");

    expect(planning).toContain('pageId="planning"');
    expect(planning).toContain("headerSubtitle={MAIN_PAGE_COPY.planning.orientation}");

    expect(library).toContain('pageId="library"');
    expect(library).toContain("headerSubtitle={MAIN_PAGE_COPY.library.orientation}");
    expect(library).not.toContain('headerSubtitle="Catégories"');

    expect(pilotage).toContain('pageId="pilotage"');
    expect(pilotage).toContain("headerSubtitle={MAIN_PAGE_COPY.pilotage.orientation}");
    expect(pilotage).not.toContain('headerSubtitle="Vue d’ensemble"');
  });
});
