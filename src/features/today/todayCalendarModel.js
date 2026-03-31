import { normalizeLocalDateKey } from "../../utils/dateKey";
import { resolveCategoryColor } from "../../utils/categoryPalette";

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function pickAccentColor(dots, selectedCategoryId, fallbackAccent) {
  const list = safeArray(dots);
  const selected = selectedCategoryId
    ? list.find((item) => item?.categoryId === selectedCategoryId && item?.color)
    : null;
  return selected?.color || list[0]?.color || fallbackAccent || "";
}

export function deriveTodayCalendarModel({
  plannedCalendarOccurrences,
  occurrences,
  goalsById,
  categoriesById,
  goalIdSet,
  selectedDateKey,
  selectedCategoryId,
  fallbackAccent,
  defaultActionId = null,
}) {
  const plannedEntries = safeArray(plannedCalendarOccurrences?.list);
  const occurrenceList = safeArray(occurrences);
  const goalIds = goalIdSet instanceof Set ? goalIdSet : new Set();
  const categoriesMap = categoriesById instanceof Map ? categoriesById : new Map();
  const goalsMap = goalsById instanceof Map ? goalsById : new Map();

  const plannedByDate = new Map();
  for (const entry of plannedEntries) {
    plannedByDate.set(entry.dateKey, (plannedByDate.get(entry.dateKey) || 0) + 1);
  }

  const doneBuckets = new Map();
  for (const occ of occurrenceList) {
    if (!occ || occ.status !== "done") continue;
    const dateKey = normalizeLocalDateKey(occ.date);
    const goalId = typeof occ.goalId === "string" ? occ.goalId : "";
    if (!dateKey || !goalId || !goalIds.has(goalId)) continue;
    const set = doneBuckets.get(dateKey) || new Set();
    set.add(goalId);
    doneBuckets.set(dateKey, set);
  }

  const doneByDate = new Map();
  for (const [dateKey, doneIds] of doneBuckets.entries()) {
    doneByDate.set(dateKey, doneIds.size);
  }

  const rawDots = new Map();
  for (const entry of plannedEntries) {
    const goal = goalsMap.get(entry.goalId);
    if (!goal) continue;
    const categoryId = typeof goal.categoryId === "string" ? goal.categoryId : "";
    if (!categoryId) continue;
    const category = categoriesMap.get(categoryId);
    const color = resolveCategoryColor(category || goal, "");
    if (!color) continue;
    const dayMap = rawDots.get(entry.dateKey) || new Map();
    if (!dayMap.has(categoryId)) dayMap.set(categoryId, { categoryId, color });
    rawDots.set(entry.dateKey, dayMap);
  }

  const categoryDotsByDate = new Map();
  for (const [dateKey, dayMap] of rawDots.entries()) {
    categoryDotsByDate.set(dateKey, Array.from(dayMap.values()));
  }

  const accentByDate = new Map();
  for (const [dateKey, dots] of categoryDotsByDate.entries()) {
    const accent = pickAccentColor(dots, selectedCategoryId, fallbackAccent);
    if (accent) accentByDate.set(dateKey, accent);
  }

  const selectedDateAccent =
    accentByDate.get(selectedDateKey) ||
    resolveCategoryColor(categoriesMap.get(selectedCategoryId || ""), "") ||
    fallbackAccent ||
    "";

  return {
    plannedByDate,
    doneByDate,
    categoryDotsByDate,
    accentByDate,
    selectedDateAccent,
    addActionContext: {
      categoryId: selectedCategoryId || null,
      actionId: typeof defaultActionId === "string" ? defaultActionId : null,
    },
  };
}
