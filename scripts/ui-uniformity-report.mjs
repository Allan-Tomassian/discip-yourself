#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const DOCS_DIR = path.join(ROOT, "docs");
const MAP_FILE = path.join(DOCS_DIR, "ui-uniformity-map.json");
const REPORT_FILE = path.join(DOCS_DIR, "ui-uniformity-audit.md");

function rel(absPath) {
  return path.relative(ROOT, absPath).split(path.sep).join("/");
}

function groupBy(items, keyFn) {
  const map = new Map();
  for (const item of items) {
    const key = keyFn(item);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(item);
  }
  return map;
}

function scoreLabel(percent) {
  if (percent >= 90) return "Excellent";
  if (percent >= 75) return "Bon";
  if (percent >= 60) return "Moyen";
  return "Faible";
}

function topOccurrencesByType(files) {
  const counts = new Map();
  for (const file of files) {
    for (const occ of file.occurrences || []) {
      counts.set(occ.type, (counts.get(occ.type) || 0) + 1);
    }
  }

  return [...counts.entries()]
    .map(([type, count]) => ({ type, count }))
    .sort((a, b) => b.count - a.count || a.type.localeCompare(b.type));
}

function buildLotPlan(hotspots) {
  const nav = hotspots.filter((item) => item.file.includes("navigation") || item.file.includes("TopNav") || item.file.includes("TopMenu"));
  const overlays = hotspots.filter((item) => /Modal|Popover|Drawer|Sheet|Toast|overlay|gate\.css|gate-premium\.css/i.test(item.file));
  const pages = hotspots.filter((item) => item.file.startsWith("src/pages/"));
  const internals = hotspots.filter((item) => item.file.startsWith("src/components/") || item.file.startsWith("src/ui/") || item.file.startsWith("src/features/"));

  return [
    {
      lot: "Lot 1 - Navigation & Overlays",
      files: [...new Set([...nav, ...overlays].map((item) => item.file))].slice(0, 10),
      why: "Bloque la majorité des écarts visibles immédiatement (topbar, hamburger, modals, popovers).",
    },
    {
      lot: "Lot 2 - Pages métier",
      files: [...new Set(pages.map((item) => item.file))].slice(0, 12),
      why: "Uniformise l’apparence des écrans complets et supprime les mixes Gate/legacy au niveau route.",
    },
    {
      lot: "Lot 3 - Composants internes",
      files: [...new Set(internals.map((item) => item.file))].slice(0, 15),
      why: "Évite la réintroduction de styles divergents via composants partagés non migrés.",
    },
  ];
}

async function main() {
  const raw = await fs.readFile(MAP_FILE, "utf8");
  const map = JSON.parse(raw);
  const files = Array.isArray(map.files) ? map.files : [];
  const totals = map.totals || {};

  const violations = files
    .flatMap((file) => (file.occurrences || []).map((occ) => ({ file: file.file, ...occ })))
    .filter((occ) => /legacy|liquid|inline-style-cardlike|inline-style-backdrop/.test(occ.type));

  const violationsByType = groupBy(violations, (occ) => occ.type);
  const sortedViolationTypes = [...violationsByType.entries()]
    .map(([type, entries]) => ({ type, count: entries.length, entries }))
    .sort((a, b) => b.count - a.count || a.type.localeCompare(b.type));

  const mixedFiles = files.filter((file) => file.mixed);
  const legacyOnlyFiles = files.filter((file) => file.legacyCount > 0 && file.gatePremiumCount === 0);
  const hotspots = (totals.hotspots || []).slice(0, 15);
  const occurrenceStats = topOccurrencesByType(files).slice(0, 20);
  const overlayRisks = Array.isArray(map.overlayRisks) ? map.overlayRisks : [];
  const lotPlan = buildLotPlan(totals.hotspots || []);

  const lines = [];
  lines.push("# UI Uniformity Audit (LOT 10)");
  lines.push("");
  lines.push(`- Generated: ${map.generatedAt || new Date().toISOString()}`);
  lines.push(`- Source of truth: \`${(map.sourceOfTruth?.gatePrimitives || []).join('`, `')}\``);
  lines.push("- Scope: `src/pages/**`, `src/components/**`, `src/ui/**`, `src/features/**`, overlays, popovers, modals, bars.");
  lines.push("");

  lines.push("## Score global");
  lines.push("");
  lines.push(`- Conformité Card Premium: **${totals.conformityPercent ?? 0}%** (${scoreLabel(totals.conformityPercent ?? 0)})`);
  lines.push(`- Fichiers scannés: ${totals.totalFiles ?? files.length}`);
  lines.push(`- Fichiers "card-relevant": ${totals.cardRelevantFiles ?? 0}`);
  lines.push(`- Gate-only: ${totals.gateOnlyFiles ?? 0}`);
  lines.push(`- Mixed (Gate + legacy): ${totals.mixedFiles ?? mixedFiles.length}`);
  lines.push(`- Legacy-only: ${totals.legacyOnlyFiles ?? legacyOnlyFiles.length}`);
  lines.push("");

  lines.push("## Violations par type");
  lines.push("");
  if (!sortedViolationTypes.length) {
    lines.push("Aucune violation legacy détectée dans le scan actuel.");
  } else {
    for (const item of sortedViolationTypes) {
      lines.push(`- **${item.type}**: ${item.count}`);
    }
  }
  lines.push("");

  lines.push("## Top hotspots");
  lines.push("");
  if (!hotspots.length) {
    lines.push("Aucun hotspot legacy détecté.");
  } else {
    hotspots.forEach((item, index) => {
      lines.push(`${index + 1}. \`${item.file}\` — legacy=${item.legacyCount}, gate=${item.gatePremiumCount}, mixed=${item.mixed ? "yes" : "no"}`);
    });
  }
  lines.push("");

  lines.push("## Mixed files (priorité haute)");
  lines.push("");
  if (!mixedFiles.length) {
    lines.push("Aucun fichier mixed.");
  } else {
    mixedFiles
      .sort((a, b) => b.legacyCount - a.legacyCount || a.file.localeCompare(b.file))
      .slice(0, 30)
      .forEach((file) => {
        lines.push(`- \`${file.file}\` (legacy=${file.legacyCount}, gate=${file.gatePremiumCount})`);
      });
  }
  lines.push("");

  lines.push("## Overlay / clip risks");
  lines.push("");
  if (!overlayRisks.length) {
    lines.push("Aucun risque de clip identifié par le scanner.");
  } else {
    overlayRisks.slice(0, 40).forEach((risk) => {
      lines.push(`- \`${risk.file}:${risk.line}\` — ${risk.reason}`);
    });
  }
  lines.push("");

  lines.push("## Occurrences les plus fréquentes");
  lines.push("");
  occurrenceStats.forEach((item) => {
    lines.push(`- ${item.type}: ${item.count}`);
  });
  lines.push("");

  lines.push("## Plan de correction (non appliqué)");
  lines.push("");
  for (const lot of lotPlan) {
    lines.push(`### ${lot.lot}`);
    lines.push("");
    lines.push(`- Objectif: ${lot.why}`);
    if (lot.files.length) {
      lines.push("- Fichiers cibles:");
      lot.files.forEach((file) => lines.push(`  - \`${file}\``));
    } else {
      lines.push("- Fichiers cibles: aucun identifié automatiquement.");
    }
    lines.push("");
  }

  lines.push("## Traçabilité");
  lines.push("");
  lines.push(`- Données brutes: \`${rel(MAP_FILE)}\``);
  lines.push(`- Rapport généré: \`${rel(REPORT_FILE)}\``);

  await fs.mkdir(DOCS_DIR, { recursive: true });
  await fs.writeFile(REPORT_FILE, `${lines.join("\n")}\n`, "utf8");
  console.log(`[ui-uniformity] report written: ${rel(REPORT_FILE)}`);
}

main().catch((error) => {
  console.error("[ui-uniformity] report failed", error);
  process.exitCode = 1;
});
