#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const MAP_FILE = path.join(ROOT, "docs", "execution-chain-map.json");
const AUDIT_FILE = path.join(ROOT, "docs", "execution-chain-audit.md");
const JOURNEY_FILE = path.join(ROOT, "docs", "execution-chain-user-journey.md");
const PLAN_FILE = path.join(ROOT, "docs", "execution-chain-fix-plan.md");
const MATRIX_FILE = path.join(ROOT, "docs", "execution-chain-test-matrix.md");

function fmtRef(ref) {
  if (!ref) return "`—`";
  return `\`${ref.file}:${ref.line}\``;
}

function fmtEvidence(items, max = 5) {
  const rows = Array.isArray(items) ? items.slice(0, max) : [];
  if (!rows.length) return "- `—`";
  return rows.map((row) => `- ${fmtRef(row)} — ${row.snippet || ""}`.trim()).join("\n");
}

function severityRank(value) {
  if (value === "P0") return 0;
  if (value === "P1") return 1;
  return 2;
}

function renderAudit(map) {
  const checks = Array.isArray(map.checks) ? map.checks : [];
  const stages = Array.isArray(map.stages) ? map.stages : [];
  const ratings = Array.isArray(map.ratings) ? map.ratings : [];
  const topRisks = Array.isArray(map.topRisks)
    ? map.topRisks
    : checks.filter((c) => c.status === "risk").sort((a, b) => severityRank(a.severity) - severityRank(b.severity));
  const q = map.productQuestions || {};

  const lines = [];
  lines.push("# 1) Verdict global (max 12 lignes)");
  lines.push("");
  lines.push("- Le moteur de planification est **fonctionnel**, mais pas totalement cohérent de bout en bout sur les cas limites.");
  lines.push("- La chaîne nominale création → occurrences → today → validation → pilotage passe dans la plupart des scénarios testés.");
  lines.push("- Deux dettes P0 fragilisent la fiabilité réelle: cleanup scheduleRules à la suppression et backfill `missed` trop local.");
  lines.push("- La chaîne Today → Session est **partielle**: app branchée sur `SessionMVP`, tandis que `Session.jsx` plus riche n’est pas le chemin runtime.");
  lines.push("- La sémantique des statuts n’est pas parfaitement unifiée entre occurrences, planner, metrics et resolver.");
  lines.push("- Pour un débutant, le flow de création reste trop dense (charge cognitive élevée).");
  lines.push("- Applicabilité “vie réelle”: possible, mais fragile pour les utilisateurs irréguliers (retour après absence).");
  lines.push("- Avant redesign UI, il faut fermer les incohérences logiques P0/P1.");
  lines.push("");

  lines.push("# 2) Cartographie de la chaîne (étapes + composants + logique)");
  lines.push("");
  for (const stage of stages) {
    lines.push(`## ${stage.title}`);
    lines.push(`- Étape: \`${stage.id}\``);
    lines.push(`- Composants/modules: ${(stage.files || []).map((f) => `\`${f}\``).join(", ") || "`—`"}`);
    lines.push("- Preuves:");
    lines.push(fmtEvidence(stage.evidence, 4));
    lines.push("");
  }

  lines.push("# 3) Incohérences fonctionnelles (P0/P1/P2)");
  lines.push("");
  for (const issue of topRisks) {
    lines.push(`## ${issue.severity} — ${issue.summary}`);
    lines.push(`- Problème observé: ${issue.summary}`);
    lines.push(`- Impact utilisateur: ${issue.impact || "Incohérence perçue dans la chaîne"}`);
    lines.push(`- Cause probable: ${issue.area || "non classée"} + implémentation dispersée`);
    lines.push("- Preuves:");
    lines.push(fmtEvidence(issue.evidence, 6));
    lines.push("- Repro:");
    for (const step of issue.repro || []) lines.push(`- ${step}`);
    lines.push("");
  }

  lines.push("# 4) Frictions UX réelles (utilisateur débutant)");
  lines.push("");
  lines.push("- Le flow de création concentre trop d’options dans les écrans actions (temps, fréquence, période, conflits).");
  lines.push("- La notion de “Session” est ambiguë car deux implémentations coexistent en code, une seule visible en runtime.");
  lines.push("- La différence “agir maintenant” vs “planifier finement” est implicite, pas explicite dans l’orchestration.");
  lines.push("- Risque de perte de confiance si des occurrences anciennes restent `planned` au lieu de `missed`.");
  lines.push("- Preuves:");
  lines.push(fmtEvidence([...(topRisks.find((r) => r.id === "create-flow-cognitive-load")?.evidence || []), ...(topRisks.find((r) => r.id === "session-page-bifurcation")?.evidence || [])], 6));
  lines.push("");

  lines.push("# 5) Ambiguïtés produit à résoudre avant redesign UI");
  lines.push("");
  lines.push("- Quelle implémentation Session est la source de vérité (MVP actuel ou version riche `Session.jsx`)?");
  lines.push("- Que signifie exactement `missed` sur retour d’absence prolongée (backfill systématique vs local)?");
  lines.push("- Quelle granularité de validation est attendue pour action sans heure (ANYTIME) ?");
  lines.push("- Quel niveau de friction anti-triche V1 cible-t-on (minimal / moyen / strict) ?");
  lines.push("- L’action “Ajouter occurrence” depuis calendrier Today doit-elle être active en production ou masquée ?");
  lines.push("");

  lines.push("# 6) Recommandation sur Session (garder / transformer / remplacer)");
  lines.push("");
  lines.push("- Recommandation: **transformer**.");
  lines.push(`- État actuel: ${q.sessionRole?.current || "non déterminable"}`);
  lines.push(`- Proposition: ${q.sessionRole?.recommendation || "Unifier vers un seul chemin Session."}`);
  lines.push("- Justification:");
  lines.push(fmtEvidence(q.sessionRole?.evidence || [], 4));
  lines.push("");

  lines.push("# 7) Recommandation Quick Action vs Focus Block (V1)");
  lines.push("");
  lines.push("- Recommandation V1:");
  lines.push("- `Quick Action` = action ANYTIME exécutable sans durée obligatoire, validation simple.");
  lines.push("- `Focus Block` = occurrence planifiée (heure/durée), session structurée, retour validation explicite.");
  lines.push(`- Base code existante: ${q.quickActionVsFocusBlock?.current || "non déterminable"}`);
  lines.push("- Preuves:");
  lines.push(fmtEvidence(q.quickActionVsFocusBlock?.evidence || [], 4));
  lines.push("");

  lines.push("# 8) Plan de correction priorisé (ordre exact)");
  lines.push("");
  lines.push("1. P0 logique: cleanup `scheduleRules` lors suppression action + garde-fou anti-occurrences orphelines.");
  lines.push("2. P0 logique: stratégie de backfill `missed` cohérente au-delà de la fenêtre Today ±1.");
  lines.push("3. P1 architecture: unifier Session runtime (éliminer bifurcation MVP vs page riche).");
  lines.push("4. P1 sémantique: harmoniser vocabulaire de statuts entre occurrences/planner/metrics/session.");
  lines.push("5. P1 UX: découper flow création en Essentiel/Avancé sans toucher au moteur.");
  lines.push("6. P2: traiter chemins UI secondaires non câblés (ex: ajout occurrence depuis calendrier si confirmé).");
  lines.push("");

  lines.push("# 9) Test matrix minimale avant refonte visuelle");
  lines.push("");
  lines.push("- Vérifier suppression d’action récurrente + non-régénération d’occurrences.");
  lines.push("- Vérifier retour après 5+ jours sans ouverture (planned -> missed cohérent).");
  lines.push("- Vérifier séquence Today -> Session -> Done -> Pilotage sur one-off / recurring / anytime.");
  lines.push("- Vérifier cohérence des totaux expected/done/missed entre Home, Calendar, Pilotage, Reporting.");
  lines.push("- Vérifier comportement selectedDate != today (lecture seule, exécution, micro-actions).");
  lines.push("- Détail des cas: voir `docs/execution-chain-test-matrix.md`.");
  lines.push("");

  lines.push("# 10) Ce qu’on ne doit PAS toucher tout de suite (pour éviter dispersion)");
  lines.push("");
  lines.push("- Refonte visuelle lourde des pages (déjà engagée sur d’autres lots).");
  lines.push("- Système Wallet/Totem/Ads (hors impact direct sur la chaîne d’exécution cœur).");
  lines.push("- Ajout de nouvelles features produit avant fermeture des P0 logiques.");
  lines.push("- Refonte navigation globale tant que Session et statuts ne sont pas unifiés.");
  lines.push("");

  lines.push("## Notes de conformité (OK / Partiel / KO)");
  lines.push("");
  for (const rating of ratings) {
    lines.push(`- ${rating.criterion}: **${rating.rating}** — ${rating.rationale}`);
  }
  lines.push("");

  return `${lines.join("\n")}\n`;
}

function renderJourney(map) {
  const lines = [];
  const checks = Array.isArray(map.checks) ? map.checks : [];
  const byId = new Map(checks.map((c) => [c.id, c]));

  lines.push("# Execution Chain — User Journey (réel)");
  lines.push("");
  lines.push("## 1) Planifier");
  lines.push("- Ce que l’utilisateur fait: ouvre `+` puis choisit Projet/Action.");
  lines.push("- Ce qu’il voit: modal guidée (`CreateFlowModal`) puis écrans CreateV2.");
  lines.push("- Ce que l’app enregistre: draft create + goals + schedule fields + règles.");
  lines.push("- Références:");
  lines.push(fmtEvidence([
    ...((map.stages || []).find((s) => s.id === "planning")?.evidence || []),
    ...((map.stages || []).find((s) => s.id === "persistence")?.evidence || []),
  ], 5));
  lines.push("");

  lines.push("## 2) Voir au calendrier");
  lines.push("- Ce que l’utilisateur fait: ouvre le calendrier (jour/mois).");
  lines.push("- Ce qu’il voit: compteurs planifié/fait par date.");
  lines.push("- Ce que l’app lit: occurrences `planned`/`done` normalisées via dateKey.");
  lines.push("- Friction: ajout d’occurrence potentiellement non câblé selon parent.");
  lines.push("- Références:");
  lines.push(fmtEvidence([
    ...((map.stages || []).find((s) => s.id === "calendar")?.evidence || []),
    ...(byId.get("calendar-add-occurrence-unwired")?.evidence || []),
  ], 6));
  lines.push("");

  lines.push("## 3) Arriver dans Aujourd’hui");
  lines.push("- Ce que l’utilisateur fait: choisit une date puis lit “À faire maintenant”.");
  lines.push("- Ce qu’il voit: focus occurrence + CTA démarrer.");
  lines.push("- Ce que l’app calcule: selectedDate/localToday, planned/day, done/day, focusOccurrence.");
  lines.push("- Friction: fenêtre de recalcul locale pouvant masquer les missed anciens.");
  lines.push("- Références:");
  lines.push(fmtEvidence([
    ...((map.stages || []).find((s) => s.id === "today")?.evidence || []),
    ...(byId.get("missed-backfill-window")?.evidence || []),
  ], 6));
  lines.push("");

  lines.push("## 4) Passer en exécution / session");
  lines.push("- Ce que l’utilisateur fait: clique “Commencer maintenant”.");
  lines.push("- Ce qu’il voit: tab session (implémentation MVP).");
  lines.push("- Ce que l’app enregistre: `ui.activeSession`, puis statut occurrence via actions session.");
  lines.push("- Friction: coexistence d’une page Session avancée non branchée.");
  lines.push("- Références:");
  lines.push(fmtEvidence([
    ...((map.stages || []).find((s) => s.id === "execution")?.evidence || []),
    ...(byId.get("session-page-bifurcation")?.evidence || []),
  ], 6));
  lines.push("");

  lines.push("## 5) Valider / clôturer");
  lines.push("- Ce que l’utilisateur fait: Terminer / Reporter / Annuler.");
  lines.push("- Ce que l’app enregistre: status occurrence + session history (selon chemin).");
  lines.push("- Risque: vocabulaire de statuts partiellement divergent entre modules.");
  lines.push("- Références:");
  lines.push(fmtEvidence([
    ...((map.stages || []).find((s) => s.id === "validation")?.evidence || []),
    ...(byId.get("status-vocabulary-divergence")?.evidence || []),
  ], 6));
  lines.push("");

  lines.push("## 6) Mesurer dans Pilotage");
  lines.push("- Ce que l’utilisateur fait: ouvre Pilotage.");
  lines.push("- Ce qu’il voit: discipline, radar, reporting.");
  lines.push("- Ce que l’app calcule: `computeWindowStats`, `metrics`, `radarModel`, `reporting`.");
  lines.push("- Références:");
  lines.push(fmtEvidence((map.stages || []).find((s) => s.id === "pilotage")?.evidence || [], 6));
  lines.push("");

  lines.push("## Frictions clés");
  lines.push("- Nettoyage suppression action incomplet (rules vs occurrences).");
  lines.push("- Backfill `missed` possiblement localisé.");
  lines.push("- Session runtime fragmentée (MVP vs version riche).");
  lines.push("- Flow création trop dense pour débutant.");
  lines.push("");

  return `${lines.join("\n")}\n`;
}

function renderFixPlan(map) {
  const risks = Array.isArray(map.topRisks) ? map.topRisks : [];
  const p0 = risks.filter((r) => r.severity === "P0");
  const p1 = risks.filter((r) => r.severity === "P1");
  const p2 = risks.filter((r) => r.severity === "P2");

  const lines = [];
  lines.push("# Execution Chain — Fix Plan Priorisé");
  lines.push("");
  lines.push("## P0 (bloquants cohérence moteur)");
  lines.push("");
  if (!p0.length) lines.push("- Aucun P0 détecté.");
  for (const issue of p0) {
    lines.push(`- ${issue.summary}`);
    lines.push(`- Impact: ${issue.impact}`);
    lines.push(`- Zone: ${issue.area}`);
    lines.push(`- Réf principale: ${fmtRef(issue.evidence?.[0])}`);
  }
  lines.push("");

  lines.push("## P1 (cohérence fonctionnelle + UX logique)");
  lines.push("");
  if (!p1.length) lines.push("- Aucun P1 détecté.");
  for (const issue of p1) {
    lines.push(`- ${issue.summary}`);
    lines.push(`- Impact: ${issue.impact}`);
    lines.push(`- Zone: ${issue.area}`);
    lines.push(`- Réf principale: ${fmtRef(issue.evidence?.[0])}`);
  }
  lines.push("");

  lines.push("## P2 (hygiène / dette secondaire)");
  lines.push("");
  if (!p2.length) lines.push("- Aucun P2 détecté.");
  for (const issue of p2) {
    lines.push(`- ${issue.summary}`);
    lines.push(`- Impact: ${issue.impact}`);
    lines.push(`- Zone: ${issue.area}`);
    lines.push(`- Réf principale: ${fmtRef(issue.evidence?.[0])}`);
  }
  lines.push("");

  lines.push("## Ordre d’exécution recommandé");
  lines.push("");
  lines.push("1. Corriger les P0 moteur (suppression rules + backfill missed).");
  lines.push("2. Unifier Session runtime (single implementation branchée).");
  lines.push("3. Harmoniser sémantique statuts (occurrences/metrics/session/pilotage).");
  lines.push("4. Découper Create en mode Essentiel/Avancé sans modifier le modèle.");
  lines.push("5. Finaliser les chemins UI secondaires non câblés.");
  lines.push("");

  lines.push("## Dépendances");
  lines.push("");
  lines.push("- P0 doit être validé avant toute refonte visuelle majeure de la chaîne Today/Session/Pilotage.");
  lines.push("- La décision produit sur Session (garder/transformer) précède toute simplification UX d’exécution.");
  lines.push("");

  return `${lines.join("\n")}\n`;
}

function renderTestMatrix(map) {
  const cov = map.coverage || {};
  const rows = [
    ["Planification -> Calendrier", cov.planToCalendar || [], "Vérifier occurrences générées et visibles bons jours", "E2E"],
    ["Planification -> Today", cov.planToToday || [], "Vérifier CTA Today sur action créée", "E2E"],
    ["Today -> Session", cov.todayToSession || [], "Vérifier start session + état activeSession", "E2E+manuel"],
    ["Session -> Validation", cov.todayToSession || [], "Done/Skipped/Canceled persistent + reload", "E2E+unit"],
    ["Validation -> Pilotage", cov.validationToPilotage || [], "expected/done/missed cohérents inter-écrans", "Unit+E2E"],
    ["Suppression action", cov.categoryDeleteAndMigration || [], "Aucune occurrence/règle orpheline", "Manuel+E2E"],
    ["Timezone/dateKey", cov.timezoneEdge || [], "Pas de drift de date mois/jour", "E2E"],
  ];

  const lines = [];
  lines.push("# Execution Chain — Test Matrix");
  lines.push("");
  lines.push("| Chaîne | Couverture actuelle | Ce qu’il faut vérifier | Priorité |");
  lines.push("|---|---|---|---|");
  for (const row of rows) {
    const tests = row[1].length
      ? row[1].map((t) => `${t.file}::${t.title}`).slice(0, 2).join(" ; ")
      : "—";
    const priority = row[0].includes("Suppression") || row[0].includes("Timezone") ? "P0/P1" : "P0";
    lines.push(`| ${row[0]} | ${tests} | ${row[2]} | ${priority} |`);
  }
  lines.push("");

  lines.push("## Scénarios edge cases obligatoires (avant redesign)");
  lines.push("");
  lines.push("1. Suppression d’action récurrente + retour sur Today + vérif non-régénération.");
  lines.push("2. Retour après 7 jours inactif + vérif conversion planned->missed.");
  lines.push("3. selectedDate passé/futur + tentative d’exécution + cohérence verrouillage.");
  lines.push("4. Action ANYTIME sans heure + validation + impact pilotage.");
  lines.push("5. Modification plan (jours/heure/période) + cohérence Calendar/Today/Pilotage.");
  lines.push("");

  return `${lines.join("\n")}\n`;
}

function main() {
  if (!fs.existsSync(MAP_FILE)) {
    console.error(`Missing ${path.relative(ROOT, MAP_FILE)}. Run execution-chain-audit-scan first.`);
    process.exit(1);
  }
  const map = JSON.parse(fs.readFileSync(MAP_FILE, "utf8"));

  fs.mkdirSync(path.dirname(AUDIT_FILE), { recursive: true });
  fs.writeFileSync(AUDIT_FILE, renderAudit(map), "utf8");
  fs.writeFileSync(JOURNEY_FILE, renderJourney(map), "utf8");
  fs.writeFileSync(PLAN_FILE, renderFixPlan(map), "utf8");
  fs.writeFileSync(MATRIX_FILE, renderTestMatrix(map), "utf8");

  // eslint-disable-next-line no-console
  console.log(`[execution-chain-audit] wrote ${path.relative(ROOT, AUDIT_FILE)}`);
  // eslint-disable-next-line no-console
  console.log(`[execution-chain-audit] wrote ${path.relative(ROOT, JOURNEY_FILE)}`);
  // eslint-disable-next-line no-console
  console.log(`[execution-chain-audit] wrote ${path.relative(ROOT, PLAN_FILE)}`);
  // eslint-disable-next-line no-console
  console.log(`[execution-chain-audit] wrote ${path.relative(ROOT, MATRIX_FILE)}`);
}

main();
