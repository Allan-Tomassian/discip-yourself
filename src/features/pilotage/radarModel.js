import {
  computeDailyStats,
  computeGoalStats,
  computeStats,
  selectOccurrencesInRange,
} from "../../logic/metrics";

const TIME_BUCKETS = [
  { id: "06-09", label: "06h–09h", from: 6 * 60, to: 9 * 60 },
  { id: "09-12", label: "09h–12h", from: 9 * 60, to: 12 * 60 },
  { id: "12-15", label: "12h–15h", from: 12 * 60, to: 15 * 60 },
  { id: "15-18", label: "15h–18h", from: 15 * 60, to: 18 * 60 },
  { id: "18-21", label: "18h–21h", from: 18 * 60, to: 21 * 60 },
  { id: "21-24", label: "21h–24h", from: 21 * 60, to: 24 * 60 },
];

const clamp01 = (n) => Math.max(0, Math.min(1, Number.isFinite(n) ? n : 0));

function toMinutes(time) {
  if (typeof time !== "string") return null;
  const clean = time.trim();
  if (!/^\d{2}:\d{2}$/.test(clean)) return null;
  const [h, m] = clean.split(":").map((n) => Number(n));
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
  if (h < 0 || h > 23 || m < 0 || m > 59) return null;
  return h * 60 + m;
}

function resolveOccurrenceTime(occ) {
  if (!occ || typeof occ !== "object") return "";
  const start = typeof occ.start === "string" ? occ.start : "";
  if (start && start !== "00:00") return start;
  const resolved = typeof occ.resolvedStart === "string" ? occ.resolvedStart : "";
  return resolved && resolved !== "00:00" ? resolved : "";
}

function resolveState(rawState) {
  return rawState && typeof rawState === "object" ? rawState : {};
}

export function computeCategoryRadarRows(state, fromKey, toKey) {
  const safeState = resolveState(state);
  const categories = Array.isArray(safeState.categories) ? safeState.categories : [];
  if (!categories.length) return [];

  const out = [];
  for (const category of categories) {
    const list = selectOccurrencesInRange(safeState, fromKey, toKey, { categoryId: category.id });
    const stats = computeStats(list);
    const daily = computeDailyStats(safeState, fromKey, toKey, { categoryId: category.id });
    const totalDays = Math.max(1, daily.byDate.size);

    let activeDays = 0;
    for (const bucket of daily.byDate.values()) {
      const done = Number(bucket?.done) || 0;
      if (done > 0) activeDays += 1;
    }

    const expected = Number(stats.expected) || 0;
    const done = Number(stats.done) || 0;
    const discipline = expected > 0 ? done / expected : 0;
    const regularity = activeDays / totalDays;
    const expectedPerDay = expected / totalDays;
    const load = clamp01(expectedPerDay / 3);

    const byGoal = computeGoalStats(safeState, fromKey, toKey, { categoryId: category.id });
    let topExpected = 0;
    for (const bucket of byGoal.values()) {
      const value = Number(bucket?.expected) || 0;
      if (value > topExpected) topExpected = value;
    }
    const focus = expected > 0 ? topExpected / expected : 0;

    out.push({
      categoryId: category.id,
      label: category.name || "Catégorie",
      color: category.color || category.accentColor || category.hex || category.themeColor || "#6EE7FF",
      values: [
        { axis: "Discipline", value: discipline },
        { axis: "Régularité", value: regularity },
        { axis: "Charge", value: load },
        { axis: "Focus", value: focus },
      ],
      raw: { discipline, regularity, load, focus, expected, done },
    });
  }

  out.sort((a, b) => (b.raw.expected || 0) - (a.raw.expected || 0));
  return out;
}

export function computePilotageInsights(state, fromKey, toKey) {
  const safeState = resolveState(state);
  const categories = Array.isArray(safeState.categories) ? safeState.categories : [];
  const goals = Array.isArray(safeState.goals) ? safeState.goals : [];
  const goalsById = new Map();
  for (const goal of goals) {
    if (goal && goal.id) goalsById.set(goal.id, goal);
  }

  const list = selectOccurrencesInRange(safeState, fromKey, toKey);
  const byCategory = new Map();
  const missedByGoal = new Map();
  const timeBuckets = new Map(TIME_BUCKETS.map((bucket) => [bucket.id, { done: 0, expected: 0 }]));

  for (const occ of list) {
    if (!occ || typeof occ.goalId !== "string") continue;
    const goal = goalsById.get(occ.goalId);
    const categoryId = goal?.categoryId;
    if (categoryId) {
      const bucket = byCategory.get(categoryId) || { done: 0, expected: 0 };
      if (occ.status !== "canceled" && occ.status !== "skipped") bucket.expected += 1;
      if (occ.status === "done") bucket.done += 1;
      byCategory.set(categoryId, bucket);
    }

    if (occ.status === "missed") {
      missedByGoal.set(occ.goalId, (missedByGoal.get(occ.goalId) || 0) + 1);
    }

    const start = resolveOccurrenceTime(occ);
    const minutes = toMinutes(start);
    if (minutes == null) continue;
    const bucket = TIME_BUCKETS.find((entry) => minutes >= entry.from && minutes < entry.to);
    if (!bucket) continue;
    const entry = timeBuckets.get(bucket.id);
    if (!entry) continue;
    entry.expected += 1;
    if (occ.status === "done") entry.done += 1;
  }

  let topCategoryId = null;
  let topScore = -1;
  for (const [catId, stats] of byCategory.entries()) {
    const expected = stats.expected || 0;
    const done = stats.done || 0;
    const score = expected > 0 ? done / expected : 0;
    if (score > topScore) {
      topScore = score;
      topCategoryId = catId;
    }
  }
  const topCategory = categories.find((category) => category.id === topCategoryId) || null;

  let missedGoalId = "";
  let missedCount = 0;
  for (const [goalId, count] of missedByGoal.entries()) {
    if (count > missedCount) {
      missedCount = count;
      missedGoalId = goalId;
    }
  }
  const missedGoal = missedGoalId ? goalsById.get(missedGoalId) : null;

  let bestBucket = null;
  let bestRate = -1;
  for (const bucket of TIME_BUCKETS) {
    const stats = timeBuckets.get(bucket.id);
    const expected = stats?.expected || 0;
    if (!expected) continue;
    const rate = (stats?.done || 0) / expected;
    if (rate > bestRate) {
      bestRate = rate;
      bestBucket = bucket;
    }
  }

  return {
    topCategory:
      topCategory && topScore >= 0
        ? `Top catégorie : ${topCategory.name || "Catégorie"}`
        : "Top catégorie : —",
    missedAction:
      missedGoal && missedCount > 0
        ? `1 action clé manquée : ${missedGoal.title || "Action"}`
        : "1 action clé manquée : aucune",
    bestSlot: bestBucket ? `Meilleur créneau : ${bestBucket.label}` : "Meilleur créneau : —",
  };
}
