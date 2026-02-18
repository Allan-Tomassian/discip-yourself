#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const MAP_FILE = path.join(ROOT, "docs", "progression-map.json");
const AUDIT_FILE = path.join(ROOT, "docs", "progression-audit.md");

function fmtRef(row) {
  return `\`${row.file}:${row.line}\``;
}

function one(arr, fallback = "—") {
  return Array.isArray(arr) && arr.length ? arr[0] : fallback;
}

function unique(values) {
  return Array.from(new Set((values || []).filter(Boolean)));
}

function shortList(values, max = 3) {
  const list = unique(values);
  if (!list.length) return "—";
  if (list.length <= max) return list.join(", ");
  return `${list.slice(0, max).join(", ")} +${list.length - max}`;
}

function buildMetricsTable(metrics) {
  const header = [
    "| Métrique | Calcul (source) | Entrées | Affichage | Fréquence |",
    "|---|---|---|---|---|",
  ];

  const rows = metrics
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((metric) => {
      const def = one(metric.definitions, null);
      const calc = def && def.file ? `\`${def.file}:${def.line}\`` : "—";
      const displayRefs = (metric.displayedIn || []).slice(0, 2).map(fmtRef).join(", ") || "—";
      return `| ${metric.name} | ${calc} | ${shortList(metric.inputs, 2)} | ${displayRefs} | ${metric.updateCadence || "—"} |`;
    });

  return [...header, ...rows].join("\n");
}

function buildHotspots(hotspots) {
  const rows = (hotspots || []).slice(0, 10);
  if (!rows.length) return "- Aucun hotspot détecté.";
  return rows.map((row, idx) => `${idx + 1}. \`${row.file}\` (${row.count} occurrences métriques)`).join("\n");
}

function buildClarityBreaks(map) {
  const issues = [];

  const inconsistencies = map.inconsistencyCandidates || [];
  if (inconsistencies.find((x) => x.id === "expected-status-semantics")) {
    issues.push(
      "`expected` n’a pas la même définition selon l’écran: `src/logic/metrics.js` inclut `canceled/skipped`, alors que Pilotage les exclut."
    );
  }
  if (inconsistencies.find((x) => x.id === "library-week-stats-semantics")) {
    issues.push(
      "La Bibliothèque calcule `planned` via `status !== \"skipped\"` (donc `canceled` reste compté), ce qui diffère de Pilotage."
    );
  }
  if (inconsistencies.find((x) => x.id === "micro-actions-influence-gap")) {
    issues.push(
      "Les micro-actions sont visibles dans les détails Discipline (14j), mais le score principal reste basé sur les occurrences seulement."
    );
  }

  const wordingTerms = (map.wording || []).map((w) => w.term);
  if (wordingTerms.includes("fait / attendu") && wordingTerms.includes("attendu / fait")) {
    issues.push("Le wording inverse `fait/attendu` vs `attendu/fait` augmente la charge cognitive.");
  }

  if (!issues.length) {
    return "- Aucun point bloquant détecté dans l’audit automatisé.";
  }
  return issues.map((issue) => `- ${issue}`).join("\n");
}

function buildUxSimplification() {
  return [
    "- Définir 1 glossaire métier unique: `attendu`, `fait`, `manqué`, `annulé`, `discipline`, `progression`.",
    "- Exposer une seule formule `discipline` (source unique) et l’utiliser sur Home + Pilotage + Reporting.",
    "- Dissocier explicitement dans l’UI: `Score discipline` (occurrences) vs `Micro-actions réalisées` (engagement).",
    "- Uniformiser l’ordre des ratios: toujours `fait / attendu`.",
    "- Ajouter un bloc d’aide court sur Pilotage: “comment le score est calculé”.",
  ].join("\n");
}

function buildUnifiedModelProposal() {
  return [
    "1. **Source unique calcul**: créer un module `progressionModel` qui retourne toutes les métriques normalisées (jour, 7j, 14j, 30j, 90j).",
    "2. **Sémantique stable**: `attendu = planifié non annulé/non reporté` (ou autre), figée et testée une fois.",
    "3. **Vues dérivées uniquement**: Home/Pilotage/Bibliothèque affichent les valeurs du modèle sans recalcul local ad hoc.",
    "4. **Micro-actions branchées explicitement**: soit contribution au score global via pondération, soit KPI séparé non ambigu.",
    "5. **Contrats de tests**: jeux de cas status (`planned/done/missed/canceled/skipped/rescheduled`) et snapshots par écran.",
  ].join("\n");
}

function main() {
  if (!fs.existsSync(MAP_FILE)) {
    console.error(`Missing ${path.relative(ROOT, MAP_FILE)}. Run progression-audit-scan first.`);
    process.exit(1);
  }

  const map = JSON.parse(fs.readFileSync(MAP_FILE, "utf8"));
  const metrics = Array.isArray(map.metrics) ? map.metrics : [];

  const sections = [];
  sections.push("# Progression Audit");
  sections.push("");
  sections.push(`- Généré le: ${map.generatedAt || "—"}`);
  sections.push(`- Scope: ${map.scope || "src/**"}`);
  sections.push(`- Fichiers scannés: ${map.filesScanned || 0}`);
  sections.push(`- Métriques indexées: ${metrics.length}`);
  sections.push("");

  sections.push("## Metrics détectées");
  sections.push("");
  sections.push(buildMetricsTable(metrics));
  sections.push("");

  sections.push("## Top 10 hotspots");
  sections.push("");
  sections.push(buildHotspots(map.hotspots));
  sections.push("");

  sections.push("## Où ça casse la clarté utilisateur");
  sections.push("");
  sections.push(buildClarityBreaks(map));
  sections.push("");

  sections.push("## Ce qui doit être simplifié (UX)");
  sections.push("");
  sections.push(buildUxSimplification());
  sections.push("");

  sections.push("## Recommandation de modèle unique de progression (proposition)");
  sections.push("");
  sections.push(buildUnifiedModelProposal());
  sections.push("");

  sections.push("## Références clés");
  sections.push("");

  const keyRefs = [
    "src/logic/metrics.js",
    "src/logic/pilotage.js",
    "src/features/pilotage/radarModel.js",
    "src/pages/Home.jsx",
    "src/pages/Pilotage.jsx",
    "src/ui/today/MicroActionsCard.jsx",
    "src/core/microActions/microActionsEngine.js",
    "src/features/library/CategoryManageInline.jsx",
  ];

  for (const ref of keyRefs) {
    sections.push(`- \`${ref}\``);
  }

  sections.push("");
  fs.mkdirSync(path.dirname(AUDIT_FILE), { recursive: true });
  fs.writeFileSync(AUDIT_FILE, `${sections.join("\n")}\n`, "utf8");

  console.log(`[progression-audit] wrote ${path.relative(ROOT, AUDIT_FILE)}`);
}

main();
