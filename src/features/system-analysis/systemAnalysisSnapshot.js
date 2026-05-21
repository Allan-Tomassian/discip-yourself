import { resolveGoalType } from "../../domain/goalType";
import { normalizeUserAiProfile } from "../../domain/userAiProfile";
import { buildAdjustDiagnostic } from "../adjust/adjustDiagnostic";
import { buildObjectiveProgressModel } from "../objectives/objectiveProgressModel";
import {
  EXECUTION_SURFACE_STATUS,
  deriveExecutionStatusForOccurrence,
} from "../../logic/executionStatus";
import { buildSystemSignals } from "../../logic/systemSignals";
import {
  addDaysLocal,
  appDowFromDate,
  buildDateRangeLocalKeys,
  fromLocalDateKey,
  normalizeLocalDateKey,
  normalizeStartTime,
  parseTimeToMinutes,
  toLocalDateKey,
} from "../../utils/datetime";

export const SYSTEM_ANALYSIS_SNAPSHOT_VERSION = 1;
export const DEFAULT_SYSTEM_ANALYSIS_WINDOW_DAYS = 14;
export const SYSTEM_ANALYSIS_MODE = Object.freeze({
  INITIAL: "initial_analysis",
  HYBRID: "hybrid_analysis",
  BEHAVIORAL: "behavioral_analysis",
});

const MAX_ENTITY_SUMMARIES = 20;
const MAX_SIGNAL_SUMMARIES = 24;
const MAX_PATTERN_SUMMARIES = 8;
const CURRENT_BEHAVIORAL_ANALYSIS_REQUIREMENTS = Object.freeze({
  MIN_PLANNED_BLOCKS: 10,
  MIN_EXECUTION_OUTCOMES: 5,
  MIN_ACTIVE_DAYS: 3,
  MIN_COMPLETION_OR_FRICTION_SIGNALS: 1,
});

const EXECUTION_OUTCOME_STATUSES = new Set([
  EXECUTION_SURFACE_STATUS.DONE,
  EXECUTION_SURFACE_STATUS.MISSED,
  EXECUTION_SURFACE_STATUS.SKIPPED,
  EXECUTION_SURFACE_STATUS.CANCELED,
  EXECUTION_SURFACE_STATUS.POSTPONED,
]);

const EXPECTED_EXECUTION_STATUSES = new Set([
  EXECUTION_SURFACE_STATUS.PLANNED,
  EXECUTION_SURFACE_STATUS.ACTIVE,
  EXECUTION_SURFACE_STATUS.DONE,
  EXECUTION_SURFACE_STATUS.MISSED,
  EXECUTION_SURFACE_STATUS.POSTPONED,
  EXECUTION_SURFACE_STATUS.BLOCKED,
  EXECUTION_SURFACE_STATUS.REPORTED,
]);

const FRICTION_STATUSES = new Set([
  EXECUTION_SURFACE_STATUS.MISSED,
  EXECUTION_SURFACE_STATUS.POSTPONED,
  EXECUTION_SURFACE_STATUS.BLOCKED,
  EXECUTION_SURFACE_STATUS.REPORTED,
]);

const BACKEND_COMPATIBLE_SNAPSHOT_KEYS = Object.freeze([
  "version",
  "period",
  "generatedAt",
  "referenceDateKey",
  "userWhy",
  "firstRunSummary",
  "goalsSummary",
  "actionsSummary",
  "executionStats",
  "sessionStats",
  "timePatterns",
  "frictionPatterns",
  "objectiveSignals",
  "planningLoadSignals",
  "systemSignals",
  "adjustDiagnosticSummary",
  "coachThemes",
  "profilePreferences",
  "dataLimitations",
  "sourceCounts",
  "snapshotHash",
]);

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function safeString(value, maxLength = null) {
  const trimmed = typeof value === "string" ? value.trim() : "";
  if (!Number.isFinite(maxLength)) return trimmed;
  return trimmed.slice(0, Math.max(0, maxLength));
}

function safeNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function clamp01(value) {
  return Math.max(0, Math.min(1, safeNumber(value, 0)));
}

function resolveNow(now) {
  return now instanceof Date && !Number.isNaN(now.getTime()) ? now : new Date();
}

function resolveReferenceDateKey(referenceDateKey, now) {
  return normalizeLocalDateKey(referenceDateKey) || toLocalDateKey(resolveNow(now));
}

function getInclusiveDays(startDateKey, endDateKey) {
  const range = buildDateRangeLocalKeys(startDateKey, endDateKey);
  return range.length || 1;
}

function resolvePeriod(period = {}, referenceDateKey) {
  const source = isPlainObject(period) ? period : {};
  const endDateKey =
    normalizeLocalDateKey(source.endDateKey) ||
    normalizeLocalDateKey(source.toKey) ||
    referenceDateKey;
  const requestedDays = Math.max(1, Math.trunc(safeNumber(source.days, DEFAULT_SYSTEM_ANALYSIS_WINDOW_DAYS)));
  let startDateKey =
    normalizeLocalDateKey(source.startDateKey) ||
    normalizeLocalDateKey(source.fromKey) ||
    addDaysLocal(endDateKey, -(requestedDays - 1));
  if (!startDateKey) startDateKey = endDateKey;
  const normalizedEnd = endDateKey < startDateKey ? startDateKey : endDateKey;
  return {
    startDateKey,
    endDateKey: normalizedEnd,
    days: getInclusiveDays(startDateKey, normalizedEnd),
  };
}

function isWithinPeriod(dateKey, period) {
  const normalized = normalizeLocalDateKey(dateKey);
  return Boolean(normalized && normalized >= period.startDateKey && normalized <= period.endDateKey);
}

function getOccurrenceDateKey(occurrence) {
  return normalizeLocalDateKey(occurrence?.date || occurrence?.dateKey);
}

function getDateDow(dateKey) {
  const normalized = normalizeLocalDateKey(dateKey);
  if (!normalized) return null;
  const date = fromLocalDateKey(normalized);
  const dow = appDowFromDate(date);
  return Number.isInteger(dow) ? dow : null;
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

function getOccurrenceActionId(occurrence) {
  return safeString(occurrence?.goalId || occurrence?.actionId);
}

function getOccurrenceDurationMinutes(occurrence, goalById) {
  const direct = safeNumber(occurrence?.durationMinutes, NaN);
  if (Number.isFinite(direct) && direct > 0) return Math.round(direct);
  const goal = goalById.get(getOccurrenceActionId(occurrence));
  const fromGoal = safeNumber(goal?.sessionMinutes || goal?.durationMinutes, NaN);
  return Number.isFinite(fromGoal) && fromGoal > 0 ? Math.round(fromGoal) : 0;
}

function normalizeFirstRunWindowForSnapshot(windowValue) {
  const source = isPlainObject(windowValue) ? windowValue : {};
  const startTime = normalizeStartTime(source.startTime);
  const endTime = normalizeStartTime(source.endTime);
  return {
    id: safeString(source.id, 120) || null,
    label: safeString(source.label, 80) || null,
    daysOfWeek: safeArray(source.daysOfWeek)
      .map((day) => Number(day))
      .filter((day) => Number.isInteger(day) && day >= 1 && day <= 7)
      .slice(0, 7),
    startTime: startTime || null,
    endTime: endTime || null,
    timeBucket: startTime ? getTimeBucket({ start: startTime }) : "no_time",
  };
}

function normalizeFirstRunWindowsForSnapshot(value) {
  return safeArray(value)
    .map(normalizeFirstRunWindowForSnapshot)
    .filter((windowValue) => windowValue.daysOfWeek.length || windowValue.startTime || windowValue.endTime || windowValue.label)
    .slice(0, MAX_PATTERN_SUMMARIES);
}

function resolveCapacityDailyMinutes(capacity, profilePreferences) {
  const profileMinutes = safeNumber(profilePreferences?.userAiProfile?.timeBudgetDailyMin, NaN);
  if (Number.isFinite(profileMinutes) && profileMinutes > 0) return Math.round(profileMinutes);
  const normalized = safeString(capacity).toLowerCase();
  if (normalized === "reprise") return 30;
  if (normalized === "forte") return 90;
  if (normalized === "stable") return 60;
  return null;
}

function normalizeLifecycleStatus(goal) {
  const status = safeString(goal?.status || goal?.state || goal?.lifecycleStatus).toLowerCase();
  if (["archived", "archive", "invalid", "deleted"].includes(status)) return "archived";
  if (["completed", "complete", "done", "finished"].includes(status)) return "completed";
  if (["failed", "failure", "abandoned"].includes(status)) return "failed";
  if (["paused", "pause", "suspended", "on_hold"].includes(status)) return "paused";
  return status || "active";
}

function buildFirstRunSummary(firstRun) {
  const source = isPlainObject(firstRun) ? firstRun : {};
  const draftAnswers = isPlainObject(source.draftAnswers) ? source.draftAnswers : {};
  const commitV1 = isPlainObject(source.commitV1) ? source.commitV1 : {};
  const generatedPlans = safeArray(source.generatedPlans);
  return {
    status: safeString(source.status) || null,
    commitStatus: safeString(commitV1.status) || null,
    appliedAt: normalizeLocalDateKey(commitV1.appliedAt) || safeString(commitV1.appliedAt) || null,
    whyLength: safeString(draftAnswers.whyText).length,
    primaryGoal: safeString(draftAnswers.primaryGoal, 160) || null,
    capacity: safeString(draftAnswers.capacity || draftAnswers.currentCapacity, 80) || null,
    priorityCategoryIds: safeArray(draftAnswers.priorityCategoryIds).map((id) => safeString(id)).filter(Boolean),
    generatedPlanCount: generatedPlans.length,
    hasCommitDraft: generatedPlans.some((plan) => isPlainObject(plan?.commitDraft)),
  };
}

function getUserWhy(state, firstRun) {
  const firstRunWhy = safeString(firstRun?.draftAnswers?.whyText, 1200);
  const profileWhy = safeString(state?.profile?.whyText, 1200);
  return firstRunWhy || profileWhy || "";
}

function buildGoalSummaries({ goals, categories, objectiveModel }) {
  const categoryIds = new Set(categories.map((category) => safeString(category?.id)).filter(Boolean));
  const outcomes = [];
  const actions = [];
  for (const goal of goals) {
    if (!safeString(goal?.id)) continue;
    if (resolveGoalType(goal) === "OUTCOME") outcomes.push(goal);
    else actions.push(goal);
  }

  const lifecycleCounts = goals.reduce((acc, goal) => {
    const status = normalizeLifecycleStatus(goal);
    acc[status] = (acc[status] || 0) + 1;
    return acc;
  }, {});

  const objectiveSummaries = safeArray(objectiveModel.objectives)
    .map((objective) => ({
      id: objective.id,
      title: safeString(objective.goal?.title || objective.objective?.title, 120),
      categoryId: safeString(objective.goal?.categoryId || objective.objective?.categoryId) || null,
      linkedActionIds: safeArray(objective.linkedActions).map((action) => action.id).filter(Boolean).slice(0, 12),
      status: objective.status?.key || "active",
      source: objective.source,
      displayProgress: clamp01(objective.displayProgress),
      completedCount: objective.completedCount,
      expectedCount: objective.expectedCount,
      frictionCount: objective.frictionCount,
    }))
    .slice(0, MAX_ENTITY_SUMMARIES);

  return {
    totalCount: goals.length,
    outcomeCount: outcomes.length,
    processActionCount: actions.length,
    visibleCategoryCount: categoryIds.size,
    lifecycleCounts,
    outcomeIds: outcomes.map((goal) => goal.id).filter(Boolean).slice(0, MAX_ENTITY_SUMMARIES),
    processActionIds: actions.map((goal) => goal.id).filter(Boolean).slice(0, MAX_ENTITY_SUMMARIES),
    objectives: objectiveSummaries,
    standaloneActionIds: safeArray(objectiveModel.standaloneActions).map((action) => action.id).filter(Boolean).slice(0, MAX_ENTITY_SUMMARIES),
  };
}

function isRecurringAction(action) {
  const planType = safeString(action?.planType || action?.type).toUpperCase();
  const repeat = safeString(action?.repeat).toLowerCase();
  const cadence = safeString(action?.cadence).toUpperCase();
  return Boolean(
    planType === "ACTION" ||
      repeat === "daily" ||
      repeat === "weekly" ||
      cadence === "DAILY" ||
      cadence === "WEEKLY" ||
      safeArray(action?.daysOfWeek).length ||
      safeArray(action?.timeSlots).length ||
      isPlainObject(action?.weeklySlotsByDay)
  );
}

function buildActionsSummary({ actions, objectiveModel }) {
  const recurringActionIds = actions.filter(isRecurringAction).map((action) => action.id).filter(Boolean);
  const oneOffActionIds = actions
    .filter((action) => safeString(action?.planType || action?.type).toUpperCase() === "ONE_OFF" || action?.oneOffDate)
    .map((action) => action.id)
    .filter(Boolean);
  const frictionActionIds = safeArray(objectiveModel.actions)
    .filter((action) => action.frictionCount > 0)
    .map((action) => action.id)
    .filter(Boolean);
  return {
    totalCount: actions.length,
    recurringCount: recurringActionIds.length,
    oneOffCount: oneOffActionIds.length,
    standaloneCount: safeArray(objectiveModel.standaloneActions).length,
    frictionActionCount: frictionActionIds.length,
    tooManyActions: actions.length >= 12,
    riskFlags: actions.length >= 12 ? ["too_many_actions"] : [],
    recurringActionIds: recurringActionIds.slice(0, MAX_ENTITY_SUMMARIES),
    oneOffActionIds: oneOffActionIds.slice(0, MAX_ENTITY_SUMMARIES),
    frictionActionIds: frictionActionIds.slice(0, MAX_ENTITY_SUMMARIES),
  };
}

function buildExecutionSummaries({ occurrences, sessionHistory, activeSession, period, goalById }) {
  const counts = Object.fromEntries(Object.values(EXECUTION_SURFACE_STATUS).map((status) => [status, 0]));
  const occurrenceIdsByStatus = Object.fromEntries(Object.values(EXECUTION_SURFACE_STATUS).map((status) => [status, []]));
  const activeDays = new Set();
  let expectedCount = 0;
  let outcomeCount = 0;
  let completedCount = 0;
  let frictionCount = 0;
  let expectedMinutes = 0;
  let completedMinutes = 0;

  const occurrenceById = new Map();
  for (const occurrence of occurrences) {
    const occurrenceId = safeString(occurrence?.id);
    if (occurrenceId) occurrenceById.set(occurrenceId, occurrence);
    const dateKey = getOccurrenceDateKey(occurrence);
    if (!isWithinPeriod(dateKey, period)) continue;
    const derived = deriveExecutionStatusForOccurrence(occurrence, {
      activeSession,
      sessionHistory,
      dateKey,
    });
    const status = derived.status;
    counts[status] = (counts[status] || 0) + 1;
    if (occurrenceId && occurrenceIdsByStatus[status].length < MAX_ENTITY_SUMMARIES) {
      occurrenceIdsByStatus[status].push(occurrenceId);
    }
    if (EXPECTED_EXECUTION_STATUSES.has(status)) {
      expectedCount += 1;
      activeDays.add(dateKey);
      expectedMinutes += getOccurrenceDurationMinutes(occurrence, goalById);
    }
    if (EXECUTION_OUTCOME_STATUSES.has(status)) {
      outcomeCount += 1;
      activeDays.add(dateKey);
    }
    if (status === EXECUTION_SURFACE_STATUS.DONE) {
      completedCount += 1;
      completedMinutes += getOccurrenceDurationMinutes(occurrence, goalById);
    }
    if (FRICTION_STATUSES.has(status)) frictionCount += 1;
  }

  for (const history of sessionHistory) {
    const dateKey = getHistoryDateKey(history);
    if (!isWithinPeriod(dateKey, period)) continue;
    if (["done", "blocked", "reported", "canceled"].includes(safeString(history?.endedReason).toLowerCase())) {
      activeDays.add(dateKey);
      if (!occurrenceById.has(safeString(history?.occurrenceId))) {
        outcomeCount += 1;
        if (["blocked", "reported"].includes(safeString(history?.endedReason).toLowerCase())) frictionCount += 1;
      }
    }
  }

  return {
    expectedCount,
    outcomeCount,
    completedCount,
    frictionCount,
    activeDayCount: activeDays.size,
    activeDateKeys: Array.from(activeDays).sort(),
    completionRate: expectedCount > 0 ? clamp01(completedCount / expectedCount) : null,
    expectedMinutes,
    completedMinutes,
    counts,
    occurrenceIdsByStatus,
  };
}

function buildSessionStats({ sessionHistory, period }) {
  const countsByReason = { done: 0, blocked: 0, reported: 0, canceled: 0 };
  const blockedHistoryIds = [];
  const reportedHistoryIds = [];
  let endedCount = 0;

  for (const history of sessionHistory) {
    if (!isWithinPeriod(getHistoryDateKey(history), period)) continue;
    const reason = safeString(history?.endedReason).toLowerCase();
    if (!Object.prototype.hasOwnProperty.call(countsByReason, reason)) continue;
    countsByReason[reason] += 1;
    endedCount += 1;
    if (reason === "blocked" && blockedHistoryIds.length < MAX_ENTITY_SUMMARIES) blockedHistoryIds.push(safeString(history?.id));
    if (reason === "reported" && reportedHistoryIds.length < MAX_ENTITY_SUMMARIES) reportedHistoryIds.push(safeString(history?.id));
  }

  return {
    endedCount,
    countsByReason,
    blockedHistoryIds: blockedHistoryIds.filter(Boolean),
    reportedHistoryIds: reportedHistoryIds.filter(Boolean),
    frictionCount: countsByReason.blocked + countsByReason.reported,
  };
}

function getTimeBucket(occurrence) {
  const minutes = parseTimeToMinutes(occurrence?.start || occurrence?.slotKey);
  if (!Number.isFinite(minutes)) return "no_time";
  if (minutes < 12 * 60) return "morning";
  if (minutes < 18 * 60) return "afternoon";
  return "evening";
}

function buildTimePatterns({ occurrences, sessionHistory, activeSession, period }) {
  const buckets = {
    morning: { expectedCount: 0, completedCount: 0, frictionCount: 0 },
    afternoon: { expectedCount: 0, completedCount: 0, frictionCount: 0 },
    evening: { expectedCount: 0, completedCount: 0, frictionCount: 0 },
    no_time: { expectedCount: 0, completedCount: 0, frictionCount: 0 },
  };

  for (const occurrence of occurrences) {
    const dateKey = getOccurrenceDateKey(occurrence);
    if (!isWithinPeriod(dateKey, period)) continue;
    const status = deriveExecutionStatusForOccurrence(occurrence, { activeSession, sessionHistory, dateKey }).status;
    if (!EXPECTED_EXECUTION_STATUSES.has(status)) continue;
    const bucket = getTimeBucket(occurrence);
    buckets[bucket].expectedCount += 1;
    if (status === EXECUTION_SURFACE_STATUS.DONE) buckets[bucket].completedCount += 1;
    if (FRICTION_STATUSES.has(status)) buckets[bucket].frictionCount += 1;
  }

  const bucketSummaries = Object.entries(buckets).map(([id, bucket]) => ({
    id,
    ...bucket,
    completionRate: bucket.expectedCount > 0 ? clamp01(bucket.completedCount / bucket.expectedCount) : null,
  }));
  return {
    buckets: bucketSummaries,
    weakWindows: bucketSummaries
      .filter((bucket) => bucket.expectedCount >= 2 && (bucket.completedCount === 0 || bucket.frictionCount >= bucket.completedCount))
      .slice(0, MAX_PATTERN_SUMMARIES),
  };
}

function buildFrictionPatterns({ occurrences, sessionHistory, activeSession, period, goalById }) {
  const byAction = new Map();
  const repeatedBlocked = [];
  const repeatedReported = [];
  const repeatedPostpone = [];
  let missedCount = 0;
  let blockedCount = 0;
  let reportedCount = 0;
  let postponedCount = 0;

  function addActionSignal(actionId, patch) {
    if (!actionId) return;
    const previous = byAction.get(actionId) || {
      actionId,
      title: safeString(goalById.get(actionId)?.title, 120) || null,
      missedCount: 0,
      blockedCount: 0,
      reportedCount: 0,
      postponedCount: 0,
      occurrenceIds: [],
      historyIds: [],
    };
    const next = { ...previous };
    for (const key of ["missedCount", "blockedCount", "reportedCount", "postponedCount"]) {
      next[key] += patch[key] || 0;
    }
    if (patch.occurrenceId && next.occurrenceIds.length < 8) next.occurrenceIds.push(patch.occurrenceId);
    if (patch.historyId && next.historyIds.length < 8) next.historyIds.push(patch.historyId);
    byAction.set(actionId, next);
  }

  const occurrenceById = new Map();
  for (const occurrence of occurrences) {
    const occurrenceId = safeString(occurrence?.id);
    if (occurrenceId) occurrenceById.set(occurrenceId, occurrence);
    const dateKey = getOccurrenceDateKey(occurrence);
    if (!isWithinPeriod(dateKey, period)) continue;
    const status = deriveExecutionStatusForOccurrence(occurrence, { activeSession, sessionHistory, dateKey }).status;
    const actionId = getOccurrenceActionId(occurrence);
    if (status === EXECUTION_SURFACE_STATUS.MISSED) {
      missedCount += 1;
      addActionSignal(actionId, { missedCount: 1, occurrenceId });
    }
    if (status === EXECUTION_SURFACE_STATUS.POSTPONED) {
      postponedCount += 1;
      addActionSignal(actionId, { postponedCount: 1, occurrenceId });
    }
    if (status === EXECUTION_SURFACE_STATUS.BLOCKED) {
      blockedCount += 1;
      addActionSignal(actionId, { blockedCount: 1, occurrenceId });
    }
    if (status === EXECUTION_SURFACE_STATUS.REPORTED) {
      reportedCount += 1;
      addActionSignal(actionId, { reportedCount: 1, occurrenceId });
    }
  }

  for (const history of sessionHistory) {
    const dateKey = getHistoryDateKey(history);
    if (!isWithinPeriod(dateKey, period)) continue;
    const reason = safeString(history?.endedReason).toLowerCase();
    if (reason !== "blocked" && reason !== "reported") continue;
    const occurrence = occurrenceById.get(safeString(history?.occurrenceId));
    const actionId = getOccurrenceActionId(occurrence) || safeString(history?.actionId || history?.goalId);
    addActionSignal(actionId, {
      blockedCount: reason === "blocked" ? 1 : 0,
      reportedCount: reason === "reported" ? 1 : 0,
      occurrenceId: safeString(history?.occurrenceId),
      historyId: safeString(history?.id),
    });
  }

  const byActionList = Array.from(byAction.values()).sort((left, right) => {
    const leftTotal = left.missedCount + left.blockedCount + left.reportedCount + left.postponedCount;
    const rightTotal = right.missedCount + right.blockedCount + right.reportedCount + right.postponedCount;
    return rightTotal - leftTotal || safeString(left.actionId).localeCompare(safeString(right.actionId));
  });
  for (const signal of byActionList) {
    if (signal.blockedCount >= 2) repeatedBlocked.push(signal);
    if (signal.reportedCount >= 2) repeatedReported.push(signal);
    if (signal.postponedCount >= 2) repeatedPostpone.push(signal);
  }

  return {
    missedCount,
    blockedCount,
    reportedCount,
    postponedCount,
    totalFrictionCount: missedCount + blockedCount + reportedCount + postponedCount,
    repeatedBlocked: repeatedBlocked.slice(0, MAX_PATTERN_SUMMARIES),
    repeatedReported: repeatedReported.slice(0, MAX_PATTERN_SUMMARIES),
    repeatedPostpone: repeatedPostpone.slice(0, MAX_PATTERN_SUMMARIES),
    byAction: byActionList.slice(0, MAX_PATTERN_SUMMARIES),
    whyExecutionMismatch: null,
  };
}

function buildObjectiveSignals(objectiveModel, userWhy) {
  const objectives = safeArray(objectiveModel.objectives);
  const neglectedObjectives = objectives
    .filter((objective) => objective.expectedCount >= 2 && objective.completedCount === 0)
    .map((objective) => ({
      objectiveId: objective.id,
      title: safeString(objective.goal?.title || objective.objective?.title, 120),
      expectedCount: objective.expectedCount,
      frictionCount: objective.frictionCount,
      linkedActionIds: safeArray(objective.linkedActions).map((action) => action.id).filter(Boolean).slice(0, 8),
    }))
    .slice(0, MAX_PATTERN_SUMMARIES);
  const frictionObjectives = objectives
    .filter((objective) => objective.frictionCount > 0)
    .map((objective) => ({
      objectiveId: objective.id,
      frictionCount: objective.frictionCount,
      missedCount: objective.missedCount,
      blockedCount: objective.blockedCount,
      reportedCount: objective.reportedCount,
    }))
    .slice(0, MAX_PATTERN_SUMMARIES);

  return {
    summary: objectiveModel.summary,
    neglectedObjectives,
    frictionObjectives,
    needsStructureObjectiveIds: objectives
      .filter((objective) => objective.status?.key === "needs_structure")
      .map((objective) => objective.id)
      .slice(0, MAX_PATTERN_SUMMARIES),
    standaloneActionIds: safeArray(objectiveModel.standaloneActions).map((action) => action.id).filter(Boolean).slice(0, MAX_PATTERN_SUMMARIES),
    whyExecutionMismatch:
      safeString(userWhy) && neglectedObjectives.length
        ? {
            detected: true,
            reason: "structured_objective_without_execution",
            objectiveIds: neglectedObjectives.map((objective) => objective.objectiveId),
          }
        : { detected: false },
  };
}

function buildPlanningLoadSignals({ occurrences, period, goalById }) {
  const days = buildDateRangeLocalKeys(period.startDateKey, period.endDateKey);
  const byDate = days.map((dateKey) => {
    const items = occurrences.filter((occurrence) => getOccurrenceDateKey(occurrence) === dateKey);
    const expected = items.filter((occurrence) => {
      const status = deriveExecutionStatusForOccurrence(occurrence, { dateKey }).status;
      return EXPECTED_EXECUTION_STATUSES.has(status);
    });
    const totalMinutes = expected.reduce((sum, occurrence) => sum + getOccurrenceDurationMinutes(occurrence, goalById), 0);
    return {
      dateKey,
      plannedCount: expected.length,
      totalMinutes,
      overload: expected.length >= 4 || totalMinutes >= 120,
      occurrenceIds: expected.map((occurrence) => safeString(occurrence?.id)).filter(Boolean).slice(0, 12),
    };
  });
  return {
    overloadedDays: byDate.filter((day) => day.overload),
    maxDailyMinutes: byDate.reduce((max, day) => Math.max(max, day.totalMinutes), 0),
    maxDailyBlocks: byDate.reduce((max, day) => Math.max(max, day.plannedCount), 0),
    averageDailyMinutes: byDate.length
      ? Math.round(byDate.reduce((sum, day) => sum + day.totalMinutes, 0) / byDate.length)
      : 0,
    byDate,
  };
}

function summarizeSystemSignal(signal) {
  return {
    id: safeString(signal?.id),
    type: safeString(signal?.type),
    severity: safeString(signal?.severity),
    title: safeString(signal?.title, 120),
    evidence: isPlainObject(signal?.evidence)
      ? {
          source: safeString(signal.evidence.source) || null,
          dateKey: normalizeLocalDateKey(signal.evidence.dateKey) || null,
          occurrenceId: safeString(signal.evidence.occurrenceId) || null,
          historyId: safeString(signal.evidence.historyId) || null,
          categoryId: safeString(signal.evidence.categoryId) || null,
          count: Number.isFinite(Number(signal.evidence.count)) ? Number(signal.evidence.count) : null,
        }
      : {},
  };
}

function buildPeriodSystemSignals({ state, period }) {
  const signals = [];
  for (const dateKey of buildDateRangeLocalKeys(period.startDateKey, period.endDateKey)) {
    const diagnostic = buildAdjustDiagnostic(state, dateKey);
    signals.push(
      ...buildSystemSignals({
        occurrences: state.occurrences,
        sessionHistory: state.sessionHistory,
        activeSession: state.ui?.activeSession || null,
        adjustDiagnostic: diagnostic,
        dateKey,
      })
    );
  }
  const seen = new Set();
  return signals
    .map(summarizeSystemSignal)
    .filter((signal) => {
      const key = signal.id || `${signal.type}:${signal.evidence?.occurrenceId}:${signal.evidence?.historyId}:${signal.evidence?.dateKey}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, MAX_SIGNAL_SUMMARIES);
}

function buildAdjustDiagnosticSummary(state, referenceDateKey) {
  const diagnostic = buildAdjustDiagnostic(state, referenceDateKey);
  return {
    activeDateKey: diagnostic.summary?.activeDateKey || referenceDateKey,
    state: diagnostic.summary?.state || "low_information",
    completionScore: diagnostic.summary?.completionScore ?? null,
    plannedCount: diagnostic.summary?.plannedCount || 0,
    doneCount: diagnostic.summary?.doneCount || 0,
    missedCount: diagnostic.summary?.missedCount || 0,
    blockedCount: diagnostic.summary?.blockedCount || 0,
    reportedCount: diagnostic.summary?.reportedCount || 0,
    remainingCount: diagnostic.summary?.remainingCount || 0,
    remainingMinutes: diagnostic.summary?.remainingMinutes || 0,
    recommendationId: diagnostic.recommendation?.id || null,
    recommendationActionId: diagnostic.recommendation?.actionId || null,
    frictionSignalIds: safeArray(diagnostic.frictionSignals).map((signal) => signal.id).filter(Boolean),
    categorySignals: safeArray(diagnostic.categorySignals).slice(0, 5),
  };
}

function collectCoachConversations(state, coachConversations) {
  if (Array.isArray(coachConversations)) return coachConversations;
  if (Array.isArray(state?.coach_conversations_v1?.conversations)) return state.coach_conversations_v1.conversations;
  if (Array.isArray(state?.ui?.coach_conversations_v1?.conversations)) return state.ui.coach_conversations_v1.conversations;
  return [];
}

function buildCoachThemes(conversations) {
  const safeConversations = safeArray(conversations);
  const modeCounts = {};
  const useCaseCounts = {};
  const themes = new Map();
  let messageCount = 0;
  let proposalCount = 0;

  const themeMatchers = [
    ["overload", /\b(charge|surcharge|trop|overload|allege|all[eè]ge)\b/i],
    ["planning", /\b(planning|horaire|cr[eé]neau|planifie|schedule)\b/i],
    ["blocked", /\b(bloqu|block|friction|impossible)\b/i],
    ["why", /\b(pourquoi|why|sens|raison)\b/i],
    ["objective", /\b(objectif|cap|goal|direction)\b/i],
  ];

  for (const conversation of safeConversations) {
    const mode = safeString(conversation?.mode) || "unknown";
    const useCase = safeString(conversation?.useCase) || "unknown";
    modeCounts[mode] = (modeCounts[mode] || 0) + 1;
    useCaseCounts[useCase] = (useCaseCounts[useCase] || 0) + 1;
    for (const message of safeArray(conversation?.messages)) {
      messageCount += 1;
      if (message?.coachReply?.proposal) proposalCount += 1;
      const text = safeString(message?.text, 800);
      for (const [theme, matcher] of themeMatchers) {
        if (matcher.test(text)) themes.set(theme, (themes.get(theme) || 0) + 1);
      }
    }
  }

  return {
    conversationCount: safeConversations.length,
    messageCount,
    planConversationCount: modeCounts.plan || 0,
    proposalCount,
    modeCounts,
    useCaseCounts,
    themes: Array.from(themes.entries())
      .map(([id, count]) => ({ id, count }))
      .sort((left, right) => right.count - left.count || left.id.localeCompare(right.id))
      .slice(0, MAX_PATTERN_SUMMARIES),
    rawTranscriptIncluded: false,
  };
}

function buildProfilePreferences(state) {
  const userAiProfile = normalizeUserAiProfile(state?.user_ai_profile);
  const categoryProfiles = isPlainObject(state?.category_profiles_v1?.byCategoryId)
    ? state.category_profiles_v1.byCategoryId
    : {};
  return {
    hasProfile: isPlainObject(state?.profile) && Object.keys(state.profile).length > 0,
    userAiProfile: {
      goals: userAiProfile.goals,
      timeBudgetDailyMin: userAiProfile.time_budget_daily_min,
      intensityPreference: userAiProfile.intensity_preference,
      preferredTimeBlocks: userAiProfile.preferred_time_blocks,
      structurePreference: userAiProfile.structure_preference,
      adaptation: userAiProfile.adaptation,
    },
    categoryProfileCount: Object.keys(categoryProfiles).length,
  };
}

function findSelectedFirstRunPlan(firstRun) {
  const generatedPlans = firstRun?.generatedPlans;
  const plans = safeArray(generatedPlans?.plans);
  const selectedPlanId = safeString(firstRun?.selectedPlanId) || safeString(firstRun?.commitV1?.selectedPlanId);
  return plans.find((plan) => safeString(plan?.id) === selectedPlanId) || plans[0] || null;
}

function buildScheduleRuleSummary(state, actions) {
  const rules = safeArray(state?.scheduleRules);
  const activeRules = rules.filter((rule) => rule?.isActive !== false);
  const ruleActionIds = new Set(activeRules.map((rule) => safeString(rule?.actionId || rule?.goalId)).filter(Boolean));
  return {
    totalCount: rules.length,
    activeCount: activeRules.length,
    recurringCount: activeRules.filter((rule) => safeString(rule?.kind || rule?.type).toLowerCase() === "recurring").length,
    actionIdsWithRules: Array.from(ruleActionIds).slice(0, MAX_ENTITY_SUMMARIES),
    actionsWithScheduleFields: actions
      .filter((action) => isRecurringAction(action))
      .map((action) => action.id)
      .filter(Boolean)
      .slice(0, MAX_ENTITY_SUMMARIES),
  };
}

function buildWeeklyPlannedLoad(planningLoadSignals, period) {
  const periodMinutes = safeArray(planningLoadSignals?.byDate).reduce((sum, day) => sum + Math.max(0, Number(day?.totalMinutes) || 0), 0);
  const periodBlocks = safeArray(planningLoadSignals?.byDate).reduce((sum, day) => sum + Math.max(0, Number(day?.plannedCount) || 0), 0);
  const days = Math.max(1, Number(period?.days) || safeArray(planningLoadSignals?.byDate).length || 1);
  const averageDailyMinutes = Math.round(periodMinutes / days);
  return {
    periodDays: days,
    periodBlocks,
    periodMinutes,
    averageDailyMinutes,
    estimatedWeeklyMinutes: Math.round(averageDailyMinutes * 7),
    maxDailyMinutes: planningLoadSignals?.maxDailyMinutes || 0,
    maxDailyBlocks: planningLoadSignals?.maxDailyBlocks || 0,
    overloadedDayCount: safeArray(planningLoadSignals?.overloadedDays).length,
  };
}

function buildNextBlockCoverage({ occurrences, activeSession, sessionHistory, period, referenceDateKey }) {
  const candidates = safeArray(occurrences)
    .map((occurrence) => {
      const dateKey = getOccurrenceDateKey(occurrence);
      const status = deriveExecutionStatusForOccurrence(occurrence, { activeSession, sessionHistory, dateKey }).status;
      return {
        occurrence,
        occurrenceId: safeString(occurrence?.id),
        actionId: getOccurrenceActionId(occurrence),
        dateKey,
        start: normalizeStartTime(occurrence?.start || occurrence?.slotKey) || null,
        status,
      };
    })
    .filter((entry) => (
      entry.occurrenceId &&
      entry.dateKey &&
      entry.dateKey >= referenceDateKey &&
      isWithinPeriod(entry.dateKey, period) &&
      [EXECUTION_SURFACE_STATUS.PLANNED, EXECUTION_SURFACE_STATUS.ACTIVE].includes(entry.status)
    ))
    .sort((left, right) => {
      if (left.dateKey !== right.dateKey) return left.dateKey.localeCompare(right.dateKey);
      return safeString(left.start).localeCompare(safeString(right.start)) || left.occurrenceId.localeCompare(right.occurrenceId);
    });
  const next = candidates[0] || null;
  return {
    hasUpcomingBlock: Boolean(next),
    nextOccurrenceId: next?.occurrenceId || null,
    nextActionId: next?.actionId || null,
    nextDateKey: next?.dateKey || null,
    nextStart: next?.start || null,
    upcomingPlannedCount: candidates.length,
    missingNextBlock: !next,
  };
}

function buildActionObjectiveStructure({ objectiveModel, goalsSummary, actionsSummary }) {
  return {
    objectiveCount: goalsSummary.outcomeCount,
    actionCount: goalsSummary.processActionCount,
    linkedObjectiveCount: safeArray(objectiveModel.objectives).filter((objective) => safeArray(objective.linkedActions).length > 0).length,
    objectiveIdsWithoutActions: safeArray(objectiveModel.objectives)
      .filter((objective) => safeArray(objective.linkedActions).length === 0)
      .map((objective) => objective.id)
      .filter(Boolean)
      .slice(0, MAX_PATTERN_SUMMARIES),
    standaloneActionIds: safeArray(objectiveModel.standaloneActions).map((action) => action.id).filter(Boolean).slice(0, MAX_PATTERN_SUMMARIES),
    tooManyActions: actionsSummary.tooManyActions,
  };
}

function buildFirstRunPlanSummary(firstRun) {
  const selectedPlan = findSelectedFirstRunPlan(firstRun);
  const metrics = selectedPlan?.comparisonMetrics || {};
  const rationale = selectedPlan?.rationale || {};
  return {
    selectedPlanId: safeString(firstRun?.selectedPlanId || firstRun?.commitV1?.selectedPlanId) || safeString(selectedPlan?.id) || null,
    selectedPlanSource: safeString(firstRun?.generatedPlans?.source || firstRun?.commitV1?.selectedPlanSource) || null,
    generatedPlanCount: safeArray(firstRun?.generatedPlans?.plans).length,
    weeklyMinutes: Number.isFinite(Number(metrics.weeklyMinutes)) ? Number(metrics.weeklyMinutes) : null,
    totalBlocks: Number.isFinite(Number(metrics.totalBlocks)) ? Number(metrics.totalBlocks) : null,
    activeDays: Number.isFinite(Number(metrics.activeDays)) ? Number(metrics.activeDays) : null,
    engagementLevel: safeString(metrics.engagementLevel) || null,
    rationale: {
      whyFit: safeString(rationale.whyFit, 240) || null,
      capacityFit: safeString(rationale.capacityFit, 240) || null,
      constraintFit: safeString(rationale.constraintFit, 240) || null,
    },
  };
}

function buildPlannedSystemSummary({
  state,
  firstRun,
  userWhy,
  objectiveModel,
  goalsSummary,
  actionsSummary,
  planningLoadSignals,
  profilePreferences,
  occurrences,
  sessionHistory,
  period,
  referenceDateKey,
}) {
  const draftAnswers = isPlainObject(firstRun?.draftAnswers) ? firstRun.draftAnswers : {};
  const capacity = safeString(draftAnswers.currentCapacity || draftAnswers.capacity) || null;
  const preferredWindows = normalizeFirstRunWindowsForSnapshot(draftAnswers.preferredWindows);
  const unavailableWindows = normalizeFirstRunWindowsForSnapshot(draftAnswers.unavailableWindows);
  const primaryObjective =
    safeString(draftAnswers.primaryGoal, 240) ||
    safeString(objectiveModel.objectives?.[0]?.goal?.title || objectiveModel.objectives?.[0]?.objective?.title, 240) ||
    null;
  return {
    whyText: safeString(userWhy, 1200),
    primaryObjective,
    capacity: {
      value: capacity,
      dailyMinutes: resolveCapacityDailyMinutes(capacity, profilePreferences),
    },
    preferredWindows,
    unavailableWindows,
    priorityCategoryIds: safeArray(draftAnswers.priorityCategoryIds).map((id) => safeString(id)).filter(Boolean).slice(0, 6),
    weeklyPlannedLoad: buildWeeklyPlannedLoad(planningLoadSignals, period),
    actionObjectiveStructure: buildActionObjectiveStructure({ objectiveModel, goalsSummary, actionsSummary }),
    nextBlockCoverage: buildNextBlockCoverage({
      occurrences,
      activeSession: state?.ui?.activeSession || null,
      sessionHistory,
      period,
      referenceDateKey,
    }),
    scheduleRuleSummary: buildScheduleRuleSummary(state, safeArray(objectiveModel.actions).map((actionModel) => actionModel.action || actionModel.goal).filter(Boolean)),
    firstRunPlanSummary: buildFirstRunPlanSummary(firstRun),
  };
}

function buildRepairHistorySummary({ occurrences, period }) {
  const byType = {};
  const byAction = new Map();
  const repairedOccurrenceIds = [];
  for (const occurrence of safeArray(occurrences)) {
    const dateKey = getOccurrenceDateKey(occurrence);
    if (!isWithinPeriod(dateKey, period) || !isPlainObject(occurrence?.repairV1)) continue;
    const type = safeString(occurrence.repairV1.type) || "unknown";
    const actionId = getOccurrenceActionId(occurrence);
    byType[type] = (byType[type] || 0) + 1;
    if (repairedOccurrenceIds.length < MAX_ENTITY_SUMMARIES && safeString(occurrence.id)) repairedOccurrenceIds.push(safeString(occurrence.id));
    if (actionId) byAction.set(actionId, (byAction.get(actionId) || 0) + 1);
  }
  return {
    repairedCount: repairedOccurrenceIds.length,
    repairedOccurrenceIds,
    byType,
    repeatedActionRepairs: Array.from(byAction.entries())
      .filter(([, count]) => count >= 2)
      .map(([actionId, count]) => ({ actionId, count }))
      .sort((left, right) => right.count - left.count || left.actionId.localeCompare(right.actionId))
      .slice(0, MAX_PATTERN_SUMMARIES),
  };
}

function buildAnalysisHistorySummary(state) {
  const analyses = safeArray(state?.system_analysis_v1?.analyses);
  const latest = analyses[0] || null;
  const appliedRecords = analyses.filter((record) => safeString(record?.status) === "applied" || safeString(record?.status) === "partially_applied");
  return {
    recordCount: analyses.length,
    latestAnalysisId: safeString(state?.system_analysis_v1?.latestAnalysisId || latest?.id) || null,
    latestStatus: safeString(latest?.status) || null,
    latestSnapshotHash: safeString(latest?.snapshotHash, 160) || null,
    appliedRecordCount: appliedRecords.length,
    appliedCorrectionCount: analyses.reduce((sum, record) => sum + safeArray(record?.appliedCorrectionIds).length, 0),
    changedOccurrenceCount: analyses.reduce((sum, record) => sum + safeArray(record?.changedOccurrenceIds).length, 0),
  };
}

function summarizeObjectiveExecution(objectiveModel) {
  return safeArray(objectiveModel.objectives)
    .map((objective) => ({
      objectiveId: objective.id,
      completedCount: objective.completedCount,
      expectedCount: objective.expectedCount,
      missedCount: objective.missedCount,
      blockedCount: objective.blockedCount,
      reportedCount: objective.reportedCount,
      frictionCount: objective.frictionCount,
      status: objective.status?.key || "active",
    }))
    .slice(0, MAX_ENTITY_SUMMARIES);
}

function summarizeActionExecution(objectiveModel) {
  return safeArray(objectiveModel.actions)
    .map((action) => ({
      actionId: action.id,
      objectiveId: action.outcomeId || null,
      completedCount: action.completedCount,
      expectedCount: action.expectedCount,
      missedCount: action.missedCount,
      blockedCount: action.blockedCount,
      reportedCount: action.reportedCount,
      frictionCount: action.frictionCount,
      status: action.status?.key || "active",
    }))
    .slice(0, MAX_ENTITY_SUMMARIES);
}

function buildBehaviorSystemSummary({
  executionStats,
  sessionStats,
  timePatterns,
  objectiveModel,
  frictionPatterns,
  repairHistorySummary,
  analysisHistorySummary,
}) {
  return {
    completedCount: executionStats.completedCount,
    missedCount: executionStats.counts?.[EXECUTION_SURFACE_STATUS.MISSED] || 0,
    reportedCount: executionStats.counts?.[EXECUTION_SURFACE_STATUS.REPORTED] || 0,
    blockedCount: executionStats.counts?.[EXECUTION_SURFACE_STATUS.BLOCKED] || 0,
    skippedCanceledCount:
      (executionStats.counts?.[EXECUTION_SURFACE_STATUS.SKIPPED] || 0) +
      (executionStats.counts?.[EXECUTION_SURFACE_STATUS.CANCELED] || 0) +
      (sessionStats.countsByReason?.canceled || 0),
    sessionStarts: sessionStats.endedCount,
    activeDays: executionStats.activeDayCount,
    plannedVsCompletedMinutes: {
      plannedMinutes: executionStats.expectedMinutes,
      completedMinutes: executionStats.completedMinutes,
      deltaMinutes: executionStats.expectedMinutes - executionStats.completedMinutes,
      completionRate: executionStats.completionRate,
    },
    completionByTimeWindow: safeArray(timePatterns.buckets).slice(0, 4),
    objectiveExecutionSummary: summarizeObjectiveExecution(objectiveModel),
    actionExecutionSummary: summarizeActionExecution(objectiveModel),
    repeatedFrictionPatterns: {
      repeatedBlocked: safeArray(frictionPatterns.repeatedBlocked),
      repeatedReported: safeArray(frictionPatterns.repeatedReported),
      repeatedPostpone: safeArray(frictionPatterns.repeatedPostpone),
      byAction: safeArray(frictionPatterns.byAction),
    },
    repairHistorySummary,
    analysisHistorySummary,
  };
}

function windowMatchesOccurrence(windowValue, occurrence) {
  const dateKey = getOccurrenceDateKey(occurrence);
  const dow = getDateDow(dateKey);
  if (!dow || !safeArray(windowValue.daysOfWeek).includes(dow)) return false;
  const startMinutes = parseTimeToMinutes(occurrence?.start || occurrence?.slotKey);
  const windowStart = parseTimeToMinutes(windowValue.startTime);
  const windowEnd = parseTimeToMinutes(windowValue.endTime);
  if (!Number.isFinite(startMinutes) || !Number.isFinite(windowStart) || !Number.isFinite(windowEnd) || windowEnd <= windowStart) {
    return getTimeBucket(occurrence) === windowValue.timeBucket;
  }
  return startMinutes >= windowStart && startMinutes < windowEnd;
}

function buildUnusedAvailableWindowsSignal({ preferredWindows, occurrences, period }) {
  const expectedOccurrences = safeArray(occurrences).filter((occurrence) => {
    const dateKey = getOccurrenceDateKey(occurrence);
    if (!isWithinPeriod(dateKey, period)) return false;
    const status = deriveExecutionStatusForOccurrence(occurrence, { dateKey }).status;
    return EXPECTED_EXECUTION_STATUSES.has(status);
  });
  const unused = safeArray(preferredWindows)
    .filter((windowValue) => windowValue.startTime && windowValue.daysOfWeek.length)
    .filter((windowValue) => !expectedOccurrences.some((occurrence) => windowMatchesOccurrence(windowValue, occurrence)))
    .map((windowValue) => ({
      windowId: windowValue.id,
      label: windowValue.label,
      daysOfWeek: windowValue.daysOfWeek,
      startTime: windowValue.startTime,
      endTime: windowValue.endTime,
    }))
    .slice(0, MAX_PATTERN_SUMMARIES);
  return {
    detected: unused.length > 0,
    count: unused.length,
    windows: unused,
  };
}

function buildActualBestWindowSignal(timePatterns) {
  const buckets = safeArray(timePatterns?.buckets)
    .filter((bucket) => bucket.expectedCount >= 2 && bucket.completionRate !== null)
    .sort((left, right) => {
      const completionDelta = (right.completionRate || 0) - (left.completionRate || 0);
      if (completionDelta) return completionDelta;
      return right.completedCount - left.completedCount || left.id.localeCompare(right.id);
    });
  const best = buckets[0] || null;
  return {
    detected: Boolean(best),
    bucketId: best?.id || null,
    completionRate: best?.completionRate ?? null,
    expectedCount: best?.expectedCount || 0,
    completedCount: best?.completedCount || 0,
  };
}

function buildActionAvoidanceSignal(frictionPatterns) {
  const actions = safeArray(frictionPatterns?.byAction)
    .map((entry) => ({
      actionId: entry.actionId,
      title: entry.title,
      frictionCount: entry.missedCount + entry.blockedCount + entry.reportedCount + entry.postponedCount,
      missedCount: entry.missedCount,
      blockedCount: entry.blockedCount,
      reportedCount: entry.reportedCount,
      postponedCount: entry.postponedCount,
      occurrenceIds: safeArray(entry.occurrenceIds).slice(0, 6),
      historyIds: safeArray(entry.historyIds).slice(0, 6),
    }))
    .filter((entry) => entry.frictionCount >= 2)
    .slice(0, MAX_PATTERN_SUMMARIES);
  return {
    detected: actions.length > 0,
    actionCount: actions.length,
    actions,
  };
}

function buildSystemDriftSignal({ firstRun, goals, occurrences }) {
  const commit = isPlainObject(firstRun?.commitV1) ? firstRun.commitV1 : {};
  const createdGoalIds = safeArray(commit.createdGoalIds).map(safeString).filter(Boolean);
  const createdActionIds = safeArray(commit.createdActionIds).map(safeString).filter(Boolean);
  const createdOccurrenceIds = safeArray(commit.createdOccurrenceIds).map(safeString).filter(Boolean);
  const goalIds = new Set(safeArray(goals).map((goal) => safeString(goal?.id)).filter(Boolean));
  const occurrenceIds = new Set(safeArray(occurrences).map((occurrence) => safeString(occurrence?.id)).filter(Boolean));
  const missingGoalIds = [...createdGoalIds, ...createdActionIds].filter((id) => !goalIds.has(id)).slice(0, MAX_PATTERN_SUMMARIES);
  const missingOccurrenceIds = createdOccurrenceIds.filter((id) => !occurrenceIds.has(id)).slice(0, MAX_PATTERN_SUMMARIES);
  return {
    detected: missingGoalIds.length > 0 || missingOccurrenceIds.length > 0,
    missingGoalIds,
    missingOccurrenceIds,
    firstRunCreatedGoalCount: createdGoalIds.length,
    firstRunCreatedActionCount: createdActionIds.length,
    firstRunCreatedOccurrenceCount: createdOccurrenceIds.length,
  };
}

function getActionOutcomeId(action, outcomeIds) {
  const candidates = [
    action?.parentId,
    action?.outcomeId,
    action?.primaryGoalId,
    action?.parentGoalId,
  ].map(safeString).filter(Boolean);
  return candidates.find((id) => outcomeIds.has(id)) || null;
}

function findObjectiveIdsWithoutExecutableBlocks({ goals, occurrences, period }) {
  const outcomes = safeArray(goals).filter((goal) => safeString(goal?.id) && resolveGoalType(goal) === "OUTCOME");
  const outcomeIds = new Set(outcomes.map((goal) => safeString(goal.id)));
  const actionToOutcome = new Map();
  for (const action of safeArray(goals)) {
    if (!safeString(action?.id) || resolveGoalType(action) !== "PROCESS") continue;
    const outcomeId = getActionOutcomeId(action, outcomeIds);
    if (outcomeId) actionToOutcome.set(safeString(action.id), outcomeId);
  }
  const executableObjectiveIds = new Set();
  for (const occurrence of safeArray(occurrences)) {
    const dateKey = getOccurrenceDateKey(occurrence);
    if (!isWithinPeriod(dateKey, period)) continue;
    const status = deriveExecutionStatusForOccurrence(occurrence, { dateKey }).status;
    if (![EXECUTION_SURFACE_STATUS.PLANNED, EXECUTION_SURFACE_STATUS.ACTIVE].includes(status)) continue;
    const objectiveId = actionToOutcome.get(getOccurrenceActionId(occurrence));
    if (objectiveId) executableObjectiveIds.add(objectiveId);
  }
  return outcomes
    .map((objective) => safeString(objective.id))
    .filter((objectiveId) => objectiveId && !executableObjectiveIds.has(objectiveId))
    .slice(0, MAX_PATTERN_SUMMARIES);
}

function buildComparisonSignals({
  plannedSystem,
  behaviorSystem,
  objectiveSignals,
  frictionPatterns,
  timePatterns,
  executionStats,
  firstRun,
  goals,
  occurrences,
  period,
}) {
  const completionOrFriction =
    executionStats.completedCount +
    executionStats.frictionCount +
    behaviorSystem.reportedCount +
    behaviorSystem.blockedCount;
  const capacityMinutes = plannedSystem.capacity?.dailyMinutes;
  const averageDailyMinutes = plannedSystem.weeklyPlannedLoad?.averageDailyMinutes || 0;
  const loadMismatch = Boolean(
    Number.isFinite(capacityMinutes) &&
      capacityMinutes > 0 &&
      (averageDailyMinutes > capacityMinutes || plannedSystem.weeklyPlannedLoad.maxDailyMinutes > Math.round(capacityMinutes * 1.25))
  );
  const repairHistory = behaviorSystem.repairHistorySummary || {};
  const analysisHistory = behaviorSystem.analysisHistorySummary || {};
  const objectiveIdsWithoutExecutableBlocks = findObjectiveIdsWithoutExecutableBlocks({ goals, occurrences, period });
  return {
    unusedAvailableWindows: buildUnusedAvailableWindowsSignal({
      preferredWindows: plannedSystem.preferredWindows,
      occurrences,
      period,
    }),
    objectiveWithoutExecutableBlocks: {
      detected: safeArray(plannedSystem.actionObjectiveStructure.objectiveIdsWithoutActions).length > 0 ||
        safeArray(objectiveSignals.needsStructureObjectiveIds).length > 0 ||
        objectiveIdsWithoutExecutableBlocks.length > 0,
      objectiveIds: Array.from(new Set([
        ...safeArray(plannedSystem.actionObjectiveStructure.objectiveIdsWithoutActions),
        ...safeArray(objectiveSignals.needsStructureObjectiveIds),
        ...objectiveIdsWithoutExecutableBlocks,
      ])).slice(0, MAX_PATTERN_SUMMARIES),
    },
    nextBlockMissing: {
      detected: plannedSystem.nextBlockCoverage.missingNextBlock,
      upcomingPlannedCount: plannedSystem.nextBlockCoverage.upcomingPlannedCount,
    },
    loadVsCapacityMismatch: {
      detected: loadMismatch,
      capacityDailyMinutes: capacityMinutes || null,
      averageDailyMinutes,
      maxDailyMinutes: plannedSystem.weeklyPlannedLoad.maxDailyMinutes,
    },
    actualBestWindow: buildActualBestWindowSignal(timePatterns),
    actionAvoidance: buildActionAvoidanceSignal(frictionPatterns),
    repairHistorySignal: {
      detected: repairHistory.repairedCount > 0,
      repairedCount: repairHistory.repairedCount || 0,
      repeatedActionRepairs: safeArray(repairHistory.repeatedActionRepairs),
      byType: repairHistory.byType || {},
    },
    analysisHistorySignal: {
      detected: analysisHistory.recordCount > 0,
      recordCount: analysisHistory.recordCount || 0,
      appliedCorrectionCount: analysisHistory.appliedCorrectionCount || 0,
      latestStatus: analysisHistory.latestStatus || null,
    },
    whyExecutionMismatch: objectiveSignals.whyExecutionMismatch || { detected: false },
    systemDrift: buildSystemDriftSignal({ firstRun, goals, occurrences }),
    completionOrFrictionSignalCount: completionOrFriction,
  };
}

function countSignalEvidence(signal) {
  if (!isPlainObject(signal)) return 0;
  let count = 0;
  for (const value of Object.values(signal)) {
    if (Array.isArray(value)) count += value.length;
    else if (isPlainObject(value)) count += countSignalEvidence(value);
    else if (value === true) count += 1;
    else if (typeof value === "number" && value > 0) count += value;
  }
  return count;
}

function confidenceForSignal(signal, { behaviorEvidence = 0, structuralEvidence = 0 } = {}) {
  if (!isPlainObject(signal) || signal.detected !== true) return "low";
  const evidenceCount = countSignalEvidence(signal);
  if (behaviorEvidence >= 5 && evidenceCount >= 3) return "high";
  if (behaviorEvidence > 0 || structuralEvidence > 0 || evidenceCount >= 2) return "medium";
  return "low";
}

function buildConfidenceBySignal({ comparisonSignals, executionStats }) {
  const behaviorEvidence = executionStats.outcomeCount + executionStats.frictionCount;
  const structuralEvidence = executionStats.expectedCount;
  return Object.fromEntries(
    Object.keys(comparisonSignals)
      .filter((key) => key !== "completionOrFrictionSignalCount")
      .map((key) => [
        key,
        confidenceForSignal(comparisonSignals[key], { behaviorEvidence, structuralEvidence }),
      ])
  );
}

export function recommendSystemAnalysisMode({
  firstRunSummary,
  executionStats,
  sessionStats,
} = {}) {
  const expectedCount = safeNumber(executionStats?.expectedCount, 0);
  const outcomeCount = safeNumber(executionStats?.outcomeCount, 0);
  const activeDayCount = safeNumber(executionStats?.activeDayCount, 0);
  const completionOrFriction =
    safeNumber(executionStats?.completedCount, 0) +
    safeNumber(executionStats?.frictionCount, 0) +
    safeNumber(sessionStats?.frictionCount, 0);
  const fullBehavioral =
    expectedCount >= CURRENT_BEHAVIORAL_ANALYSIS_REQUIREMENTS.MIN_PLANNED_BLOCKS &&
    outcomeCount >= CURRENT_BEHAVIORAL_ANALYSIS_REQUIREMENTS.MIN_EXECUTION_OUTCOMES &&
    activeDayCount >= CURRENT_BEHAVIORAL_ANALYSIS_REQUIREMENTS.MIN_ACTIVE_DAYS &&
    completionOrFriction >= CURRENT_BEHAVIORAL_ANALYSIS_REQUIREMENTS.MIN_COMPLETION_OR_FRICTION_SIGNALS;
  if (fullBehavioral) return SYSTEM_ANALYSIS_MODE.BEHAVIORAL;

  if (
    safeString(firstRunSummary?.commitStatus) === "applied" &&
    (
      outcomeCount < CURRENT_BEHAVIORAL_ANALYSIS_REQUIREMENTS.MIN_EXECUTION_OUTCOMES ||
      activeDayCount < CURRENT_BEHAVIORAL_ANALYSIS_REQUIREMENTS.MIN_ACTIVE_DAYS
    )
  ) {
    return SYSTEM_ANALYSIS_MODE.INITIAL;
  }

  const hasBehavior =
    outcomeCount > 0 ||
    activeDayCount > 0 ||
    safeNumber(sessionStats?.endedCount, 0) > 0 ||
    completionOrFriction > 0;
  if (hasBehavior) return SYSTEM_ANALYSIS_MODE.HYBRID;

  if (safeString(firstRunSummary?.commitStatus) === "applied") return SYSTEM_ANALYSIS_MODE.INITIAL;
  return SYSTEM_ANALYSIS_MODE.INITIAL;
}

function buildDataLimitations({ userWhy, firstRun, executionStats, sessionStats, coachThemes, profilePreferences }) {
  const limitations = [];
  function add(code, message) {
    limitations.push({ code, message });
  }
  if (!userWhy) add("missing_user_why", "No clarified why text is available.");
  if (!firstRun?.commitStatus) add("missing_first_run_commit", "First-run commit metadata is missing.");
  if (executionStats.expectedCount < 10) add("thin_planning_data", "The period has few planned execution blocks.");
  if (executionStats.outcomeCount < 5) add("thin_execution_outcomes", "The period has few completed or friction outcomes.");
  if (executionStats.activeDayCount < 3) add("thin_active_days", "The period has few active execution days.");
  if (sessionStats.endedCount <= 0) add("missing_session_history", "Session history is not available for the period.");
  if (coachThemes.messageCount <= 0) add("missing_coach_themes", "Coach conversations are unavailable or empty.");
  if (!profilePreferences.userAiProfile.goals.length) add("missing_profile_preferences", "AI profile preferences are sparse.");
  add("missing_planning_edit_telemetry", "Detailed planning edit telemetry is not available yet.");
  add("missing_correction_ignore_telemetry", "Ignored AI correction telemetry is not available yet.");
  add("missing_detailed_session_event_telemetry", "Detailed pause/resume event telemetry is not available yet.");
  return limitations;
}

function stableCloneForHash(value) {
  if (Array.isArray(value)) return value.map(stableCloneForHash);
  if (!isPlainObject(value)) return value;
  const out = {};
  for (const key of Object.keys(value).sort()) {
    if (key === "generatedAt" || key === "snapshotHash") continue;
    out[key] = stableCloneForHash(value[key]);
  }
  return out;
}

function stableStringify(value) {
  return JSON.stringify(stableCloneForHash(value));
}

export function buildSystemAnalysisSnapshotHash(snapshot) {
  const input = stableStringify(snapshot || {});
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `sas_${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

export function buildSystemAnalysisBackendSnapshot(snapshot) {
  const source = isPlainObject(snapshot) ? snapshot : {};
  return Object.fromEntries(
    BACKEND_COMPATIBLE_SNAPSHOT_KEYS
      .filter((key) => Object.prototype.hasOwnProperty.call(source, key))
      .map((key) => [key, source[key]])
  );
}

export function buildSystemAnalysisSnapshot({
  state,
  period,
  referenceDateKey,
  now,
  coachConversations,
} = {}) {
  const safeState = isPlainObject(state) ? state : {};
  const referenceKey = resolveReferenceDateKey(referenceDateKey, now);
  const normalizedPeriod = resolvePeriod(period, referenceKey);
  const generatedAt = resolveNow(now).toISOString();
  const categories = safeArray(safeState.categories);
  const goals = safeArray(safeState.goals);
  const actions = goals.filter((goal) => resolveGoalType(goal) === "PROCESS");
  const occurrences = safeArray(safeState.occurrences);
  const sessionHistory = safeArray(safeState.sessionHistory);
  const firstRun = isPlainObject(safeState.ui?.firstRunV1) ? safeState.ui.firstRunV1 : {};
  const goalById = new Map(goals.map((goal) => [safeString(goal?.id), goal]).filter(([id]) => Boolean(id)));
  const userWhy = getUserWhy(safeState, firstRun);
  const objectiveModel = buildObjectiveProgressModel({
    goals,
    occurrences,
    sessionHistory,
    categories,
    dateKey: normalizedPeriod.endDateKey,
    windowDays: normalizedPeriod.days,
  });
  const firstRunSummary = buildFirstRunSummary(firstRun);
  const goalsSummary = buildGoalSummaries({ goals, categories, objectiveModel });
  const actionsSummary = buildActionsSummary({ actions, objectiveModel });
  const executionStats = buildExecutionSummaries({
    occurrences,
    sessionHistory,
    activeSession: safeState.ui?.activeSession || null,
    period: normalizedPeriod,
    goalById,
  });
  const sessionStats = buildSessionStats({ sessionHistory, period: normalizedPeriod });
  const timePatterns = buildTimePatterns({
    occurrences,
    sessionHistory,
    activeSession: safeState.ui?.activeSession || null,
    period: normalizedPeriod,
  });
  const frictionPatterns = buildFrictionPatterns({
    occurrences,
    sessionHistory,
    activeSession: safeState.ui?.activeSession || null,
    period: normalizedPeriod,
    goalById,
  });
  const objectiveSignals = buildObjectiveSignals(objectiveModel, userWhy);
  frictionPatterns.whyExecutionMismatch = objectiveSignals.whyExecutionMismatch;
  const planningLoadSignals = buildPlanningLoadSignals({ occurrences, period: normalizedPeriod, goalById });
  const systemSignals = buildPeriodSystemSignals({
    state: {
      ...safeState,
      categories,
      goals,
      occurrences,
      sessionHistory,
      ui: isPlainObject(safeState.ui) ? safeState.ui : {},
    },
    period: normalizedPeriod,
  });
  const adjustDiagnosticSummary = buildAdjustDiagnosticSummary(
    {
      ...safeState,
      categories,
      goals,
      occurrences,
      sessionHistory,
      ui: isPlainObject(safeState.ui) ? safeState.ui : {},
    },
    referenceKey
  );
  const coachThemes = buildCoachThemes(collectCoachConversations(safeState, coachConversations));
  const profilePreferences = buildProfilePreferences(safeState);
  const repairHistorySummary = buildRepairHistorySummary({ occurrences, period: normalizedPeriod });
  const analysisHistorySummary = buildAnalysisHistorySummary(safeState);
  const plannedSystem = buildPlannedSystemSummary({
    state: safeState,
    firstRun,
    userWhy,
    objectiveModel,
    goalsSummary,
    actionsSummary,
    planningLoadSignals,
    profilePreferences,
    occurrences,
    sessionHistory,
    period: normalizedPeriod,
    referenceDateKey: referenceKey,
  });
  const behaviorSystem = buildBehaviorSystemSummary({
    executionStats,
    sessionStats,
    timePatterns,
    objectiveModel,
    frictionPatterns,
    repairHistorySummary,
    analysisHistorySummary,
  });
  const comparisonSignals = buildComparisonSignals({
    plannedSystem,
    behaviorSystem,
    objectiveSignals,
    frictionPatterns,
    timePatterns,
    executionStats,
    firstRun,
    goals,
    occurrences,
    period: normalizedPeriod,
  });
  const confidenceBySignal = buildConfidenceBySignal({ comparisonSignals, executionStats });
  const analysisModeRecommendation = recommendSystemAnalysisMode({
    firstRunSummary,
    executionStats,
    sessionStats,
  });
  const dataLimitations = buildDataLimitations({
    userWhy,
    firstRun: firstRunSummary,
    executionStats,
    sessionStats,
    coachThemes,
    profilePreferences,
  });
  const sourceCounts = {
    categories: categories.length,
    goals: goals.length,
    processActions: actions.length,
    occurrences: occurrences.length,
    periodOccurrences: occurrences.filter((occurrence) => isWithinPeriod(getOccurrenceDateKey(occurrence), normalizedPeriod)).length,
    sessionHistory: sessionHistory.length,
    periodSessionHistory: sessionHistory.filter((history) => isWithinPeriod(getHistoryDateKey(history), normalizedPeriod)).length,
    systemSignals: systemSignals.length,
    coachConversations: coachThemes.conversationCount,
    repairHistory: repairHistorySummary.repairedCount,
    systemAnalysisHistory: analysisHistorySummary.recordCount,
  };

  const snapshot = {
    version: SYSTEM_ANALYSIS_SNAPSHOT_VERSION,
    period: normalizedPeriod,
    generatedAt,
    referenceDateKey: referenceKey,
    userWhy,
    firstRunSummary,
    goalsSummary,
    actionsSummary,
    executionStats,
    sessionStats,
    timePatterns,
    frictionPatterns,
    objectiveSignals,
    planningLoadSignals,
    systemSignals,
    adjustDiagnosticSummary,
    coachThemes,
    profilePreferences,
    plannedSystem,
    behaviorSystem,
    comparisonSignals,
    confidenceBySignal,
    analysisModeRecommendation,
    dataLimitations,
    sourceCounts,
    snapshotHash: "",
  };
  return {
    ...snapshot,
    snapshotHash: buildSystemAnalysisSnapshotHash(snapshot),
  };
}
