#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const SRC_DIR = path.join(ROOT, "src");
const OUT_FILE = path.join(ROOT, "docs", "progression-map.json");

const CODE_EXT = new Set([".js", ".jsx", ".ts", ".tsx", ".css"]);

const METRICS = [
  {
    id: "metrics.computeStats",
    name: "computeStats",
    area: "core-metrics",
    token: "computeStats",
    inputs: ["occurrences[].status", "occurrences[].pointsAwarded"],
    updateCadence: "recompute in useMemo / report generation",
  },
  {
    id: "metrics.computeDailyStats",
    name: "computeDailyStats",
    area: "core-metrics",
    token: "computeDailyStats",
    inputs: ["occurrences[] in [from,to]", "filters.categoryId", "filters.goalIds"],
    updateCadence: "recompute when window/filter changes",
  },
  {
    id: "metrics.computeGoalStats",
    name: "computeGoalStats",
    area: "core-metrics",
    token: "computeGoalStats",
    inputs: ["occurrences[]", "window", "filters"],
    updateCadence: "report/radar computation",
  },
  {
    id: "metrics.computeDisciplineScore",
    name: "computeDisciplineScore",
    area: "discipline",
    token: "computeDisciplineScore",
    inputs: ["occurrences[].status", "occurrences[].date", "todayKey"],
    updateCadence: "Home disciplineBreakdown useMemo",
  },
  {
    id: "metrics.computeDisciplineScoreWindow",
    name: "computeDisciplineScoreWindow",
    area: "discipline",
    token: "computeDisciplineScoreWindow",
    inputs: ["occurrences[].status", "windowKeys", "todayKey"],
    updateCadence: "pilotage summary windows",
  },
  {
    id: "pilotage.getCategoryStatus",
    name: "getCategoryStatus",
    area: "pilotage",
    token: "getCategoryStatus",
    inputs: ["goals by category", "occurrences status/date"],
    updateCadence: "Pilotage category list",
  },
  {
    id: "pilotage.getLoadSummary",
    name: "getLoadSummary",
    area: "pilotage",
    token: "getLoadSummary",
    inputs: ["process goals", "occurrences statuses"],
    updateCadence: "utility (currently not wired in page)",
  },
  {
    id: "pilotage.getDisciplineSummary",
    name: "getDisciplineSummary",
    area: "pilotage",
    token: "getDisciplineSummary",
    inputs: ["process goals", "occurrences statuses"],
    updateCadence: "utility (currently not wired in page)",
  },
  {
    id: "pilotage.getDisciplineStreak7d",
    name: "getDisciplineStreak7d",
    area: "pilotage",
    token: "getDisciplineStreak7d",
    inputs: ["process goals", "past week occurrences"],
    updateCadence: "utility (currently not wired in page)",
  },
  {
    id: "radar.computeCategoryRadarRows",
    name: "computeCategoryRadarRows",
    area: "pilotage-radar",
    token: "computeCategoryRadarRows",
    inputs: ["computeStats by category", "computeDailyStats by category", "computeGoalStats by category"],
    updateCadence: "Pilotage radar selection/window changes",
  },
  {
    id: "radar.computePilotageInsights",
    name: "computePilotageInsights",
    area: "pilotage-radar",
    token: "computePilotageInsights",
    inputs: ["occurrences + goal/category mapping + time buckets"],
    updateCadence: "Pilotage radar window changes",
  },
  {
    id: "home.coreProgress",
    name: "coreProgress",
    area: "today",
    token: "coreProgress",
    inputs: ["activeHabits", "doneHabitIds", "selectedGoal.status"],
    updateCadence: "Home render/memo on selected date",
  },
  {
    id: "home.disciplineBreakdown",
    name: "disciplineBreakdown",
    area: "today",
    token: "disciplineBreakdown",
    inputs: ["computeDisciplineScore", "microChecks 14j", "outcomes done 90j"],
    updateCadence: "Home render/memo",
  },
  {
    id: "home.microDoneToday",
    name: "microDoneToday",
    area: "today-micro-actions",
    token: "microDoneToday",
    inputs: ["microChecks[selectedDate]"],
    updateCadence: "Home render/memo",
  },
  {
    id: "library.habitWeekStats",
    name: "habitWeekStats",
    area: "library",
    token: "habitWeekStats",
    inputs: ["process goals in category", "occurrences this week"],
    updateCadence: "CategoryManageInline render/memo",
  },
  {
    id: "micro.getMicroActionsForToday",
    name: "getMicroActionsForToday",
    area: "micro-actions-engine",
    token: "getMicroActionsForToday",
    inputs: ["categoryId/name", "hourNow", "time bucket", "seenIds", "library templates"],
    updateCadence: "MicroActionsCard per category/30min bucket/refresh",
  },
  {
    id: "habits.computeStreakDays",
    name: "computeStreakDays",
    area: "legacy-rewards",
    token: "computeStreakDays",
    inputs: ["computeGlobalAvgForDay"],
    updateCadence: "reward check invocation",
  },
];

const WORDING_TERMS = [
  "Progression du jour",
  "Discipline",
  "fait / attendu",
  "attendu / fait",
  "Semaine (attendu / fait)",
  "Occurrences attendues",
  "Occurrences faites",
  "Occurrences manquées",
  "Occurrences annulées",
  "Occurrences planifiées",
  "Assiduité (14j)",
  "Fiabilité (90j)",
  "Radar & insights",
  "Top catégorie",
  "1 action clé manquée",
  "Meilleur créneau",
];

const UI_COMPONENT_TOKENS = [
  "Gauge",
  "ProgressRing",
  "Meter",
  "progressTrack",
  "progressFill",
  "pilotageRadar",
  "pilotageInsights",
  "disciplineOverlay",
  "disciplineCard",
];

const MICRO_ACTIONS_TOKENS = [
  "microChecks",
  "microDoneToday",
  "onAddMicroCheck",
  "microActionsSeen",
  "microActionsDone",
  "getMicroActionsForToday",
  "handleRotate",
  "seedOffset",
];

function walk(dir) {
  const out = [];
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

function toSnippet(line) {
  return line.replace(/\s+/g, " ").trim().slice(0, 220);
}

function findTokenOccurrences(files, token) {
  const regex = new RegExp(`\\b${token.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&")}\\b`);
  const rows = [];
  for (const file of files) {
    const content = fs.readFileSync(file, "utf8");
    const lines = content.split(/\r?\n/);
    for (let i = 0; i < lines.length; i += 1) {
      if (!regex.test(lines[i])) continue;
      rows.push({ file: rel(file), line: i + 1, snippet: toSnippet(lines[i]) });
    }
  }
  return rows;
}

function uniqueBy(items, keyFn) {
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

function findRegexOccurrences(files, regex) {
  const rows = [];
  for (const file of files) {
    const content = fs.readFileSync(file, "utf8");
    const lines = content.split(/\r?\n/);
    for (let i = 0; i < lines.length; i += 1) {
      if (!regex.test(lines[i])) continue;
      rows.push({ file: rel(file), line: i + 1, snippet: toSnippet(lines[i]) });
    }
  }
  return rows;
}

function pickDefinitions(occurrences, token) {
  const defRe = new RegExp(`(?:export\\s+)?function\\s+${token}\\b|(?:const|let|var)\\s+${token}\\b`);
  return occurrences.filter((row) => defRe.test(row.snippet));
}

function pickDisplayUsages(occurrences) {
  return occurrences.filter((row) => {
    const fileScore = /src\/(pages|components|ui|features)\//.test(row.file);
    const uiHint = /data-tour-id|title|subtitle|label|value|%|attendu|fait|manqu|Discipline|Progression|Radar|insight|jsx|<|\{/.test(
      row.snippet
    );
    return fileScore && uiHint;
  });
}

function topHotspots(metricRows) {
  const countByFile = new Map();
  for (const row of metricRows) {
    countByFile.set(row.file, (countByFile.get(row.file) || 0) + 1);
  }
  return Array.from(countByFile.entries())
    .map(([file, count]) => ({ file, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 15);
}

function buildInconsistencyCandidates(files) {
  const candidates = [];

  const expectedStatuses = findRegexOccurrences(files, /EXPECTED_STATUSES|"canceled"|"skipped"|"in_progress"/);
  const metricsExpected = expectedStatuses.filter((row) => row.file === "src/logic/metrics.js");
  if (metricsExpected.length) {
    candidates.push({
      id: "expected-status-semantics",
      title: "Semantics mismatch: expected workload includes canceled/skipped in metrics.js",
      evidence: metricsExpected.slice(0, 8),
    });
  }

  const pilotageExpected = findRegexOccurrences(files, /isOccIgnoredForExpected|isOccExpected|status === "canceled"|status === "skipped"/)
    .filter((row) => row.file === "src/logic/pilotage.js");
  if (pilotageExpected.length) {
    candidates.push({
      id: "pilotage-expected-excludes-canceled-skipped",
      title: "Pilotage excludes canceled/skipped from expected workload",
      evidence: pilotageExpected.slice(0, 8),
    });
  }

  const libraryPlanned = findRegexOccurrences(files, /status !== "skipped"|planned \+= 1|habitWeekStats/)
    .filter((row) => row.file === "src/features/library/CategoryManageInline.jsx");
  if (libraryPlanned.length) {
    candidates.push({
      id: "library-week-stats-semantics",
      title: "Library weekly stat counts planned when status !== skipped (canceled still counted)",
      evidence: libraryPlanned.slice(0, 8),
    });
  }

  const radarSemantics = findRegexOccurrences(files, /occ\.status !== "canceled" && occ\.status !== "skipped"|computeCategoryRadarRows|Charge=attendu\/jour/)
    .filter((row) => row.file === "src/features/pilotage/radarModel.js" || row.file === "src/pages/Pilotage.jsx");
  if (radarSemantics.length) {
    candidates.push({
      id: "radar-expected-semantics",
      title: "Radar expected semantics differs from core metrics semantics",
      evidence: radarSemantics.slice(0, 8),
    });
  }

  const microInfluence = findRegexOccurrences(files, /disciplineBreakdown|microDone14|microRatio14|score = disciplineBase\.score|getDisciplineSummary/)
    .filter((row) => row.file === "src/pages/Home.jsx" || row.file === "src/logic/pilotage.js");
  if (microInfluence.length) {
    candidates.push({
      id: "micro-actions-influence-gap",
      title: "Micro-actions displayed in discipline details but not integrated in primary discipline score",
      evidence: microInfluence.slice(0, 8),
    });
  }

  return candidates;
}

function main() {
  const files = walk(SRC_DIR);

  const metrics = METRICS.map((metric) => {
    const occurrences = findTokenOccurrences(files, metric.token);
    const definitions = pickDefinitions(occurrences, metric.token);
    const displayUsages = pickDisplayUsages(occurrences);
    const usageFiles = uniqueBy(occurrences, (row) => row.file).map((row) => row.file);
    return {
      ...metric,
      definitions,
      usages: occurrences,
      usageFiles,
      displayedIn: displayUsages,
      usageCount: occurrences.length,
    };
  });

  const wording = WORDING_TERMS.map((term) => ({ term, occurrences: findRegexOccurrences(files, new RegExp(term.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&"), "i")) }))
    .filter((entry) => entry.occurrences.length > 0);

  const uiComponents = UI_COMPONENT_TOKENS.map((token) => ({ token, occurrences: findTokenOccurrences(files, token) }))
    .filter((entry) => entry.occurrences.length > 0);

  const microActions = MICRO_ACTIONS_TOKENS.map((token) => ({ token, occurrences: findTokenOccurrences(files, token) }))
    .filter((entry) => entry.occurrences.length > 0);

  const allMetricRows = metrics.flatMap((m) => m.usages.map((row) => ({ metric: m.name, ...row })));
  const hotspots = topHotspots(allMetricRows);

  const data = {
    generatedAt: new Date().toISOString(),
    scope: "src/**",
    filesScanned: files.length,
    metrics,
    microActions: {
      flows: microActions,
      storageKeys: [
        { key: "microChecks", location: "src/pages/Home.jsx:306" },
        { key: "microActionsSeen", location: "src/ui/today/MicroActionsCard.jsx:13" },
        { key: "microActionsDone", location: "src/ui/today/MicroActionsCard.jsx:14" },
      ],
      generation: [
        { file: "src/core/microActions/microActionsEngine.js", line: 118, note: "selection engine with seed/time/category" },
        { file: "src/ui/today/MicroActionsCard.jsx", line: 115, note: "displayItems derived from engine context" },
      ],
      execution: [
        { file: "src/ui/today/MicroActionsCard.jsx", line: 147, note: "click -> onAddMicroCheck + DONE_KEY log" },
        { file: "src/pages/Home.jsx", line: 1383, note: "onAddMicroCheck writes data.microChecks[date][id]=true" },
      ],
    },
    uiComponents,
    wording,
    inconsistencyCandidates: buildInconsistencyCandidates(files),
    hotspots,
  };

  fs.mkdirSync(path.dirname(OUT_FILE), { recursive: true });
  fs.writeFileSync(OUT_FILE, `${JSON.stringify(data, null, 2)}\n`, "utf8");

  console.log(`[progression-audit] wrote ${path.relative(ROOT, OUT_FILE)}`);
  console.log(`[progression-audit] files scanned: ${files.length}`);
  console.log(`[progression-audit] metrics indexed: ${metrics.length}`);
}

main();
