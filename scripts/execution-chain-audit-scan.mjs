#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const SRC_DIR = path.join(ROOT, "src");
const TESTS_DIR = path.join(ROOT, "tests");
const OUT_FILE = path.join(ROOT, "docs", "execution-chain-map.json");

const CODE_EXT = new Set([".js", ".jsx", ".ts", ".tsx"]);

const CORE_FILES = [
  "src/App.jsx",
  "src/pages/Home.jsx",
  "src/pages/SessionMVP.jsx",
  "src/pages/Session.jsx",
  "src/pages/Pilotage.jsx",
  "src/pages/Categories.jsx",
  "src/pages/EditItem.jsx",
  "src/pages/CreateV2Habits.jsx",
  "src/ui/create/CreateFlowModal.jsx",
  "src/creation/creationSchema.js",
  "src/creation/creationDraft.js",
  "src/hooks/useCreateFlowOrchestration.js",
  "src/ui/calendar/CalendarCard.jsx",
  "src/ui/calendar/DayRail.jsx",
  "src/ui/session/sessionPlanner.js",
  "src/ui/focus/FocusCard.jsx",
  "src/logic/goals.js",
  "src/logic/scheduleRules.js",
  "src/logic/occurrencePlanner.js",
  "src/logic/occurrences.js",
  "src/logic/sessionResolver.js",
  "src/logic/sessions.js",
  "src/logic/sessionsV2.js",
  "src/logic/metrics.js",
  "src/logic/progressionModel.js",
  "src/logic/pilotage.js",
  "src/logic/reporting.js",
  "src/features/pilotage/radarModel.js",
  "src/logic/state/normalizers.js",
  "src/logic/state/migrations.js",
  "src/data/useUserData.js",
  "src/data/userDataApi.js",
];

const STAGE_DEFS = [
  {
    id: "planning",
    title: "Création / Planification",
    patterns: [
      ["src/ui/create/CreateFlowModal.jsx", /CreateV2Habit|CreateV2Outcome|step === "choice"/],
      ["src/pages/CreateV2Habits.jsx", /planType|timeMode|daysOfWeek|activeFrom|activeTo/],
      ["src/creation/creationDraft.js", /ONE_OFF|RECURRING|ANYTIME|expectedDays/],
      ["src/creation/creationSchema.js", /CREATION_FLOW_HABIT|CREATION_FLOW_HABIT_UX_V2/],
    ],
  },
  {
    id: "persistence",
    title: "Persistance / normalisation",
    patterns: [
      ["src/data/useUserData.js", /migrate\(|loadUserData|upsertUserData|saveState/],
      ["src/logic/state/migrations.js", /migrateLegacyActivity|scheduleRules|activeSession/],
      ["src/logic/state/normalizers.js", /normalizeGoal|normalizeCategory|sanitizePilotageRadarSelection/],
    ],
  },
  {
    id: "calendar",
    title: "Calendrier / occurrences",
    patterns: [
      ["src/logic/occurrencePlanner.js", /ensureWindowFromScheduleRules|buildOccurrenceFromRule|ruleAppliesOnDate/],
      ["src/logic/scheduleRules.js", /buildScheduleRulesFromAction|syncScheduleRulesForActions|ensureScheduleRulesForActions/],
      ["src/ui/calendar/CalendarCard.jsx", /plannedByDate|doneByDate|onDayOpen/],
      ["src/pages/Home.jsx", /plannedByDate|doneByDate|plannedCalendarOccurrences/],
    ],
  },
  {
    id: "today",
    title: "Aujourd’hui / sélection du jour",
    patterns: [
      ["src/pages/Home.jsx", /selectedDateKey|localTodayKey|selectedStatus/],
      ["src/pages/Home.jsx", /focusOccurrence|handleStartSession|todayHero/],
      ["src/ui/focus/FocusCard.jsx", /Utilise “Démarrer” dans “À faire maintenant”/],
    ],
  },
  {
    id: "execution",
    title: "Exécution / Session",
    patterns: [
      ["src/App.jsx", /tab === "session"|SessionMVP/],
      ["src/pages/SessionMVP.jsx", /setOccurrenceStatusById|Terminer|Reporter|Annuler/],
      ["src/pages/Session.jsx", /timerRunning|upsertSessionV2|setOccurrenceStatusById/],
      ["src/logic/sessionResolver.js", /resolveExecutableOccurrence|isFinalOccurrenceStatus/],
    ],
  },
  {
    id: "validation",
    title: "Validation / statuts",
    patterns: [
      ["src/logic/occurrences.js", /STATUS_VALUES|setOccurrenceStatusById|setOccurrencesStatusForGoalDate/],
      ["src/pages/EditItem.jsx", /setOccurrenceStatusById\(occId, "canceled"/],
      ["src/pages/Categories.jsx", /setOccurrenceStatusById\(occId, "canceled"/],
    ],
  },
  {
    id: "pilotage",
    title: "Pilotage / progression",
    patterns: [
      ["src/logic/metrics.js", /EXPECTED_STATUSES|computeDailyStats|computeGoalStats/],
      ["src/logic/progressionModel.js", /computeExpectedDoneMissed|computeWindowStats|MICRO_ACTION_WEIGHT/],
      ["src/pages/Pilotage.jsx", /computeWindowStats|buildReport|computeCategoryRadarRows/],
      ["src/features/pilotage/radarModel.js", /expected|done|missed|status === "missed"/],
    ],
  },
];

function walk(dir) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...walk(full));
      continue;
    }
    if (CODE_EXT.has(path.extname(entry.name))) out.push(full);
  }
  return out;
}

function safeRead(file) {
  const full = path.join(ROOT, file);
  if (!fs.existsSync(full)) return "";
  return fs.readFileSync(full, "utf8");
}

function toSnippet(line) {
  return line.replace(/\s+/g, " ").trim().slice(0, 200);
}

function findAll(file, matcher, max = 12) {
  const content = safeRead(file);
  if (!content) return [];
  const out = [];
  const lines = content.split(/\r?\n/);
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const hit =
      typeof matcher === "string"
        ? line.includes(matcher)
        : matcher instanceof RegExp
          ? matcher.test(line)
          : false;
    if (!hit) continue;
    out.push({ file, line: i + 1, snippet: toSnippet(line) });
    if (out.length >= max) break;
  }
  return out;
}

function first(file, matcher) {
  return findAll(file, matcher, 1)[0] || null;
}

function parseImports(content) {
  const out = [];
  const regex = /^\s*import\s+.+?\s+from\s+["'](.+?)["'];?\s*$/gm;
  let match;
  while ((match = regex.exec(content))) out.push(match[1]);
  return out;
}

function parseExports(content) {
  const out = [];
  const regex = /^\s*export\s+(?:async\s+)?function\s+([A-Za-z0-9_]+)/gm;
  let match;
  while ((match = regex.exec(content))) out.push(match[1]);
  return out;
}

function parseTestTitles(content) {
  const out = [];
  const regex = /\b(?:it|test)\(\s*["'`](.+?)["'`]/g;
  let match;
  while ((match = regex.exec(content))) out.push(match[1]);
  return out;
}

function buildModuleIndex(files) {
  return files
    .filter((file) => fs.existsSync(path.join(ROOT, file)))
    .map((file) => {
      const content = safeRead(file);
      return {
        file,
        imports: parseImports(content),
        exports: parseExports(content),
      };
    });
}

function buildStages() {
  return STAGE_DEFS.map((stage) => {
    const evidence = [];
    for (const [file, matcher] of stage.patterns) {
      evidence.push(...findAll(file, matcher, 3));
    }
    const files = Array.from(new Set(evidence.map((row) => row.file)));
    return { ...stage, files, evidence };
  });
}

function buildStatusSemantics() {
  return {
    occurrenceStatuses: ["planned", "done", "skipped", "canceled"],
    metricsExtraStatuses: ["missed", "rescheduled", "in_progress"],
    expectedDefinition: "expected = occurrences non canceled/skipped (+ micro pondéré selon progressionModel)",
    evidence: [
      ...findAll("src/logic/occurrences.js", /const STATUS_VALUES = new Set/, 1),
      ...findAll("src/logic/metrics.js", /const EXPECTED_STATUSES = new Set/, 1),
      ...findAll("src/logic/progressionModel.js", /const CANCELED_STATUSES = new Set/, 1),
      ...findAll("src/logic/occurrencePlanner.js", /status: "missed"/, 1),
    ],
  };
}

function buildChecks() {
  const checks = [];

  const categoriesDelete = safeRead("src/pages/Categories.jsx");
  const manageDelete = safeRead("src/features/library/CategoryManageInline.jsx");
  const deletesScheduleRules = /scheduleRules/.test(categoriesDelete) || /scheduleRules/.test(manageDelete);
  checks.push({
    id: "delete-action-schedule-rules-cleanup",
    severity: "P0",
    area: "planning->calendar",
    status: deletesScheduleRules ? "pass" : "risk",
    summary: "Suppression d’action sans cleanup explicite des scheduleRules",
    impact: "Risque d’occurrences orphelines régénérées après suppression",
    evidence: [
      ...findAll("src/pages/Categories.jsx", /function deleteAction\(/, 1),
      ...findAll("src/pages/Categories.jsx", /nextOccurrences = .*goalId/, 1),
      ...findAll("src/features/library/CategoryManageInline.jsx", /function deleteAction\(/, 1),
      ...findAll("src/logic/occurrencePlanner.js", /const rulesRaw = Array\.isArray\(working\.scheduleRules\)/, 1),
    ],
    repro: [
      "Créer action récurrente.",
      "Supprimer action depuis Bibliothèque.",
      "Revenir sur Today (ensureWindow).",
      "Vérifier réapparition/compteurs incohérents.",
    ],
  });

  const narrowWindow = findAll("src/pages/Home.jsx", /addDays\(baseDate, -1\)|addDays\(baseDate, 1\)/, 2);
  checks.push({
    id: "missed-backfill-window",
    severity: "P0",
    area: "today->validation",
    status: narrowWindow.length ? "risk" : "unknown",
    summary: "Backfill des missed contraint à la fenêtre selectedDate ±1",
    impact: "Occurences anciennes potentiellement laissées en planned après longue absence",
    evidence: [
      ...findAll("src/pages/Home.jsx", /ensureWindowFromScheduleRules\(prev, fromKey, toKey, sortedIds\)/, 1),
      ...narrowWindow,
      ...findAll("src/logic/occurrencePlanner.js", /status: "missed"/, 1),
    ],
    repro: [
      "Planifier sur plusieurs jours.",
      "Ne pas ouvrir l’app plusieurs jours.",
      "Revenir Today sans parcourir les jours passés.",
      "Comparer planned/missed attendu vs affiché.",
    ],
  });

  const sessionMvpMounted = Boolean(first("src/App.jsx", /tab === "session" \? \(/)) && Boolean(first("src/App.jsx", /<SessionMVP/));
  const richSessionMounted = Boolean(first("src/App.jsx", /<Session\s/));
  checks.push({
    id: "session-page-bifurcation",
    severity: "P1",
    area: "today->execution",
    status: sessionMvpMounted && !richSessionMounted ? "risk" : "pass",
    summary: "Le tab session monte SessionMVP; Session.jsx riche existe mais n’est pas branché",
    impact: "Risque de logique/exigences d’exécution fragmentées (deux implémentations)",
    evidence: [
      ...findAll("src/App.jsx", /import SessionMVP/, 1),
      ...findAll("src/App.jsx", /tab === "session" \? \(/, 1),
      ...findAll("src/App.jsx", /<SessionMVP/, 1),
      ...findAll("src/pages/Session.jsx", /export default function Session/, 1),
    ],
    repro: [
      "Démarrer une session depuis Today.",
      "Observer que l’écran session correspond au MVP.",
      "Comparer fonctionnalités attendues vs Session.jsx.",
    ],
  });

  const sessionsLegacyUsed = Boolean(first("src/logic/sessions.js", /export function startSessionForOccurrence/));
  const sessionsLegacyImported = Boolean(first("src/App.jsx", /from "\.\/logic\/sessions"/)) ||
    Boolean(first("src/pages/Home.jsx", /from "\.\.\/logic\/sessions"/)) ||
    Boolean(first("src/pages/SessionMVP.jsx", /from "\.\.\/logic\/sessions"/));
  checks.push({
    id: "session-model-duality",
    severity: "P1",
    area: "execution->validation",
    status: sessionsLegacyUsed && !sessionsLegacyImported ? "risk" : "pass",
    summary: "API sessions.js présente mais flux actif basé sur ui.activeSession + sessionsV2",
    impact: "Dette de maintenance et confusion sur la source de vérité de session",
    evidence: [
      ...findAll("src/logic/sessions.js", /export function startSessionForOccurrence/, 1),
      ...findAll("src/logic/sessionsV2.js", /export function upsertSessionV2/, 1),
      ...findAll("src/pages/SessionMVP.jsx", /activeSession/, 2),
      ...findAll("src/pages/Home.jsx", /activeSession/, 2),
    ],
    repro: [
      "Comparer état écrit dans ui.activeSession et sessionHistory.",
      "Vérifier si sessions[] est encore utilisé par le runtime.",
    ],
  });

  checks.push({
    id: "status-vocabulary-divergence",
    severity: "P1",
    area: "validation->pilotage",
    status: "risk",
    summary: "Vocabulaire de statuts différent selon modules",
    impact: "Interprétation divergente des statuts finaux et expected",
    evidence: [
      ...findAll("src/logic/occurrences.js", /const STATUS_VALUES = new Set/, 1),
      ...findAll("src/logic/metrics.js", /const EXPECTED_STATUSES = new Set/, 1),
      ...findAll("src/logic/occurrencePlanner.js", /status: "missed"/, 1),
      ...findAll("src/logic/sessionResolver.js", /isFinalOccurrenceStatus/, 1),
    ],
    repro: [
      "Injecter une occurrence status=missed.",
      "Comparer rendu/calcul Home, Session resolver et Pilotage.",
    ],
  });

  checks.push({
    id: "create-flow-cognitive-load",
    severity: "P1",
    area: "planning",
    status: "risk",
    summary: "Flow création dense pour débutant; mode Essentiel non explicite",
    impact: "Abandon en création et confusion entre Quick/Focus planning",
    evidence: [
      ...findAll("src/pages/CreateV2Habits.jsx", /const \[.*\] = useState\(/, 8),
      ...findAll("src/creation/creationSchema.js", /CREATION_FLOW_HABIT = CREATION_FLOW_HABIT_LEGACY/, 1),
      ...findAll("src/ui/create/CreateFlowModal.jsx", /step === "choice"/, 1),
    ],
    repro: [
      "Créer action récurrente avec options avancées.",
      "Mesurer nombre de champs obligatoires/perçus.",
      "Comparer avec flow simple attendu (titre+jour+heure).",
    ],
  });

  const addOccurrenceHookPresent = Boolean(first("src/pages/Home.jsx", /onAddOccurrence/));
  const addOccurrenceHookWired = Boolean(first("src/App.jsx", /onAddOccurrence=/));
  checks.push({
    id: "calendar-add-occurrence-unwired",
    severity: "P2",
    area: "calendar->today",
    status: addOccurrenceHookPresent && !addOccurrenceHookWired ? "risk" : "pass",
    summary: "CTA Ajouter occurrence dans calendrier potentiellement non câblé au parent",
    impact: "Action UI visible mais sans effet selon contexte",
    evidence: [
      ...findAll("src/pages/Home.jsx", /onAddOccurrence,/, 1),
      ...findAll("src/pages/Home.jsx", /onAddOccurrence=\{typeof onAddOccurrence === "function" \? handleAddOccurrence : null\}/, 1),
      ...findAll("src/App.jsx", /<Home/, 1),
    ],
    repro: [
      "Ouvrir calendrier mois Today.",
      "Cliquer Ajouter sur un jour.",
      "Vérifier création effective d’occurrence.",
    ],
  });

  return checks;
}

function buildRatings(checks) {
  const has = (id) => checks.find((c) => c.id === id && c.status === "risk");
  const ratings = [];

  ratings.push({
    criterion: "Chaîne planification → calendrier cohérente",
    rating: has("delete-action-schedule-rules-cleanup") ? "Partiel" : "OK",
    rationale: has("delete-action-schedule-rules-cleanup")
      ? "Génération OK, mais suppression d’action peut laisser des règles réinjectables."
      : "Flux création -> règles -> occurrences cohérent.",
    evidence: has("delete-action-schedule-rules-cleanup")?.evidence || [],
  });

  ratings.push({
    criterion: "Chaîne planification → Today cohérente",
    rating: has("missed-backfill-window") ? "Partiel" : "OK",
    rationale: has("missed-backfill-window")
      ? "Today assure la fenêtre locale mais peut sous-traiter l’historique missed."
      : "Les occurrences planifiées remontent correctement dans Today.",
    evidence: has("missed-backfill-window")?.evidence || [],
  });

  ratings.push({
    criterion: "Chaîne Today → exécution/session cohérente",
    rating: has("session-page-bifurcation") ? "Partiel" : "OK",
    rationale: has("session-page-bifurcation")
      ? "Today ouvre bien une session, mais deux implémentations coexistent (MVP vs page riche)."
      : "Today et Session sont alignés.",
    evidence: has("session-page-bifurcation")?.evidence || [],
  });

  ratings.push({
    criterion: "Chaîne exécution/session → validation cohérente",
    rating: has("session-model-duality") ? "Partiel" : "OK",
    rationale: has("session-model-duality")
      ? "Validation fonctionne, mais source de vérité session dispersée."
      : "Validation de session unifiée.",
    evidence: has("session-model-duality")?.evidence || [],
  });

  ratings.push({
    criterion: "Chaîne validation → pilotage/progression cohérente",
    rating: has("status-vocabulary-divergence") ? "Partiel" : "OK",
    rationale: has("status-vocabulary-divergence")
      ? "Calculs robustes globalement, mais sémantique statuts non homogène."
      : "Stats alignées entre validation et pilotage.",
    evidence: has("status-vocabulary-divergence")?.evidence || [],
  });

  ratings.push({
    criterion: "Compréhensibilité utilisateur (débutant)",
    rating: has("create-flow-cognitive-load") ? "KO" : "Partiel",
    rationale: has("create-flow-cognitive-load")
      ? "Flow création trop dense; mode Essentiel implicite."
      : "Compréhensible mais encore dense.",
    evidence: has("create-flow-cognitive-load")?.evidence || [],
  });

  ratings.push({
    criterion: "Applicabilité dans la vraie vie (usage réel)",
    rating: "Partiel",
    rationale:
      "Boucle existe (planifier->exécuter->valider->analyser), mais friction création et ambiguïtés session freinent l’usage régulier.",
    evidence: [
      ...findAll("src/pages/Home.jsx", /todayHeroKicker|Commencer maintenant/, 2),
      ...findAll("src/pages/Pilotage.jsx", /computeWindowStats/, 2),
    ],
  });

  ratings.push({
    criterion: "Prêt pour itération “Flow Rapide / Affiner”",
    rating: has("create-flow-cognitive-load") ? "Partiel" : "OK",
    rationale:
      "La logique supporte déjà les types ONE_OFF/RECURRING/ANYTIME; segmentation UX Essentiel/Avancé faisable sans changer le moteur.",
    evidence: [
      ...findAll("src/creation/creationDraft.js", /ONE_OFF|RECURRING|ANYTIME/, 2),
      ...findAll("src/creation/creationSchema.js", /CREATION_FLOW_HABIT_UX_V2/, 1),
    ],
  });

  return ratings;
}

function buildQuestions() {
  return {
    sessionRole: {
      current: "Page dédiée (tab session) ouvrant SessionMVP; Session.jsx avancée non branchée.",
      recommendation: "Transformer Session en mode d’exécution unifié (single implementation), pas deux écrans concurrents.",
      evidence: [
        ...findAll("src/App.jsx", /tab === "session" \? \(/, 1),
        ...findAll("src/App.jsx", /<SessionMVP/, 1),
        ...findAll("src/pages/Session.jsx", /export default function Session/, 1),
      ],
    },
    quickActionVsFocusBlock: {
      current:
        "ANYTIME/RECURRING/ONE_OFF existent côté modèle; Focus Today met en avant une occurrence planifiée.",
      recommendation:
        "V1: Quick Action = ANYTIME sans durée obligatoire; Focus Block = occurrence planifiée avec heure/durée et retour validation.",
      evidence: [
        ...findAll("src/creation/creationDraft.js", /ANYTIME|RECURRING|ONE_OFF/, 2),
        ...findAll("src/pages/Home.jsx", /focusOccurrence|Commencer maintenant/, 2),
      ],
    },
    rewardMoment: {
      current:
        "Occurrences gagnent points au status done; micro-actions créditent wallet au done (hors occurrence standard).",
      recommendation:
        "Récompenser au moment de validation (done), pas au démarrage, pour préserver l’intégrité discipline.",
      evidence: [
        ...findAll("src/logic/occurrences.js", /POINTS_BASE|applyDoneFields/, 2),
        ...findAll("src/pages/Home.jsx", /type: "micro_done"|addCoins/, 2),
      ],
    },
    antiCheatFriction: {
      current: "Faible friction: validation done/skipped/canceled en 1 clic, sans preuve d’exécution.",
      recommendation: "V1: friction minimale contrôlée (confirmation légère pour done, historique session), pas de preuve lourde.",
      evidence: [
        ...findAll("src/pages/SessionMVP.jsx", /updateOccurrenceStatus\("done"\)|Reporter|Annuler/, 3),
        ...findAll("src/pages/Session.jsx", /confirmEndSession|cancelSession/, 2),
      ],
    },
  };
}

function buildTestsSection() {
  const unitFiles = walk(path.join(ROOT, "src/logic")).filter((f) => f.endsWith(".test.js"));
  const e2eFiles = walk(TESTS_DIR).filter((f) => f.endsWith(".spec.js"));
  const titles = [];
  for (const file of [...unitFiles, ...e2eFiles]) {
    const content = fs.readFileSync(file, "utf8");
    const rel = path.relative(ROOT, file).split(path.sep).join("/");
    for (const title of parseTestTitles(content)) titles.push({ file: rel, title });
  }
  return {
    unitFiles: unitFiles.map((f) => path.relative(ROOT, f).split(path.sep).join("/")),
    e2eFiles: e2eFiles.map((f) => path.relative(ROOT, f).split(path.sep).join("/")),
    titles,
  };
}

function buildCoverage(titles) {
  const has = (tokens) =>
    titles.filter((row) => tokens.some((token) => row.title.toLowerCase().includes(token))).slice(0, 5);
  return {
    planToCalendar: has(["ponctuelle", "récurrente", "calendrier"]),
    planToToday: has(["appsync", "ponctuelle", "action anytime"]),
    todayToSession: has(["session"]),
    validationToPilotage: has(["pilotage", "report", "metrics"]),
    categoryDeleteAndMigration: has(["categorygate", "désactivation", "supprim"]),
    timezoneEdge: has(["anti-décalage", "fin de mois"]),
  };
}

function main() {
  const srcFiles = walk(SRC_DIR);
  const testFiles = walk(TESTS_DIR);
  const modules = buildModuleIndex(CORE_FILES);
  const stages = buildStages();
  const statusSemantics = buildStatusSemantics();
  const checks = buildChecks();
  const ratings = buildRatings(checks);
  const productQuestions = buildQuestions();
  const tests = buildTestsSection();
  const coverage = buildCoverage(tests.titles);

  const map = {
    generatedAt: new Date().toISOString(),
    scope: { src: "src/**", tests: "tests/**" },
    filesScanned: {
      src: srcFiles.length,
      tests: testFiles.length,
      coreMapped: modules.length,
    },
    modules,
    stages,
    statusSemantics,
    checks,
    ratings,
    productQuestions,
    tests,
    coverage,
    topRisks: checks.filter((c) => c.status === "risk").sort((a, b) => {
      const rank = (v) => (v === "P0" ? 0 : v === "P1" ? 1 : 2);
      return rank(a.severity) - rank(b.severity);
    }),
  };

  fs.mkdirSync(path.dirname(OUT_FILE), { recursive: true });
  fs.writeFileSync(OUT_FILE, `${JSON.stringify(map, null, 2)}\n`, "utf8");
  // eslint-disable-next-line no-console
  console.log(`[execution-chain-audit] wrote ${path.relative(ROOT, OUT_FILE)}`);
}

main();
