import { addDays, startOfWeekKey } from "../../utils/dates";
import { fromLocalDateKey, normalizeLocalDateKey, toLocalDateKey } from "../../utils/dateKey";

function safeMap(value) {
  return value instanceof Map ? value : new Map();
}

function normalizeOccurrences(occurrences = []) {
  return Array.isArray(occurrences) ? occurrences.filter(Boolean) : [];
}

function isPlannedOccurrence(occurrence) {
  const status = typeof occurrence?.status === "string" ? occurrence.status : "";
  return status === "planned" || status === "in_progress";
}

function resolveWeekKeys(selectedDateKey) {
  const anchor = fromLocalDateKey(selectedDateKey) || new Date();
  const mondayKey = startOfWeekKey(anchor);
  const monday = fromLocalDateKey(mondayKey) || anchor;
  return Array.from({ length: 7 }, (_, index) => toLocalDateKey(addDays(monday, index)));
}

function buildPlannedEntries({ selectedDateKey, occurrences, goalsById, categoriesById }) {
  const selectedDayKey = normalizeLocalDateKey(selectedDateKey);
  const weekKeys = new Set(resolveWeekKeys(selectedDayKey));
  const dayEntries = [];
  const weekEntries = [];
  const weekMinutesByCategory = new Map();
  const weekDaysWithPlan = new Set();

  for (const occurrence of normalizeOccurrences(occurrences)) {
    if (!isPlannedOccurrence(occurrence)) continue;
    const dateKey = normalizeLocalDateKey(occurrence?.date);
    if (!dateKey || !weekKeys.has(dateKey)) continue;
    const goal = safeMap(goalsById).get(occurrence?.goalId || "") || null;
    const category = safeMap(categoriesById).get(goal?.categoryId || "") || null;
    const durationMinutes = Number.isFinite(occurrence?.durationMinutes) ? occurrence.durationMinutes : 0;
    const entry = {
      ...occurrence,
      dateKey,
      title: goal?.title || occurrence?.title || "Action",
      categoryId: goal?.categoryId || null,
      categoryName: category?.name || null,
      durationMinutes,
    };
    weekEntries.push(entry);
    weekDaysWithPlan.add(dateKey);
    if (entry.categoryId) {
      weekMinutesByCategory.set(
        entry.categoryId,
        (weekMinutesByCategory.get(entry.categoryId) || 0) + durationMinutes
      );
    }
    if (dateKey === selectedDayKey) {
      dayEntries.push(entry);
    }
  }

  return {
    dayEntries,
    weekEntries,
    weekDaysWithPlan,
    weekMinutesByCategory,
  };
}

function findDominantCategory({ weekMinutesByCategory, categoriesById }) {
  let dominantCategoryId = "";
  let dominantMinutes = 0;
  let totalMinutes = 0;
  for (const [categoryId, minutes] of weekMinutesByCategory.entries()) {
    totalMinutes += minutes;
    if (minutes > dominantMinutes) {
      dominantMinutes = minutes;
      dominantCategoryId = categoryId;
    }
  }
  if (!dominantCategoryId || totalMinutes <= 0) return null;
  return {
    categoryId: dominantCategoryId,
    categoryName: safeMap(categoriesById).get(dominantCategoryId)?.name || "Catégorie",
    share: dominantMinutes / totalMinutes,
    totalMinutes,
  };
}

export function buildPlanningCoachFallback({
  selectedDateKey,
  activeCategoryId = null,
  activeCategoryProfileSummary = null,
  occurrences = [],
  goalsById,
  categoriesById,
}) {
  const { dayEntries, weekEntries, weekDaysWithPlan, weekMinutesByCategory } = buildPlannedEntries({
    selectedDateKey,
    occurrences,
    goalsById,
    categoriesById,
  });
  const dayMinutes = dayEntries.reduce((sum, entry) => sum + (entry.durationMinutes || 0), 0);
  const dominantCategory = findDominantCategory({ weekMinutesByCategory, categoriesById });

  if (!weekEntries.length) {
    return {
      kind: "chat",
      headline: "Semaine vide",
      reason: activeCategoryProfileSummary?.currentPriority
        ? `Aucun créneau n’est planifié cette semaine pour ${activeCategoryProfileSummary.currentPriority}. Sans premier bloc visible, le système perd son point d’appui.`
        : "Aucun créneau n’est planifié cette semaine. Sans premier bloc visible, le système perd son point d’appui.",
      primaryAction: {
        label: "Ajouter un premier bloc",
        intent: "open_pilotage",
        categoryId: activeCategoryId,
        actionId: null,
        occurrenceId: null,
        dateKey: selectedDateKey,
      },
      secondaryAction: null,
      suggestedDurationMin: 20,
    };
  }

  if (!dayEntries.length) {
    return {
      kind: "chat",
      headline: "Journée vide",
      reason: activeCategoryProfileSummary?.currentPriority
        ? `Aucune occurrence n’est prévue aujourd’hui pour ${activeCategoryProfileSummary.currentPriority}. Pose un bloc court pour garder le rythme.`
        : "Aucune occurrence n’est prévue sur la journée sélectionnée. Pose un bloc court pour garder le rythme.",
      primaryAction: {
        label: "Ajouter un bloc court",
        intent: "open_pilotage",
        categoryId: activeCategoryId,
        actionId: null,
        occurrenceId: null,
        dateKey: selectedDateKey,
      },
      secondaryAction: null,
      suggestedDurationMin: 20,
    };
  }

  if (dayEntries.length > 6) {
    return {
      kind: "chat",
      headline: "Charge trop dense",
      reason: "Plus de 6 occurrences sont prévues aujourd’hui. Le risque principal est la fragmentation de l’attention.",
      primaryAction: {
        label: "Déplacer un bloc secondaire",
        intent: "open_pilotage",
        categoryId: activeCategoryId,
        actionId: null,
        occurrenceId: null,
        dateKey: selectedDateKey,
      },
      secondaryAction: null,
      suggestedDurationMin: 15,
    };
  }

  if (dominantCategory && dominantCategory.share >= 0.8) {
    return {
      kind: "chat",
      headline: `Déséquilibre ${dominantCategory.categoryName}`.slice(0, 72),
      reason: `${dominantCategory.categoryName} concentre ${Math.round(dominantCategory.share * 100)}% du temps prévu cette semaine. Rééquilibre avant d’accumuler un angle mort.`,
      primaryAction: {
        label: "Rééquilibrer un bloc",
        intent: "open_pilotage",
        categoryId: dominantCategory.categoryId,
        actionId: null,
        occurrenceId: null,
        dateKey: selectedDateKey,
      },
      secondaryAction: null,
      suggestedDurationMin: 20,
    };
  }

  if (!weekDaysWithPlan.size) {
    return {
      kind: "chat",
      headline: "Risque d’abandon",
      reason: "Aucun jour de la semaine visible n’a de créneau solide. Pose un premier rendez-vous de continuité.",
      primaryAction: {
        label: "Créer un point d’appui",
        intent: "open_pilotage",
        categoryId: activeCategoryId,
        actionId: null,
        occurrenceId: null,
        dateKey: selectedDateKey,
      },
      secondaryAction: null,
      suggestedDurationMin: 15,
    };
  }

  return {
    kind: "chat",
    headline: "Charge crédible",
    reason: `${dayEntries.length} bloc${dayEntries.length > 1 ? "s" : ""} prévu${dayEntries.length > 1 ? "s" : ""} aujourd’hui pour ${dayMinutes} min. Protège surtout le prochain bloc important.`,
    primaryAction: {
      label: "Protéger le prochain bloc",
      intent: "open_today",
      categoryId: activeCategoryId,
      actionId: dayEntries[0]?.goalId || null,
      occurrenceId: dayEntries[0]?.id || null,
      dateKey: selectedDateKey,
    },
    secondaryAction: null,
    suggestedDurationMin: dayEntries[0]?.durationMinutes || 20,
  };
}
