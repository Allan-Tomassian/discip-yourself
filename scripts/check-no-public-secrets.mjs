import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const FILES_TO_SCAN = [
  ".env.example",
  ".env",
  ".env.local",
  ".env.local.example",
  ".env.staging.example",
  ".env.production.example",
  "backend/.env.example",
];

const FORBIDDEN_VITE_NAME_PATTERNS = [
  /^VITE_OPENAI_/i,
  /^VITE_.*OPENAI/i,
  /^VITE_.*SERVICE_ROLE/i,
  /^VITE_.*SECRET/i,
  /^VITE_.*PRIVATE(_KEY)?/i,
];
const LEGACY_PUBLIC_ENV_NAMES = new Set([
  "VITE_SUPABASE_ANON_KEY",
  "E2E_SUPABASE_ANON_KEY",
]);

const violations = [];

for (const relPath of FILES_TO_SCAN) {
  const absPath = path.join(ROOT, relPath);
  if (!fs.existsSync(absPath)) continue;
  const source = fs.readFileSync(absPath, "utf8");
  const lines = source.split(/\r?\n/);

  lines.forEach((line, index) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) return;
    const match = trimmed.match(/^([A-Z0-9_]+)\s*=\s*(.*)$/);
    if (!match) return;
    const [, name, rawValue] = match;
    if (LEGACY_PUBLIC_ENV_NAMES.has(name)) {
      violations.push({
        file: relPath,
        line: index + 1,
        name,
        reason: "legacy-public-name",
      });
      return;
    }
    if (!name.startsWith("VITE_")) return;

    const value = String(rawValue || "").trim();
    const hasForbiddenName = FORBIDDEN_VITE_NAME_PATTERNS.some((pattern) => pattern.test(name));
    const looksLikeServerSecret =
      /service_role/i.test(value) ||
      /(^|[^A-Z])sk-[A-Za-z0-9]/i.test(value) ||
      /^sb_secret_/i.test(value);

    if (hasForbiddenName || looksLikeServerSecret) {
      violations.push({
        file: relPath,
        line: index + 1,
        name,
        reason: hasForbiddenName ? "forbidden-public-name" : "server-secret-value",
      });
    }
  });
}

if (violations.length) {
  console.error("Forbidden public env variables detected:");
  for (const violation of violations) {
    console.error(`- ${violation.file}:${violation.line} -> ${violation.name} (${violation.reason})`);
  }
  process.exit(1);
}

console.log("Public env audit passed.");
