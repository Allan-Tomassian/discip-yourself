import { resolveGoalType } from "../../domain/goalType";
import {
  deriveExecutionStatusForOccurrence,
  EXECUTION_SURFACE_STATUS,
} from "../../logic/executionStatus";
import { getGoalProgress } from "../../logic/goals";
import {
  addDaysLocal,
  normalizeLocalDateKey,
  todayLocalKey,
} from "../../utils/datetime";

export const OBJECTIVE_PROGRESS_SOURCE = Object.freeze({
  EXECUTION: "execution",
  MANUAL: "manual",
  NONE: "none",
});

export const OBJECTIVE_DISPLAY_STATUS = Object.freeze({
  COMPLETED: "completed",
  PAUSED: "paused",
  FAILED: "failed",
  ARCHIVED: "archived",
  NEEDS_STRUCTURE: "needs_structure",
  EXECUTION_FRICTION: "execution_friction",
  ACTIVE: "active",
});

const OBJECTIVE_STATUS_META = Object.freeze({
  [OBJECTIVE_DISPLAY_STATUS.COMPLETED]: {
    key: OBJECTIVE_DISPLAY_STATUS.COMPLETED,
    label: "Terminé",
    tone: "execution",
  },
  [OBJECTIVE_DISPLAY_STATUS.PAUSED]: {
    key: OBJECTIVE_DISPLAY_STATUS.PAUSED,
    label: "En pause",
    tone: "attention",
  },
  [OBJECTIVE_DISPLAY_STATUS.FAILED]: {
    key: OBJECTIVE_DISPLAY_STATUS.FAILED,
    label: "Échoué",
    tone: "critical",
  },
  [OBJECTIVE_DISPLAY_STATUS.ARCHIVED]: {
    key: OBJECTIVE_DISPLAY_STATUS.ARCHIVED,
    label: "Archivé",
    tone: "disabled",
  },
  [OBJECTIVE_DISPLAY_STATUS.NEEDS_STRUCTURE]: {
    key: OBJECTIVE_DISPLAY_STATUS.NEEDS_STRUCTURE,
    label: "À structurer",
    tone: "attention",
  },
  [OBJECTIVE_DISPLAY_STATUS.EXECUTION_FRICTION]: {
    key: OBJECTIVE_DISPLAY_STATUS.EXECUTION_FRICTION,
    label: "Friction détectée",
    tone: "attention",
  },
  [OBJECTIVE_DISPLAY_STATUS.ACTIVE]: {
    key: OBJECTIVE_DISPLAY_STATUS.ACTIVE,
    label: "Actif",
    tone: "execution",
  },
});

const SOURCE_LABELS = Object.freeze({
  [OBJECTIVE_PROGRESS_SOURCE.EXECUTION]: "Progression d’exécution",
  [OBJECTIVE_PROGRESS_SOURCE.MANUAL]: "Progression manuelle",
  [OBJECTIVE_PROGRESS_SOURCE.NONE]: "Point de départ",
});

const STATUS_WITHOUT_PROGRESS = new Set([
  EXECUTION_SURFACE_STATUS.SKIPPED,
  EXECUTION_SURFACE_STATUS.CANCELED,
]);

const EXECUTION_EXPECTED_STATUSES = new Set([
  EXECUTION_SURFACE_STATUS.PLANNED,
  EXECUTION_SURFACE_STATUS.ACTIVE,
  EXECUTION_SURFACE_STATUS.DONE,
  EXECUTION_SURFACE_STATUS.MISSED,
  EXECUTION_SURFACE_STATUS.POSTPONED,
  EXECUTION_SURFACE_STATUS.BLOCKED,
  EXECUTION_SURFACE_STATUS.REPORTED,
]);

const HISTORY_FRICTION_REASONS = new Set(["blocked", "reported"]);

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function safeString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function clamp01(value) {
  return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
}

function normalizeKey(value) {
  return safeString(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function normalizeWindowDays(value) {
  const days = Number(value);
  if (!Number.isFinite(days)) return 14;
  return Math.max(1, Math.trunc(days));
}

function buildWindow(dateKey, windowDays) {
  const toKey = normalizeLocalDateKey(dateKey) || todayLocalKey();
  const days = normalizeWindowDays(windowDays);
  return {
    dateKey: toKey,
    fromKey: addDaysLocal(toKey, -(days - 1)) || toKey,
    toKey,
    days,
  };
}

function isWithinWindow(dateKey, window) {
  const normalized = normalizeLocalDateKey(dateKey);
  return Boolean(normalized && normalized >= window.fromKey && normalized <= window.toKey);
}

function normalizeGoalStatus(goal) {
  return normalizeKey(goal?.status || goal?.state || goal?.lifecycleStatus);
}

function getLifecycleStatus(goal) {
  const status = normalizeGoalStatus(goal);
  if (["archived", "archive", "invalid", "deleted"].includes(status)) {
    return OBJECTIVE_STATUS_META[OBJECTIVE_DISPLAY_STATUS.ARCHIVED];
  }
  if (["failed", "failure", "abandoned", "echec", "echoue"].includes(status)) {
    return OBJECTIVE_STATUS_META[OBJECTIVE_DISPLAY_STATUS.FAILED];
  }
  if (["completed", "complete", "done", "finished", "termine", "terminee"].includes(status)) {
    return OBJECTIVE_STATUS_META[OBJECTIVE_DISPLAY_STATUS.COMPLETED];
  }
  if (["paused", "pause", "suspended", "on_hold", "hold", "en_pause"].includes(status)) {
    return OBJECTIVE_STATUS_META[OBJECTIVE_DISPLAY_STATUS.PAUSED];
  }
  return null;
}

function hasStoredProgress(goal) {
  if (!goal || typeof goal !== "object") return false;
  if (goal.progress !== null && goal.progress !== undefined && Number.isFinite(Number(goal.progress))) return true;
  return getLifecycleStatus(goal)?.key === OBJECTIVE_DISPLAY_STATUS.COMPLETED;
}

function getManualProgressSignal(goal) {
  if (!hasStoredProgress(goal)) {
    return { hasSignal: false, progress: 0 };
  }
  if (getLifecycleStatus(goal)?.key === OBJECTIVE_DISPLAY_STATUS.COMPLETED) {
    return { hasSignal: true, progress: 1 };
  }
  return {
    hasSignal: true,
    progress: clamp01(getGoalProgress(goal)),
  };
}

function getOutcomeCandidates(action) {
  return [
    safeString(action?.parentId),
    safeString(action?.outcomeId),
    safeString(action?.primaryGoalId),
    safeString(action?.parentGoalId),
  ].filter(Boolean);
}

function resolveLinkedOutcomeId(action, outcomeById) {
  for (const candidate of getOutcomeCandidates(action)) {
    if (outcomeById.has(candidate)) return candidate;
  }
  return null;
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

function getOccurrenceDateKey(occurrence) {
  return normalizeLocalDateKey(occurrence?.date) || "";
}

function getHistoryDateKey(history) {
  return (
    normalizeLocalDateKey(history?.dateKey) ||
    normalizeLocalDateKey(history?.date) ||
    normalizeLocalDateKey(history?.endAt) ||
    normalizeLocalDateKey(history?.startAt) ||
    ""
  );
}

function getHistoryReason(history) {
  const reason = normalizeKey(history?.endedReason);
  return HISTORY_FRICTION_REASONS.has(reason) ? reason : "";
}

function getHistoryRank(history) {
  const candidates = [history?.endAt, history?.finishedAt, history?.updatedAt, history?.createdAt, history?.startAt];
  for (const candidate of candidates) {
    const timestamp = Date.parse(safeString(candidate));
    if (Number.isFinite(timestamp)) return timestamp;
  }
  return 0;
}

function buildOccurrenceIndexes(occurrences) {
  const byId = new Map();
  const byGoalId = new Map();
  for (const occurrence of asArray(occurrences)) {
    const occurrenceId = safeString(occurrence?.id);
    const goalId = safeString(occurrence?.goalId || occurrence?.actionId);
    if (!occurrenceId || !goalId) continue;
    byId.set(occurrenceId, occurrence);
    if (!byGoalId.has(goalId)) byGoalId.set(goalId, []);
    byGoalId.get(goalId).push(occurrence);
  }
  for (const list of byGoalId.values()) {
    list.sort(compareByDateAndStart);
  }
  return { byId, byGoalId };
}

function buildHistoryFrictionByAction({ sessionHistory, occurrenceById, actionsById, window }) {
  const latestByEvidenceKey = new Map();
  for (const history of asArray(sessionHistory)) {
    const reason = getHistoryReason(history);
    if (!reason) continue;
    const dateKey = getHistoryDateKey(history);
    if (!isWithinWindow(dateKey, window)) continue;

    const occurrenceId = safeString(history?.occurrenceId);
    const occurrence = occurrenceId ? occurrenceById.get(occurrenceId) || null : null;
    const actionId = safeString(occurrence?.goalId || occurrence?.actionId || history?.actionId || history?.goalId);
    if (!actionId || !actionsById.has(actionId)) continue;

    const status = reason === "blocked" ? EXECUTION_SURFACE_STATUS.BLOCKED : EXECUTION_SURFACE_STATUS.REPORTED;
    const evidenceKey = `${status}:${occurrenceId || safeString(history?.id)}:${dateKey}`;
    const previous = latestByEvidenceKey.get(evidenceKey);
    if (previous && getHistoryRank(previous.history) > getHistoryRank(history)) continue;

    latestByEvidenceKey.set(evidenceKey, {
      actionId,
      occurrenceId,
      historyId: safeString(history?.id) || null,
      dateKey,
      status,
      history,
      evidenceKey,
    });
  }

  const byActionId = new Map();
  for (const signal of latestByEvidenceKey.values()) {
    if (!byActionId.has(signal.actionId)) byActionId.set(signal.actionId, []);
    byActionId.get(signal.actionId).push(signal);
  }
  return byActionId;
}

function summarizeExecutionOccurrences({
  occurrences,
  sessionHistory,
  historyFriction,
  window,
}) {
  let completedCount = 0;
  let expectedCount = 0;
  let missedCount = 0;
  let blockedCount = 0;
  let reportedCount = 0;
  const evidenceKeys = new Set();

  for (const occurrence of occurrences) {
    const occurrenceDateKey = getOccurrenceDateKey(occurrence);
    if (!isWithinWindow(occurrenceDateKey, window)) continue;

    const derived = deriveExecutionStatusForOccurrence(occurrence, {
      sessionHistory,
      dateKey: occurrenceDateKey,
    });
    const status = derived.status;
    if (STATUS_WITHOUT_PROGRESS.has(status)) continue;
    if (!EXECUTION_EXPECTED_STATUSES.has(status)) continue;

    expectedCount += 1;
    if (status === EXECUTION_SURFACE_STATUS.DONE) completedCount += 1;
    if (status === EXECUTION_SURFACE_STATUS.MISSED) missedCount += 1;
    if (status === EXECUTION_SURFACE_STATUS.BLOCKED) blockedCount += 1;
    if (status === EXECUTION_SURFACE_STATUS.REPORTED) reportedCount += 1;

    if (status === EXECUTION_SURFACE_STATUS.BLOCKED || status === EXECUTION_SURFACE_STATUS.REPORTED) {
      evidenceKeys.add(`${status}:${safeString(occurrence?.id)}:${occurrenceDateKey}`);
    }
  }

  for (const signal of historyFriction) {
    if (!signal?.evidenceKey || evidenceKeys.has(signal.evidenceKey)) continue;
    expectedCount += 1;
    if (signal.status === EXECUTION_SURFACE_STATUS.BLOCKED) blockedCount += 1;
    if (signal.status === EXECUTION_SURFACE_STATUS.REPORTED) reportedCount += 1;
    evidenceKeys.add(signal.evidenceKey);
  }

  const frictionCount = missedCount + blockedCount + reportedCount;
  const hasExecutionData = expectedCount > 0 || frictionCount > 0;
  return {
    completedCount,
    expectedCount,
    missedCount,
    blockedCount,
    reportedCount,
    frictionCount,
    executionProgress: hasExecutionData && expectedCount > 0 ? clamp01(completedCount / expectedCount) : 0,
    hasExecutionData,
  };
}

function buildLabels({ source, completedCount, expectedCount, frictionCount, statusKey }) {
  let evidence = "Aucun bloc exécuté dans la fenêtre.";
  if (expectedCount > 0) {
    evidence = `${completedCount}/${expectedCount} blocs validés`;
  }
  if (frictionCount > 0) {
    evidence = `${evidence} · ${frictionCount} friction${frictionCount > 1 ? "s" : ""}`;
  }
  return {
    source: statusKey === OBJECTIVE_DISPLAY_STATUS.EXECUTION_FRICTION
      ? "Friction détectée"
      : statusKey === OBJECTIVE_DISPLAY_STATUS.NEEDS_STRUCTURE
        ? "À structurer"
        : SOURCE_LABELS[source] || SOURCE_LABELS[OBJECTIVE_PROGRESS_SOURCE.NONE],
    evidence,
    progress: SOURCE_LABELS[source] || SOURCE_LABELS[OBJECTIVE_PROGRESS_SOURCE.NONE],
  };
}

function chooseDisplayProgress({ execution, manual }) {
  if (execution.hasExecutionData) {
    return {
      source: OBJECTIVE_PROGRESS_SOURCE.EXECUTION,
      displayProgress: execution.executionProgress,
    };
  }
  if (manual.hasSignal) {
    return {
      source: OBJECTIVE_PROGRESS_SOURCE.MANUAL,
      displayProgress: manual.progress,
    };
  }
  return {
    source: OBJECTIVE_PROGRESS_SOURCE.NONE,
    displayProgress: 0,
  };
}

function buildActionStatus({ lifecycleStatus, execution }) {
  if (lifecycleStatus) return lifecycleStatus;
  if (execution.frictionCount > 0) {
    return OBJECTIVE_STATUS_META[OBJECTIVE_DISPLAY_STATUS.EXECUTION_FRICTION];
  }
  return OBJECTIVE_STATUS_META[OBJECTIVE_DISPLAY_STATUS.ACTIVE];
}

function buildObjectiveStatus({ lifecycleStatus, linkedActions, execution }) {
  if (lifecycleStatus) return lifecycleStatus;
  if (!linkedActions.length) return OBJECTIVE_STATUS_META[OBJECTIVE_DISPLAY_STATUS.NEEDS_STRUCTURE];
  if (execution.frictionCount > 0) {
    return OBJECTIVE_STATUS_META[OBJECTIVE_DISPLAY_STATUS.EXECUTION_FRICTION];
  }
  return OBJECTIVE_STATUS_META[OBJECTIVE_DISPLAY_STATUS.ACTIVE];
}

function buildActionModels({
  processGoals,
  outcomeById,
  occurrencesByGoalId,
  sessionHistory,
  historyFrictionByActionId,
  window,
  categoriesById,
}) {
  const byActionId = new Map();
  const actions = [];

  for (const action of processGoals) {
    const actionId = safeString(action?.id);
    if (!actionId) continue;
    const linkedOutcomeId = resolveLinkedOutcomeId(action, outcomeById);
    const occurrences = occurrencesByGoalId.get(actionId) || [];
    const execution = summarizeExecutionOccurrences({
      occurrences,
      sessionHistory,
      historyFriction: historyFrictionByActionId.get(actionId) || [],
      window,
    });
    const manual = getManualProgressSignal(action);
    const display = chooseDisplayProgress({ execution, manual });
    const lifecycleStatus = getLifecycleStatus(action);
    const status = buildActionStatus({ lifecycleStatus, execution });
    const model = {
      id: actionId,
      actionId,
      action,
      goal: action,
      outcomeId: linkedOutcomeId,
      category: categoriesById.get(action?.categoryId || "") || null,
      displayProgress: display.displayProgress,
      executionProgress: execution.executionProgress,
      manualProgress: manual.hasSignal ? manual.progress : null,
      source: display.source,
      completedCount: execution.completedCount,
      expectedCount: execution.expectedCount,
      missedCount: execution.missedCount,
      blockedCount: execution.blockedCount,
      reportedCount: execution.reportedCount,
      frictionCount: execution.frictionCount,
      hasExecutionData: execution.hasExecutionData,
      hasManualProgress: manual.hasSignal,
      status,
      labels: buildLabels({
        source: display.source,
        completedCount: execution.completedCount,
        expectedCount: execution.expectedCount,
        frictionCount: execution.frictionCount,
        statusKey: status.key,
      }),
    };
    byActionId.set(actionId, model);
    actions.push(model);
  }

  return { actions, byActionId };
}

function getObjectiveManualProgress(objective, linkedActionModels) {
  const ownManual = getManualProgressSignal(objective);
  if (ownManual.hasSignal) return ownManual;

  const manualActions = linkedActionModels.filter((action) => action.hasManualProgress);
  if (!manualActions.length) return { hasSignal: false, progress: 0 };

  const weighted = manualActions.map((action) => {
    const rawWeight = Number(action.action?.weight);
    return {
      progress: action.manualProgress || 0,
      weight: Number.isFinite(rawWeight) ? Math.max(0, rawWeight) : 100,
    };
  });
  const totalWeight = weighted.reduce((sum, item) => sum + item.weight, 0);
  if (totalWeight <= 0) return { hasSignal: false, progress: 0 };
  const progress = weighted.reduce((sum, item) => sum + item.progress * item.weight, 0) / totalWeight;
  return {
    hasSignal: true,
    progress: clamp01(progress),
  };
}

function combineExecution(linkedActionModels) {
  const summary = linkedActionModels.reduce(
    (acc, action) => {
      acc.completedCount += action.completedCount;
      acc.expectedCount += action.expectedCount;
      acc.missedCount += action.missedCount;
      acc.blockedCount += action.blockedCount;
      acc.reportedCount += action.reportedCount;
      acc.frictionCount += action.frictionCount;
      if (action.hasExecutionData) acc.hasExecutionData = true;
      return acc;
    },
    {
      completedCount: 0,
      expectedCount: 0,
      missedCount: 0,
      blockedCount: 0,
      reportedCount: 0,
      frictionCount: 0,
      hasExecutionData: false,
    },
  );
  return {
    ...summary,
    executionProgress: summary.hasExecutionData && summary.expectedCount > 0
      ? clamp01(summary.completedCount / summary.expectedCount)
      : 0,
  };
}

function buildObjectiveModels({
  outcomes,
  actionModels,
  categoriesById,
}) {
  const byObjectiveId = new Map();
  const byOutcomeId = new Map();
  for (const action of actionModels) {
    if (!action.outcomeId) continue;
    if (!byOutcomeId.has(action.outcomeId)) byOutcomeId.set(action.outcomeId, []);
    byOutcomeId.get(action.outcomeId).push(action);
  }

  const objectives = [];
  for (const outcome of outcomes) {
    const objectiveId = safeString(outcome?.id);
    if (!objectiveId) continue;
    const linkedActions = byOutcomeId.get(objectiveId) || [];
    const execution = combineExecution(linkedActions);
    const manual = getObjectiveManualProgress(outcome, linkedActions);
    const display = chooseDisplayProgress({ execution, manual });
    const lifecycleStatus = getLifecycleStatus(outcome);
    const status = buildObjectiveStatus({ lifecycleStatus, linkedActions, execution });
    const model = {
      id: objectiveId,
      objectiveId,
      outcomeId: objectiveId,
      objective: outcome,
      goal: outcome,
      category: categoriesById.get(outcome?.categoryId || "") || null,
      linkedActions,
      displayProgress: display.displayProgress,
      executionProgress: execution.executionProgress,
      manualProgress: manual.hasSignal ? manual.progress : null,
      source: display.source,
      completedCount: execution.completedCount,
      expectedCount: execution.expectedCount,
      missedCount: execution.missedCount,
      blockedCount: execution.blockedCount,
      reportedCount: execution.reportedCount,
      frictionCount: execution.frictionCount,
      hasExecutionData: execution.hasExecutionData,
      hasManualProgress: manual.hasSignal,
      status,
      labels: buildLabels({
        source: display.source,
        completedCount: execution.completedCount,
        expectedCount: execution.expectedCount,
        frictionCount: execution.frictionCount,
        statusKey: status.key,
      }),
    };
    byObjectiveId.set(objectiveId, model);
    objectives.push(model);
  }

  return { objectives, byObjectiveId };
}

function isVisibleInCategories(goal, categoriesById) {
  return categoriesById.has(goal?.categoryId || "");
}

export function buildObjectiveProgressModel({
  goals,
  occurrences,
  sessionHistory,
  categories,
  dateKey,
  windowDays = 14,
} = {}) {
  const window = buildWindow(dateKey, windowDays);
  const safeCategories = asArray(categories).filter((category) => safeString(category?.id));
  const categoriesById = new Map(safeCategories.map((category) => [category.id, category]));
  const safeGoals = asArray(goals);
  const outcomes = safeGoals.filter((goal) => resolveGoalType(goal) === "OUTCOME" && isVisibleInCategories(goal, categoriesById));
  const processGoals = safeGoals.filter((goal) => resolveGoalType(goal) === "PROCESS" && isVisibleInCategories(goal, categoriesById));
  const outcomeById = new Map(outcomes.map((outcome) => [outcome.id, outcome]));
  const actionsById = new Map(processGoals.map((action) => [action.id, action]));
  const occurrenceIndexes = buildOccurrenceIndexes(occurrences);
  const historyFrictionByActionId = buildHistoryFrictionByAction({
    sessionHistory,
    occurrenceById: occurrenceIndexes.byId,
    actionsById,
    window,
  });
  const actionResult = buildActionModels({
    processGoals,
    outcomeById,
    occurrencesByGoalId: occurrenceIndexes.byGoalId,
    sessionHistory: asArray(sessionHistory),
    historyFrictionByActionId,
    window,
    categoriesById,
  });
  const objectiveResult = buildObjectiveModels({
    outcomes,
    actionModels: actionResult.actions,
    categoriesById,
  });

  const standaloneActions = actionResult.actions.filter((action) => !action.outcomeId);
  const summary = {
    objectiveCount: objectiveResult.objectives.length,
    actionCount: actionResult.actions.length,
    standaloneActionCount: standaloneActions.length,
    executionObjectiveCount: objectiveResult.objectives.filter((objective) => objective.source === OBJECTIVE_PROGRESS_SOURCE.EXECUTION).length,
    manualObjectiveCount: objectiveResult.objectives.filter((objective) => objective.source === OBJECTIVE_PROGRESS_SOURCE.MANUAL).length,
    frictionObjectiveCount: objectiveResult.objectives.filter((objective) => objective.frictionCount > 0).length,
  };

  return {
    dateKey: window.toKey,
    window,
    objectives: objectiveResult.objectives,
    actions: actionResult.actions,
    standaloneActions,
    byObjectiveId: objectiveResult.byObjectiveId,
    byActionId: actionResult.byActionId,
    summary,
  };
}
