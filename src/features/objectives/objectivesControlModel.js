import { getVisibleCategories } from "../../domain/categoryVisibility";
import { resolveGoalType } from "../../domain/goalType";
import { computeAggregateProgress, getGoalProgress } from "../../logic/goals";
import { splitProcessByLink } from "../../logic/linking";
import { endOfMonth, startOfMonth, startOfWeekKey } from "../../utils/dates";
import {
  addDaysLocal,
  fromLocalDateKey,
  normalizeLocalDateKey,
  todayLocalKey,
  toLocalDateKey,
} from "../../utils/datetime";

export const OBJECTIVES_LENSES = Object.freeze({
  OBJECTIVES: "objectives",
  CATEGORIES: "categories",
  KEY_ACTIONS: "key_actions",
});

export const OBJECTIVES_HORIZONS = Object.freeze({
  DAY: "day",
  WEEK: "week",
  MONTH: "month",
});

const OUTCOME_STATUS_PRIORITY = Object.freeze({
  protect: 0,
  reframe: 1,
  overflow: 2,
  stalled: 3,
  structure: 4,
  active: 5,
});

const ACTION_STATUS_PRIORITY = Object.freeze({
  drift: 0,
  orphan: 1,
  dense: 2,
  support: 3,
  quiet: 4,
});

const CATEGORY_STATUS_PRIORITY = Object.freeze({
  dominant: 0,
  restart: 1,
  active: 2,
  structure: 3,
  empty: 4,
});

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function safeString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function compareByDateAndStart(left, right) {
  const leftDate = safeString(left?.date);
  const rightDate = safeString(right?.date);
  if (leftDate !== rightDate) return leftDate.localeCompare(rightDate);
  const leftStart = safeString(left?.start || left?.slotKey);
  const rightStart = safeString(right?.start || right?.slotKey);
  if (leftStart !== rightStart) return leftStart.localeCompare(rightStart);
  return safeString(left?.id).localeCompare(safeString(right?.id));
}

function compareTitle(left, right) {
  return safeString(left?.title).localeCompare(safeString(right?.title), "fr");
}

function compareStatusThenTitle(left, right, priorityMap) {
  const leftPriority = priorityMap[left?.status?.key] ?? Number.MAX_SAFE_INTEGER;
  const rightPriority = priorityMap[right?.status?.key] ?? Number.MAX_SAFE_INTEGER;
  if (leftPriority !== rightPriority) return leftPriority - rightPriority;
  return compareTitle(left, right);
}

function isExpectedOccurrenceStatus(status) {
  const next = safeString(status).toLowerCase();
  return next !== "canceled" && next !== "skipped";
}

function isDoneOccurrenceStatus(status) {
  return safeString(status).toLowerCase() === "done";
}

function isMissedOccurrenceStatus(status) {
  return safeString(status).toLowerCase() === "missed";
}

function buildWindow(anchorDateKey, horizon) {
  const safeAnchorDateKey = normalizeLocalDateKey(anchorDateKey) || todayLocalKey();
  if (horizon === OBJECTIVES_HORIZONS.DAY) {
    return {
      horizon,
      anchorDateKey: safeAnchorDateKey,
      fromKey: safeAnchorDateKey,
      toKey: safeAnchorDateKey,
      planningDateKey: safeAnchorDateKey,
      title: "Aujourd'hui",
    };
  }
  if (horizon === OBJECTIVES_HORIZONS.MONTH) {
    const anchorDate = fromLocalDateKey(safeAnchorDateKey);
    const fromKey = toLocalDateKey(startOfMonth(anchorDate));
    const toKey = toLocalDateKey(endOfMonth(anchorDate));
    return {
      horizon,
      anchorDateKey: safeAnchorDateKey,
      fromKey,
      toKey,
      planningDateKey: fromKey,
      title: "Ce mois-ci",
    };
  }
  const fromKey = startOfWeekKey(fromLocalDateKey(safeAnchorDateKey));
  return {
    horizon: OBJECTIVES_HORIZONS.WEEK,
    anchorDateKey: safeAnchorDateKey,
    fromKey,
    toKey: addDaysLocal(fromKey, 6),
    planningDateKey: fromKey,
    title: "Cette semaine",
  };
}

function normalizeLens(value) {
  return value === OBJECTIVES_LENSES.CATEGORIES || value === OBJECTIVES_LENSES.KEY_ACTIONS
    ? value
    : OBJECTIVES_LENSES.OBJECTIVES;
}

function normalizeHorizon(value) {
  if (value === OBJECTIVES_HORIZONS.DAY) return OBJECTIVES_HORIZONS.DAY;
  if (value === OBJECTIVES_HORIZONS.MONTH) return OBJECTIVES_HORIZONS.MONTH;
  return OBJECTIVES_HORIZONS.WEEK;
}

export function normalizeObjectivesLens(value) {
  return normalizeLens(value);
}

export function normalizeObjectivesHorizon(value) {
  return normalizeHorizon(value);
}

function buildOccurrenceMaps(occurrences) {
  const allByGoalId = new Map();
  for (const occurrence of occurrences) {
    if (!occurrence?.goalId || !isExpectedOccurrenceStatus(occurrence.status)) continue;
    const current = allByGoalId.get(occurrence.goalId) || [];
    current.push(occurrence);
    allByGoalId.set(occurrence.goalId, current);
  }
  for (const list of allByGoalId.values()) {
    list.sort(compareByDateAndStart);
  }
  return allByGoalId;
}

function collectWindowOccurrences(occurrencesByGoalId, goalId, fromKey, toKey) {
  return (occurrencesByGoalId.get(goalId) || []).filter((occurrence) => {
    const dateKey = normalizeLocalDateKey(occurrence?.date);
    return Boolean(dateKey && dateKey >= fromKey && dateKey <= toKey);
  });
}

function collectNextOccurrence(occurrencesByGoalId, goalId, anchorDateKey) {
  return (occurrencesByGoalId.get(goalId) || []).find((occurrence) => {
    const dateKey = normalizeLocalDateKey(occurrence?.date);
    return Boolean(dateKey && dateKey >= anchorDateKey);
  }) || null;
}

function formatCountLabel(count, noun) {
  const safeCount = Number.isFinite(count) ? count : 0;
  return `${safeCount} ${noun}${safeCount > 1 ? "s" : ""}`;
}

function formatMinutesLabel(minutes) {
  const safeMinutes = Number.isFinite(minutes) ? Math.max(0, Math.round(minutes)) : 0;
  return `${safeMinutes} min`;
}

function classifyOutcomeStatus({
  linkedActions,
  progress,
  expectedCount,
  doneCount,
  missedCount,
  totalMinutes,
}) {
  if (!linkedActions.length) {
    return {
      key: "structure",
      label: "À structurer",
      tone: "warning",
      description: "Aucune action structurante ne nourrit encore cet objectif.",
    };
  }
  if (expectedCount >= 4 && doneCount === 0) {
    return {
      key: "overflow",
      label: "À desserrer",
      tone: "warning",
      description: "La charge prévue dépasse ce qui avance réellement.",
    };
  }
  if (expectedCount === 0 && doneCount === 0) {
    return {
      key: "stalled",
      label: "En veille",
      tone: "info",
      description: "Aucun signal récent ne montre un vrai mouvement.",
    };
  }
  if (missedCount > 0 || expectedCount > doneCount + 1) {
    return {
      key: "reframe",
      label: "À recadrer",
      tone: "warning",
      description: "Le rythme actuel manque de crédibilité ou de continuité.",
    };
  }
  if (progress >= 0.55 || doneCount > 0 || totalMinutes >= 45) {
    return {
      key: "protect",
      label: "À protéger",
      tone: "success",
      description: "Cet objectif produit déjà un signal crédible à préserver.",
    };
  }
  return {
    key: "active",
    label: "En cours",
    tone: "info",
    description: "Le mouvement existe, mais demande encore un cadrage clair.",
  };
}

function classifyActionStatus({
  linkedOutcome,
  expectedCount,
  doneCount,
  totalMinutes,
}) {
  if (!linkedOutcome) {
    return {
      key: "orphan",
      label: "Orpheline",
      tone: "warning",
      description: "Cette action n'alimente pas clairement un objectif.",
    };
  }
  if (expectedCount > 0 && doneCount === 0) {
    return {
      key: "drift",
      label: "En dérive",
      tone: "warning",
      description: "Prévue, mais sans signal réel d'avancement sur l'horizon.",
    };
  }
  if (expectedCount >= 4 || totalMinutes >= 150) {
    return {
      key: "dense",
      label: "À alléger",
      tone: "warning",
      description: "Le volume prévu risque de fragmenter l'attention.",
    };
  }
  if (doneCount > 0 || expectedCount > 0) {
    return {
      key: "support",
      label: "Porteuse",
      tone: "success",
      description: "Cette action porte déjà un signal utile pour son objectif.",
    };
  }
  return {
    key: "quiet",
    label: "En veille",
    tone: "info",
    description: "Présente dans le système, mais sans rôle visible sur l'horizon.",
  };
}

function classifyCategoryStatus({
  outcomeCount,
  actionCount,
  expectedCount,
  doneCount,
  share,
}) {
  if (outcomeCount === 0 && actionCount === 0) {
    return {
      key: "empty",
      label: "Vide",
      tone: "warning",
      description: "Aucune structure exploitable sur cet horizon.",
    };
  }
  if (share >= 0.6 && expectedCount > 0) {
    return {
      key: "dominant",
      label: "Trop dominante",
      tone: "warning",
      description: "Cette catégorie absorbe une trop grande part de la charge.",
    };
  }
  if (expectedCount > 0 && doneCount === 0) {
    return {
      key: "restart",
      label: "À relancer",
      tone: "warning",
      description: "La catégorie porte de la charge sans signal d'exécution utile.",
    };
  }
  if (expectedCount === 0 && doneCount === 0) {
    return {
      key: "structure",
      label: "À structurer",
      tone: "info",
      description: "Les objectifs existent, mais le rythme n'est pas visible.",
    };
  }
  return {
    key: "active",
    label: "Active",
    tone: "success",
    description: "La catégorie garde une contribution lisible sur l'horizon.",
  };
}

function buildSignal(label, item, fallback) {
  if (!item) {
    return {
      label,
      title: fallback,
      categoryId: null,
      outcomeId: null,
      actionId: null,
    };
  }
  return {
    label,
    title: item.title || item.name || fallback,
    categoryId: item.category?.id || item.categoryId || null,
    outcomeId: item.outcomeId || item.id || null,
    actionId: item.actionId || null,
  };
}

function buildOverviewCards({ window, focusSignals, totals, activeCategory }) {
  if (window.horizon === OBJECTIVES_HORIZONS.DAY) {
    return [
      {
        key: "protect",
        label: "Cap du jour",
        value: focusSignals.protect.title,
        meta: activeCategory?.name || "Toutes catégories",
      },
      {
        key: "reframe",
        label: "Point de tension",
        value: focusSignals.reframe.title,
        meta: formatCountLabel(totals.keyActionCount, "action clé"),
      },
    ];
  }
  if (window.horizon === OBJECTIVES_HORIZONS.MONTH) {
    return [
      {
        key: "objectives",
        label: "Objectifs actifs",
        value: String(totals.objectiveCount),
        meta: formatCountLabel(totals.filteredCategoryCount, "catégorie"),
      },
      {
        key: "drift",
        label: "En dérive",
        value: String(totals.stalledOutcomeCount + totals.overflowOutcomeCount),
        meta: "Objectifs à recadrer",
      },
      {
        key: "orphan",
        label: "Actions orphelines",
        value: String(totals.orphanActionCount),
        meta: "Actions à relier",
      },
      {
        key: "minutes",
        label: "Charge visible",
        value: formatMinutesLabel(totals.windowMinutes),
        meta: formatCountLabel(totals.windowExpected, "bloc"),
      },
    ];
  }
  return [
    {
      key: "protect",
      label: "À protéger",
      value: focusSignals.protect.title,
      meta: focusSignals.protect.categoryId && activeCategory?.id !== focusSignals.protect.categoryId
        ? "Signal principal"
        : window.title,
    },
    {
      key: "loosen",
      label: "À desserrer",
      value: focusSignals.loosen.title,
      meta: formatMinutesLabel(totals.windowMinutes),
    },
  ];
}

export function buildObjectivesControlRoom({
  data,
  activeCategoryId = null,
  horizon = OBJECTIVES_HORIZONS.WEEK,
  anchorDateKey = todayLocalKey(),
}) {
  const safeData = data && typeof data === "object" ? data : {};
  const categories = getVisibleCategories(safeData.categories);
  const categoriesById = new Map(categories.map((category) => [category.id, category]));
  const safeHorizon = normalizeHorizon(horizon);
  const window = buildWindow(anchorDateKey, safeHorizon);
  const goals = asArray(safeData.goals);
  const outcomes = goals.filter((goal) => resolveGoalType(goal) === "OUTCOME" && categoriesById.has(goal?.categoryId || ""));
  const processGoals = goals.filter((goal) => resolveGoalType(goal) === "PROCESS" && categoriesById.has(goal?.categoryId || ""));
  const outcomeById = new Map(outcomes.map((outcome) => [outcome.id, outcome]));
  const occurrences = asArray(safeData.occurrences).filter((occurrence) => processGoals.some((goal) => goal.id === occurrence?.goalId));
  const occurrencesByGoalId = buildOccurrenceMaps(occurrences);
  const goalProgressById = new Map();

  for (const outcome of outcomes) {
    const aggregate = computeAggregateProgress({ goals }, outcome.id);
    const progress = outcome?.progress == null ? aggregate.progress : getGoalProgress(outcome);
    goalProgressById.set(outcome.id, progress);
  }

  const actionCards = processGoals
    .filter((action) => !activeCategoryId || action.categoryId === activeCategoryId)
    .map((action) => {
      const linkedOutcome =
        outcomeById.get(safeString(action?.parentId)) ||
        outcomeById.get(safeString(action?.outcomeId)) ||
        null;
      const windowOccurrences = collectWindowOccurrences(occurrencesByGoalId, action.id, window.fromKey, window.toKey);
      const nextOccurrence = collectNextOccurrence(occurrencesByGoalId, action.id, window.anchorDateKey);
      const expectedCount = windowOccurrences.length;
      const doneCount = windowOccurrences.filter((occurrence) => isDoneOccurrenceStatus(occurrence.status)).length;
      const missedCount = windowOccurrences.filter((occurrence) => isMissedOccurrenceStatus(occurrence.status)).length;
      const totalMinutes = windowOccurrences.reduce(
        (sum, occurrence) => sum + (Number.isFinite(occurrence?.durationMinutes) ? occurrence.durationMinutes : 0),
        0,
      );
      return {
        id: action.id,
        actionId: action.id,
        title: action.title || "Action",
        category: categoriesById.get(action.categoryId || "") || null,
        linkedOutcome,
        outcomeId: linkedOutcome?.id || null,
        windowOccurrences,
        nextOccurrence,
        expectedCount,
        doneCount,
        missedCount,
        totalMinutes,
        planningDateKey: normalizeLocalDateKey(nextOccurrence?.date) || window.planningDateKey,
        status: classifyActionStatus({
          linkedOutcome,
          expectedCount,
          doneCount,
          totalMinutes,
        }),
        summary: [formatCountLabel(expectedCount, "bloc"), formatMinutesLabel(totalMinutes)].join(" • "),
      };
    })
    .sort((left, right) => compareStatusThenTitle(left, right, ACTION_STATUS_PRIORITY));

  const objectiveCards = outcomes
    .filter((outcome) => !activeCategoryId || outcome.categoryId === activeCategoryId)
    .map((outcome) => {
      const category = categoriesById.get(outcome.categoryId || "") || null;
      const linkedActions = splitProcessByLink(processGoals, outcome.id).linked
        .filter((action) => !activeCategoryId || action.categoryId === activeCategoryId)
        .map((action) => actionCards.find((entry) => entry.actionId === action.id))
        .filter(Boolean);
      const expectedCount = linkedActions.reduce((sum, action) => sum + action.expectedCount, 0);
      const doneCount = linkedActions.reduce((sum, action) => sum + action.doneCount, 0);
      const missedCount = linkedActions.reduce((sum, action) => sum + action.missedCount, 0);
      const totalMinutes = linkedActions.reduce((sum, action) => sum + action.totalMinutes, 0);
      const progress = goalProgressById.get(outcome.id) || 0;
      const nextAction = linkedActions.find((action) => action.nextOccurrence) || linkedActions[0] || null;
      const keyActions = linkedActions.slice(0, 3);
      return {
        id: outcome.id,
        outcomeId: outcome.id,
        title: outcome.title || "Objectif",
        subtitle: safeString(outcome.notes) || safeString(outcome.deadline) || "Objectif actif sur cet horizon.",
        category,
        progress,
        linkedActions,
        keyActions,
        planningDateKey: nextAction?.planningDateKey || window.planningDateKey,
        status: classifyOutcomeStatus({
          linkedActions,
          progress,
          expectedCount,
          doneCount,
          missedCount,
          totalMinutes,
        }),
        metrics: {
          expectedCount,
          doneCount,
          missedCount,
          totalMinutes,
        },
      };
    })
    .sort((left, right) => compareStatusThenTitle(left, right, OUTCOME_STATUS_PRIORITY));

  const totalMinutesAllCategories = actionCards.reduce((sum, action) => sum + action.totalMinutes, 0);

  const categoryCards = categories
    .filter((category) => !activeCategoryId || category.id === activeCategoryId)
    .map((category) => {
      const categoryObjectives = objectiveCards.filter((objective) => objective.category?.id === category.id);
      const categoryActions = actionCards.filter((action) => action.category?.id === category.id);
      const totalMinutes = categoryActions.reduce((sum, action) => sum + action.totalMinutes, 0);
      const expectedCount = categoryActions.reduce((sum, action) => sum + action.expectedCount, 0);
      const doneCount = categoryActions.reduce((sum, action) => sum + action.doneCount, 0);
      return {
        id: category.id,
        name: category.name || "Catégorie",
        category,
        planningDateKey: window.planningDateKey,
        outcomeCount: categoryObjectives.length,
        actionCount: categoryActions.length,
        totalMinutes,
        expectedCount,
        doneCount,
        share: totalMinutesAllCategories > 0 ? Number((totalMinutes / totalMinutesAllCategories).toFixed(2)) : 0,
        topObjectives: categoryObjectives.slice(0, 2).map((objective) => objective.title),
        status: classifyCategoryStatus({
          outcomeCount: categoryObjectives.length,
          actionCount: categoryActions.length,
          expectedCount,
          doneCount,
          share: totalMinutesAllCategories > 0 ? totalMinutes / totalMinutesAllCategories : 0,
        }),
      };
    })
    .sort((left, right) => {
      const leftPriority = CATEGORY_STATUS_PRIORITY[left?.status?.key] ?? Number.MAX_SAFE_INTEGER;
      const rightPriority = CATEGORY_STATUS_PRIORITY[right?.status?.key] ?? Number.MAX_SAFE_INTEGER;
      if (leftPriority !== rightPriority) return leftPriority - rightPriority;
      if (right.totalMinutes !== left.totalMinutes) return right.totalMinutes - left.totalMinutes;
      return safeString(left?.name).localeCompare(safeString(right?.name), "fr");
    });

  const protectCandidate =
    objectiveCards.find((objective) => objective.status.key === "protect") ||
    actionCards.find((action) => action.status.key === "support") ||
    categoryCards.find((category) => category.status.key === "active") ||
    objectiveCards[0] ||
    null;
  const loosenCandidate =
    categoryCards.find((category) => category.status.key === "dominant") ||
    objectiveCards.find((objective) => objective.status.key === "overflow") ||
    actionCards.find((action) => action.status.key === "dense") ||
    categoryCards[0] ||
    null;
  const reframeCandidate =
    objectiveCards.find((objective) => objective.status.key === "reframe" || objective.status.key === "stalled" || objective.status.key === "structure") ||
    actionCards.find((action) => action.status.key === "drift" || action.status.key === "orphan") ||
    categoryCards.find((category) => category.status.key === "restart" || category.status.key === "structure") ||
    objectiveCards[objectiveCards.length - 1] ||
    null;

  const totals = {
    objectiveCount: objectiveCards.length,
    filteredCategoryCount: categoryCards.length,
    keyActionCount: actionCards.length,
    windowMinutes: actionCards.reduce((sum, action) => sum + action.totalMinutes, 0),
    windowExpected: actionCards.reduce((sum, action) => sum + action.expectedCount, 0),
    windowDone: actionCards.reduce((sum, action) => sum + action.doneCount, 0),
    orphanActionCount: actionCards.filter((action) => action.status.key === "orphan").length,
    stalledOutcomeCount: objectiveCards.filter((objective) => objective.status.key === "stalled" || objective.status.key === "structure").length,
    overflowOutcomeCount: objectiveCards.filter((objective) => objective.status.key === "overflow" || objective.status.key === "reframe").length,
  };

  const focusSignals = {
    protect: buildSignal("À protéger", protectCandidate, "Aucun objectif clair"),
    loosen: buildSignal("À desserrer", loosenCandidate, "Aucune surcharge nette"),
    reframe: buildSignal("À recadrer", reframeCandidate, "Aucun signal critique"),
  };

  return {
    lens: normalizeLens(OBJECTIVES_LENSES.OBJECTIVES),
    horizon: safeHorizon,
    window,
    activeCategory: activeCategoryId ? categoriesById.get(activeCategoryId) || null : null,
    categories,
    objectiveCards,
    categoryCards,
    keyActionCards: actionCards,
    focusSignals,
    overviewCards: buildOverviewCards({
      window,
      focusSignals,
      totals,
      activeCategory: activeCategoryId ? categoriesById.get(activeCategoryId) || null : null,
    }),
    totals,
    aiFallbackNarrative: [
      `Protège ${focusSignals.protect.title}.`,
      `Dessers ${focusSignals.loosen.title}.`,
      `Recadre ${focusSignals.reframe.title}.`,
    ].join(" "),
  };
}
