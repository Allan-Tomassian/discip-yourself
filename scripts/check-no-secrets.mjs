import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const SKIP_DIRS = new Set([
  ".git",
  "node_modules",
  "dist",
  "coverage",
  "test-results",
]);
const SKIP_FILES = new Set([
  "docs/text-map.json",
]);
const TEXT_EXTENSIONS = new Set([
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  ".json",
  ".md",
  ".css",
  ".html",
  ".toml",
  ".yml",
  ".yaml",
  ".env",
  ".example",
]);
const FRONTEND_SECRET_NAME_PATTERNS = [
  /\bOPENAI_API_KEY\b/,
  /\bSUPABASE_SECRET_KEY\b/,
  /\bSUPABASE_SERVICE_ROLE_KEY\b/,
  /\bVITE_OPENAI_[A-Z0-9_]*\b/,
  /\bVITE_.*SERVICE_ROLE[A-Z0-9_]*\b/,
  /\bVITE_.*SECRET[A-Z0-9_]*\b/,
];
const ENV_VALUE_NAMES = new Set([
  "OPENAI_API_KEY",
  "SUPABASE_URL",
  "SUPABASE_PUBLISHABLE_KEY",
  "SUPABASE_SECRET_KEY",
  "VITE_SUPABASE_URL",
  "VITE_SUPABASE_PUBLISHABLE_KEY",
]);

function walk(dir, output = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name === "." || entry.name === "..") continue;
    const abs = path.join(dir, entry.name);
    const rel = path.relative(ROOT, abs);
    if (SKIP_FILES.has(rel)) continue;
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      walk(abs, output);
      continue;
    }
    output.push({ abs, rel });
  }
  return output;
}

function looksLikeTextFile(relPath) {
  if (path.basename(relPath).startsWith(".env")) return true;
  return TEXT_EXTENSIONS.has(path.extname(relPath));
}

function isPlaceholderValue(value) {
  const normalized = String(value || "").trim();
  if (!normalized) return true;
  const lower = normalized.toLowerCase();
  return (
    normalized === "\\" ||
    lower.includes("<") ||
    lower.includes(">") ||
    lower.startsWith("your-") ||
    lower.startsWith("example") ||
    lower.includes("example-project-ref") ||
    lower.includes("placeholder") ||
    lower.includes("replace") ||
    lower.includes("test") ||
    lower.includes("e2e") ||
    lower === "http://127.0.0.1:3001" ||
    lower === "http://localhost:3001"
  );
}

function scanFrontendSecretNames(relPath, source, violations) {
  if (!relPath.startsWith("src/")) return;
  const lines = source.split(/\r?\n/);
  lines.forEach((line, index) => {
    for (const pattern of FRONTEND_SECRET_NAME_PATTERNS) {
      if (pattern.test(line)) {
        violations.push({
          kind: "frontend-secret-read",
          file: relPath,
          line: index + 1,
          detail: line.trim(),
        });
      }
    }
  });
}

function scanEnvAssignments(relPath, source, violations) {
  const lines = source.split(/\r?\n/);
  lines.forEach((line, index) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) return;
    const match = trimmed.match(/^([A-Z0-9_]+)\s*=\s*(.*)$/);
    if (!match) return;
    const [, name, rawValue] = match;
    if (!ENV_VALUE_NAMES.has(name)) return;
    const value = String(rawValue || "").trim().replace(/^['"]|['"]$/g, "");
    if (!isPlaceholderValue(value)) {
      violations.push({
        kind: "committed-env-value",
        file: relPath,
        line: index + 1,
        detail: `${name}=***`,
      });
    }
  });
}

function scanLiteralKeys(relPath, source, violations) {
  const lines = source.split(/\r?\n/);
  lines.forEach((line, index) => {
    const trimmed = line.trim();
    if (/\bsk-(proj-|live-|test-)?[A-Za-z0-9_-]{20,}\b/.test(trimmed)) {
      violations.push({
        kind: "openai-key-literal",
        file: relPath,
        line: index + 1,
        detail: trimmed,
      });
    }
    if (/\bsb_secret_[A-Za-z0-9._-]{20,}\b/.test(trimmed)) {
      violations.push({
        kind: "supabase-secret-literal",
        file: relPath,
        line: index + 1,
        detail: trimmed,
      });
    }
    if (/\bsb_publishable_[A-Za-z0-9._-]{20,}\b/.test(trimmed) && !/e2e|test|example|placeholder/i.test(trimmed)) {
      violations.push({
        kind: "supabase-publishable-literal",
        file: relPath,
        line: index + 1,
        detail: trimmed,
      });
    }
  });
}

const violations = [];
for (const file of walk(ROOT)) {
  if (!looksLikeTextFile(file.rel)) continue;
  const source = fs.readFileSync(file.abs, "utf8");
  scanFrontendSecretNames(file.rel, source, violations);
  scanEnvAssignments(file.rel, source, violations);
  scanLiteralKeys(file.rel, source, violations);
}

if (violations.length) {
  console.error("Secret hygiene check failed:");
  for (const violation of violations) {
    console.error(`- ${violation.kind}: ${violation.file}:${violation.line} -> ${violation.detail}`);
  }
  process.exit(1);
}

console.log("Secret hygiene check passed.");
