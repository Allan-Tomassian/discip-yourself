export const PILOTAGE_DISCIPLINE_WINDOWS = Object.freeze([7, 14, 30]);
export const PILOTAGE_DEFAULT_DISCIPLINE_WINDOW = 14;

function toDateKey(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addDays(date, deltaDays) {
  const next = new Date(date);
  next.setDate(next.getDate() + deltaDays);
  return next;
}

function resolveWindowDays(windowDays) {
  return PILOTAGE_DISCIPLINE_WINDOWS.includes(windowDays)
    ? windowDays
    : PILOTAGE_DEFAULT_DISCIPLINE_WINDOW;
}

function buildWindowBounds(windowDays, now = new Date()) {
  const safeWindowDays = resolveWindowDays(windowDays);
  const safeNow = now instanceof Date ? now : new Date();
  const toKey = toDateKey(safeNow);
  const fromKey = toDateKey(addDays(safeNow, -(safeWindowDays - 1)));
  return { fromKey, toKey, windowDays: safeWindowDays };
}

function buildDateKeys(fromKey, toKey) {
  const start = new Date(`${fromKey}T12:00:00`);
  const end = new Date(`${toKey}T12:00:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) return [];
  const out = [];
  const cursor = new Date(start);
  while (cursor <= end) {
    out.push(toDateKey(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return out;
}

function isExpectedStatus(status) {
  return status !== "canceled" && status !== "skipped";
}

function isDoneStatus(status) {
  return status === "done";
}

function resolveCategoryGoalIds(state, categoryId) {
  if (!categoryId) return null;
  const goals = Array.isArray(state?.goals) ? state.goals : [];
  const goalIds = goals
    .filter((goal) => goal?.id && goal?.categoryId === categoryId)
    .map((goal) => goal.id);
  return new Set(goalIds);
}

function average(values) {
  if (!Array.isArray(values) || !values.length) return 0;
  const total = values.reduce((sum, value) => sum + value, 0);
  return total / values.length;
}

function deriveTrendSummary(series) {
  const scoredSeries = Array.isArray(series) ? series.filter((entry) => Number.isFinite(entry?.score)) : [];
  const neutralDays = Array.isArray(series) ? series.filter((entry) => entry?.isNeutral).length : 0;

  if (!scoredSeries.length) {
    return {
      currentScore: null,
      trendLabel: "stable",
      trendDetail: "Aucune action prévue sur cette période.",
      delta: 0,
      scoredDays: 0,
      neutralDays,
    };
  }

  const scoredValues = scoredSeries.map((entry) => entry.score);
  const currentScore = scoredValues[scoredValues.length - 1];
  if (scoredSeries.length < 4) {
    return {
      currentScore,
      trendLabel: "stable",
      trendDetail: "Pas assez de recul.",
      delta: 0,
      scoredDays: scoredSeries.length,
      neutralDays,
    };
  }

  const recent = scoredValues.slice(-3);
  const previous = scoredValues.slice(-6, -3);
  const recentAverage = average(recent);
  const previousAverage = average(previous);
  const delta = Math.round(recentAverage - previousAverage);

  let averageVariation = 0;
  if (scoredValues.length > 1) {
    const variations = [];
    for (let index = 1; index < scoredValues.length; index += 1) {
      variations.push(Math.abs(scoredValues[index] - scoredValues[index - 1]));
    }
    averageVariation = average(variations);
  }

  let trendLabel = "stable";
  let trendDetail = "Tendance stable.";

  if (delta >= 8) {
    trendLabel = "hausse";
    trendDetail = "La discipline progresse sur les derniers jours.";
  } else if (delta <= -8) {
    trendLabel = "baisse";
    trendDetail = "La discipline recule sur les derniers jours.";
  } else if (Math.abs(delta) < 8 && averageVariation >= 18) {
    trendLabel = "irrégularité";
    trendDetail = "La discipline varie fortement d’un jour à l’autre.";
  }

  return {
    currentScore,
    trendLabel,
    trendDetail,
    delta,
    scoredDays: scoredSeries.length,
    neutralDays,
  };
}

export function buildPilotageDisciplineTrend(state, {
  categoryId = null,
  windowDays = PILOTAGE_DEFAULT_DISCIPLINE_WINDOW,
  now = new Date(),
} = {}) {
  const { fromKey, toKey, windowDays: safeWindowDays } = buildWindowBounds(windowDays, now);
  const dateKeys = buildDateKeys(fromKey, toKey);
  const goalIdSet = resolveCategoryGoalIds(state, categoryId);
  const occurrences = Array.isArray(state?.occurrences) ? state.occurrences : [];
  const statsByDate = new Map(dateKeys.map((dateKey) => [dateKey, { expected: 0, done: 0 }]));

  for (const occurrence of occurrences) {
    if (!occurrence || typeof occurrence !== "object") continue;
    const dateKey = typeof occurrence.date === "string" ? occurrence.date : "";
    if (!dateKey || dateKey < fromKey || dateKey > toKey) continue;
    if (goalIdSet && !goalIdSet.has(occurrence.goalId)) continue;
    const bucket = statsByDate.get(dateKey);
    if (!bucket) continue;
    const status = typeof occurrence.status === "string" ? occurrence.status.trim().toLowerCase() : "";
    if (isExpectedStatus(status)) bucket.expected += 1;
    if (isDoneStatus(status)) bucket.done += 1;
  }

  const series = Array.from(statsByDate.entries()).map(([dateKey, stats]) => {
    const expected = Number(stats.expected) || 0;
    const done = Number(stats.done) || 0;
    const score = expected > 0 ? Math.round((done / expected) * 100) : null;
    return {
      dateKey,
      score,
      expected,
      done,
      isNeutral: expected <= 0,
    };
  });
  const summary = deriveTrendSummary(series);

  return {
    windowDays: safeWindowDays,
    fromKey,
    toKey,
    series,
    summary,
  };
}
