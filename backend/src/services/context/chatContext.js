import { buildNowContext } from "./nowContext.js";
import { safeArray } from "./shared.js";

const AI_FOUNDATION_PLANNING_TEMPLATE_ID = "ai_onboarding_planning";

function isProcessGoal(goal) {
  if (!goal || typeof goal !== "object") return false;
  const type = typeof goal.type === "string" ? goal.type.toUpperCase() : "";
  const planType = typeof goal.planType === "string" ? goal.planType.toUpperCase() : "";
  return type === "PROCESS" || planType === "ACTION" || planType === "ONE_OFF";
}

function buildAvailableCategories(data) {
  return safeArray(data?.categories)
    .filter((category) => category?.id && category.id !== "sys_inbox" && category.system !== true)
    .map((category) => ({
      id: category.id,
      name: category.name || "Categorie",
      color: category.color || null,
    }))
    .slice(0, 12);
}

function buildActionSummaries(data, activeCategoryId) {
  const categoriesById = new Map(
    safeArray(data?.categories).filter((category) => category?.id).map((category) => [category.id, category])
  );
  const summaries = safeArray(data?.goals)
    .filter(
      (goal) =>
        goal?.id &&
        goal?.categoryId &&
        goal.categoryId !== "sys_inbox" &&
        goal.templateId !== AI_FOUNDATION_PLANNING_TEMPLATE_ID &&
        isProcessGoal(goal)
    )
    .map((goal) => ({
      actionId: goal.id,
      title: goal.title || "Action",
      categoryId: goal.categoryId,
      categoryName: categoriesById.get(goal.categoryId)?.name || null,
      durationMin: Number.isFinite(goal.durationMinutes)
        ? goal.durationMinutes
        : Number.isFinite(goal.sessionMinutes)
          ? goal.sessionMinutes
          : null,
      repeat: typeof goal.repeat === "string" ? goal.repeat : null,
    }))
    .sort((left, right) => {
      const leftActive = left.categoryId === activeCategoryId ? 0 : 1;
      const rightActive = right.categoryId === activeCategoryId ? 0 : 1;
      if (leftActive !== rightActive) return leftActive - rightActive;
      return String(left.title || "").localeCompare(String(right.title || ""));
    });

  return summaries.slice(0, 12);
}

function normalizeRecentMessages(recentMessages) {
  return safeArray(recentMessages)
    .filter((entry) => entry && (entry.role === "user" || entry.role === "assistant"))
    .map((entry) => ({
      role: entry.role,
      content: typeof entry.content === "string" ? entry.content.trim().slice(0, 500) : "",
    }))
    .filter((entry) => entry.content)
    .slice(-6);
}

function toDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function buildWeekKeys(selectedDateKey) {
  const anchor = new Date(`${selectedDateKey}T12:00:00`);
  if (Number.isNaN(anchor.getTime())) return [];
  const day = anchor.getDay() || 7;
  const monday = new Date(anchor);
  monday.setDate(anchor.getDate() - (day - 1));
  return Array.from({ length: 7 }, (_, index) => {
    const current = new Date(monday);
    current.setDate(monday.getDate() + index);
    return toDateKey(current);
  });
}

function buildPlanningSummary(data, selectedDateKey) {
  const goalsById = new Map(safeArray(data?.goals).filter((goal) => goal?.id).map((goal) => [goal.id, goal]));
  const categoriesById = new Map(
    safeArray(data?.categories).filter((category) => category?.id).map((category) => [category.id, category])
  );
  const weekKeys = new Set(buildWeekKeys(selectedDateKey));
  const plannedOccurrences = safeArray(data?.occurrences).filter(
    (occurrence) => occurrence?.status === "planned" || occurrence?.status === "in_progress"
  );
  const dayOccurrences = [];
  const weekOccurrences = [];
  const minutesByCategory = new Map();

  for (const occurrence of plannedOccurrences) {
    const dateKey = typeof occurrence?.date === "string" ? occurrence.date : "";
    if (!weekKeys.has(dateKey)) continue;
    const goal = goalsById.get(occurrence.goalId || "") || null;
    const category = categoriesById.get(goal?.categoryId || "") || null;
    const durationMinutes = Number.isFinite(occurrence?.durationMinutes) ? occurrence.durationMinutes : 0;
    const entry = {
      occurrenceId: occurrence.id || null,
      dateKey,
      title: goal?.title || occurrence?.title || "Action",
      categoryId: goal?.categoryId || null,
      categoryName: category?.name || null,
      durationMinutes,
    };
    weekOccurrences.push(entry);
    if (dateKey === selectedDateKey) {
      dayOccurrences.push(entry);
    }
    if (entry.categoryId) {
      minutesByCategory.set(entry.categoryId, (minutesByCategory.get(entry.categoryId) || 0) + durationMinutes);
    }
  }

  let dominantCategoryId = null;
  let dominantCategoryMinutes = 0;
  let totalWeekMinutes = 0;
  for (const [categoryId, minutes] of minutesByCategory.entries()) {
    totalWeekMinutes += minutes;
    if (minutes > dominantCategoryMinutes) {
      dominantCategoryMinutes = minutes;
      dominantCategoryId = categoryId;
    }
  }

  return {
    selectedDayCount: dayOccurrences.length,
    selectedDayMinutes: dayOccurrences.reduce((sum, entry) => sum + (entry.durationMinutes || 0), 0),
    weekCount: weekOccurrences.length,
    weekMinutes: totalWeekMinutes,
    dominantCategoryName: dominantCategoryId ? categoriesById.get(dominantCategoryId)?.name || null : null,
    dominantCategoryShare:
      dominantCategoryId && totalWeekMinutes > 0
        ? Number((dominantCategoryMinutes / totalWeekMinutes).toFixed(2))
        : null,
    emptyDay: dayOccurrences.length === 0,
    emptyWeek: weekOccurrences.length === 0,
  };
}

function buildPilotageSummary(data, activeCategoryId) {
  const today = new Date();
  today.setHours(12, 0, 0, 0);
  const from = new Date(today);
  from.setDate(today.getDate() - 6);
  const fromKey = toDateKey(from);
  const toKey = toDateKey(today);
  const goalsById = new Map(safeArray(data?.goals).filter((goal) => goal?.id).map((goal) => [goal.id, goal]));
  const relevantOccurrences = safeArray(data?.occurrences).filter((occurrence) => {
    const dateKey = typeof occurrence?.date === "string" ? occurrence.date : "";
    if (!dateKey || dateKey < fromKey || dateKey > toKey) return false;
    if (!activeCategoryId) return true;
    const goal = goalsById.get(occurrence?.goalId || "") || null;
    return goal?.categoryId === activeCategoryId;
  });
  const sessionHistoryByOccurrenceId = new Map();
  for (const entry of safeArray(data?.sessionHistory)) {
    if (!entry?.occurrenceId) continue;
    sessionHistoryByOccurrenceId.set(entry.occurrenceId, entry);
  }

  let expected = 0;
  let done = 0;
  let missed = 0;
  let realMinutes = 0;
  const activeDays = new Set();
  for (const occurrence of relevantOccurrences) {
    const status = typeof occurrence?.status === "string" ? occurrence.status : "";
    if (status !== "canceled" && status !== "skipped") expected += 1;
    if (status === "done") {
      done += 1;
      activeDays.add(occurrence.date);
      const sessionEntry = sessionHistoryByOccurrenceId.get(occurrence.id) || null;
      if (Number.isFinite(sessionEntry?.timerSeconds)) {
        realMinutes += Math.round(sessionEntry.timerSeconds / 60);
      } else if (Number.isFinite(occurrence?.durationMinutes)) {
        realMinutes += occurrence.durationMinutes;
      }
    }
    if (status === "missed") missed += 1;
  }

  const daysActive7 = activeDays.size;
  const constanceLabel =
    daysActive7 >= 4 && realMinutes >= 60 ? "stable" : daysActive7 >= 2 ? "en progression" : "irrégulier";

  return {
    daysActive7,
    realMinutes7: realMinutes,
    expected7: expected,
    done7: done,
    missed7: missed,
    constanceLabel,
  };
}

export function buildChatContext({
  data,
  selectedDateKey,
  activeCategoryId,
  quotaState,
  requestId,
  body,
  now = new Date(),
}) {
  const baseContext = buildNowContext({
    data,
    selectedDateKey,
    activeCategoryId,
    quotaState,
    requestId,
    trigger: "manual",
    now,
  });
  const message = typeof body?.message === "string" ? body.message.trim().slice(0, 500) : "";

  return {
    ...baseContext,
    activeCategoryLabel: baseContext.category?.name || null,
    message,
    messagePreview: message ? message.slice(0, 120) : null,
    recentMessages: normalizeRecentMessages(body?.recentMessages),
    availableCategories: buildAvailableCategories(data),
    actionSummaries: buildActionSummaries(data, activeCategoryId),
    planningSummary: buildPlanningSummary(data, selectedDateKey),
    pilotageSummary: buildPilotageSummary(data, activeCategoryId),
    categorySnapshot: baseContext.categoryCoherence?.categorySnapshot || null,
  };
}
