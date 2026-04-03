#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const SRC_DIR = path.join(ROOT, "src");
const EXTENSIONS = new Set([".js", ".jsx", ".ts", ".tsx", ".css"]);

const ALLOWED_CLASS_PATTERNS = [];

function toPosix(value) {
  return value.split(path.sep).join("/");
}

function relFromRoot(absPath) {
  return toPosix(path.relative(ROOT, absPath));
}

async function walk(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const out = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === ".git" || entry.name === "dist") continue;
      out.push(...(await walk(full)));
      continue;
    }
    if (!entry.isFile()) continue;
    if (!EXTENSIONS.has(path.extname(entry.name))) continue;
    out.push(full);
  }
  return out;
}

function parseArgs(argv) {
  const scopes = [];
  for (let i = 2; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === "--scope") {
      const value = argv[i + 1] || "";
      i += 1;
      value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean)
        .forEach((item) => scopes.push(normalizeScope(item)));
    } else if (token.startsWith("--scope=")) {
      token
        .slice("--scope=".length)
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean)
        .forEach((item) => scopes.push(normalizeScope(item)));
    }
  }
  return { scopes };
}

function normalizeScope(value) {
  const posix = toPosix(value).replace(/^\.\//, "").replace(/\/$/, "");
  return posix;
}

function inScope(relPath, scopes) {
  if (!scopes.length) return true;
  return scopes.some((scope) => relPath === scope || relPath.startsWith(`${scope}/`));
}

function lineAt(text, index) {
  const slice = text.slice(0, index);
  return slice.split("\n").length;
}

function formatIssue(issue) {
  return `- [${issue.type}] ${issue.file}:${issue.line} ${issue.rule}: ${issue.detail}`;
}

function extractClassNamesWithLine(text) {
  const out = [];
  const patterns = [
    /className\s*=\s*"([^"]+)"/g,
    /className\s*=\s*'([^']+)'/g,
    /className\s*=\s*\{`([^`]+)`\}/g,
    /className\s*=\s*\{"([^"]+)"\}/g,
  ];

  for (const re of patterns) {
    for (const match of text.matchAll(re)) {
      const idx = match.index ?? 0;
      const line = lineAt(text, idx);
      const normalized = match[1].replace(/\$\{[^}]+\}/g, " ").replace(/\s+/g, " ").trim();
      if (!normalized) continue;
      for (const token of normalized.split(" ")) {
        const clean = token.replace(/[^A-Za-z0-9_-]/g, "");
        if (clean) out.push({ className: clean, line });
      }
    }
  }
  return out;
}

function isLegacyImport(specifier) {
  return (
    specifier.includes("/components/UI") ||
    specifier === "./UI" ||
    specifier === "../UI" ||
    specifier.endsWith("/UI")
  );
}

function isAllowedClassUsage(relPath) {
  return ALLOWED_CLASS_PATTERNS.some((pattern) => pattern.test(relPath));
}

function collectImportViolations(text, relPath) {
  const out = [];
  const importRe = /import\s+[\s\S]*?\sfrom\s+["']([^"']+)["']/g;
  for (const match of text.matchAll(importRe)) {
    const specifier = match[1];
    const idx = match.index ?? 0;
    const line = lineAt(text, idx);
    if (isLegacyImport(specifier)) {
      out.push({
        type: "legacy-import",
        rule: "no-components-ui-import",
        file: relPath,
        line,
        detail: `forbidden import: ${specifier}`,
      });
    }
    if (specifier.includes("LiquidGlassSurface") || specifier.includes("liquidGlassSurface")) {
      out.push({
        type: "liquid-import",
        rule: "no-liquid-import",
        file: relPath,
        line,
        detail: `forbidden import: ${specifier}`,
      });
    }
  }
  return out;
}

function collectTokenViolations(text, relPath) {
  const out = [];

  for (const match of text.matchAll(/<LiquidGlassSurface\b/g)) {
    const idx = match.index ?? 0;
    out.push({
      type: "liquid-component",
      rule: "no-liquid-component",
      file: relPath,
      line: lineAt(text, idx),
      detail: "forbidden component usage: <LiquidGlassSurface>",
    });
  }

  if (!isAllowedClassUsage(relPath)) {
    const classTokens = extractClassNamesWithLine(text);
    for (const token of classTokens) {
      if (/^(glass|liquid)/i.test(token.className)) {
        out.push({
          type: "legacy-class",
          rule: "no-glass-liquid-class",
          file: relPath,
          line: token.line,
          detail: `forbidden class token: ${token.className}`,
        });
      }
    }
  }

  return out;
}

async function main() {
  const { scopes } = parseArgs(process.argv);
  const files = await walk(SRC_DIR);
  const scopedFiles = files
    .map((absPath) => ({ absPath, relPath: relFromRoot(absPath) }))
    .filter((entry) => inScope(entry.relPath, scopes));

  if (scopes.length && scopedFiles.length === 0) {
    console.error(`[ui:check] no files matched scope: ${scopes.join(", ")}`);
    process.exitCode = 1;
    return;
  }

  const violations = [];

  for (const entry of scopedFiles) {
    const text = await fs.readFile(entry.absPath, "utf8");
    violations.push(...collectImportViolations(text, entry.relPath));
    violations.push(...collectTokenViolations(text, entry.relPath));
  }

  if (violations.length > 0) {
    console.error("[ui:check] Legacy UI violations found:");
    for (const issue of violations) {
      console.error(formatIssue(issue));
    }
    process.exitCode = 1;
    return;
  }

  const scopeLabel = scopes.length ? ` (scope: ${scopes.join(", ")})` : "";
  console.log(`[ui:check] OK${scopeLabel} - no forbidden legacy UI usage detected.`);
}

main().catch((error) => {
  console.error("[ui:check] failed", error);
  process.exitCode = 1;
});
