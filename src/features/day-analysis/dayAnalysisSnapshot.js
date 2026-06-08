import {
  EXECUTION_SURFACE_STATUS,
  deriveExecutionStatusForOccurrence,
} from "../../logic/executionStatus";
import { resolveGoalType } from "../../domain/goalType";
import { toLocalDateKey } from "../../utils/datetime";
import { buildDayAnalysisCandidates } from "./dayAnalysisCandidates";
import { DAY_ANALYSIS_VERSION } from "./dayAnalysisTypes";

const MAX_SNAPSHOT_OCCURRENCES = 24;
const MAX_SNAPSHOT_HISTORY = 12;
const MAX_SNAPSHOT_SIGNALS = 6;

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function safeString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function truncate(value, max = 180) {
  const text = safeString(value);
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

function normalizeNow(now) {
  const date = now instanceof Date ? now : new Date(now || Date.now());
  return Number.isNaN(date.getTime()) ? new Date() : date;
}

function indexById(items) {
  return new Map(
    safeArray(items)
      .filter((item) => item && item.id)
      .map((item) => [String(item.id), item]),
  );
}

function getOccurrenceDateKey(occurrence) {
  return (
    safeString(occurrence?.dateKey) ||
    safeString(occurrence?.date) ||
    safeString(occurrence?.plannedDateKey) ||
    safeString(occurrence?.localDateKey)
  );
}

function getOccurrenceStart(occurrence) {
  return (
    safeString(occurrence?.startTime) ||
    safeString(occurrence?.start) ||
    safeString(occurrence?.time) ||
    safeString(occurrence?.slotKey)
  );
}

function getOccurrenceDuration(occurrence, action) {
  const raw =
    occurrence?.durationMinutes ??
    occurrence?.plannedDurationMinutes ??
    occurrence?.duration ??
    action?.durationMinutes ??
    action?.estimatedMinutes;
  const duration = Number(raw);
  return Number.isFinite(duration) && duration > 0 ? duration : null;
}

function getActionIdForOccurrence(occurrence) {
  return (
    safeString(occurrence?.actionId) ||
    safeString(occurrence?.goalId) ||
    safeString(occurrence?.taskId)
  );
}

function getGoalTitle(goal) {
  return truncate(goal?.title || goal?.name || goal?.label || "");
}

function resolveParentObjective(action, goalsById) {
  const parentId =
    safeString(action?.outcomeId) ||
    safeString(action?.objectiveId) ||
    safeString(action?.parentGoalId);
  if (parentId && goalsById.has(parentId)) return goalsById.get(parentId);
  return null;
}

function resolvePrimaryGoal({ state, todayData, goalsById }) {
  const primaryActionId =
    safeString(todayData?.primaryAction?.actionId) ||
    safeString(todayData?.primaryAction?.goalId);
  const primaryAction = primaryActionId ? goalsById.get(primaryActionId) : null;
  const parentObjective = primaryAction ? resolveParentObjective(primaryAction, goalsById) : null;
  const explicitPrimaryId =
    safeString(state?.ui?.firstRun?.primaryGoalId) ||
    safeString(state?.firstRun?.primaryGoalId) ||
    safeString(state?.userProfile?.primaryGoalId);

  const explicitPrimary = explicitPrimaryId ? goalsById.get(explicitPrimaryId) : null;
  const fallbackObjective = safeArray(state?.goals).find((goal) => {
    const type = resolveGoalType(goal);
    return type === "OUTCOME";
  });
  const goal = parentObjective || explicitPrimary || fallbackObjective || null;
  if (!goal) return null;
  return {
    id: goal.id,
    title: getGoalTitle(goal),
    categoryId: safeString(goal.categoryId) || null,
    type: resolveGoalType(goal),
  };
}

function extractWhyText(state) {
  return truncate(
    state?.ui?.firstRun?.whyText ||
      state?.firstRun?.whyText ||
      state?.userProfile?.whyText ||
      state?.profile?.whyText ||
      "",
    240,
  );
}

function buildFirstRunSummary(state) {
  const source = state?.ui?.firstRun || state?.firstRun || null;
  if (!source) return null;
  return {
    status: safeString(source.status) || null,
    appliedAt: safeString(source.appliedAt) || safeString(source.completedAt) || null,
    planSource: safeString(source.planSource) || safeString(source.selectedPlanSource) || null,
    createdActionCount: Number.isFinite(Number(source.createdActionCount))
      ? Number(source.createdActionCount)
      : null,
    createdOccurrenceCount: Number.isFinite(Number(source.createdOccurrenceCount))
      ? Number(source.createdOccurrenceCount)
      : null,
  };
}

function normalizePrimaryAction(todayData) {
  const action = todayData?.primaryAction;
  if (!action) return null;
  return {
    status: safeString(action.status) || null,
    occurrenceId: safeString(action.occurrenceId) || null,
    actionId: safeString(action.actionId) || safeString(action.goalId) || null,
    title: truncate(action.title || action.label || ""),
    description: truncate(action.description || ""),
    timingLabel: truncate(action.timingLabel || ""),
    durationLabel: truncate(action.durationLabel || ""),
    primaryLabel: truncate(action.primaryLabel || ""),
    reason: truncate(action.reason || ""),
  };
}

function normalizeOccurrence({ occurrence, action, goalsById, state }) {
  const statusResult = deriveExecutionStatusForOccurrence(occurrence, {
    sessionHistory: state?.sessionHistory,
    activeSession: state?.ui?.activeSession || state?.activeSession || null,
    dateKey: getOccurrenceDateKey(occurrence),
  });
  const objective = action ? resolveParentObjective(action, goalsById) : null;
  return {
    id: occurrence.id,
    actionId: action?.id || getActionIdForOccurrence(occurrence) || null,
    objectiveId: objective?.id || null,
    categoryId: safeString(action?.categoryId) || safeString(occurrence?.categoryId) || null,
    title: truncate(action?.title || occurrence.title || occurrence.label || ""),
    dateKey: getOccurrenceDateKey(occurrence),
    start: getOccurrenceStart(occurrence) || null,
    durationMinutes: getOccurrenceDuration(occurrence, action),
    persistedStatus: safeString(occurrence.status) || null,
    derivedStatus: statusResult.status || EXECUTION_SURFACE_STATUS.PLANNED,
    executionSource: statusResult.source || null,
    executionReason: statusResult.reason || null,
    historyId: statusResult.historyEntry?.id || null,
  };
}

function normalizeSessionHistory(state, dayKey) {
  return safeArray(state?.sessionHistory)
    .filter((entry) => {
      const dateKey =
        safeString(entry?.dateKey) ||
        safeString(entry?.dayKey) ||
        safeString(entry?.plannedDateKey);
      return !dateKey || dateKey === dayKey;
    })
    .slice(-MAX_SNAPSHOT_HISTORY)
    .map((entry) => ({
      id: entry.id || null,
      occurrenceId: safeString(entry.occurrenceId) || null,
      goalId: safeString(entry.goalId) || null,
      dateKey:
        safeString(entry.dateKey) ||
        safeString(entry.dayKey) ||
        safeString(entry.plannedDateKey) ||
        dayKey,
      endedReason: safeString(entry.endedReason) || safeString(entry.reason) || null,
      status: safeString(entry.status) || null,
      startedAt: safeString(entry.startedAt) || null,
      endedAt: safeString(entry.endedAt) || null,
    }));
}

function normalizeActiveSession(state) {
  const session = state?.ui?.activeSession || state?.activeSession || null;
  if (!session) return null;
  return {
    id: session.id || null,
    occurrenceId: safeString(session.occurrenceId) || null,
    goalId: safeString(session.goalId) || null,
    dateKey: safeString(session.dateKey) || safeString(session.dayKey) || null,
    status: safeString(session.status) || safeString(session.runtimePhase) || null,
  };
}

function normalizeSystemSignals(todayData, state) {
  const signals =
    todayData?.systemSignals ||
    todayData?.signals ||
    state?.systemSignals ||
    state?.ui?.systemSignals ||
    [];
  return safeArray(signals)
    .slice(0, MAX_SNAPSHOT_SIGNALS)
    .map((signal) => ({
      id: signal.id || null,
      type: safeString(signal.type) || null,
      severity: safeString(signal.severity) || null,
      label: truncate(signal.label || signal.title || ""),
      summary: truncate(signal.summary || signal.description || ""),
    }));
}

function getTimezone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || null;
  } catch {
    return null;
  }
}

export function buildDayAnalysisSnapshot({ state, todayData, now, selectedDateKey } = {}) {
  const safeState = state && typeof state === "object" ? state : {};
  const date = normalizeNow(now);
  const dayKey = selectedDateKey || toLocalDateKey(date);
  const goalsById = indexById(safeState.goals);
  const primaryGoal = resolvePrimaryGoal({ state: safeState, todayData, goalsById });
  const todayOccurrences = safeArray(safeState.occurrences)
    .filter((occurrence) => getOccurrenceDateKey(occurrence) === dayKey)
    .slice(0, MAX_SNAPSHOT_OCCURRENCES)
    .map((occurrence) => {
      const actionId = getActionIdForOccurrence(occurrence);
      return normalizeOccurrence({
        occurrence,
        action: goalsById.get(actionId) || null,
        goalsById,
        state: safeState,
      });
    });

  const deterministicActions = buildDayAnalysisCandidates({
    state: safeState,
    todayData,
    now: date,
    selectedDateKey: dayKey,
    primaryGoal,
  });

  const dataLimitations = [];
  if (!primaryGoal) dataLimitations.push("no_primary_goal");
  if (todayOccurrences.length === 0) dataLimitations.push("empty_day");
  if (deterministicActions.length === 0) dataLimitations.push("no_deterministic_actions");
  if (dayKey !== toLocalDateKey(date)) dataLimitations.push("non_today_selected_date");

  return {
    version: DAY_ANALYSIS_VERSION,
    dayKey,
    nowIso: date.toISOString(),
    timezone: getTimezone(),
    activeCategoryId:
      safeString(safeState.ui?.executionActiveCategoryId) ||
      safeString(safeState.ui?.selectedCategoryId) ||
      safeString(todayData?.primaryAction?.categoryId) ||
      null,
    primaryGoal,
    whyText: extractWhyText(safeState),
    firstRun: buildFirstRunSummary(safeState),
    primaryAction: normalizePrimaryAction(todayData),
    occurrences: todayOccurrences,
    sessionHistory: normalizeSessionHistory(safeState, dayKey),
    activeSession: normalizeActiveSession(safeState),
    systemSignals: normalizeSystemSignals(todayData, safeState),
    deterministicActions,
    dataLimitations,
  };
}
