#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const MAP_FILE = path.join(ROOT, "docs", "planning-chain-map.json");
const AUDIT_FILE = path.join(ROOT, "docs", "planning-chain-audit.md");
const BUG_MATRIX_FILE = path.join(ROOT, "docs", "planning-chain-bug-matrix.md");
const SIMPLE_ADVANCED_FILE = path.join(ROOT, "docs", "create-flow-simple-vs-advanced-audit.md");
const SCENARIOS_FILE = path.join(ROOT, "docs", "planning-chain-test-scenarios.md");

function fmtRef(item) {
  if (!item) return "`—`";
  return `\`${item.file}:${item.line}\``;
}

function fmtEvidence(items, max = 5) {
  const rows = Array.isArray(items) ? items.slice(0, max) : [];
  if (!rows.length) return "- `—`";
  return rows
    .map((row) => `- ${fmtRef(row)} — ${row.snippet || ""}`.trim())
    .join("\n");
}

function domainLabel(domain) {
  const map = {
    "create-flow": "Création/planification",
    "occurrence-generation": "Génération d’occurrences",
    "core-planning-state": "État planning (goals/occurrences)",
    calendar: "Calendrier",
    session: "Session",
    "pilotage-stats": "Pilotage/stats",
    "state-normalization": "Normalisation/migrations",
    "app-orchestration": "Orchestration app",
  };
  return map[domain] || domain;
}

function checkSeverityRank(value) {
  if (value === "P0") return 0;
  if (value === "P1") return 1;
  if (value === "P2") return 2;
  return 3;
}

function coverageEmoji(coverage) {
  if (coverage === "covered") return "✅";
  if (coverage === "partial") return "⚠️";
  return "❌";
}

function buildAuditMarkdown(map) {
  const modules = Array.isArray(map.modules) ? map.modules : [];
  const checks = Array.isArray(map.checks) ? map.checks : [];
  const scenarios = Array.isArray(map.scenarios) ? map.scenarios : [];
  const bugCandidates = Array.isArray(map.bugCandidates) ? map.bugCandidates : [];
  const risks = checks
    .filter((c) => c.status === "risk")
    .sort((a, b) => checkSeverityRank(a.severity) - checkSeverityRank(b.severity));

  const lines = [];
  lines.push("# Audit Planning Chain (P0 logique)");
  lines.push("");
  lines.push(`- Généré le: ${map.generatedAt || "—"}`);
  lines.push(`- Scope: \`${map.scope?.src || "src/**"}\`, \`${map.scope?.tests || "tests/**"}\``);
  lines.push(
    `- Fichiers scannés: src=${map.filesScanned?.src || 0}, tests=${map.filesScanned?.tests || 0}, modules clés=${map.filesScanned?.coreMapped || 0}`
  );
  lines.push("");

  lines.push("## 1) Chaîne produit cartographiée");
  lines.push("");
  lines.push("| Domaine | Fichiers clés |");
  lines.push("|---|---|");
  const byDomain = new Map();
  for (const mod of modules) {
    const key = mod.domain || "other";
    const arr = byDomain.get(key) || [];
    arr.push(mod.file);
    byDomain.set(key, arr);
  }
  for (const [domain, files] of byDomain.entries()) {
    lines.push(`| ${domainLabel(domain)} | ${files.map((f) => `\`${f}\``).join(", ")} |`);
  }
  lines.push("");

  lines.push("## 2) Cohérence fonctionnelle (audit)");
  lines.push("");
  for (const scenario of scenarios) {
    lines.push(`### ${coverageEmoji(scenario.coverage)} ${scenario.title}`);
    lines.push(`- Check: ${scenario.checks}`);
    lines.push(`- Couverture: **${scenario.coverage}**`);
    if (scenario.coverageEvidence?.length) {
      lines.push(`- Tests repérés: ${scenario.coverageEvidence.map((row) => `\`${row.file}\` → "${row.title}"`).join(" ; ")}`);
    }
    lines.push("- Preuves code:");
    lines.push(fmtEvidence(scenario.evidence, 4));
    lines.push("");
  }

  lines.push("## 3) P0/P1/P2 (priorisés)");
  lines.push("");
  if (!risks.length) {
    lines.push("- Aucun risque majeur détecté par le scan.");
    lines.push("");
  } else {
    for (const risk of risks) {
      lines.push(`### ${risk.severity || "P2"} — ${risk.summary}`);
      lines.push(`- Cause probable: ${risk.rationale || "—"}`);
      lines.push("- Preuves:");
      lines.push(fmtEvidence(risk.evidence, 6));
      lines.push("");
    }
  }

  lines.push("## 4) Audit UX logique du flow création (débutant)");
  lines.push("");
  lines.push("- Constats:");
  lines.push(`- \`CreateV2Habits\` expose ${map.createFlowAudit?.complexity?.createV2HabitsUseStateCount || 0} états locaux (densité élevée).`);
  lines.push(
    `- Le flow habit par défaut reste legacy: \`${map.createFlowAudit?.complexity?.defaultFlowStillLegacy ? "oui" : "non"}\` (cf. \`src/creation/creationSchema.js\`).`
  );
  lines.push(
    `- Import legacy UI détecté dans le form principal: \`${map.createFlowAudit?.complexity?.createV2HabitsImportsLegacyUI ? "oui" : "non"}\`.`
  );
  lines.push("- Verdict UX logique: flow techniquement robuste, cognitivement dense pour débutant sans mode essentiel explicite.");
  lines.push("");

  lines.push("## 5) Couverture tests actuelle");
  lines.push("");
  lines.push(`- Unit planning/stats: ${(map.tests?.unitFiles || []).length} fichiers`);
  lines.push(`- E2E: ${(map.tests?.e2eFiles || []).length} fichiers`);
  lines.push("- Principaux trous:");
  const gapScenarios = scenarios.filter((s) => s.coverage !== "covered");
  if (!gapScenarios.length) {
    lines.push("- Aucun trou critique détecté.");
  } else {
    for (const gap of gapScenarios.slice(0, 6)) {
      lines.push(`- ${gap.title}: ${gap.coverage}`);
    }
  }
  lines.push("");

  lines.push("## 6) Verdict exécutable");
  lines.push("");
  if (!bugCandidates.length) {
    lines.push("- P0 bloquant logique: aucun détecté.");
  } else {
    const p0 = bugCandidates.filter((b) => b.severity === "P0");
    if (!p0.length) lines.push("- P0 bloquant logique: aucun détecté.");
    else lines.push(`- P0 bloquants logiques: ${p0.length} (voir \`docs/planning-chain-bug-matrix.md\`).`);
  }
  lines.push("- Viabilité réelle: **oui**, mais avec dette logique sur suppression/scheduleRules et backfill missed.");
  lines.push("- Recommandation avant grande refonte UI: corriger les P0 logiques puis simplifier le flow création (mode Essentiel).");
  lines.push("");

  return `${lines.join("\n")}\n`;
}

function buildBugMatrixMarkdown(map) {
  const bugCandidates = Array.isArray(map.bugCandidates) ? map.bugCandidates : [];
  const lines = [];
  lines.push("# Planning Chain — Bug Matrix");
  lines.push("");
  lines.push("| Priorité | ID | Problème | Impact utilisateur |");
  lines.push("|---|---|---|---|");
  for (const bug of bugCandidates.sort((a, b) => checkSeverityRank(a.severity) - checkSeverityRank(b.severity))) {
    let impact = "Incohérence potentielle";
    if (bug.id === "delete-action-schedule-rules-cleanup") impact = "Actions supprimées pouvant réapparaître via occurrences orphelines";
    if (bug.id === "missed-backfill-window") impact = "Historique planned/missed incomplet après inactivité";
    if (bug.id === "status-vocabulary-divergence") impact = "Stats/session interprètent différemment certains statuts";
    lines.push(`| ${bug.severity} | \`${bug.id}\` | ${bug.title} | ${impact} |`);
  }
  lines.push("");

  for (const bug of bugCandidates.sort((a, b) => checkSeverityRank(a.severity) - checkSeverityRank(b.severity))) {
    lines.push(`## ${bug.severity} — ${bug.title}`);
    lines.push(`- ID: \`${bug.id}\``);
    lines.push(`- Cause probable: ${bug.rationale || "—"}`);
    lines.push("- Preuves:");
    lines.push(fmtEvidence(bug.evidence, 8));
    lines.push("- Scénario de repro:");
    if (bug.reproSteps?.length) {
      for (const step of bug.reproSteps) lines.push(`- ${step}`);
    } else {
      lines.push("- `—`");
    }
    lines.push("");
  }

  return `${lines.join("\n")}\n`;
}

function buildSimpleVsAdvancedMarkdown(map) {
  const essential = map.createFlowAudit?.essentialFields || [];
  const advanced = map.createFlowAudit?.advancedFields || [];
  const complexity = map.createFlowAudit?.complexity || {};

  const lines = [];
  lines.push("# Create Flow — Essentiel vs Avancé (audit logique)");
  lines.push("");
  lines.push("## Résumé");
  lines.push("");
  lines.push(`- États locaux dans \`CreateV2Habits\`: **${complexity.createV2HabitsUseStateCount || 0}**`);
  lines.push(`- Flow habit par défaut legacy: **${complexity.defaultFlowStillLegacy ? "oui" : "non"}**`);
  lines.push(`- Flow uxV2 disponible: **${complexity.uxV2FlowAvailable ? "oui" : "non"}**`);
  lines.push("");

  lines.push("## Mode Essentiel (débutant)");
  lines.push("");
  lines.push("| Champ | Pourquoi indispensable | Réf |");
  lines.push("|---|---|---|");
  for (const item of essential) {
    lines.push(`| ${item.field} | ${item.reason} | ${fmtRef(item.evidence?.[0])} |`);
  }
  lines.push("");

  lines.push("## Mode Avancé (power user)");
  lines.push("");
  lines.push("| Champ | Pourquoi avancé | Réf |");
  lines.push("|---|---|---|");
  for (const item of advanced) {
    lines.push(`| ${item.field} | ${item.reason} | ${fmtRef(item.evidence?.[0])} |`);
  }
  lines.push("");

  lines.push("## Verdict faisabilité (sans casser logique)");
  lines.push("");
  lines.push("- **Viable**: la logique actuelle supporte un découpage Essentiel/Avancé.");
  lines.push("- Implémentation future recommandée (hors ce lot):");
  lines.push("- Étape 1 (Essentiel): type, titre, date/jours, heure optionnelle, catégorie.");
  lines.push("- Étape 2 (Avancé): période, créneaux par jour, rappel, quantité, politiques d’échec.");
  lines.push("- Étape 3: résolution conflit affichée seulement en cas de collision.");
  lines.push("");

  return `${lines.join("\n")}\n`;
}

function buildScenarioMarkdown(map) {
  const scenarios = Array.isArray(map.scenarios) ? map.scenarios : [];
  const lines = [];
  lines.push("# Planning Chain — Test Scenarios Matrix");
  lines.push("");
  lines.push("| Scénario | Couverture actuelle | Tests repérés | Priorité ajout |");
  lines.push("|---|---|---|---|");
  for (const scenario of scenarios) {
    const tests = scenario.coverageEvidence?.length
      ? scenario.coverageEvidence.map((row) => `${row.file}::${row.title}`).slice(0, 2).join(" ; ")
      : "—";
    const priority = scenario.coverage === "gap" ? "P0" : scenario.coverage === "partial" ? "P1" : "P2";
    lines.push(`| ${scenario.title} | ${coverageEmoji(scenario.coverage)} ${scenario.coverage} | ${tests} | ${priority} |`);
  }
  lines.push("");

  lines.push("## Scénarios manuels/e2e recommandés");
  lines.push("");
  for (const scenario of scenarios) {
    lines.push(`### ${scenario.title}`);
    lines.push("- Objectif:");
    lines.push(`- ${scenario.checks}`);
    lines.push("- Steps:");
    lines.push("- Préparer état de base avec catégories + action(s) ciblée(s).");
    lines.push("- Exécuter le flow création/modification/suppression selon scénario.");
    lines.push("- Vérifier cohérence sur Aujourd’hui, Calendrier, Pilotage.");
    lines.push("- Vérifier persistance après reload.");
    lines.push("- Références code:");
    lines.push(fmtEvidence(scenario.evidence, 3));
    lines.push("");
  }
  return `${lines.join("\n")}\n`;
}

function main() {
  if (!fs.existsSync(MAP_FILE)) {
    console.error(`Missing ${path.relative(ROOT, MAP_FILE)}. Run planning-chain-audit-scan first.`);
    process.exit(1);
  }

  const map = JSON.parse(fs.readFileSync(MAP_FILE, "utf8"));

  const outputs = [
    { file: AUDIT_FILE, content: buildAuditMarkdown(map) },
    { file: BUG_MATRIX_FILE, content: buildBugMatrixMarkdown(map) },
    { file: SIMPLE_ADVANCED_FILE, content: buildSimpleVsAdvancedMarkdown(map) },
    { file: SCENARIOS_FILE, content: buildScenarioMarkdown(map) },
  ];

  for (const out of outputs) {
    fs.mkdirSync(path.dirname(out.file), { recursive: true });
    fs.writeFileSync(out.file, out.content, "utf8");
    console.log(`[planning-chain-audit] wrote ${path.relative(ROOT, out.file)}`);
  }
}

main();
