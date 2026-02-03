import { normalizeLocalDateKey } from "../utils/dateKey";
import { computeDailyStats, computeGoalStats, computeStats, selectOccurrencesInRange } from "./metrics";

function toPlainStats(stats) {
  const safe = stats && typeof stats === "object" ? stats : {};
  const expected = Number(safe.expected) || 0;
  const done = Number(safe.done) || 0;
  const missed = Number(safe.missed) || 0;
  const canceled = Number(safe.canceled) || 0;
  const planned = Number(safe.planned) || 0;
  const remaining = Number(safe.remaining) || 0;
  const netScore = Number.isFinite(safe.netScore) ? safe.netScore : 0;
  const completionRate = expected > 0 ? done / expected : 0;
  return { expected, done, missed, canceled, planned, remaining, completionRate, netScore };
}

function mergeStats(target, source) {
  const t = target || {
    expected: 0,
    done: 0,
    missed: 0,
    canceled: 0,
    planned: 0,
    remaining: 0,
    completionRate: 0,
    netScore: 0,
  };
  const s = source && typeof source === "object" ? source : {};
  t.expected += Number(s.expected) || 0;
  t.done += Number(s.done) || 0;
  t.missed += Number(s.missed) || 0;
  t.canceled += Number(s.canceled) || 0;
  t.planned += Number(s.planned) || 0;
  t.remaining += Number(s.remaining) || 0;
  t.netScore += Number(s.netScore) || 0;
  t.completionRate = t.expected > 0 ? t.done / t.expected : 0;
  return t;
}

function csvEscape(value) {
  const raw = value == null ? "" : String(value);
  if (/[",\n]/.test(raw)) {
    return `"${raw.replace(/"/g, "\"\"")}"`;
  }
  return raw;
}

function csvLine(values) {
  return values.map(csvEscape).join(",");
}

export function buildReport(state, { fromKey, toKey, categoryId = null, goalIds = null } = {}) {
  const from = normalizeLocalDateKey(fromKey);
  const to = normalizeLocalDateKey(toKey);
  const cleanedGoalIds = Array.isArray(goalIds) ? goalIds.filter(Boolean) : null;
  const cleanedCategoryId = typeof categoryId === "string" && categoryId.trim() ? categoryId.trim() : null;

  if (!from || !to || to < from) {
    return {
      meta: {
        fromKey: from || "",
        toKey: to || "",
        categoryId: cleanedCategoryId,
        goalIds: cleanedGoalIds && cleanedGoalIds.length ? cleanedGoalIds : null,
        generatedAt: new Date().toISOString(),
      },
      totals: toPlainStats(null),
      byDate: [],
      byGoal: [],
      byCategory: [],
    };
  }

  const filters = { categoryId: cleanedCategoryId, goalIds: cleanedGoalIds };
  const goals = Array.isArray(state?.goals) ? state.goals : [];
  const categories = Array.isArray(state?.categories) ? state.categories : [];
  const goalsById = new Map(goals.filter(Boolean).map((g) => [g.id, g]));
  const categoriesById = new Map(categories.filter(Boolean).map((c) => [c.id, c]));

  const occurrences = selectOccurrencesInRange(state, from, to, filters);
  const totals = toPlainStats(computeStats(occurrences));

  const daily = computeDailyStats(state, from, to, filters);
  const byDate = Array.from(daily.byDate.entries())
    .map(([date, stats]) => ({ date, ...toPlainStats(stats) }))
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

  const goalsMap = computeGoalStats(state, from, to, filters);
  const byGoal = Array.from(goalsMap.entries())
    .map(([goalId, stats]) => {
      const goal = goalsById.get(goalId) || null;
      const categoryIdValue = goal?.categoryId || "";
      return {
        goalId,
        title: goal?.title || goal?.name || "",
        categoryId: categoryIdValue,
        categoryName: categoriesById.get(categoryIdValue)?.name || "",
        ...toPlainStats(stats),
      };
    })
    .sort((a, b) => (a.goalId < b.goalId ? -1 : a.goalId > b.goalId ? 1 : 0));

  const byCategoryMap = new Map();
  for (const entry of byGoal) {
    const categoryIdValue = entry.categoryId || "";
    if (!categoryIdValue) continue;
    if (!byCategoryMap.has(categoryIdValue)) {
      byCategoryMap.set(categoryIdValue, {
        categoryId: categoryIdValue,
        categoryName: categoriesById.get(categoryIdValue)?.name || "",
        expected: 0,
        done: 0,
        missed: 0,
        canceled: 0,
        planned: 0,
        remaining: 0,
        completionRate: 0,
        netScore: 0,
      });
    }
    const bucket = byCategoryMap.get(categoryIdValue);
    mergeStats(bucket, entry);
  }

  const byCategory = Array.from(byCategoryMap.values()).sort((a, b) =>
    a.categoryId < b.categoryId ? -1 : a.categoryId > b.categoryId ? 1 : 0
  );

  return {
    meta: {
      fromKey: from,
      toKey: to,
      categoryId: cleanedCategoryId,
      goalIds: cleanedGoalIds && cleanedGoalIds.length ? cleanedGoalIds : null,
      generatedAt: new Date().toISOString(),
    },
    totals,
    byDate,
    byGoal,
    byCategory,
  };
}

export function exportReportToCSV(report) {
  const byDate = Array.isArray(report?.byDate) ? report.byDate : [];
  const byGoal = Array.isArray(report?.byGoal) ? report.byGoal : [];

  const dailyRows = ["date,expected,done,missed,canceled,planned,scorePct"];
  for (const row of byDate) {
    const expected = Number(row?.expected) || 0;
    const done = Number(row?.done) || 0;
    const scorePct = expected > 0 ? Math.round((done / expected) * 100) : 0;
    dailyRows.push(
      csvLine([
        row?.date || "",
        expected,
        done,
        Number(row?.missed) || 0,
        Number(row?.canceled) || 0,
        Number(row?.planned) || 0,
        scorePct,
      ])
    );
  }

  const goalRows = ["goalId,title,categoryId,expected,done,missed,canceled,planned,scorePct"];
  for (const row of byGoal) {
    const expected = Number(row?.expected) || 0;
    const done = Number(row?.done) || 0;
    const scorePct = expected > 0 ? Math.round((done / expected) * 100) : 0;
    goalRows.push(
      csvLine([
        row?.goalId || "",
        row?.title || "",
        row?.categoryId || "",
        expected,
        done,
        Number(row?.missed) || 0,
        Number(row?.canceled) || 0,
        Number(row?.planned) || 0,
        scorePct,
      ])
    );
  }

  return {
    dailyCsv: dailyRows.join("\n"),
    goalsCsv: goalRows.join("\n"),
  };
}
