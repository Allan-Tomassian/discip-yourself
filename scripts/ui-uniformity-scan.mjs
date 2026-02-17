#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const SRC_DIR = path.join(ROOT, "src");
const DOCS_DIR = path.join(ROOT, "docs");
const OUT_FILE = path.join(DOCS_DIR, "ui-uniformity-map.json");
const EXTENSIONS = new Set([".js", ".jsx", ".ts", ".tsx", ".css"]);

const GATE_COMPONENTS = new Set(["GatePanel", "GateSection", "GateRow", "GateCard", "GateHeader", "GateFooter", "GateButton"]);
const LEGACY_COMPONENTS = new Set(["Card", "Button", "Input", "Textarea", "SelectMenu", "IconButton", "Modal"]);
const PREMIUM_CLASSES = new Set(["GateSurfacePremium", "GateCardPremium", "GateRowPremium", "GateGlassOuter", "GateGlassClip", "GateGlassBackdrop", "GateGlassContent"]);

function toPosix(value) {
  return value.split(path.sep).join("/");
}

function rel(absPath) {
  return toPosix(path.relative(ROOT, absPath));
}

function lineAt(text, index) {
  return text.slice(0, index).split("\n").length;
}

function uniq(values) {
  return Array.from(new Set(values));
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

function takeSnippet(lines, line) {
  return String(lines[line - 1] || "").trim().slice(0, 220);
}

function extractClassTokens(text) {
  const out = [];
  const patterns = [
    /className\s*=\s*"([^"]+)"/g,
    /className\s*=\s*'([^']+)'/g,
    /className\s*=\s*\{`([^`]+)`\}/g,
    /className\s*=\s*\{"([^"]+)"\}/g,
    /class\s*=\s*"([^"]+)"/g,
  ];

  for (const re of patterns) {
    for (const match of text.matchAll(re)) {
      const line = lineAt(text, match.index ?? 0);
      const normalized = match[1].replace(/\$\{[^}]+\}/g, " ").replace(/\s+/g, " ").trim();
      if (!normalized) continue;
      for (const token of normalized.split(" ")) {
        const clean = token.replace(/[^A-Za-z0-9_-]/g, "");
        if (clean) out.push({ token: clean, line });
      }
    }
  }

  return out;
}

function scanJsLike(text, file) {
  const lines = text.split("\n");
  const occurrences = [];
  let gatePremiumCount = 0;
  let legacyCount = 0;

  for (const match of text.matchAll(/import\s+[\s\S]*?from\s+["']([^"']+)["']/g)) {
    const spec = match[1];
    const line = lineAt(text, match.index ?? 0);
    if (spec.includes("/components/UI") || spec === "./UI" || spec === "../UI" || spec.endsWith("/UI")) {
      legacyCount += 1;
      occurrences.push({ type: "legacy-import", line, snippet: takeSnippet(lines, line) });
    }
    if (spec.includes("LiquidGlassSurface") || spec.includes("liquidGlassSurface")) {
      legacyCount += 1;
      occurrences.push({ type: "liquid-import", line, snippet: takeSnippet(lines, line) });
    }
  }

  for (const match of text.matchAll(/<([A-Z][A-Za-z0-9_]*)\b/g)) {
    const tag = match[1];
    const line = lineAt(text, match.index ?? 0);
    if (GATE_COMPONENTS.has(tag)) {
      gatePremiumCount += 1;
      occurrences.push({ type: "gate-component", line, snippet: takeSnippet(lines, line) });
    }
    if (LEGACY_COMPONENTS.has(tag)) {
      legacyCount += 1;
      occurrences.push({ type: "legacy-component", line, snippet: takeSnippet(lines, line) });
    }
    if (tag === "LiquidGlassSurface") {
      legacyCount += 1;
      occurrences.push({ type: "liquid-component", line, snippet: takeSnippet(lines, line) });
    }
  }

  const classTokens = extractClassTokens(text);
  for (const { token, line } of classTokens) {
    if (PREMIUM_CLASSES.has(token) || token.startsWith("gate") || token.startsWith("Gate")) {
      gatePremiumCount += 1;
      occurrences.push({ type: "gate-class", line, snippet: takeSnippet(lines, line) });
    }
    if (/^(glass|liquid)/i.test(token)) {
      legacyCount += 1;
      occurrences.push({ type: "legacy-class", line, snippet: takeSnippet(lines, line) });
    }
    if (token === "accentBorder" || token === "accentRail") {
      legacyCount += 1;
      occurrences.push({ type: "legacy-token", line, snippet: takeSnippet(lines, line) });
    }
  }

  for (const match of text.matchAll(/style\s*=\s*\{\{([\s\S]*?)\}\}/g)) {
    const styleBody = match[1] || "";
    const line = lineAt(text, match.index ?? 0);
    const hasBackdrop = /backdropFilter|WebkitBackdropFilter/.test(styleBody);
    const hasCardLike = /borderRadius|background|boxShadow|border\s*:/.test(styleBody);
    if (hasBackdrop) {
      legacyCount += 1;
      occurrences.push({
        type: hasCardLike ? "inline-style-cardlike" : "inline-style-backdrop",
        line,
        snippet: takeSnippet(lines, line),
      });
    }
  }

  return { occurrences, gatePremiumCount, legacyCount };
}

function scanCss(text, file) {
  const lines = text.split("\n");
  const occurrences = [];
  const overlayRisks = [];
  let gatePremiumCount = 0;
  let legacyCount = 0;

  const blockRe = /([^{}]+)\{([^{}]*)\}/g;
  for (const match of text.matchAll(blockRe)) {
    const selector = String(match[1] || "").trim();
    const body = String(match[2] || "");
    const line = lineAt(text, match.index ?? 0);

    const hasBackdrop = /backdrop-filter\s*:|-webkit-backdrop-filter\s*:/.test(body);
    const hasRadius = /border-radius\s*:/.test(body);
    const hasBackground = /background\s*:/.test(body);
    const hasBorder = /border\s*:/.test(body);
    const hasOverflowClip = /overflow\s*:\s*hidden/.test(body) || /clip/.test(selector);

    if (/\.Gate(SurfacePremium|CardPremium|RowPremium|GlassOuter|GlassClip|GlassBackdrop|GlassContent)/.test(selector)) {
      gatePremiumCount += 1;
      occurrences.push({ type: "gate-css-selector", line, snippet: takeSnippet(lines, line) });
    }

    if (/\.(glass|liquid)/i.test(selector)) {
      legacyCount += 1;
      occurrences.push({ type: "legacy-css-selector", line, snippet: takeSnippet(lines, line) });
    }

    if (hasBackdrop) {
      occurrences.push({ type: "css-backdrop", line, snippet: takeSnippet(lines, line) });
      if (!(hasOverflowClip && hasRadius)) {
        overlayRisks.push({
          file,
          line,
          selector,
          reason: "backdrop-filter without clear clip pattern (overflow hidden + radius) in same block",
          snippet: takeSnippet(lines, line),
        });
      }
    }

    if (hasBackdrop && hasRadius && hasBackground && hasBorder) {
      occurrences.push({ type: "css-glass-cardlike", line, snippet: takeSnippet(lines, line) });
      if (!/GateGlass|gate/i.test(selector)) {
        legacyCount += 1;
      }
    }
  }

  return { occurrences, gatePremiumCount, legacyCount, overlayRisks };
}

function summarize(files) {
  const cardRelevantFiles = files.filter((f) => f.gatePremiumCount + f.legacyCount > 0);
  const gateOnlyFiles = cardRelevantFiles.filter((f) => f.gatePremiumCount > 0 && f.legacyCount === 0);
  const mixedFiles = cardRelevantFiles.filter((f) => f.gatePremiumCount > 0 && f.legacyCount > 0);
  const legacyOnlyFiles = cardRelevantFiles.filter((f) => f.gatePremiumCount === 0 && f.legacyCount > 0);

  const compliance = cardRelevantFiles.length
    ? Number(((gateOnlyFiles.length / cardRelevantFiles.length) * 100).toFixed(2))
    : 100;

  const occurrenceTypeCounts = {};
  for (const file of files) {
    for (const occ of file.occurrences) {
      occurrenceTypeCounts[occ.type] = (occurrenceTypeCounts[occ.type] || 0) + 1;
    }
  }

  const hotspots = [...files]
    .filter((f) => f.legacyCount > 0)
    .sort((a, b) => b.legacyCount - a.legacyCount || b.occurrences.length - a.occurrences.length || a.file.localeCompare(b.file))
    .slice(0, 30)
    .map((f) => ({ file: f.file, legacyCount: f.legacyCount, gatePremiumCount: f.gatePremiumCount, mixed: f.mixed }));

  return {
    totalFiles: files.length,
    cardRelevantFiles: cardRelevantFiles.length,
    gateOnlyFiles: gateOnlyFiles.length,
    mixedFiles: mixedFiles.length,
    legacyOnlyFiles: legacyOnlyFiles.length,
    conformityPercent: compliance,
    occurrenceTypeCounts,
    hotspots,
  };
}

async function main() {
  const absFiles = await walk(SRC_DIR);
  const files = [];
  const overlayRisks = [];

  for (const abs of absFiles) {
    const file = rel(abs);
    const text = await fs.readFile(abs, "utf8");
    const ext = path.extname(abs);

    let result;
    if (ext === ".css") result = scanCss(text, file);
    else result = scanJsLike(text, file);

    const occurrences = uniq(
      result.occurrences.map((occ) => `${occ.type}|${occ.line}|${occ.snippet}`)
    ).map((key) => {
      const [type, line, ...rest] = key.split("|");
      return { type, line: Number(line), snippet: rest.join("|") };
    }).sort((a, b) => a.line - b.line || a.type.localeCompare(b.type));

    files.push({
      file,
      gatePremiumCount: result.gatePremiumCount,
      legacyCount: result.legacyCount,
      mixed: result.gatePremiumCount > 0 && result.legacyCount > 0,
      occurrences,
    });

    if (result.overlayRisks) overlayRisks.push(...result.overlayRisks);
  }

  const map = {
    generatedAt: new Date().toISOString(),
    sourceOfTruth: {
      gatePrimitives: ["src/shared/ui/gate/Gate.jsx", "src/shared/ui/gate/gate.css", "src/shared/ui/gate/gate-premium.css"],
      allowedPatterns: [
        "GatePanel/GateSection/GateSurfacePremium/GateCardPremium",
        "GateGlassOuter + GateGlassClip + GateGlassBackdrop + GateGlassContent",
      ],
      forbiddenPatterns: [
        "imports from components/UI legacy primitives",
        "LiquidGlassSurface",
        "classes glass*/liquid*",
        "inline card recreation with backdropFilter + card styling",
      ],
    },
    files,
    overlayRisks,
    totals: summarize(files),
  };

  await fs.mkdir(DOCS_DIR, { recursive: true });
  await fs.writeFile(OUT_FILE, `${JSON.stringify(map, null, 2)}\n`, "utf8");
  console.log(`[ui-uniformity] map written: ${rel(OUT_FILE)}`);
}

main().catch((error) => {
  console.error("[ui-uniformity] scan failed", error);
  process.exitCode = 1;
});
