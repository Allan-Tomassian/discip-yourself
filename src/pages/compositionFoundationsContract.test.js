import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const SRC_ROOT = path.join(ROOT, "src");

function readRoot(relPath) {
  return fs.readFileSync(path.join(ROOT, relPath), "utf8");
}

function readSrc(relPath) {
  return fs.readFileSync(path.join(SRC_ROOT, relPath), "utf8");
}

describe("composition foundations contract", () => {
  it("documents the composition law next to UI foundations", () => {
    const uiFoundations = readRoot("UI_FOUNDATIONS.md");
    const compositionFoundations = readRoot("COMPOSITION_FOUNDATIONS.md");

    expect(uiFoundations).toContain("COMPOSITION_FOUNDATIONS.md");
    expect(compositionFoundations).toContain("Flat by default");
    expect(compositionFoundations).toContain("Visible surface justified");
    expect(compositionFoundations).toContain("Maximum surface depth");
    expect(compositionFoundations).toContain("Allowed exceptions");
  });

  it("removes structural wrapper cards from low-density utility and library surfaces", () => {
    const preferences = readSrc("pages/Preferences.jsx");
    const support = readSrc("pages/Support.jsx");
    const legal = readSrc("pages/Legal.jsx");
    const privacy = readSrc("pages/Privacy.jsx");
    const categories = readSrc("pages/Categories.jsx");
    const manage = readSrc("features/library/CategoryManageInline.jsx");

    expect(preferences).not.toContain('title="Apparence"\n          subtitle="Le design system global est appliqué partout dans l’app."\n        />\n        <AppCard');
    expect(support).not.toContain('title="Contact" subtitle="Réponse par email." />\n        <AppCard');
    expect(legal).not.toContain('title="Utilisation" subtitle="Cadre général de l’app." />\n        <AppCard');
    expect(privacy).not.toContain('title="Données collectées" subtitle="Données utiles au fonctionnement." />\n        <AppCard');
    expect(categories).toContain("libraryPrimaryStack");
    expect(categories).not.toContain("libraryPrimaryCard");
    expect(manage).toContain("libraryManageSectionFlat");
  });
});
