#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const DOCS_DIR = path.join(ROOT, "docs");
const MAP_FILE = path.join(DOCS_DIR, "hamburger-layer-map.json");
const REPORT_FILE = path.join(DOCS_DIR, "hamburger-layer-audit.md");

function rel(absPath) {
  return path.relative(ROOT, absPath).split(path.sep).join("/");
}

function ref(entry) {
  return `\`${entry.file}:${entry.line}\``;
}

function evidenceLine(entry) {
  return `- ${ref(entry)} — ${entry.snippet}`;
}

async function main() {
  const raw = await fs.readFile(MAP_FILE, "utf8");
  const map = JSON.parse(raw);
  const suspects = Array.isArray(map.suspects) ? map.suspects : [];
  const stack = Array.isArray(map.stackingContexts) ? map.stackingContexts : [];
  const safe = Array.isArray(map.safeAreaFindings) ? map.safeAreaFindings : [];
  const portal = Array.isArray(map.portalUsage) ? map.portalUsage : [];

  const lines = [];
  lines.push("# Hamburger Layer Audit (LOT 11)");
  lines.push("");
  lines.push(`- Generated: ${map.generatedAt || new Date().toISOString()}`);
  lines.push(`- Data source: \`${rel(MAP_FILE)}\``);
  lines.push("- Mode: Read-only static audit (aucun correctif appliqué).");
  lines.push("");

  lines.push("## Commandes exécutées");
  lines.push("");
  for (const cmd of map.commandsRun || []) {
    lines.push(`- \`${cmd}\``);
  }
  lines.push("");

  lines.push("## Stacking map (synthèse)");
  lines.push("");
  lines.push("- Topbar layers: `.stickyStack`, `.topNavGateWrap`, `.topNavGateBar`.");
  lines.push("- Overlay scrim: `.topMenuScrim`.");
  lines.push("- Popover: `.topMenuPopoverLayer` -> `.topMenuGatePopover` -> `.topMenuGate`.");
  lines.push("- Glass clipping primitives: `.GateGlassOuter` + `.GateGlassClip` + `.GateGlassBackdrop`.");
  lines.push("");

  lines.push("## Causes probables (triées)");
  lines.push("");
  if (!suspects.length) {
    lines.push("Aucune cause forte détectée automatiquement.");
  } else {
    suspects.forEach((suspect, idx) => {
      lines.push(`### ${idx + 1}. ${suspect.title} (${suspect.severity})`);
      lines.push("");
      lines.push(`- Pourquoi: ${suspect.why}`);
      lines.push("- Preuves:");
      for (const ev of suspect.evidence || []) {
        lines.push(evidenceLine(ev));
      }
      lines.push("");
    });
  }

  lines.push("## Top suspects selectors/classes");
  lines.push("");
  const selectorHits = new Map();
  for (const entry of map.cssFindings || []) {
    if (!entry.selector) continue;
    if (!/(topMenu|TopNav|GateGlass|stickyStack|navWrap)/i.test(entry.selector)) continue;
    selectorHits.set(entry.selector, (selectorHits.get(entry.selector) || 0) + 1);
  }
  [...selectorHits.entries()]
    .map(([selector, count]) => ({ selector, count }))
    .sort((a, b) => b.count - a.count || a.selector.localeCompare(b.selector))
    .slice(0, 12)
    .forEach((item) => {
      lines.push(`- \`${item.selector}\` (${item.count} occurrences)`);
    });
  lines.push("");

  lines.push("## iPhone / safe-area / clip observations");
  lines.push("");
  if (!safe.length) {
    lines.push("Aucune trace explicite safe-area détectée.");
  } else {
    safe.slice(0, 20).forEach((item) => lines.push(evidenceLine(item)));
  }
  lines.push("");

  lines.push("## Portals");
  lines.push("");
  if (!portal.length) {
    lines.push("- Aucun `createPortal` détecté dans les fichiers scannés liés au menu.");
    lines.push("- Le popover est rendu dans l’arbre courant de `TopNav`.");
  } else {
    portal.forEach((item) => lines.push(evidenceLine(item)));
  }
  lines.push("");

  lines.push("## Runtime checklist (DevTools, non appliqué)");
  lines.push("");
  lines.push("1. Cliquer hamburger puis vérifier `menuOpen` passe à `true` (React DevTools).\n2. Vérifier présence DOM de `.topMenuPopoverLayer` et dimensions calculées (`top`, `left`, `width`, `--topMenuMaxH`).\n3. Vérifier computed styles du popover: `opacity`, `visibility`, `pointer-events`, `z-index`.\n4. Vérifier ancêtres: presence de `.GateGlassClip` avec `overflow:hidden` et `transform` actif.\n5. Vérifier si la topbar couvre la zone popover (`z-index` topbar > popover).\n6. Sur iPhone, vérifier `visualViewport` au moment du clic et la valeur calculée `left`/`maxHeight`.");
  lines.push("");

  lines.push("## Conclusion audit");
  lines.push("");
  lines.push("- Diagnostic principal: conflit de stacking + clipping de conteneur glass autour d’un popover fixed (suspect critique).\n- Diagnostic secondaire: topbar ouverte à un z-index supérieur au popover.\n- Diagnostic tertiaire: edge case de calcul clamp horizontal quand viewport reportée est transitoire.");

  await fs.mkdir(DOCS_DIR, { recursive: true });
  await fs.writeFile(REPORT_FILE, `${lines.join("\n")}\n`, "utf8");
  console.log(`[hamburger-layer] report written: ${rel(REPORT_FILE)}`);
}

main().catch((error) => {
  console.error("[hamburger-layer] report failed", error);
  process.exitCode = 1;
});
