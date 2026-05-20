import { describe, expect, it } from "vitest";
import { DATA_IMPORT_CONFIRM_COPY, prepareDataImportState } from "./dataImportModel";

describe("prepareDataImportState", () => {
  it("prepares valid JSON through the migration path without applying it", () => {
    const imported = { schemaVersion: 1, profile: { plan: "premium" } };
    const migrated = { ...imported, schemaVersion: 99 };
    const result = prepareDataImportState(JSON.stringify(imported), {
      migrateState: (state) => ({ ...state, schemaVersion: 99 }),
    });

    expect(result).toEqual({ ok: true, errorCode: "", data: migrated });
    expect(imported.schemaVersion).toBe(1);
  });

  it("rejects invalid JSON", () => {
    expect(prepareDataImportState("{", { migrateState: (state) => state })).toMatchObject({
      ok: false,
      errorCode: "invalid_json",
      data: null,
    });
  });

  it("rejects non-object JSON payloads", () => {
    expect(prepareDataImportState("[]", { migrateState: (state) => state })).toMatchObject({
      ok: false,
      errorCode: "invalid_shape",
      data: null,
    });
  });

  it("rejects migration failures or malformed migration results", () => {
    expect(
      prepareDataImportState("{}", {
        migrateState: () => {
          throw new Error("bad import");
        },
      })
    ).toMatchObject({ ok: false, errorCode: "migration_failed", data: null });

    expect(prepareDataImportState("{}", { migrateState: () => null })).toMatchObject({
      ok: false,
      errorCode: "invalid_migrated_shape",
      data: null,
    });
  });

  it("keeps the destructive import confirmation copy explicit", () => {
    expect(DATA_IMPORT_CONFIRM_COPY.title).toBe("Confirmer l’import");
    expect(DATA_IMPORT_CONFIRM_COPY.text).toContain("remplacer les données actuelles");
    expect(DATA_IMPORT_CONFIRM_COPY.cta).toBe("Importer et remplacer");
    expect(DATA_IMPORT_CONFIRM_COPY.secondary).toBe("Annuler");
  });
});
