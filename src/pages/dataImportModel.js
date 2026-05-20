import { migrate } from "../logic/state";

export const DATA_IMPORT_CONFIRM_COPY = {
  title: "Confirmer l’import",
  text: "Cette action peut remplacer les données actuelles de ton système. Vérifie ton fichier avant de continuer.",
  cta: "Importer et remplacer",
  secondary: "Annuler",
};

export function prepareDataImportState(rawText, { migrateState = migrate } = {}) {
  let parsed;
  try {
    parsed = JSON.parse(String(rawText || ""));
  } catch {
    return { ok: false, errorCode: "invalid_json", data: null };
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return { ok: false, errorCode: "invalid_shape", data: null };
  }

  try {
    const migrated = typeof migrateState === "function" ? migrateState(parsed) : parsed;
    if (!migrated || typeof migrated !== "object" || Array.isArray(migrated)) {
      return { ok: false, errorCode: "invalid_migrated_shape", data: null };
    }
    return { ok: true, errorCode: "", data: migrated };
  } catch {
    return { ok: false, errorCode: "migration_failed", data: null };
  }
}
