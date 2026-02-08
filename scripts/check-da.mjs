import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();

const TARGETS = [
  "src/components/CategoryGateModal.jsx",
  "src/ui/create/CreateFlowModal.jsx",
];

const CREATE_V2_RE = /^src\/pages\/CreateV2[^/]*\.jsx$/;

const CHECKS = [
  {
    id: "legacy-card-import",
    message: "Import legacy interdit: `Card` depuis `.../UI`.",
    regex: /import\s*{[\s\S]*?\bCard\b[\s\S]*?}\s*from\s*["'][^"']*UI["']/g,
  },
  {
    id: "legacy-create-section-import",
    message: "Import legacy interdit: `CreateSection`.",
    regex: /import\s+CreateSection\s+from\s*["'][^"']*CreateSection["']/g,
  },
  {
    id: "legacy-accent-border-wrapper",
    message: "Wrapper legacy interdit: usage `accentBorder`.",
    regex: /\baccentBorder\b/g,
  },
];

function walkFiles(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...walkFiles(fullPath));
    } else if (entry.isFile()) {
      files.push(fullPath);
    }
  }
  return files;
}

function toRelPosix(filePath) {
  return path.relative(ROOT, filePath).split(path.sep).join("/");
}

function isTargetFile(relPath) {
  return TARGETS.includes(relPath) || CREATE_V2_RE.test(relPath);
}

function lineFromIndex(content, index) {
  return content.slice(0, index).split("\n").length;
}

const allFiles = walkFiles(path.join(ROOT, "src"));
const targetFiles = allFiles.map(toRelPosix).filter(isTargetFile).sort();

if (!targetFiles.length) {
  console.log("[check:da] Aucun fichier ciblé trouvé.");
  process.exit(0);
}

const violations = [];

for (const relPath of targetFiles) {
  const absPath = path.join(ROOT, relPath);
  const content = fs.readFileSync(absPath, "utf8");
  for (const check of CHECKS) {
    check.regex.lastIndex = 0;
    let match = null;
    while ((match = check.regex.exec(content)) !== null) {
      const line = lineFromIndex(content, match.index);
      const firstLine = (match[0] || "").split("\n")[0].trim();
      violations.push({
        file: relPath,
        line,
        id: check.id,
        message: check.message,
        snippet: firstLine,
      });
    }
  }
}

if (violations.length) {
  console.error(
    `[check:da] ${violations.length} violation(s) DA détectée(s) dans les écrans Create (Gate/FlowShell only).`
  );
  for (const violation of violations) {
    console.error(
      `- ${violation.file}:${violation.line} [${violation.id}] ${violation.message}\n  ${violation.snippet}`
    );
  }
  process.exit(1);
}

console.log(
  `[check:da] OK (${targetFiles.length} fichiers): aucune importation/usage legacy interdit dans le flow Create.`
);
