import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();

const GUARDED_EXPLICIT = [
  "src/components/CategoryGateModal.jsx",
  "src/components/PaywallModal.jsx",
  "src/ui/create/CreateFlowModal.jsx",
  "src/ui/create/FlowShell.jsx",
  "src/ui/create/CreateSection.jsx",
];

const GUARDED_PATTERNS = [
  /^src\/features\/.*$/,
  /^src\/pages\/CreateV2[^/]*\.jsx$/,
];

const RULES = [
  {
    id: "legacy-accent-rail",
    message: "Pattern legacy interdit: `accentRail`.",
    regex: /\baccentRail\b/g,
  },
  {
    id: "legacy-accent-border",
    message: "Pattern legacy interdit: `accentBorder`.",
    regex: /\baccentBorder\b/g,
  },
  {
    id: "legacy-card-accent-border",
    message: "Pattern legacy interdit: `<Card accentBorder ...>`.",
    regex: /<Card\b[^>]*\baccentBorder\b/g,
  },
  {
    id: "legacy-create-section-import",
    message: "Import legacy interdit: `CreateSection`.",
    regex: /import\s+CreateSection\s+from\s*["'][^"']*CreateSection["']/g,
  },
  {
    id: "inline-style-massive",
    message: "Inline style interdit dans ce scope (utiliser CSS scoppé).",
    regex: /\bstyle=\{\{/g,
    allow: ({ lineText }) =>
      /background:\s*(cat\.color|categoryColor)/.test(lineText) ||
      /--catColor/.test(lineText),
  },
];

function walkFiles(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...walkFiles(fullPath));
    else if (entry.isFile()) files.push(fullPath);
  }
  return files;
}

function toRelPosix(filePath) {
  return path.relative(ROOT, filePath).split(path.sep).join("/");
}

function lineFromIndex(content, index) {
  return content.slice(0, index).split("\n").length;
}

function lineTextAt(content, lineNumber) {
  const lines = content.split("\n");
  return lines[lineNumber - 1] || "";
}

function isGuardedFile(relPath) {
  if (GUARDED_EXPLICIT.includes(relPath)) return true;
  return GUARDED_PATTERNS.some((re) => re.test(relPath));
}

const srcDir = path.join(ROOT, "src");
const allFiles = walkFiles(srcDir).map(toRelPosix);
const guardedFiles = allFiles.filter(isGuardedFile).sort();

if (!guardedFiles.length) {
  console.log("[check:da] Aucun fichier ciblé.");
  process.exit(0);
}

const violations = [];

for (const relPath of guardedFiles) {
  const absPath = path.join(ROOT, relPath);
  const content = fs.readFileSync(absPath, "utf8");

  for (const rule of RULES) {
    rule.regex.lastIndex = 0;
    let match = null;
    while ((match = rule.regex.exec(content)) !== null) {
      const line = lineFromIndex(content, match.index);
      const lineText = lineTextAt(content, line).trim();
      if (typeof rule.allow === "function" && rule.allow({ relPath, line, lineText, match: match[0] })) {
        continue;
      }
      violations.push({
        file: relPath,
        line,
        id: rule.id,
        message: rule.message,
        snippet: lineText,
      });
    }
  }
}

if (violations.length) {
  console.error(`[check:da] ${violations.length} violation(s) DA détectée(s).`);
  for (const violation of violations) {
    console.error(
      `- ${violation.file}:${violation.line} [${violation.id}] ${violation.message}\n  ${violation.snippet}`
    );
  }
  process.exit(1);
}

console.log(`[check:da] OK (${guardedFiles.length} fichiers): aucune dérive DA détectée.`);
