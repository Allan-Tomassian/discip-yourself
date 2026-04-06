import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DEFAULT_ENV_FILES = [
  path.join(PROJECT_ROOT, ".env"),
  path.join(PROJECT_ROOT, ".env.local"),
];

function stripWrappingQuotes(value) {
  const normalized = String(value || "").trim();
  if (!normalized) return "";
  if (
    (normalized.startsWith("\"") && normalized.endsWith("\""))
    || (normalized.startsWith("'") && normalized.endsWith("'"))
  ) {
    return normalized.slice(1, -1);
  }
  return normalized;
}

export function parseEnvFile(source) {
  const parsed = {};
  const lines = String(source || "").split(/\r?\n/);

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const match = trimmed.match(/^([A-Z0-9_]+)\s*=\s*(.*)$/);
    if (!match) continue;

    const [, name, rawValue] = match;
    parsed[name] = stripWrappingQuotes(rawValue);
  }

  return parsed;
}

export function loadLocalEnvFiles({ env = process.env, files = DEFAULT_ENV_FILES } = {}) {
  const target = env && typeof env === "object" ? env : process.env;
  const protectedNames = new Set(
    Object.entries(target)
      .filter(([, value]) => typeof value !== "undefined" && String(value || "").trim() !== "")
      .map(([name]) => name)
  );
  const loadedFiles = [];

  for (const filePath of files) {
    if (!fs.existsSync(filePath)) continue;

    const parsed = parseEnvFile(fs.readFileSync(filePath, "utf8"));
    for (const [name, value] of Object.entries(parsed)) {
      if (protectedNames.has(name)) continue;
      target[name] = value;
    }

    loadedFiles.push(filePath);
  }

  return loadedFiles;
}
