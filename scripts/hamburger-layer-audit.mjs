#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const SRC_DIR = path.join(ROOT, "src");
const DOCS_DIR = path.join(ROOT, "docs");
const OUT_FILE = path.join(DOCS_DIR, "hamburger-layer-map.json");
const EXTENSIONS = new Set([".js", ".jsx", ".ts", ".tsx", ".css"]);
const INTEREST = [
  "TopNav",
  "TopMenuPopover",
  "topMenu",
  "navMenu",
  "hamburger",
  "GateGlass",
  "scrim",
  "popover",
  "stickyStack",
  "navTop",
];

function rel(absPath) {
  return path.relative(ROOT, absPath).split(path.sep).join("/");
}

function lineAt(text, index) {
  return text.slice(0, index).split("\n").length;
}

function snippet(lines, line) {
  return String(lines[line - 1] || "").trim().slice(0, 240);
}

function uniqBy(items, keyFn) {
  const seen = new Set();
  const out = [];
  for (const item of items) {
    const key = keyFn(item);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
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

function shouldIndexFile(fileRel, text) {
  if (fileRel.includes("TopNav") || fileRel.includes("TopMenuPopover") || fileRel.includes("topMenuGate")) {
    return true;
  }
  return INTEREST.some((token) => text.includes(token));
}

function scanJsFile(file, text) {
  const lines = text.split("\n");
  const findings = [];

  const lineMatchers = [
    /menuOpen|setMenuOpen|onMenuNavigate|TopMenuPopover|menuRef|menuButtonRef|getBoundingClientRect|visualViewport|safe-top|safe-bottom|createPortal|history\.pushState|setTab\(/,
    /className=.*(topMenu|navMenu|TopNav|GateGlass|scrim|popover)/,
    /style\s*=\s*\{\{/,
    /zIndex\s*:/,
    /position\s*:/,
    /transform\s*:/,
    /overflow\s*:/,
    /opacity\s*:/,
    /visibility\s*:/,
  ];

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (lineMatchers.some((re) => re.test(line))) {
      findings.push({
        file,
        line: i + 1,
        type: "js-line",
        snippet: snippet(lines, i + 1),
      });
    }
  }

  const styleBlockRe = /style\s*=\s*\{\{([\s\S]*?)\}\}/g;
  for (const match of text.matchAll(styleBlockRe)) {
    const body = String(match[1] || "");
    const baseLine = lineAt(text, match.index ?? 0);
    const props = [...body.matchAll(/([A-Za-z_-]+)\s*:\s*([^,\n}]+)/g)].map((m) => ({
      prop: m[1],
      value: String(m[2] || "").trim(),
      line: baseLine + lineAt(body, m.index ?? 0) - 1,
    }));

    const interestingProps = props.filter((p) => /zIndex|position|top|left|width|maxHeight|transform|overflow|opacity|visibility|filter|backdrop/i.test(p.prop));
    for (const prop of interestingProps) {
      findings.push({
        file,
        line: prop.line,
        type: "inline-style-prop",
        prop: prop.prop,
        value: prop.value,
        snippet: snippet(lines, prop.line),
      });
    }
  }

  const layoutSignals = [
    /const\s+\[menuLayout,\s*setMenuLayout\]/,
    /const\s+computeMenuLayout\s*=\s*useCallback/,
    /const\s+maxWidth\s*=\s*Math\.min\(560,\s*Math\.max\(260,\s*vw\s*-\s*24\)\)/,
    /const\s+left\s*=\s*clamp\(desiredLeft,\s*minLeft,\s*maxLeft\)/,
    /const\s+top\s*=\s*Math\.max\(desiredTop,\s*12\s*\+\s*safeTop\)/,
  ];

  for (const re of layoutSignals) {
    const m = text.match(re);
    if (m) {
      const index = text.indexOf(m[0]);
      const ln = lineAt(text, index);
      findings.push({ file, line: ln, type: "layout-signal", snippet: snippet(lines, ln) });
    }
  }

  return findings;
}

function scanCssFile(file, text) {
  const lines = text.split("\n");
  const findings = [];
  const contexts = [];

  const blockRe = /([^{}]+)\{([^{}]*)\}/g;
  for (const match of text.matchAll(blockRe)) {
    const selector = String(match[1] || "").trim();
    const body = String(match[2] || "");
    const baseLine = lineAt(text, match.index ?? 0);
    const props = [...body.matchAll(/([A-Za-z-]+)\s*:\s*([^;]+);/g)].map((m) => ({
      prop: m[1].trim(),
      value: m[2].trim(),
      line: baseLine + lineAt(body, m.index ?? 0) - 1,
    }));

    const isRelevantSelector = /(topMenu|TopNav|navTop|stickyStack|navWrap|GateGlass|popover|scrim|overlay)/i.test(selector);
    const hasRelevantProp = props.some((p) => /z-index|position|top|left|bottom|right|transform|filter|backdrop-filter|opacity|visibility|overflow|clip-path|mask|max-height|border-radius/i.test(p.prop));

    if (!isRelevantSelector && !hasRelevantProp) continue;

    for (const prop of props) {
      if (!/z-index|position|top|left|bottom|right|transform|filter|backdrop-filter|opacity|visibility|overflow|max-height|border-radius/i.test(prop.prop)) {
        continue;
      }
      findings.push({
        file,
        line: prop.line,
        type: "css-prop",
        selector,
        prop: prop.prop,
        value: prop.value,
        snippet: snippet(lines, prop.line),
      });
    }

    const hasPosition = props.some((p) => p.prop === "position" && p.value !== "static");
    const zIndex = props.find((p) => p.prop === "z-index");
    const hasTransform = props.some((p) => p.prop === "transform");
    const hasFilter = props.some((p) => p.prop === "filter" || p.prop === "backdrop-filter" || p.prop === "-webkit-backdrop-filter");
    const opacity = props.find((p) => p.prop === "opacity");
    const hasOverflowClip = props.some((p) => p.prop === "overflow" && /(hidden|clip)/.test(p.value));

    if ((hasPosition && zIndex) || hasTransform || hasFilter || (opacity && Number.parseFloat(opacity.value) < 1)) {
      contexts.push({
        file,
        line: baseLine,
        selector,
        reason: [
          hasPosition && zIndex ? "position+z-index" : null,
          hasTransform ? "transform" : null,
          hasFilter ? "filter/backdrop" : null,
          opacity && Number.parseFloat(opacity.value) < 1 ? "opacity<1" : null,
        ].filter(Boolean).join(", "),
        hasOverflowClip,
        snippet: snippet(lines, baseLine),
      });
    }
  }

  return { findings, contexts };
}

function findEvidence(findings, matcher) {
  return findings.filter((item) => matcher(item)).slice(0, 6);
}

async function main() {
  const files = await walk(SRC_DIR);
  const indexed = [];
  const jsFindings = [];
  const cssFindings = [];
  const stackingContexts = [];

  for (const abs of files) {
    const file = rel(abs);
    const text = await fs.readFile(abs, "utf8");
    if (!shouldIndexFile(file, text)) continue;
    indexed.push(file);

    if (/\.(css)$/.test(file)) {
      const result = scanCssFile(file, text);
      cssFindings.push(...result.findings);
      stackingContexts.push(...result.contexts);
    } else {
      jsFindings.push(...scanJsFile(file, text));
    }
  }

  const suspects = [];

  const topNavFindings = jsFindings.filter((f) => f.file.endsWith("src/components/TopNav.jsx"));
  const topCssFindings = cssFindings.filter((f) => f.file.endsWith("src/features/navigation/topMenuGate.css") || f.file.endsWith("src/index.css") || f.file.endsWith("src/shared/ui/gate/gate-premium.css"));

  const topbarZ = findEvidence(topNavFindings, (f) => /zIndex:\s*menuOpen\s*\?\s*1011\s*:\s*900/.test(f.snippet));
  const popoverZ = findEvidence(topNavFindings, (f) => /zIndex:\s*1010/.test(f.snippet));
  if (topbarZ.length && popoverZ.length) {
    suspects.push({
      id: "topbar-over-popover",
      severity: "high",
      title: "Topbar z-index au-dessus du popover",
      why: "Quand le menu est ouvert, la topbar passe à 1011 alors que le popover est à 1010. Cela peut masquer ou recouvrir la card du menu.",
      evidence: [...topbarZ, ...popoverZ].slice(0, 8),
    });
  }

  const gateGlassClipOverflow = topCssFindings.filter(
    (f) => (f.selector || "").includes(".GateGlassClip")
      && f.prop === "overflow"
      && /(hidden|clip)/.test(String(f.value || ""))
  );
  const gateGlassClipTransform = topCssFindings.filter(
    (f) => (f.selector || "").includes(".GateGlassClip")
      && f.prop === "transform"
      && /(translateZ|matrix|scale|translate|rotate)/.test(String(f.value || ""))
  );

  const fixedInsideClipEvidence = [
    ...findEvidence(topNavFindings, (f) => /className="TopNavSurfaceClip TopNavBackdrop GateGlassClip GateGlassBackdrop"/.test(f.snippet)),
    ...findEvidence(topNavFindings, (f) => /className="topMenuPopoverLayer"/.test(f.snippet)),
    ...gateGlassClipOverflow,
    ...gateGlassClipTransform,
  ];

  if (fixedInsideClipEvidence.length >= 3) {
    suspects.push({
      id: "fixed-inside-transformed-clip",
      severity: "critical",
      title: "Popover fixed potentiellement contraint par un ancêtre clip/transformed",
      why: "Le menu est rendu dans un arbre contenant `GateGlassClip` (`overflow:hidden` + `transform`). Sur Safari/iOS cela peut créer un containing block et clipper/masquer un descendant `position: fixed`.",
      evidence: fixedInsideClipEvidence.slice(0, 10),
    });
  }

  const clampEvidence = topNavFindings.filter(
    (f) => f.file.endsWith("src/components/TopNav.jsx")
      && (f.type === "layout-signal" || f.type === "js-line")
      && /maxWidth|minLeft|maxLeft|clamp\(desiredLeft|safeTop|safeBottom/.test(f.snippet)
  ).slice(0, 8);
  if (clampEvidence.length >= 2) {
    suspects.push({
      id: "layout-clamp-edge-case",
      severity: "medium",
      title: "Clamp horizontal sans garde maxLeft>=minLeft",
      why: "Si la viewport reportée est anormale (iOS visualViewport transient), `maxLeft` peut passer sous `minLeft` et pousser la card hors écran.",
      evidence: clampEvidence,
    });
  }

  const overflowAncestors = cssFindings
    .filter((f) => f.prop === "overflow" || f.prop === "overflow-x")
    .filter((f) => /(hidden|clip)/.test(String(f.value || "")))
    .slice(0, 30);

  const safeAreaFindings = [
    ...jsFindings.filter((f) => /safe-top|safe-bottom|visualViewport|maxHeight/.test(f.snippet)),
    ...cssFindings.filter((f) => /safe-area-inset-top|safe-area-inset-bottom/.test(String(f.value || "") + " " + String(f.snippet || ""))),
  ];

  const portalUsage = jsFindings.filter((f) => /createPortal/.test(f.snippet));

  const map = {
    generatedAt: new Date().toISOString(),
    scope: "Read-only static audit for hamburger visibility/stacking",
    commandsRun: [
      "node scripts/hamburger-layer-audit.mjs && node scripts/hamburger-layer-report.mjs",
      "node scripts/menu-intent-audit.mjs",
      "node scripts/ui-uniformity-scan.mjs && node scripts/ui-uniformity-report.mjs",
      "node scripts/text-audit-scan.mjs && node scripts/text-audit-report.mjs",
    ],
    indexedFiles: indexed.sort(),
    jsFindings: uniqBy(jsFindings, (i) => `${i.file}:${i.line}:${i.type}:${i.snippet}`).sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line),
    cssFindings: uniqBy(cssFindings, (i) => `${i.file}:${i.line}:${i.selector}:${i.prop}:${i.value}`).sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line),
    stackingContexts: uniqBy(stackingContexts, (i) => `${i.file}:${i.line}:${i.selector}:${i.reason}`).sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line),
    overflowAncestors,
    safeAreaFindings: uniqBy(safeAreaFindings, (i) => `${i.file}:${i.line}:${i.snippet}`).sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line),
    portalUsage,
    suspects,
    layerMap: {
      topbar: {
        selectors: [".stickyStack", ".topNavGateWrap", ".topNavGateBar"],
        evidence: cssFindings.filter((f) => [".stickyStack", ".topNavGateWrap", ".topNavGateBar"].some((s) => (f.selector || "").includes(s))).slice(0, 20),
      },
      scrim: {
        selectors: [".topMenuScrim"],
        evidence: cssFindings.filter((f) => (f.selector || "").includes(".topMenuScrim")).slice(0, 20),
      },
      popover: {
        selectors: [".topMenuPopoverLayer", ".topMenuGatePopover", ".topMenuGate"],
        evidence: cssFindings.filter((f) => [".topMenuPopoverLayer", ".topMenuGatePopover", ".topMenuGate"].some((s) => (f.selector || "").includes(s))).slice(0, 40),
      },
      clipPattern: {
        selectors: [".GateGlassOuter", ".GateGlassClip", ".GateGlassBackdrop"],
        evidence: cssFindings.filter((f) => [".GateGlassOuter", ".GateGlassClip", ".GateGlassBackdrop"].some((s) => (f.selector || "").includes(s))).slice(0, 30),
      },
    },
  };

  await fs.mkdir(DOCS_DIR, { recursive: true });
  await fs.writeFile(OUT_FILE, `${JSON.stringify(map, null, 2)}\n`, "utf8");
  console.log(`[hamburger-layer] map written: ${rel(OUT_FILE)}`);
}

main().catch((error) => {
  console.error("[hamburger-layer] audit failed", error);
  process.exitCode = 1;
});
