#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const SRC_DIR = path.join(ROOT, "src");
const DOCS_DIR = path.join(ROOT, "docs");
const OUT_FILE = path.join(DOCS_DIR, "text-map.json");
const EXTENSIONS = new Set([".js", ".jsx", ".ts", ".tsx", ".json"]);

function rel(absPath) {
  return path.relative(ROOT, absPath).split(path.sep).join("/");
}

function lineAt(text, index) {
  return text.slice(0, index).split("\n").length;
}

function snippet(lines, line) {
  return String(lines[line - 1] || "").trim().slice(0, 220);
}

function normalizeText(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\s\-_]+/g, " ")
    .replace(/[^\p{L}\p{N} ]/gu, "")
    .trim();
}

function looksLikeTechnicalValue(value) {
  const trimmed = value.trim();
  if (!trimmed) return true;
  if (/^(https?:\/\/|\/|\.|#|[A-Za-z]:\\)/.test(trimmed)) return true;
  if (/^[A-Z0-9_\-.]+$/.test(trimmed) && !/[a-zà-ÿ]/i.test(trimmed)) return true;
  if (/^([a-z0-9_-]+\/)+[a-z0-9_.-]+$/i.test(trimmed)) return true;
  return false;
}

function cleanText(value) {
  return String(value || "")
    .replace(/\\n/g, " ")
    .replace(/\\t/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function keepText(value, context) {
  const text = cleanText(value);
  if (!text) return false;
  if (text.length > 260) return false;
  if (looksLikeTechnicalValue(text) && context !== "aria-label") return false;

  if (context === "jsx-text") {
    return /[A-Za-zÀ-ÿ]/.test(text) && text.length >= 2;
  }

  if (context === "string-literal") {
    if (!/[A-Za-zÀ-ÿ]/.test(text)) return false;
    if (text.length < 3) return false;
  }

  return true;
}

async function walk(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const out = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (["node_modules", ".git", "dist"].includes(entry.name)) continue;
      out.push(...(await walk(full)));
      continue;
    }
    if (!entry.isFile()) continue;
    if (!EXTENSIONS.has(path.extname(entry.name))) continue;
    out.push(full);
  }
  return out;
}

function pushEntry(entries, dedupeSet, payload) {
  const key = `${payload.file}|${payload.line}|${payload.context}|${payload.text}`;
  if (dedupeSet.has(key)) return;
  dedupeSet.add(key);
  entries.push(payload);
}

function contextFromLine(line) {
  const lower = line.toLowerCase();
  if (/toast|notify|snackbar/.test(lower)) return "toast";
  if (/error|throw|seterror|onerror/.test(lower)) return "error";
  if (/success|setstatus|status/.test(lower)) return "status";
  if (/placeholder/.test(lower)) return "placeholder";
  if (/aria-label|arialabel/.test(lower)) return "aria-label";
  if (/title|subtitle|heading/.test(lower)) return "title";
  if (/label/.test(lower)) return "label";
  if (/empty|aucun|vide/.test(lower)) return "emptyState";
  if (/menu|item/.test(lower)) return "menuItem";
  if (/button|cta|onClick/.test(lower)) return "button";
  return "string-literal";
}

function extractFromFile(file, text) {
  const entries = [];
  const dedupeSet = new Set();
  const lines = text.split("\n");

  const propPatterns = [
    { regex: /(title|subtitle|label|placeholder|helperText|description|caption|text|aria-label|ariaLabel|alt)\s*=\s*"([^"]+)"/g, quote: '"' },
    { regex: /(title|subtitle|label|placeholder|helperText|description|caption|text|aria-label|ariaLabel|alt)\s*=\s*'([^']+)'/g, quote: "'" },
  ];

  for (const { regex } of propPatterns) {
    for (const match of text.matchAll(regex)) {
      const key = match[1];
      const value = cleanText(match[2]);
      const line = lineAt(text, match.index ?? 0);
      const context = key === "ariaLabel" ? "aria-label" : key;
      if (!keepText(value, context)) continue;
      pushEntry(entries, dedupeSet, {
        text: value,
        file,
        line,
        context,
        keyHint: key,
        snippet: snippet(lines, line),
      });
    }
  }

  for (const match of text.matchAll(/\b(title|subtitle|label|name|description|message|placeholder|helperText|cta|buttonLabel)\s*:\s*(["'`])([\s\S]*?)\2/g)) {
    const key = match[1];
    const value = cleanText(match[3]);
    const line = lineAt(text, match.index ?? 0);
    const context = key === "message" ? "status" : key;
    if (!keepText(value, context)) continue;
    pushEntry(entries, dedupeSet, {
      text: value,
      file,
      line,
      context,
      keyHint: key,
      snippet: snippet(lines, line),
    });
  }

  for (const match of text.matchAll(/>([^<>{}\n][^<>{}]*)</g)) {
    const value = cleanText(match[1]);
    const line = lineAt(text, match.index ?? 0);
    if (!keepText(value, "jsx-text")) continue;
    pushEntry(entries, dedupeSet, {
      text: value,
      file,
      line,
      context: "jsx-text",
      keyHint: null,
      snippet: snippet(lines, line),
    });
  }

  for (const match of text.matchAll(/(["'`])((?:\\.|(?!\1).)*)\1/g)) {
    const value = cleanText(match[2]);
    const line = lineAt(text, match.index ?? 0);
    const sourceLine = snippet(lines, line);

    if (/^\s*import\s/.test(sourceLine) || /^\s*export\s/.test(sourceLine)) continue;
    if (!keepText(value, "string-literal")) continue;

    const context = contextFromLine(sourceLine);
    pushEntry(entries, dedupeSet, {
      text: value,
      file,
      line,
      context,
      keyHint: null,
      snippet: sourceLine,
    });
  }

  return entries;
}

function buildVariants(entries) {
  const groups = new Map();
  for (const entry of entries) {
    const norm = normalizeText(entry.text);
    if (!norm || norm.length < 2) continue;
    if (!groups.has(norm)) {
      groups.set(norm, {
        normalized: norm,
        variants: new Map(),
        occurrences: 0,
        contexts: new Map(),
      });
    }

    const group = groups.get(norm);
    group.occurrences += 1;
    group.variants.set(entry.text, (group.variants.get(entry.text) || 0) + 1);
    group.contexts.set(entry.context, (group.contexts.get(entry.context) || 0) + 1);
  }

  return [...groups.values()]
    .map((group) => ({
      normalized: group.normalized,
      variants: [...group.variants.entries()]
        .map(([text, count]) => ({ text, count }))
        .sort((a, b) => b.count - a.count || a.text.localeCompare(b.text)),
      occurrences: group.occurrences,
      contexts: [...group.contexts.entries()]
        .map(([context, count]) => ({ context, count }))
        .sort((a, b) => b.count - a.count || a.context.localeCompare(b.context)),
    }))
    .sort((a, b) => b.occurrences - a.occurrences || a.normalized.localeCompare(b.normalized));
}

function computeStats(entries, variants) {
  const byContext = new Map();
  const byFile = new Map();

  for (const entry of entries) {
    byContext.set(entry.context, (byContext.get(entry.context) || 0) + 1);
    byFile.set(entry.file, (byFile.get(entry.file) || 0) + 1);
  }

  const filesHotspots = [...byFile.entries()]
    .map(([file, count]) => ({ file, count }))
    .sort((a, b) => b.count - a.count || a.file.localeCompare(b.file))
    .slice(0, 30);

  const nearDuplicates = variants
    .filter((item) => item.variants.length > 1)
    .slice(0, 200)
    .map((item) => ({
      normalized: item.normalized,
      occurrences: item.occurrences,
      variants: item.variants,
    }));

  return {
    totalEntries: entries.length,
    uniqueTexts: new Set(entries.map((entry) => entry.text)).size,
    normalizedGroups: variants.length,
    byContext: [...byContext.entries()]
      .map(([context, count]) => ({ context, count }))
      .sort((a, b) => b.count - a.count || a.context.localeCompare(b.context)),
    hotspots: filesHotspots,
    nearDuplicates,
  };
}

async function main() {
  const absFiles = await walk(SRC_DIR);
  const entries = [];

  for (const abs of absFiles) {
    const file = rel(abs);
    const text = await fs.readFile(abs, "utf8");
    entries.push(...extractFromFile(file, text));
  }

  entries.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line || a.text.localeCompare(b.text));
  const variants = buildVariants(entries);
  const stats = computeStats(entries, variants);

  const map = {
    generatedAt: new Date().toISOString(),
    source: "src/**/*.{js,jsx,ts,tsx,json}",
    entries,
    variants,
    stats,
  };

  await fs.mkdir(DOCS_DIR, { recursive: true });
  await fs.writeFile(OUT_FILE, `${JSON.stringify(map, null, 2)}\n`, "utf8");
  console.log(`[text-audit] map written: ${rel(OUT_FILE)}`);
}

main().catch((error) => {
  console.error("[text-audit] scan failed", error);
  process.exitCode = 1;
});
