import { resolveGoalType } from "../../domain/goalType";
import { buildPilotageDisciplineTrend } from "../pilotage/disciplineTrendModel";
import {
  EXECUTION_SURFACE_STATUS,
  getSessionFrictionSignalsForDate,
} from "../../logic/executionStatus";
import { buildSystemSignals } from "../../logic/systemSignals";
import {
  OCCURRENCE_STATUS,
  isCompletedOccurrenceStatus,
  isExcludedFromExpectedOccurrenceStatus,
  isMissedOccurrenceStatus,
  normalizeOccurrenceStatus,
} from "../../logic/occurrenceStatus";
import {
  addDaysLocal,
  normalizeLocalDateKey,
  parseTimeToMinutes,
  todayLocalKey,
} from "../../utils/datetime";

export const ADJUST_ACTION_IDS = Object.freeze({
  SIMPLIFY_DAY: "simplify_day",
  REORGANIZE_SCHEDULE: "reorganize_schedule",
  REDUCE_LOAD: "reduce_load",
  ASK_COACH: "ask_coach",
});

const QUICK_ACTIONS = Object.freeze([
  {
    id: ADJUST_ACTION_IDS.SIMPLIFY_DAY,
    label: "Simplifier la journée",
    description: "Passe par le Coach pour retenir l’essentiel non critique.",
    tone: "execution",
  },
  {
    id: ADJUST_ACTION_IDS.REORGANIZE_SCHEDULE,
    label: "Réorganiser les horaires",
    description: "Ouvre Planning pour replacer les blocs utiles.",
    tone: "execution",
  },
  {
    id: ADJUST_ACTION_IDS.REDUCE_LOAD,
    label: "Réduire la charge",
    description: "Demande un plan plus léger sans perdre l’action critique.",
    tone: "attention",
  },
  {
    id: ADJUST_ACTION_IDS.ASK_COACH,
    label: "Demander au Coach IA",
    description: "Obtiens une analyse personnalisée et un plan d’action.",
    tone: "ai",
  },
]);

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function normalizeDateKey(value) {
  return normalizeLocalDateKey(value) || "";
}

function isPostponedStatus(rawStatus) {
  const raw = String(rawStatus || "").trim().toLowerCase();
  return raw === "postponed" || raw === "reported" || raw === OCCURRENCE_STATUS.RESCHEDULED;
}

function isExpectedStatus(status) {
  return normalizeOccurrenceStatus(status) !== OCCURRENCE_STATUS.RESCHEDULED && !isExcludedFromExpectedOccurrenceStatus(status);
}

function getOccurrenceMinutes(occurrence, goalsById) {
  const rawDuration = Number(occurrence?.durationMinutes);
  if (Number.isFinite(rawDuration) && rawDuration > 0) return Math.round(rawDuration);
  const goal = goalsById.get(occurrence?.goalId || occurrence?.actionId || "");
  const goalDuration = Number(goal?.sessionMinutes || goal?.durationMinutes);
  return Number.isFinite(goalDuration) && goalDuration > 0 ? Math.round(goalDuration) : 0;
}

function occurrenceTimeRank(occurrence) {
  const minutes = parseTimeToMinutes(occurrence?.start);
  return Number.isFinite(minutes) ? minutes : Number.MAX_SAFE_INTEGER;
}

function compareOccurrences(left, right) {
  const leftDate = normalizeDateKey(left?.date);
  const rightDate = normalizeDateKey(right?.date);
  if (leftDate !== rightDate) return leftDate.localeCompare(rightDate);
  const timeDelta = occurrenceTimeRank(left) - occurrenceTimeRank(right);
  if (timeDelta !== 0) return timeDelta;
  return String(left?.id || "").localeCompare(String(right?.id || ""));
}

function resolveOccurrenceGoal(occurrence, goalsById) {
  return goalsById.get(occurrence?.goalId || occurrence?.actionId || "") || null;
}

function resolveOccurrenceCategory(occurrence, goal, categoriesById) {
  const categoryId = goal?.categoryId || occurrence?.categoryId || "";
  return categoriesById.get(categoryId) || null;
}

function buildNextBlock({ occurrences, activeDateKey, goalsById, categoriesById }) {
  const next = occurrences
    .filter((occurrence) => {
      const dateKey = normalizeDateKey(occurrence?.date);
      if (!dateKey || dateKey < activeDateKey) return false;
      const status = normalizeOccurrenceStatus(occurrence?.status);
      if (!isExpectedStatus(status)) return false;
      if (isCompletedOccurrenceStatus(status) || isMissedOccurrenceStatus(status)) return false;
      return true;
    })
    .sort(compareOccurrences)[0];

  if (!next) return null;
  const goal = resolveOccurrenceGoal(next, goalsById);
  const category = resolveOccurrenceCategory(next, goal, categoriesById);
  return {
    id: next.id || "",
    title: goal?.title || next.title || "Bloc d’exécution",
    dateKey: normalizeDateKey(next.date),
    start: typeof next.start === "string" ? next.start : "",
    durationMinutes: getOccurrenceMinutes(next, goalsById),
    status: normalizeOccurrenceStatus(next.status),
    categoryId: category?.id || null,
    categoryName: category?.name || "Système",
  };
}

function buildCategorySignals({ categories, goals, occurrences, fromKey, toKey }) {
  const processGoals = goals.filter((goal) => resolveGoalType(goal) === "PROCESS");
  const goalsByCategory = new Map();
  for (const goal of processGoals) {
    const categoryId = goal?.categoryId || "";
    if (!categoryId) continue;
    if (!goalsByCategory.has(categoryId)) goalsByCategory.set(categoryId, []);
    goalsByCategory.get(categoryId).push(goal);
  }

  return categories
    .map((category) => {
      const categoryGoals = goalsByCategory.get(category.id) || [];
      const goalIds = new Set(categoryGoals.map((goal) => goal.id).filter(Boolean));
      let expected = 0;
      let done = 0;
      let missed = 0;
      for (const occurrence of occurrences) {
        if (!goalIds.has(occurrence?.goalId || occurrence?.actionId || "")) continue;
        const dateKey = normalizeDateKey(occurrence?.date);
        if (!dateKey || dateKey < fromKey || dateKey > toKey) continue;
        const status = normalizeOccurrenceStatus(occurrence?.status);
        if (isExpectedStatus(status)) expected += 1;
        if (isCompletedOccurrenceStatus(status)) done += 1;
        if (isMissedOccurrenceStatus(status)) missed += 1;
      }
      const score = expected ? Math.round((done / expected) * 100) : null;
      return {
        id: category.id,
        label: category.name || "Catégorie",
        expected,
        done,
        missed,
        score,
        hasStructure: categoryGoals.length > 0,
      };
    })
    .filter((signal) => signal.hasStructure || signal.expected > 0)
    .sort((left, right) => {
      if ((left.score ?? 101) !== (right.score ?? 101)) return (left.score ?? 101) - (right.score ?? 101);
      return right.expected - left.expected;
    })
    .slice(0, 5);
}

function buildFrictionSignals({ summary, trend, categorySignals, nextBlock }) {
  const signals = [];
  if (summary.missedCount > 0) {
    signals.push({
      id: "missed_blocks",
      tone: "attention",
      title: `${summary.missedCount} bloc${summary.missedCount > 1 ? "s" : ""} manqué${summary.missedCount > 1 ? "s" : ""}`,
      description: "La journée contient déjà une friction d’exécution réelle.",
    });
  }
  if (summary.blockedCount > 0) {
    signals.push({
      id: "blocked_blocks",
      tone: "attention",
      title: `${summary.blockedCount} bloc${summary.blockedCount > 1 ? "s" : ""} bloqué${summary.blockedCount > 1 ? "s" : ""}`,
      description: "Un bloc a rencontré une friction concrète. Corrige le système sans ajouter de dette.",
    });
  }
  if (summary.reportedCount > 0) {
    signals.push({
      id: "reported_blocks",
      tone: "attention",
      title: `${summary.reportedCount} bloc${summary.reportedCount > 1 ? "s" : ""} signalé${summary.reportedCount > 1 ? "s" : ""}`,
      description: "Un report signalé mérite une heure plus claire ou une version allégée.",
    });
  }
  if (summary.remainingMinutes >= 120 || summary.remainingCount >= 4) {
    signals.push({
      id: "high_load",
      tone: "attention",
      title: "Charge élevée",
      description: "La charge restante dépasse ce qui reste facile à protéger.",
    });
  }
  if (!nextBlock && summary.plannedCount > summary.doneCount) {
    signals.push({
      id: "no_next_block",
      tone: "attention",
      title: "Prochain bloc flou",
      description: "Il reste de l’exécution, mais aucun prochain bloc net ne ressort.",
    });
  }
  const trendLabel = String(trend?.summary?.trendLabel || "");
  const currentScore =
    typeof trend?.summary?.currentScore === "number" && Number.isFinite(trend.summary.currentScore)
      ? trend.summary.currentScore
      : null;
  if (trendLabel === "baisse" || trendLabel === "irrégularité" || (Number.isFinite(currentScore) && currentScore < 45)) {
    signals.push({
      id: "weak_consistency",
      tone: "attention",
      title: "Régularité fragile",
      description: "Le rythme des derniers jours demande un ajustement plus simple.",
    });
  }
  const neglected = categorySignals.find((signal) => signal.expected >= 2 && signal.done === 0);
  if (neglected) {
    signals.push({
      id: "neglected_category",
      tone: "attention",
      title: `${neglected.label} en retrait`,
      description: "Une direction structurée existe, mais elle n’a pas encore produit d’exécution récente.",
    });
  }
  return signals.slice(0, 4);
}

function resolveRecommendation({ summary, frictionSignals, nextBlock }) {
  const hasMissed = frictionSignals.some((signal) => signal.id === "missed_blocks");
  const hasHighLoad = frictionSignals.some((signal) => signal.id === "high_load");
  const hasNoNextBlock = frictionSignals.some((signal) => signal.id === "no_next_block");
  const hasWeakConsistency = frictionSignals.some((signal) => signal.id === "weak_consistency");
  const hasBlocked = frictionSignals.some((signal) => signal.id === "blocked_blocks");
  const hasReported = frictionSignals.some((signal) => signal.id === "reported_blocks");

  if (hasBlocked) {
    return {
      id: "recommend_simplify_blocked",
      actionId: ADJUST_ACTION_IDS.SIMPLIFY_DAY,
      tone: "execution",
      title: "Simplifie le bloc bloqué",
      description: "Passe par le Coach pour garder une version plus courte et faisable du prochain bloc.",
      expectedImpact: ["Friction nommée", "Version plus courte", "Reprise sans dette"],
    };
  }
  if (hasReported && (summary.reportedCount >= 2 || hasHighLoad)) {
    return {
      id: "recommend_reduce_reported",
      actionId: ADJUST_ACTION_IDS.REDUCE_LOAD,
      tone: "attention",
      title: "Réduis la charge",
      description: "Les reports signalent une journée trop lourde ou mal placée.",
      expectedImpact: ["Charge plus réaliste", "Moins de reports", "Prochain bloc plus clair"],
    };
  }
  if (hasReported) {
    return {
      id: "recommend_reorganize_reported",
      actionId: ADJUST_ACTION_IDS.REORGANIZE_SCHEDULE,
      tone: "execution",
      title: "Réorganise l’horaire",
      description: "Replace le bloc signalé dans un créneau plus clair avant de forcer l’exécution.",
      expectedImpact: ["Créneau clarifié", "Moins d’improvisation", "Bloc plus facile à protéger"],
    };
  }
  if (hasMissed || hasHighLoad) {
    return {
      id: "recommend_simplify",
      actionId: ADJUST_ACTION_IDS.SIMPLIFY_DAY,
      tone: "execution",
      title: "Simplifie la journée",
      description: "Passe par le Coach pour retirer ou hiérarchiser les blocs non critiques.",
      expectedImpact: ["Moins de charge mentale", "Prochain bloc mieux protégé", "Journée plus tenable"],
    };
  }
  if (hasNoNextBlock || (!nextBlock && summary.plannedCount <= 0)) {
    return {
      id: "recommend_reorganize",
      actionId: ADJUST_ACTION_IDS.REORGANIZE_SCHEDULE,
      tone: "execution",
      title: "Réorganise les horaires",
      description: "Ouvre Planning pour donner une heure claire au prochain bloc utile.",
      expectedImpact: ["Planning plus lisible", "Moins d’improvisation", "Prochain créneau clarifié"],
    };
  }
  if (hasWeakConsistency || summary.completionScore < 45) {
    return {
      id: "recommend_reduce",
      actionId: ADJUST_ACTION_IDS.REDUCE_LOAD,
      tone: "attention",
      title: "Réduis la charge",
      description: "Demande au Coach un plan plus léger sans abandonner l’action critique.",
      expectedImpact: ["Cadence plus réaliste", "Friction réduite", "Exécution plus stable"],
    };
  }
  return {
    id: "recommend_coach",
    actionId: ADJUST_ACTION_IDS.ASK_COACH,
    tone: "execution",
    title: "Garde le système lisible",
    description: nextBlock
      ? `Le prochain bloc est clair : ${nextBlock.title}. Demande au Coach si tu veux le challenger.`
      : "Aucun signal critique ne ressort. Tu peux demander au Coach de vérifier le meilleur ajustement.",
    expectedImpact: ["Cap conservé", "Décision plus nette", "Ajustement sans surcharge"],
  };
}

export function buildAdjustDiagnostic(data, activeDateKey = todayLocalKey()) {
  const safeData = data && typeof data === "object" ? data : {};
  const dateKey = normalizeDateKey(activeDateKey) || todayLocalKey();
  const occurrences = safeArray(safeData.occurrences);
  const sessionHistory = safeArray(safeData.sessionHistory);
  const goals = safeArray(safeData.goals);
  const categories = safeArray(safeData.categories);
  const goalsById = new Map(goals.map((goal) => [goal?.id, goal]).filter(([id]) => typeof id === "string" && id));
  const categoriesById = new Map(categories.map((category) => [category?.id, category]).filter(([id]) => typeof id === "string" && id));

  const todayOccurrences = occurrences.filter((occurrence) => normalizeDateKey(occurrence?.date) === dateKey);
  const expectedToday = todayOccurrences.filter((occurrence) => isExpectedStatus(normalizeOccurrenceStatus(occurrence?.status)));
  const doneToday = expectedToday.filter((occurrence) => isCompletedOccurrenceStatus(occurrence?.status));
  const missedToday = expectedToday.filter((occurrence) => isMissedOccurrenceStatus(occurrence?.status));
  const postponedToday = todayOccurrences.filter((occurrence) => isPostponedStatus(occurrence?.status));
  const sessionFrictionSignals = getSessionFrictionSignalsForDate({ sessionHistory, dateKey });
  const blockedSessionSignals = sessionFrictionSignals.filter(
    (signal) => signal.status === EXECUTION_SURFACE_STATUS.BLOCKED
  );
  const reportedSessionSignals = sessionFrictionSignals.filter(
    (signal) => signal.status === EXECUTION_SURFACE_STATUS.REPORTED
  );
  const postponedOccurrenceKeys = new Set(
    postponedToday.map((occurrence) => occurrence?.id).filter((id) => typeof id === "string" && id)
  );
  const reportedSessionOnlySignals = reportedSessionSignals.filter(
    (signal) => !postponedOccurrenceKeys.has(signal.occurrenceId)
  );
  const remainingToday = expectedToday.filter((occurrence) => {
    const status = normalizeOccurrenceStatus(occurrence?.status);
    return !isCompletedOccurrenceStatus(status) && !isMissedOccurrenceStatus(status);
  });
  const remainingMinutes = remainingToday.reduce((total, occurrence) => total + getOccurrenceMinutes(occurrence, goalsById), 0);
  const completionScore = expectedToday.length ? Math.round((doneToday.length / expectedToday.length) * 100) : null;
  const nextBlock = buildNextBlock({ occurrences, activeDateKey: dateKey, goalsById, categoriesById });
  const trendSnapshot = buildPilotageDisciplineTrend(safeData, {
    windowDays: 7,
    now: new Date(`${dateKey}T12:00:00`),
  });
  const fromKey = addDaysLocal(dateKey, -6);
  const categorySignals = buildCategorySignals({ categories, goals, occurrences, fromKey, toKey: dateKey });

  let summary = {
    activeDateKey: dateKey,
    hasAnyData: occurrences.length > 0 || goals.length > 0 || categories.length > 0,
    hasPlannedData: expectedToday.length > 0 || sessionFrictionSignals.length > 0,
    completionScore,
    plannedCount: expectedToday.length,
    doneCount: doneToday.length,
    missedCount: missedToday.length,
    postponedCount: postponedToday.length + reportedSessionOnlySignals.length,
    rescheduledCount: postponedToday.length,
    blockedCount: blockedSessionSignals.length,
    reportedCount: reportedSessionSignals.length,
    sessionFrictionCount: sessionFrictionSignals.length,
    systemSignalCount: 0,
    remainingCount: remainingToday.length,
    remainingMinutes,
    state:
      expectedToday.length <= 0 && sessionFrictionSignals.length <= 0
        ? "low_information"
        : missedToday.length > 0 || remainingMinutes >= 120 || sessionFrictionSignals.length > 0
          ? "friction"
          : completionScore >= 70
            ? "control"
            : "adjust",
  };
  const frictionSignals = buildFrictionSignals({ summary, trend: trendSnapshot, categorySignals, nextBlock });
  const recommendation = resolveRecommendation({ summary, frictionSignals, nextBlock });
  const systemSignals = buildSystemSignals({
    occurrences,
    sessionHistory,
    adjustDiagnostic: {
      summary,
      nextBlock,
      frictionSignals,
      categorySignals,
    },
    dateKey,
  });
  summary = {
    ...summary,
    systemSignalCount: systemSignals.length,
  };

  return {
    summary,
    nextBlock,
    frictionSignals,
    systemSignals,
    recommendation,
    quickActions: QUICK_ACTIONS,
    trendSnapshot,
    categorySignals,
  };
}
