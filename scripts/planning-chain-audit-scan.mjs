#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const SRC_DIR = path.join(ROOT, "src");
const TESTS_DIR = path.join(ROOT, "tests");
const OUT_FILE = path.join(ROOT, "docs", "planning-chain-map.json");

const CODE_EXT = new Set([".js", ".jsx", ".ts", ".tsx"]);

const CORE_FILES = [
  "src/logic/goals.js",
  "src/logic/occurrencePlanner.js",
  "src/logic/scheduleRules.js",
  "src/logic/occurrences.js",
  "src/logic/calendar.js",
  "src/logic/metrics.js",
  "src/logic/progressionModel.js",
  "src/logic/pilotage.js",
  "src/logic/reporting.js",
  "src/features/pilotage/radarModel.js",
  "src/pages/Home.jsx",
  "src/pages/SessionMVP.jsx",
  "src/ui/calendar/CalendarCard.jsx",
  "src/ui/calendar/DayRail.jsx",
  "src/pages/CreateV2Habits.jsx",
  "src/pages/CreateV2HabitOneOff.jsx",
  "src/pages/CreateV2HabitRecurring.jsx",
  "src/pages/CreateV2HabitAnytime.jsx",
  "src/pages/CreateV2Outcome.jsx",
  "src/pages/CreateV2LinkOutcome.jsx",
  "src/pages/CreateV2PickCategory.jsx",
  "src/creation/creationSchema.js",
  "src/creation/creationDraft.js",
  "src/logic/state/normalizers.js",
  "src/logic/state/migrations.js",
  "src/pages/Categories.jsx",
  "src/features/library/CategoryManageInline.jsx",
  "src/pages/EditItem.jsx",
  "src/App.jsx",
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
    const ext = path.extname(entry.name);
    if (!CODE_EXT.has(ext)) continue;
    out.push(full);
  }
  return out;
}

function rel(file) {
  return path.relative(ROOT, file).split(path.sep).join("/");
}

function read(file) {
  return fs.readFileSync(path.join(ROOT, file), "utf8");
}

function safeRead(file) {
  const full = path.join(ROOT, file);
  if (!fs.existsSync(full)) return "";
  return fs.readFileSync(full, "utf8");
}

function toSnippet(line) {
  return line.replace(/\s+/g, " ").trim().slice(0, 180);
}

function findAll(file, matcher, max = 20) {
  const content = safeRead(file);
  if (!content) return [];
  const rows = [];
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
    rows.push({
      file,
      line: i + 1,
      snippet: toSnippet(line),
    });
    if (rows.length >= max) break;
  }
  return rows;
}

function first(file, matcher) {
  const list = findAll(file, matcher, 1);
  return list[0] || null;
}

function parseImports(content) {
  const rows = [];
  const regex = /^\s*import\s+.+?\s+from\s+["'](.+?)["'];?\s*$/gm;
  let match;
  while ((match = regex.exec(content))) {
    rows.push(match[1]);
  }
  return rows;
}

function parseExports(content) {
  const names = [];
  const regex = /^\s*export\s+(?:async\s+)?function\s+([A-Za-z0-9_]+)/gm;
  let match;
  while ((match = regex.exec(content))) {
    names.push(match[1]);
  }
  return names;
}

function inferDomain(file) {
  if (file.includes("CreateV2") || file.includes("creation/")) return "create-flow";
  if (file.includes("occurrencePlanner") || file.includes("scheduleRules")) return "occurrence-generation";
  if (file.includes("occurrences.js") || file.includes("goals.js")) return "core-planning-state";
  if (file.includes("calendar") || file.includes("CalendarCard") || file.includes("DayRail")) return "calendar";
  if (file.includes("SessionMVP") || file.includes("session")) return "session";
  if (file.includes("pilotage") || file.includes("metrics") || file.includes("progressionModel") || file.includes("reporting")) {
    return "pilotage-stats";
  }
  if (file.includes("normalizers") || file.includes("migrations")) return "state-normalization";
  if (file.includes("Home.jsx") || file.includes("App.jsx")) return "app-orchestration";
  return "other";
}

function inferRoles(file) {
  const roles = [];
  if (file === "src/logic/goals.js") roles.push("create/update/delete goals", "trigger occurrence window generation");
  if (file === "src/logic/occurrencePlanner.js") roles.push("generate occurrences from rules", "mark planned as missed", "window conflict resolution");
  if (file === "src/logic/scheduleRules.js") roles.push("build/normalize/sync schedule rules");
  if (file === "src/logic/occurrences.js") roles.push("occurrence persistence mutations", "status transitions");
  if (file === "src/pages/Home.jsx") roles.push("today/session selection", "calendar counters", "local window ensuring");
  if (file === "src/logic/calendar.js") roles.push("calendar day grouping/color/count helpers");
  if (file === "src/pages/SessionMVP.jsx") roles.push("session execution UI", "occurrence status actions");
  if (file === "src/pages/Pilotage.jsx") roles.push("pilotage dashboards", "report generation UI");
  if (file === "src/features/pilotage/radarModel.js") roles.push("radar analytics");
  if (file === "src/creation/creationDraft.js") roles.push("create flow draft normalization");
  if (file === "src/pages/CreateV2Habits.jsx") roles.push("main action creation form", "conflict resolution during save");
  if (file === "src/logic/state/migrations.js") roles.push("schema migration", "schedule rule seeding");
  if (!roles.length) roles.push("supporting module");
  return roles;
}

function extractFunctionBlock(content, markerRegex) {
  const startMatch = markerRegex.exec(content);
  if (!startMatch || startMatch.index == null) return "";
  const startIndex = startMatch.index;
  const braceIndex = content.indexOf("{", startIndex);
  if (braceIndex < 0) return "";
  let depth = 0;
  for (let i = braceIndex; i < content.length; i += 1) {
    const ch = content[i];
    if (ch === "{") depth += 1;
    if (ch === "}") {
      depth -= 1;
      if (depth === 0) return content.slice(startIndex, i + 1);
    }
  }
  return content.slice(startIndex);
}

function countRegex(content, regex) {
  const matches = content.match(regex);
  return matches ? matches.length : 0;
}

function parseTestTitles(content) {
  const out = [];
  const regex = /\b(?:it|test)\(\s*["'`](.+?)["'`]/g;
  let match;
  while ((match = regex.exec(content))) {
    out.push(match[1]);
  }
  return out;
}

function scenarioCoverage(testIndex, keywords) {
  const hits = [];
  for (const row of testIndex) {
    const title = row.title.toLowerCase();
    if (keywords.some((k) => title.includes(k))) hits.push(row);
  }
  return hits;
}

function buildModules(files) {
  return files
    .filter((file) => fs.existsSync(path.join(ROOT, file)))
    .map((file) => {
      const content = read(file);
      const imports = parseImports(content);
      const exports = parseExports(content);
      const roles = inferRoles(file);
      const evidence = [];
      const roleTokens = [
        "createGoal",
        "updateGoal",
        "deleteAction",
        "deleteOutcome",
        "ensureWindowFromScheduleRules",
        "regenerateWindowFromScheduleRules",
        "computeWindowStats",
        "computeDailyStats",
        "computeExpectedDoneMissed",
        "selectedDateKey",
        "localTodayKey",
        "scheduleRules",
      ];
      for (const token of roleTokens) {
        const hit = first(file, token);
        if (hit) evidence.push(hit);
      }
      return {
        file,
        domain: inferDomain(file),
        roles,
        imports,
        exports,
        evidence: evidence.slice(0, 8),
      };
    });
}

function buildChecks() {
  const checks = [];

  const categoriesContent = safeRead("src/pages/Categories.jsx");
  const manageInlineContent = safeRead("src/features/library/CategoryManageInline.jsx");
  const categoriesDeleteAction = extractFunctionBlock(categoriesContent, /function\s+deleteAction\s*\(/);
  const manageDeleteAction = extractFunctionBlock(manageInlineContent, /function\s+deleteAction\s*\(/);
  const deletesScheduleRules =
    /scheduleRules/.test(categoriesDeleteAction) || /scheduleRules/.test(manageDeleteAction);
  checks.push({
    id: "delete-action-schedule-rules-cleanup",
    severity: "P0",
    status: deletesScheduleRules ? "pass" : "risk",
    summary: "delete action cleanup should handle scheduleRules linked to removed goals",
    evidence: [
      ...(findAll("src/pages/Categories.jsx", /function deleteAction\(/, 1)),
      ...(findAll("src/pages/Categories.jsx", /nextOccurrences = .*goalId/, 1)),
      ...(findAll("src/features/library/CategoryManageInline.jsx", /function deleteAction\(/, 1)),
      ...(findAll("src/features/library/CategoryManageInline.jsx", /nextOccurrences = .*goalId/, 1)),
      ...(findAll("src/logic/occurrencePlanner.js", /const rulesRaw = Array\.isArray\(working\.scheduleRules\)/, 1)),
      ...(findAll("src/logic/occurrencePlanner.js", /const created = buildOccurrenceFromRule\(rule, dateKey\)/, 1)),
    ],
    rationale:
      "deletes remove goals/occurrences/reminders but not scheduleRules; generator consumes active scheduleRules and can recreate orphan occurrences if rules remain active",
  });

  const statusVocabularyCheck = {
    id: "status-vocabulary-divergence",
    severity: "P1",
    status: "risk",
    summary: "status values differ across modules (occurrence mutation vs planner/metrics/session)",
    evidence: [
      ...(findAll("src/logic/occurrences.js", /const STATUS_VALUES = new Set/, 1)),
      ...(findAll("src/logic/metrics.js", /const EXPECTED_STATUSES = new Set/, 1)),
      ...(findAll("src/logic/occurrencePlanner.js", /const patch = \{ status: "missed"/, 1)),
      ...(findAll("src/logic/occurrences.js", /if \(st === "done" \|\| st === "skipped" \|\| st === "canceled"\)/, 1)),
    ],
    rationale:
      "planner writes missed; metrics track missed/rescheduled/in_progress; session final-state check in occurrences.js only treats done/skipped/canceled as final",
  };
  checks.push(statusVocabularyCheck);

  const homeEnsureHits = findAll("src/pages/Home.jsx", /ensureWindowFromScheduleRules\(prev, fromKey, toKey, sortedIds\)/, 1);
  const narrowWindow = findAll("src/pages/Home.jsx", /addDays\(baseDate, -1\)|addDays\(baseDate, 1\)/, 2);
  checks.push({
    id: "missed-backfill-window",
    severity: "P0",
    status: homeEnsureHits.length && narrowWindow.length ? "risk" : "unknown",
    summary: "planned->missed backfill appears constrained to selected date ±1 in Home",
    evidence: [
      ...homeEnsureHits,
      ...narrowWindow,
      ...findAll("src/logic/occurrencePlanner.js", /if \(endMs == null \|\| nowMs <= endMs\) continue;/, 1),
      ...findAll("src/logic/occurrencePlanner.js", /const patch = \{ status: "missed"/, 1),
    ],
    rationale:
      "missed conversion occurs only for occurrences in provided window; Home ensures only a 3-day range around selected date, so old planned occurrences may remain planned after long inactivity",
  });

  checks.push({
    id: "discipline-calculation-duplication-home-vs-model",
    severity: "P1",
    status: "risk",
    summary: "Home computes discipline through model and local loops in parallel",
    evidence: [
      ...findAll("src/pages/Home.jsx", /computeWindowStats\(safeData, oldestHistoryKey, yesterdayKey/, 1),
      ...findAll("src/pages/Home.jsx", /function countDoneForWindow\(days\)/, 1),
      ...findAll("src/pages/Home.jsx", /const habit14 = countDoneForWindow\(14\)/, 1),
      ...findAll("src/pages/Home.jsx", /const habit90 = countDoneForWindow\(90\)/, 1),
      ...findAll("src/logic/progressionModel.js", /export function computeWindowStats/, 1),
    ],
    rationale:
      "score/ratio comes from progressionModel, but Home still derives additional habit/micro/outcome windows locally, increasing semantic drift risk with Pilotage/reporting",
  });

  checks.push({
    id: "schedule-rules-sync-dual-implementations",
    severity: "P2",
    status: "risk",
    summary: "two schedule rule sync implementations coexist",
    evidence: [
      ...findAll("src/logic/scheduleRules.js", /export function syncScheduleRulesForActions/, 1),
      ...findAll("src/logic/scheduleRules.js", /export function ensureScheduleRulesForActions/, 1),
      ...findAll("src/logic/occurrencePlanner.js", /ensureScheduleRulesForActions\(working, ids, now\)/, 1),
    ],
    rationale:
      "duplicate sync pathways increase maintenance cost and can diverge behavior over time",
  });

  const createHabits = safeRead("src/pages/CreateV2Habits.jsx");
  const stateCount = countRegex(createHabits, /useState\(/g);
  checks.push({
    id: "create-flow-cognitive-load",
    severity: "P1",
    status: stateCount >= 20 ? "risk" : "pass",
    summary: "CreateV2Habits carries high field density and mixed concerns",
    evidence: [
      ...findAll("src/pages/CreateV2Habits.jsx", /from "\.\.\/components\/UI"/, 1),
      ...findAll("src/pages/CreateV2Habits.jsx", /const \[.*\] = useState\(/, 10),
      ...findAll("src/creation/creationSchema.js", /CREATION_FLOW_HABIT = CREATION_FLOW_HABIT_LEGACY/, 1),
    ],
    rationale:
      "single screen combines scheduling/time/period/reminder/quantity/conflict logic; uxV2 path exists but default flow remains legacy",
    meta: { stateHookCount: stateCount },
  });

  return checks;
}

function buildSourceOfTruth(modules) {
  const group = (domain) => modules.filter((m) => m.domain === domain).map((m) => m.file);
  return {
    createFlow: group("create-flow"),
    occurrenceGeneration: group("occurrence-generation"),
    corePlanningState: group("core-planning-state"),
    todaySession: group("session").concat(group("app-orchestration").filter((f) => f.includes("Home"))),
    calendar: group("calendar"),
    pilotageStats: group("pilotage-stats"),
    normalizationMigration: group("state-normalization"),
  };
}

function buildDependencyEdges(modules) {
  const edgeSet = new Set();
  const localFiles = new Set(modules.map((m) => m.file));
  for (const mod of modules) {
    for (const imp of mod.imports) {
      if (!imp.startsWith(".")) continue;
      const base = path.posix.dirname(mod.file);
      const normalized = path.posix.normalize(path.posix.join(base, imp));
      const candidates = [
        `${normalized}.js`,
        `${normalized}.jsx`,
        `${normalized}.ts`,
        `${normalized}.tsx`,
        `${normalized}/index.js`,
        `${normalized}/index.jsx`,
      ];
      const target = candidates.find((c) => localFiles.has(c));
      if (target) edgeSet.add(`${mod.file}=>${target}`);
    }
  }
  return Array.from(edgeSet).map((entry) => {
    const [from, to] = entry.split("=>");
    return { from, to };
  });
}

function buildCreateFlowAudit() {
  const essentialFields = [
    {
      field: "Type d’action (ponctuelle / récurrente / anytime)",
      reason: "choix indispensable pour définir le modèle d’occurrence",
      evidence: findAll("src/pages/CreateV2HabitType.jsx", /CreateV2HabitType|ONE_OFF|RECURRING|ANYTIME/, 4),
    },
    {
      field: "Titre action",
      reason: "minimum pour persistance/actionnable",
      evidence: findAll("src/pages/CreateV2Habits.jsx", /title|Nouvelle action/, 4),
    },
    {
      field: "Date unique ou jours attendus",
      reason: "définit la cadence attendue",
      evidence: [
        ...findAll("src/pages/CreateV2Habits.jsx", /oneOffDate|daysOfWeek|Choisis au moins un jour/, 4),
        ...findAll("src/creation/creationDraft.js", /expectedDays|repeat = deriveLegacyRepeatFromExpectedDays/, 2),
      ],
    },
    {
      field: "Heure (optionnelle one-off, requise récurrent standard)",
      reason: "nécessaire pour Session/Aujourd’hui",
      evidence: findAll("src/pages/CreateV2Habits.jsx", /requiresStartTime|Choisis une heure/, 4),
    },
    {
      field: "Catégorie finale",
      reason: "détermine affichage Home/Bibliothèque/Pilotage",
      evidence: findAll("src/pages/CreateV2PickCategory.jsx", /category|onDone|safeUpdateGoal/, 5),
    },
  ];

  const advancedFields = [
    {
      field: "Période activeFrom/activeTo",
      reason: "utile pour power users, surcharge débutant",
      evidence: findAll("src/pages/CreateV2Habits.jsx", /activeFrom|activeTo|période valide/i, 6),
    },
    {
      field: "Schedule mode WEEKLY_SLOTS + slots par jour",
      reason: "configuration fine; candidat mode avancé",
      evidence: findAll("src/pages/CreateV2Habits.jsx", /WEEKLY_SLOTS|weeklySlotsByDay|créneau/, 8),
    },
    {
      field: "Rappels + fenêtre reminder",
      reason: "non essentiel pour premier succès utilisateur",
      evidence: findAll("src/pages/CreateV2Habits.jsx", /reminderTime|reminderWindowStart|reminderWindowEnd/, 6),
    },
    {
      field: "Quantity value/unit/period",
      reason: "mesure avancée; augmente charge cognitive",
      evidence: findAll("src/pages/CreateV2Habits.jsx", /quantityValue|quantityUnit|quantityPeriod/, 6),
    },
    {
      field: "Miss policy / grace / completionMode",
      reason: "contrats comportementaux avancés",
      evidence: findAll("src/pages/CreateV2Habits.jsx", /missPolicy|graceMinutes|completionMode|completionTarget/, 6),
    },
    {
      field: "Résolution de conflit proactive",
      reason: "utile mais doit rester option avancée",
      evidence: findAll("src/pages/CreateV2Habits.jsx", /ConflictResolver|findFirstConflict|applyConflict/, 6),
    },
  ];

  const complexity = {
    createV2HabitsUseStateCount: countRegex(safeRead("src/pages/CreateV2Habits.jsx"), /useState\(/g),
    createV2HabitsImportsLegacyUI: Boolean(first("src/pages/CreateV2Habits.jsx", /from "\.\.\/components\/UI"/)),
    uxV2FlowAvailable: Boolean(first("src/creation/creationSchema.js", /CREATION_FLOW_HABIT_UX_V2/)),
    defaultFlowStillLegacy: Boolean(first("src/creation/creationSchema.js", /CREATION_FLOW_HABIT = CREATION_FLOW_HABIT_LEGACY/)),
  };

  return { essentialFields, advancedFields, complexity };
}

function buildScenarios(testIndex) {
  const scenarios = [
    {
      id: "one-off-no-time",
      title: "Action ponctuelle sans heure",
      checks: "création + occurrence day-level + affichage today/calendar/pilotage",
      evidence: [
        ...findAll("src/pages/CreateV2Habits.jsx", /isOneOff|timeMode: "NONE"|oneOffDate/, 4),
        ...findAll("src/logic/scheduleRules.js", /kind === "one_time"/, 1),
      ],
      coverage: scenarioCoverage(testIndex, ["ponctuelle"]),
    },
    {
      id: "one-off-with-time",
      title: "Action ponctuelle avec heure",
      checks: "startTime fixé et occurrence fixe",
      evidence: findAll("src/pages/CreateV2Habits.jsx", /isTypeOneOff && timeMode === "FIXED"|startAt = /, 4),
      coverage: scenarioCoverage(testIndex, ["ponctuelle", "projet + action"]),
    },
    {
      id: "recurring-simple",
      title: "Action récurrente simple",
      checks: "daysOfWeek + fixed time + génération multi-jours",
      evidence: [
        ...findAll("src/pages/CreateV2HabitRecurring.jsx", /repeat: "weekly"|daysOfWeek/, 3),
        ...findAll("src/logic/scheduleRules.js", /buildScheduleRulesFromAction/, 1),
      ],
      coverage: scenarioCoverage(testIndex, ["récurrente"]),
    },
    {
      id: "recurring-specific-days",
      title: "Récurrence jours spécifiques (lun/mer/ven)",
      checks: "daysOfWeek filtrés dans ruleAppliesOnDate",
      evidence: [
        ...findAll("src/logic/scheduleRules.js", /resolveDaysOfWeek|daysOfWeek/, 3),
        ...findAll("src/logic/occurrencePlanner.js", /const days = Array\.isArray\(rule.daysOfWeek\)/, 2),
      ],
      coverage: scenarioCoverage(testIndex, ["récurrente"]),
    },
    {
      id: "period-bounds",
      title: "Période activeFrom/activeTo",
      checks: "occurrences hors période supprimées ou non générées",
      evidence: [
        ...findAll("src/logic/occurrencePlanner.js", /isDateWithinPeriod|Period enforcement/, 4),
        ...findAll("src/pages/CreateV2Habits.jsx", /activeFrom|activeTo/, 4),
      ],
      coverage: scenarioCoverage(testIndex, ["récurrente", "ponctuelle"]),
    },
    {
      id: "edited-after-planning",
      title: "Modification après planification",
      checks: "rebuild occurrences via regenerateWindowFromScheduleRules",
      evidence: [
        ...findAll("src/pages/Categories.jsx", /const planChanged = prevPlanSig !== nextPlanSig;/, 1),
        ...findAll("src/pages/Categories.jsx", /next = regenerateWindowFromScheduleRules\(next, goalId, fromKey, toKey\);/, 1),
        ...findAll("src/pages/EditItem.jsx", /const planChanged = prevPlanSig !== nextPlanSig;/, 1),
        ...findAll("src/pages/EditItem.jsx", /next = regenerateWindowFromScheduleRules\(next, goalId, fromKey, toKey\);/, 1),
      ],
      coverage: scenarioCoverage(testIndex, ["createflow"]),
    },
    {
      id: "delete-cancel-skipped",
      title: "Suppression / canceled / skipped",
      checks: "cleanup coherence goals/occurrences/reminders/sessions/checks",
      evidence: [
        ...findAll("src/pages/Categories.jsx", /setOccurrenceStatusById\(occId, "canceled"/, 2),
        ...findAll("src/logic/occurrences.js", /setOccurrenceStatusById/, 1),
        ...findAll("src/pages/Categories.jsx", /function deleteAction\(/, 1),
      ],
      coverage: scenarioCoverage(testIndex, ["conflit", "categorygate"]),
    },
    {
      id: "selected-date-not-today",
      title: "Date sélectionnée différente de today",
      checks: "today/session et micro-actions restent cohérents",
      evidence: [
        ...findAll("src/pages/Home.jsx", /selectedDateKey|selectedStatus|isMicroToday/, 5),
        ...findAll("src/ui/calendar/DayRail.jsx", /selectedDateKey|localTodayKey/, 4),
      ],
      coverage: scenarioCoverage(testIndex, ["calendrier mois"]),
    },
    {
      id: "timezone-datekey-consistency",
      title: "Fuseau / dateKey cohérence",
      checks: "normalizeLocalDateKey across planning + calendar invariants",
      evidence: [
        ...findAll("src/pages/Home.jsx", /calendar-datekey-invariant|normalizeLocalDateKey/, 4),
        ...findAll("src/logic/calendar.js", /normalizeLocalDateKey/, 3),
      ],
      coverage: scenarioCoverage(testIndex, ["anti-décalage", "calendrier mois"]),
    },
    {
      id: "expected-done-missed-cross-screen",
      title: "Consistance expected/done/missed Home/Calendar/Pilotage",
      checks: "same semantics in metrics/progression/radar/reporting",
      evidence: [
        ...findAll("src/logic/metrics.js", /EXPECTED_STATUSES|stats\.expected/, 3),
        ...findAll("src/logic/progressionModel.js", /computeExpectedDoneMissed|isExpected/, 3),
        ...findAll("src/features/pilotage/radarModel.js", /expected|done|missed/, 3),
      ],
      coverage: scenarioCoverage(testIndex, ["report", "metrics", "progression", "pilotage"]),
    },
  ];

  return scenarios.map((scenario) => {
    const coverageCount = scenario.coverage.length;
    const coverage = coverageCount >= 2 ? "covered" : coverageCount === 1 ? "partial" : "gap";
    return {
      ...scenario,
      coverage,
      coverageEvidence: scenario.coverage.slice(0, 4),
    };
  });
}

function buildTestsSection() {
  const unitFiles = walk(path.join(ROOT, "src/logic")).filter((file) => file.endsWith(".test.js"));
  const e2eFiles = walk(TESTS_DIR).filter((file) => file.endsWith(".spec.js"));

  const titles = [];
  for (const file of [...unitFiles, ...e2eFiles]) {
    const relative = rel(file);
    const content = fs.readFileSync(file, "utf8");
    const parsed = parseTestTitles(content);
    for (const title of parsed) {
      titles.push({ file: relative, title });
    }
  }

  return {
    unitFiles: unitFiles.map(rel),
    e2eFiles: e2eFiles.map(rel),
    titles,
  };
}

function buildBugCandidates(checks) {
  const candidates = [];
  for (const check of checks) {
    if (check.status !== "risk") continue;
    const severity = check.severity || "P2";
    const repro = [];
    if (check.id === "delete-action-schedule-rules-cleanup") {
      repro.push("Créer une action récurrente avec occurrences.");
      repro.push("Supprimer l’action depuis Bibliothèque.");
      repro.push("Déclencher ensureWindowFromScheduleRules (ouvrir Aujourd’hui / changer date).");
      repro.push("Observer réapparition d’occurrences orphelines ou stats incohérentes.");
    } else if (check.id === "missed-backfill-window") {
      repro.push("Créer des occurrences planifiées sur plusieurs jours futurs.");
      repro.push("Ne pas ouvrir l’app pendant plusieurs jours.");
      repro.push("Revenir sur Aujourd’hui: fenêtre ensure limitée à ±1 jour.");
      repro.push("Observer anciennes occurrences toujours planned au lieu de missed.");
    } else if (check.id === "status-vocabulary-divergence") {
      repro.push("Forcer une occurrence avec status=missed via planner.");
      repro.push("Vérifier les modules qui considèrent les statuts finaux (session/local helpers).");
      repro.push("Observer divergence de traitement entre modules.");
    } else if (check.id === "discipline-calculation-duplication-home-vs-model") {
      repro.push("Comparer score discipline Home vs Pilotage sur un jeu de données mixte.");
      repro.push("Modifier une sémantique locale (ex. 14j) et observer écart UI.");
    } else if (check.id === "create-flow-cognitive-load") {
      repro.push("Mesurer completion rate du flow débutant (type -> action -> catégorie).");
      repro.push("Observer abandon lorsque champs avancés apparaissent tôt.");
    }
    candidates.push({
      id: check.id,
      severity,
      title: check.summary,
      rationale: check.rationale,
      evidence: check.evidence.slice(0, 6),
      reproSteps: repro,
    });
  }
  return candidates;
}

function main() {
  const srcFiles = walk(SRC_DIR);
  const testFiles = walk(TESTS_DIR);
  const modules = buildModules(CORE_FILES);
  const checks = buildChecks();
  const tests = buildTestsSection();
  const scenarios = buildScenarios(tests.titles);
  const bugCandidates = buildBugCandidates(checks);

  const map = {
    generatedAt: new Date().toISOString(),
    scope: {
      src: "src/**",
      tests: "tests/**",
    },
    filesScanned: {
      src: srcFiles.length,
      tests: testFiles.length,
      coreMapped: modules.length,
    },
    modules,
    sourceOfTruth: buildSourceOfTruth(modules),
    dependencyEdges: buildDependencyEdges(modules),
    checks,
    scenarios,
    tests,
    createFlowAudit: buildCreateFlowAudit(),
    bugCandidates,
  };

  fs.mkdirSync(path.dirname(OUT_FILE), { recursive: true });
  fs.writeFileSync(OUT_FILE, `${JSON.stringify(map, null, 2)}\n`, "utf8");
  console.log(`[planning-chain-audit] wrote ${path.relative(ROOT, OUT_FILE)}`);
}

main();
