import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const SRC_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function readSrc(relPath) {
  return fs.readFileSync(path.join(SRC_ROOT, relPath), "utf8");
}

function extractBetween(source, startNeedle, endNeedle) {
  const start = source.indexOf(startNeedle);
  const end = source.indexOf(endNeedle, start + startNeedle.length);
  expect(start).toBeGreaterThanOrEqual(0);
  expect(end).toBeGreaterThan(start);
  return source.slice(start, end);
}

describe("dirty and destructive exit safety contract", () => {
  it("requires confirmation before Data import can replace app state", () => {
    const source = readSrc("pages/Data.jsx");
    const importHandler = extractBetween(source, "function handleImportFile", "function handleConfirmImport");
    const confirmHandler = extractBetween(source, "function handleConfirmImport", "function handleCancelImport");

    expect(source).toContain("DATA_IMPORT_CONFIRM_COPY");
    expect(source).toContain("prepareDataImportState");
    expect(source).toContain("pendingImport");
    expect(source).toContain('data-testid="data-import-confirmation"');
    expect(importHandler).not.toContain("setData(");
    expect(confirmHandler).toContain("setData(() => pendingImport.data)");
  });

  it("routes CreateItem header back through the dirty-safe cancel path", () => {
    const source = readSrc("pages/CreateItem.jsx");
    const headerRight = extractBetween(source, "const headerRight =", "const actionScreenController");

    expect(source).toContain("safeConfirm(\"Annuler cette création ? Le brouillon sera perdu.\")");
    expect(headerRight).toContain("AppBackButton");
    expect(headerRight).toContain("onClick={handleCancel}");
  });

  it("guards dirty Account and Settings header exits", () => {
    const account = readSrc("pages/Account.jsx");
    const preferences = readSrc("pages/Preferences.jsx");

    expect(account).toContain("safeConfirm");
    expect(account).toContain("Quitter sans enregistrer les modifications du profil ?");
    expect(account).toContain("onClick={handleBack}");
    expect(preferences).toContain("safeConfirm");
    expect(preferences).toContain("Quitter sans enregistrer les modifications du pourquoi ?");
    expect(preferences).toContain("onClick={handleBack}");
  });
});
