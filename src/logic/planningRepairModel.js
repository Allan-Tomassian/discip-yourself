import { uid } from "../utils/helpers";
import {
  addDaysLocal,
  minutesToTimeStr,
  normalizeLocalDateKey,
  normalizeStartTime,
  parseTimeToMinutes,
  todayLocalKey,
  toLocalDateKey,
} from "../utils/datetime";
import {
  EXECUTION_SURFACE_STATUS,
  deriveExecutionStatusForOccurrence,
} from "./executionStatus";
import { OCCURRENCE_STATUS, normalizeOccurrenceStatus } from "./occurrenceStatus";
import { resolveConflictNearest } from "./occurrencePlanner";

export const PLANNING_REPAIR_TYPE = Object.freeze({
  MOVE_LATER_TODAY: "move_later_today",
  MOVE_TOMORROW: "move_tomorrow",
  CHOOSE_TIME: "choose_time",
  REDUCE_DURATION: "reduce_duration",
  SKIP_ONCE: "skip_once",
  CANCEL_ONCE: "cancel_once",
  REDUCE_TODAY_LOAD: "reduce_today_load",
  SPLIT_BLOCK: "split_block",
});

const SUPPORTED_SINGLE_REPAIRS = new Set([
  PLANNING_REPAIR_TYPE.MOVE_LATER_TODAY,
  PLANNING_REPAIR_TYPE.MOVE_TOMORROW,
  PLANNING_REPAIR_TYPE.CHOOSE_TIME,
  PLANNING_REPAIR_TYPE.REDUCE_DURATION,
  PLANNING_REPAIR_TYPE.SKIP_ONCE,
  PLANNING_REPAIR_TYPE.CANCEL_ONCE,
]);

const SUPPORTED_RECOVERY_REPAIRS = new Set([
  PLANNING_REPAIR_TYPE.MOVE_LATER_TODAY,
  PLANNING_REPAIR_TYPE.MOVE_TOMORROW,
  PLANNING_REPAIR_TYPE.CHOOSE_TIME,
  PLANNING_REPAIR_TYPE.REDUCE_DURATION,
  PLANNING_REPAIR_TYPE.SKIP_ONCE,
]);

const LOAD_CANDIDATE_STATUSES = new Set([EXECUTION_SURFACE_STATUS.PLANNED]);
const BUSY_OCCURRENCE_STATUSES = new Set([
  OCCURRENCE_STATUS.PLANNED,
  OCCURRENCE_STATUS.IN_PROGRESS,
]);

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function safeString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function safeNow(value) {
  return value instanceof Date && !Number.isNaN(value.getTime()) ? value : new Date();
}

function cloneStateWithOccurrences(state, occurrences) {
  return {
    ...(state && typeof state === "object" ? state : {}),
    occurrences,
  };
}

function buildResult({
  ok,
  state,
  nextState,
  repairSummary = "",
  changedOccurrenceIds = [],
  warnings = [],
  confirmation = null,
  extras = {},
}) {
  return {
    ok: Boolean(ok),
    nextState: nextState || state || null,
    repairSummary,
    changedOccurrenceIds: Array.from(new Set(safeArray(changedOccurrenceIds).filter(Boolean))),
    warnings: safeArray(warnings).filter(Boolean),
    confirmation,
    ...extras,
  };
}

function normalizeDateKey(value) {
  return normalizeLocalDateKey(value) || "";
}

function normalizeDurationMinutes(value, fallback = null) {
  const raw = typeof value === "string" ? Number(value) : value;
  if (!Number.isFinite(raw)) return fallback;
  const rounded = Math.round(raw);
  return rounded > 0 ? rounded : fallback;
}

function getOccurrences(state) {
  return safeArray(state?.occurrences);
}

function getGoals(state) {
  return safeArray(state?.goals);
}

function getOccurrenceById(state, occurrenceId) {
  const id = safeString(occurrenceId);
  if (!id) return null;
  return getOccurrences(state).find((occurrence) => occurrence && occurrence.id === id) || null;
}

function getGoalById(state, goalId) {
  const id = safeString(goalId);
  if (!id) return null;
  return getGoals(state).find((goal) => goal && goal.id === id) || null;
}

function getActiveSession(state) {
  return state?.ui?.activeSession && typeof state.ui.activeSession === "object" ? state.ui.activeSession : null;
}

function getSurfaceStatus(state, occurrence) {
  return deriveExecutionStatusForOccurrence(occurrence, {
    activeSession: getActiveSession(state),
    sessionHistory: state?.sessionHistory,
    dateKey: occurrence?.date,
  });
}

function validateRepairableOccurrence(state, occurrenceId) {
  const occurrence = getOccurrenceById(state, occurrenceId);
  if (!occurrence) {
    return { ok: false, occurrence: null, warnings: ["occurrence_missing"] };
  }

  const derived = getSurfaceStatus(state, occurrence);
  if (derived.status === EXECUTION_SURFACE_STATUS.ACTIVE) {
    return { ok: false, occurrence, warnings: ["occurrence_active"] };
  }

  const persistedStatus = normalizeOccurrenceStatus(occurrence.status);
  if (persistedStatus !== OCCURRENCE_STATUS.PLANNED) {
    return { ok: false, occurrence, warnings: [`occurrence_final_${persistedStatus}`] };
  }

  return { ok: true, occurrence, warnings: [] };
}

function validateRecoveryRepairableOccurrence(state, occurrenceId) {
  const occurrence = getOccurrenceById(state, occurrenceId);
  if (!occurrence) {
    return { ok: false, occurrence: null, warnings: ["occurrence_missing"] };
  }

  const derived = getSurfaceStatus(state, occurrence);
  if (derived.status === EXECUTION_SURFACE_STATUS.ACTIVE) {
    return { ok: false, occurrence, warnings: ["occurrence_active"] };
  }

  const persistedStatus = normalizeOccurrenceStatus(occurrence.status);
  if (persistedStatus === OCCURRENCE_STATUS.IN_PROGRESS) {
    return { ok: false, occurrence, warnings: ["occurrence_active"] };
  }
  if (
    persistedStatus === OCCURRENCE_STATUS.DONE ||
    persistedStatus === OCCURRENCE_STATUS.SKIPPED ||
    persistedStatus === OCCURRENCE_STATUS.CANCELED ||
    persistedStatus === OCCURRENCE_STATUS.RESCHEDULED
  ) {
    return { ok: false, occurrence, warnings: [`occurrence_final_${persistedStatus}`] };
  }
  if (persistedStatus !== OCCURRENCE_STATUS.PLANNED && persistedStatus !== OCCURRENCE_STATUS.MISSED) {
    return { ok: false, occurrence, warnings: [`occurrence_not_repairable_${persistedStatus}`] };
  }

  return { ok: true, occurrence, warnings: [] };
}

function resolveAppliedAt(now) {
  return safeNow(now).toISOString();
}

function getOccurrenceStart(occurrence, fallback = "09:00") {
  return normalizeStartTime(occurrence?.start) || normalizeStartTime(occurrence?.slotKey) || fallback;
}

function getOccurrenceDate(occurrence, fallback = "") {
  return normalizeDateKey(occurrence?.date) || normalizeDateKey(fallback) || todayLocalKey();
}

function roundUpToStep(minutes, step = 15) {
  if (!Number.isFinite(minutes)) return null;
  return Math.ceil(minutes / step) * step;
}

function resolveLaterTodayStart(occurrence, selectedDateKey, now) {
  const occurrenceStart = getOccurrenceStart(occurrence);
  const occurrenceStartMinutes = parseTimeToMinutes(occurrenceStart);
  const dateKey = normalizeDateKey(selectedDateKey) || getOccurrenceDate(occurrence);
  const current = safeNow(now);
  const currentDateKey = toLocalDateKey(current);
  const currentMinutes = current.getHours() * 60 + current.getMinutes();
  const minimumStart =
    dateKey === currentDateKey
      ? roundUpToStep(currentMinutes + 30)
      : Number.isFinite(occurrenceStartMinutes)
        ? occurrenceStartMinutes + 60
        : 10 * 60;
  const fallback = Number.isFinite(occurrenceStartMinutes) ? occurrenceStartMinutes + 60 : 10 * 60;
  const target = Math.max(Number.isFinite(minimumStart) ? minimumStart : fallback, fallback);
  return minutesToTimeStr(Math.min(target, 22 * 60)) || "18:00";
}

function buildTimingFields(dateKey, start, durationMinutes) {
  const date = normalizeDateKey(dateKey);
  const time = normalizeStartTime(start);
  const duration = normalizeDurationMinutes(durationMinutes, 0);
  if (!date || !time || !duration) return {};
  const startMinutes = parseTimeToMinutes(time);
  const end = Number.isFinite(startMinutes) ? minutesToTimeStr(Math.min(startMinutes + duration, (24 * 60) - 1)) : "";
  return {
    startAt: `${date}T${time}`,
    endAt: end ? `${date}T${end}` : "",
  };
}

function buildRepairMetadata({
  type,
  appliedAt,
  sourceOccurrenceId,
  targetOccurrenceId,
  reason,
  sourceOccurrence,
}) {
  return {
    version: 1,
    type,
    appliedAt,
    sourceOccurrenceId: safeString(sourceOccurrenceId),
    targetOccurrenceId: safeString(targetOccurrenceId),
    protectFromRuleSync: true,
    reason: safeString(reason),
    sourceScheduleRuleId: safeString(sourceOccurrence?.scheduleRuleId) || undefined,
    fromDate: normalizeDateKey(sourceOccurrence?.date) || undefined,
    fromStart: getOccurrenceStart(sourceOccurrence, "") || undefined,
    fromDurationMinutes: normalizeDurationMinutes(sourceOccurrence?.durationMinutes, null) || undefined,
  };
}

function stripUndefinedFields(value) {
  return Object.fromEntries(Object.entries(value).filter(([, entry]) => typeof entry !== "undefined"));
}

function buildTargetOccurrence({ id, sourceOccurrence, targetDate, targetStart, durationMinutes, repairV1 }) {
  const preserved = { ...sourceOccurrence };
  delete preserved.id;
  delete preserved.date;
  delete preserved.start;
  delete preserved.slotKey;
  delete preserved.status;
  delete preserved.doneAt;
  delete preserved.pointsAwarded;
  delete preserved.startAt;
  delete preserved.endAt;
  delete preserved.windowStartAt;
  delete preserved.windowEndAt;
  delete preserved.resolvedStart;
  delete preserved.resolvedStartAt;
  delete preserved.conflict;
  delete preserved.scheduleRuleId;
  delete preserved.repairV1;

  const timing = buildTimingFields(targetDate, targetStart, durationMinutes);
  return stripUndefinedFields({
    ...preserved,
    id: id || uid(),
    goalId: sourceOccurrence.goalId,
    date: targetDate,
    start: targetStart,
    slotKey: targetStart,
    durationMinutes,
    status: OCCURRENCE_STATUS.PLANNED,
    timeType: targetStart === "00:00" ? sourceOccurrence.timeType : "fixed",
    noTime: targetStart === "00:00" ? sourceOccurrence.noTime : undefined,
    ...timing,
    repairV1,
    updatedAt: repairV1.appliedAt,
  });
}

function findExactTargetOccurrence(occurrences, sourceOccurrence, targetDate, targetStart) {
  return occurrences.find((occurrence) => {
    if (!occurrence || occurrence.id === sourceOccurrence.id) return false;
    if (safeString(occurrence.goalId) !== safeString(sourceOccurrence.goalId)) return false;
    if (normalizeDateKey(occurrence.date) !== targetDate) return false;
    return getOccurrenceStart(occurrence, "") === targetStart;
  }) || null;
}

function isReusableTargetOccurrence(occurrence) {
  return normalizeOccurrenceStatus(occurrence?.status) === OCCURRENCE_STATUS.PLANNED;
}

function getConflictOccurrences(state, sourceOccurrence, targetOccurrence = null) {
  return getOccurrences(state).filter((occurrence) => {
    if (!occurrence || occurrence.id === sourceOccurrence?.id) return false;
    if (targetOccurrence && occurrence.id === targetOccurrence.id) return false;
    const status = normalizeOccurrenceStatus(occurrence.status);
    return BUSY_OCCURRENCE_STATUSES.has(status);
  });
}

function resolveTargetSlot({ state, sourceOccurrence, targetDate, preferredStart, durationMinutes, targetOccurrence }) {
  const start = normalizeStartTime(preferredStart);
  if (!targetDate || !start) {
    return { ok: false, start: "", warning: "target_time_invalid" };
  }
  const conflictSource = getConflictOccurrences(state, sourceOccurrence, targetOccurrence);
  const resolved = resolveConflictNearest(conflictSource, targetDate, start, durationMinutes, []);
  if (resolved.conflict) {
    return { ok: false, start, warning: "target_time_conflict" };
  }
  return { ok: true, start: normalizeStartTime(resolved.start) || start, warning: resolved.start !== start ? "target_time_adjusted" : "" };
}

function repairTypeLabel(type) {
  switch (type) {
    case PLANNING_REPAIR_TYPE.MOVE_LATER_TODAY:
      return "Move later today";
    case PLANNING_REPAIR_TYPE.MOVE_TOMORROW:
      return "Move tomorrow";
    case PLANNING_REPAIR_TYPE.CHOOSE_TIME:
      return "Choose time";
    case PLANNING_REPAIR_TYPE.REDUCE_DURATION:
      return "Reduce duration";
    case PLANNING_REPAIR_TYPE.SKIP_ONCE:
      return "Skip once";
    case PLANNING_REPAIR_TYPE.CANCEL_ONCE:
      return "Cancel once";
    default:
      return "Repair";
  }
}

function buildConfirmation(type, occurrence, detail) {
  return {
    type,
    occurrenceId: safeString(occurrence?.id),
    title: repairTypeLabel(type),
    message: detail,
    requiresConfirmation: true,
  };
}

function computeReducedDuration(occurrence, requestedDuration = null) {
  const current = normalizeDurationMinutes(occurrence?.durationMinutes, 30);
  const requested = normalizeDurationMinutes(requestedDuration, null);
  if (requested && requested < current) return Math.max(5, requested);
  if (current <= 10) return current;
  const halved = Math.round((current / 2) / 5) * 5;
  return Math.max(10, Math.min(current - 5, halved || 10));
}

function normalizeRepair(repair) {
  if (!repair || typeof repair !== "object") return { type: "" };
  return {
    ...repair,
    type: safeString(repair.type),
    reason: safeString(repair.reason),
  };
}

function resolveMoveTarget({ state, occurrence, repair, now }) {
  const type = repair.type;
  const sourceDate = getOccurrenceDate(occurrence);
  let targetDate = normalizeDateKey(repair.dateKey) || normalizeDateKey(repair.date);
  let targetStart = normalizeStartTime(repair.start);

  if (type === PLANNING_REPAIR_TYPE.MOVE_LATER_TODAY) {
    targetDate = targetDate || normalizeDateKey(repair.selectedDateKey) || sourceDate;
    targetStart = targetStart || resolveLaterTodayStart(occurrence, targetDate, now);
  } else if (type === PLANNING_REPAIR_TYPE.MOVE_TOMORROW) {
    targetDate = targetDate || addDaysLocal(sourceDate, 1);
    targetStart = targetStart || getOccurrenceStart(occurrence);
  } else if (type === PLANNING_REPAIR_TYPE.CHOOSE_TIME) {
    targetDate = targetDate || sourceDate;
  }

  targetDate = normalizeDateKey(targetDate);
  targetStart = normalizeStartTime(targetStart);
  if (!targetDate || !targetStart) return { ok: false, warning: "target_missing" };
  if (targetDate === sourceDate && targetStart === getOccurrenceStart(occurrence, "")) {
    return { ok: false, warning: "target_same_as_source" };
  }

  const durationMinutes = normalizeDurationMinutes(repair.durationMinutes, normalizeDurationMinutes(occurrence.durationMinutes, 30));
  const exactTarget = findExactTargetOccurrence(getOccurrences(state), occurrence, targetDate, targetStart);
  if (exactTarget && !isReusableTargetOccurrence(exactTarget)) {
    return { ok: false, warning: "target_occurrence_final" };
  }
  const resolved = resolveTargetSlot({
    state,
    sourceOccurrence: occurrence,
    targetDate,
    preferredStart: targetStart,
    durationMinutes,
    targetOccurrence: exactTarget,
  });
  if (!resolved.ok) return { ok: false, warning: resolved.warning };

  const resolvedTarget = findExactTargetOccurrence(getOccurrences(state), occurrence, targetDate, resolved.start);
  if (resolvedTarget && !isReusableTargetOccurrence(resolvedTarget)) {
    return { ok: false, warning: "target_occurrence_final" };
  }

  return {
    ok: true,
    targetDate,
    targetStart: resolved.start,
    durationMinutes,
    targetOccurrence: resolvedTarget,
    warning: resolved.warning,
  };
}

function applyMoveRepair({ state, occurrence, repair, now }) {
  const target = resolveMoveTarget({ state, occurrence, repair, now });
  if (!target.ok) {
    return buildResult({
      ok: false,
      state,
      warnings: [target.warning],
      confirmation: buildConfirmation(repair.type, occurrence, "Choose a valid target slot before applying this repair."),
    });
  }

  const appliedAt = resolveAppliedAt(now);
  const targetId = target.targetOccurrence?.id || uid();
  const sourceRepairV1 = buildRepairMetadata({
    type: repair.type,
    appliedAt,
    sourceOccurrenceId: occurrence.id,
    targetOccurrenceId: targetId,
    reason: repair.reason,
    sourceOccurrence: occurrence,
  });
  const targetRepairV1 = buildRepairMetadata({
    type: repair.type,
    appliedAt,
    sourceOccurrenceId: occurrence.id,
    targetOccurrenceId: targetId,
    reason: repair.reason,
    sourceOccurrence: occurrence,
  });

  const sourcePatch = {
    status: OCCURRENCE_STATUS.RESCHEDULED,
    repairV1: sourceRepairV1,
    updatedAt: appliedAt,
  };
  let targetChanged = false;
  const occurrences = getOccurrences(state).map((current) => {
    if (!current || current.id === occurrence.id) {
      return current && current.id === occurrence.id ? { ...current, ...sourcePatch } : current;
    }
    if (target.targetOccurrence && current.id === target.targetOccurrence.id) {
      targetChanged = true;
      return {
        ...current,
        status: OCCURRENCE_STATUS.PLANNED,
        durationMinutes: target.durationMinutes,
        repairV1: targetRepairV1,
        updatedAt: appliedAt,
      };
    }
    return current;
  });

  let nextOccurrences = occurrences;
  if (!targetChanged) {
    nextOccurrences = [
      ...occurrences,
      buildTargetOccurrence({
        id: targetId,
        sourceOccurrence: occurrence,
        targetDate: target.targetDate,
        targetStart: target.targetStart,
        durationMinutes: target.durationMinutes,
        repairV1: targetRepairV1,
      }),
    ];
  }

  const nextState = cloneStateWithOccurrences(state, nextOccurrences);
  const warnings = [target.warning].filter(Boolean);
  return buildResult({
    ok: true,
    state,
    nextState,
    repairSummary: `${repairTypeLabel(repair.type)}: ${target.targetDate} ${target.targetStart}`,
    changedOccurrenceIds: [occurrence.id, targetId],
    warnings,
    confirmation: buildConfirmation(
      repair.type,
      occurrence,
      `Move this block to ${target.targetDate} at ${target.targetStart}.`
    ),
  });
}

function applyReduceDurationRepair({ state, occurrence, repair, now }) {
  const currentDuration = normalizeDurationMinutes(occurrence.durationMinutes, 30);
  const nextDuration = computeReducedDuration(occurrence, repair.durationMinutes);
  if (!nextDuration || nextDuration >= currentDuration) {
    return buildResult({
      ok: false,
      state,
      warnings: ["duration_not_reduced"],
      confirmation: buildConfirmation(repair.type, occurrence, "Choose a shorter duration before applying this repair."),
    });
  }

  const appliedAt = resolveAppliedAt(now);
  const repairV1 = buildRepairMetadata({
    type: repair.type,
    appliedAt,
    sourceOccurrenceId: occurrence.id,
    targetOccurrenceId: occurrence.id,
    reason: repair.reason,
    sourceOccurrence: occurrence,
  });
  const timing = buildTimingFields(occurrence.date, getOccurrenceStart(occurrence), nextDuration);
  const nextOccurrences = getOccurrences(state).map((current) =>
    current?.id === occurrence.id
      ? {
          ...current,
          durationMinutes: nextDuration,
          ...timing,
          repairV1,
          updatedAt: appliedAt,
        }
      : current
  );

  return buildResult({
    ok: true,
    state,
    nextState: cloneStateWithOccurrences(state, nextOccurrences),
    repairSummary: `Reduce duration to ${nextDuration} min`,
    changedOccurrenceIds: [occurrence.id],
    confirmation: buildConfirmation(repair.type, occurrence, `Reduce this block to ${nextDuration} minutes.`),
  });
}

function applyStatusRepair({ state, occurrence, repair, now }) {
  const nextStatus =
    repair.type === PLANNING_REPAIR_TYPE.SKIP_ONCE
      ? OCCURRENCE_STATUS.SKIPPED
      : OCCURRENCE_STATUS.CANCELED;
  const appliedAt = resolveAppliedAt(now);
  const repairV1 = buildRepairMetadata({
    type: repair.type,
    appliedAt,
    sourceOccurrenceId: occurrence.id,
    targetOccurrenceId: occurrence.id,
    reason: repair.reason,
    sourceOccurrence: occurrence,
  });
  const nextOccurrences = getOccurrences(state).map((current) =>
    current?.id === occurrence.id
      ? {
          ...current,
          status: nextStatus,
          repairV1,
          updatedAt: appliedAt,
        }
      : current
  );

  return buildResult({
    ok: true,
    state,
    nextState: cloneStateWithOccurrences(state, nextOccurrences),
    repairSummary: `${repairTypeLabel(repair.type)}: ${nextStatus}`,
    changedOccurrenceIds: [occurrence.id],
    confirmation: buildConfirmation(repair.type, occurrence, `Mark this block as ${nextStatus}.`),
  });
}

function resolveRecoveryReplacementTarget({ state, occurrence, repair, now }) {
  if (repair.type !== PLANNING_REPAIR_TYPE.REDUCE_DURATION) {
    return resolveMoveTarget({ state, occurrence, repair, now });
  }

  const currentDuration = normalizeDurationMinutes(occurrence.durationMinutes, 30);
  const durationMinutes = computeReducedDuration(occurrence, repair.durationMinutes);
  if (!durationMinutes || durationMinutes >= currentDuration) {
    return { ok: false, warning: "duration_not_reduced" };
  }

  const sourceDate = getOccurrenceDate(occurrence);
  const targetDate =
    normalizeDateKey(repair.dateKey) ||
    normalizeDateKey(repair.selectedDateKey) ||
    sourceDate;
  const targetStart =
    normalizeStartTime(repair.start) ||
    resolveLaterTodayStart(occurrence, targetDate, now);

  if (!targetDate || !targetStart) return { ok: false, warning: "target_missing" };
  if (targetDate === sourceDate && targetStart === getOccurrenceStart(occurrence, "")) {
    return { ok: false, warning: "target_same_as_source" };
  }

  const exactTarget = findExactTargetOccurrence(getOccurrences(state), occurrence, targetDate, targetStart);
  if (exactTarget && !isReusableTargetOccurrence(exactTarget)) {
    return { ok: false, warning: "target_occurrence_final" };
  }
  const resolved = resolveTargetSlot({
    state,
    sourceOccurrence: occurrence,
    targetDate,
    preferredStart: targetStart,
    durationMinutes,
    targetOccurrence: exactTarget,
  });
  if (!resolved.ok) return { ok: false, warning: resolved.warning };

  const resolvedTarget = findExactTargetOccurrence(getOccurrences(state), occurrence, targetDate, resolved.start);
  if (resolvedTarget && !isReusableTargetOccurrence(resolvedTarget)) {
    return { ok: false, warning: "target_occurrence_final" };
  }

  return {
    ok: true,
    targetDate,
    targetStart: resolved.start,
    durationMinutes,
    targetOccurrence: resolvedTarget,
    warning: resolved.warning,
  };
}

function applyRecoveryReplacementRepair({ state, occurrence, repair, now }) {
  const target = resolveRecoveryReplacementTarget({ state, occurrence, repair, now });
  if (!target.ok) {
    return buildResult({
      ok: false,
      state,
      warnings: [target.warning],
      confirmation: buildConfirmation(repair.type, occurrence, "Choose a valid target before applying this recovery."),
    });
  }

  const appliedAt = resolveAppliedAt(now);
  const targetId = target.targetOccurrence?.id || uid();
  const sourceRepairV1 = buildRepairMetadata({
    type: repair.type,
    appliedAt,
    sourceOccurrenceId: occurrence.id,
    targetOccurrenceId: targetId,
    reason: repair.reason,
    sourceOccurrence: occurrence,
  });
  const targetRepairV1 = buildRepairMetadata({
    type: repair.type,
    appliedAt,
    sourceOccurrenceId: occurrence.id,
    targetOccurrenceId: targetId,
    reason: repair.reason,
    sourceOccurrence: occurrence,
  });

  const sourcePatch = {
    status: OCCURRENCE_STATUS.RESCHEDULED,
    repairV1: sourceRepairV1,
    updatedAt: appliedAt,
  };
  let targetChanged = false;
  const occurrences = getOccurrences(state).map((current) => {
    if (!current || current.id === occurrence.id) {
      return current && current.id === occurrence.id ? { ...current, ...sourcePatch } : current;
    }
    if (target.targetOccurrence && current.id === target.targetOccurrence.id) {
      targetChanged = true;
      return {
        ...current,
        status: OCCURRENCE_STATUS.PLANNED,
        durationMinutes: target.durationMinutes,
        repairV1: targetRepairV1,
        updatedAt: appliedAt,
      };
    }
    return current;
  });

  let nextOccurrences = occurrences;
  if (!targetChanged) {
    nextOccurrences = [
      ...occurrences,
      buildTargetOccurrence({
        id: targetId,
        sourceOccurrence: occurrence,
        targetDate: target.targetDate,
        targetStart: target.targetStart,
        durationMinutes: target.durationMinutes,
        repairV1: targetRepairV1,
      }),
    ];
  }

  return buildResult({
    ok: true,
    state,
    nextState: cloneStateWithOccurrences(state, nextOccurrences),
    repairSummary: `${repairTypeLabel(repair.type)}: ${target.targetDate} ${target.targetStart}`,
    changedOccurrenceIds: [occurrence.id, targetId],
    warnings: [target.warning].filter(Boolean),
    confirmation: buildConfirmation(
      repair.type,
      occurrence,
      `Recover this block on ${target.targetDate} at ${target.targetStart}.`
    ),
  });
}

export function applyOccurrenceRecoveryRepair({ state, occurrenceId, repair, now } = {}) {
  const normalizedRepair = normalizeRepair(repair);
  if (!SUPPORTED_RECOVERY_REPAIRS.has(normalizedRepair.type)) {
    return buildResult({
      ok: false,
      state,
      warnings: ["recovery_repair_type_unsupported"],
    });
  }

  const validation = validateRecoveryRepairableOccurrence(state, occurrenceId || normalizedRepair.occurrenceId);
  if (!validation.ok) {
    return buildResult({
      ok: false,
      state,
      warnings: validation.warnings,
    });
  }

  if (normalizedRepair.type === PLANNING_REPAIR_TYPE.SKIP_ONCE) {
    return applyStatusRepair({ state, occurrence: validation.occurrence, repair: normalizedRepair, now });
  }

  return applyRecoveryReplacementRepair({
    state,
    occurrence: validation.occurrence,
    repair: normalizedRepair,
    now,
  });
}

export function buildRepairOptions({ state, occurrenceId, selectedDateKey, now } = {}) {
  const validation = validateRepairableOccurrence(state, occurrenceId);
  if (!validation.ok) {
    return buildResult({
      ok: false,
      state,
      warnings: validation.warnings,
      extras: { options: [] },
    });
  }

  const occurrence = validation.occurrence;
  const reducedDuration = computeReducedDuration(occurrence);
  const dateKey = normalizeDateKey(selectedDateKey) || getOccurrenceDate(occurrence);
  const options = [
    {
      type: PLANNING_REPAIR_TYPE.MOVE_LATER_TODAY,
      occurrenceId: occurrence.id,
      dateKey,
      start: resolveLaterTodayStart(occurrence, dateKey, now),
      requiresConfirmation: true,
    },
    {
      type: PLANNING_REPAIR_TYPE.MOVE_TOMORROW,
      occurrenceId: occurrence.id,
      dateKey: addDaysLocal(getOccurrenceDate(occurrence), 1),
      start: getOccurrenceStart(occurrence),
      requiresConfirmation: true,
    },
    {
      type: PLANNING_REPAIR_TYPE.CHOOSE_TIME,
      occurrenceId: occurrence.id,
      dateKey,
      start: getOccurrenceStart(occurrence),
      requiresConfirmation: true,
    },
    {
      type: PLANNING_REPAIR_TYPE.REDUCE_DURATION,
      occurrenceId: occurrence.id,
      durationMinutes: reducedDuration,
      requiresConfirmation: true,
    },
    {
      type: PLANNING_REPAIR_TYPE.SKIP_ONCE,
      occurrenceId: occurrence.id,
      requiresConfirmation: true,
    },
    {
      type: PLANNING_REPAIR_TYPE.CANCEL_ONCE,
      occurrenceId: occurrence.id,
      requiresConfirmation: true,
    },
  ];

  return buildResult({
    ok: true,
    state,
    repairSummary: "Repair options built",
    confirmation: null,
    extras: { options },
  });
}

export function applyOccurrenceRepair({ state, occurrenceId, repair, now } = {}) {
  const normalizedRepair = normalizeRepair(repair);
  if (!SUPPORTED_SINGLE_REPAIRS.has(normalizedRepair.type)) {
    return buildResult({
      ok: false,
      state,
      warnings: [normalizedRepair.type === PLANNING_REPAIR_TYPE.SPLIT_BLOCK ? "split_block_deferred" : "repair_type_unsupported"],
    });
  }

  const validation = validateRepairableOccurrence(state, occurrenceId || normalizedRepair.occurrenceId);
  if (!validation.ok) {
    return buildResult({
      ok: false,
      state,
      warnings: validation.warnings,
    });
  }

  const occurrence = validation.occurrence;
  if (
    normalizedRepair.type === PLANNING_REPAIR_TYPE.MOVE_LATER_TODAY ||
    normalizedRepair.type === PLANNING_REPAIR_TYPE.MOVE_TOMORROW ||
    normalizedRepair.type === PLANNING_REPAIR_TYPE.CHOOSE_TIME
  ) {
    return applyMoveRepair({ state, occurrence, repair: normalizedRepair, now });
  }
  if (normalizedRepair.type === PLANNING_REPAIR_TYPE.REDUCE_DURATION) {
    return applyReduceDurationRepair({ state, occurrence, repair: normalizedRepair, now });
  }
  return applyStatusRepair({ state, occurrence, repair: normalizedRepair, now });
}

function getPriorityRank(goal) {
  const raw = safeString(goal?.priority || goal?.priorityLevel || goal?.priorityTier).toLowerCase();
  if (["bonus", "optional", "someday", "low"].includes(raw)) return 0;
  if (["prioritaire", "primary", "high", "essential"].includes(raw)) return 2;
  return 1;
}

function isFutureSameDayOccurrence(occurrence, selectedDateKey, now) {
  const dateKey = normalizeDateKey(selectedDateKey);
  if (!dateKey || normalizeDateKey(occurrence?.date) !== dateKey) return false;
  const current = safeNow(now);
  const today = toLocalDateKey(current);
  if (dateKey > today) return true;
  if (dateKey < today) return false;
  const startMinutes = parseTimeToMinutes(getOccurrenceStart(occurrence, ""));
  if (!Number.isFinite(startMinutes)) return false;
  const nowMinutes = current.getHours() * 60 + current.getMinutes();
  return startMinutes > nowMinutes;
}

function isReduceLoadCandidate(state, occurrence, selectedDateKey, now) {
  if (!isFutureSameDayOccurrence(occurrence, selectedDateKey, now)) return false;
  const status = getSurfaceStatus(state, occurrence);
  return LOAD_CANDIDATE_STATUSES.has(status.status);
}

function buildLoadRepairForOccurrence(occurrence) {
  const duration = normalizeDurationMinutes(occurrence.durationMinutes, 30);
  if (duration >= 45) {
    return {
      type: PLANNING_REPAIR_TYPE.REDUCE_DURATION,
      occurrenceId: occurrence.id,
      durationMinutes: computeReducedDuration(occurrence),
      reason: PLANNING_REPAIR_TYPE.REDUCE_TODAY_LOAD,
    };
  }
  return {
    type: PLANNING_REPAIR_TYPE.MOVE_TOMORROW,
    occurrenceId: occurrence.id,
    reason: PLANNING_REPAIR_TYPE.REDUCE_TODAY_LOAD,
  };
}

export function buildReduceLoadPlan({ state, selectedDateKey, now } = {}) {
  const dateKey = normalizeDateKey(selectedDateKey) || todayLocalKey();
  const candidates = getOccurrences(state)
    .filter((occurrence) => isReduceLoadCandidate(state, occurrence, dateKey, now))
    .map((occurrence) => ({
      occurrence,
      goal: getGoalById(state, occurrence.goalId),
      startMinutes: parseTimeToMinutes(getOccurrenceStart(occurrence, "")) ?? 0,
      duration: normalizeDurationMinutes(occurrence.durationMinutes, 0) || 0,
    }))
    .sort((left, right) => {
      const priorityDelta = getPriorityRank(left.goal) - getPriorityRank(right.goal);
      if (priorityDelta) return priorityDelta;
      if (right.startMinutes !== left.startMinutes) return right.startMinutes - left.startMinutes;
      if (right.duration !== left.duration) return right.duration - left.duration;
      return safeString(left.occurrence.id).localeCompare(safeString(right.occurrence.id));
    });

  const selected = candidates.slice(0, 3);
  const proposedRepairs = selected.map((entry) => buildLoadRepairForOccurrence(entry.occurrence));
  return buildResult({
    ok: proposedRepairs.length > 0,
    state,
    repairSummary: proposedRepairs.length
      ? `${proposedRepairs.length} load repair${proposedRepairs.length > 1 ? "s" : ""} proposed`
      : "No load repair proposed",
    changedOccurrenceIds: [],
    warnings: proposedRepairs.length ? [] : ["no_reduce_load_candidates"],
    confirmation: proposedRepairs.length
      ? {
          type: PLANNING_REPAIR_TYPE.REDUCE_TODAY_LOAD,
          title: "Reduce today's load",
          message: "Apply only the proposed occurrence repairs after user confirmation.",
          requiresConfirmation: true,
        }
      : null,
    extras: {
      proposedRepairs,
      candidateOccurrenceIds: selected.map((entry) => entry.occurrence.id),
    },
  });
}

export function applyReduceLoadPlan({ state, plan, now } = {}) {
  const proposedRepairs = safeArray(plan?.proposedRepairs);
  if (!proposedRepairs.length) {
    return buildResult({
      ok: false,
      state,
      warnings: ["reduce_load_plan_empty"],
    });
  }

  let working = state;
  const warnings = [];
  const changedOccurrenceIds = [];
  const applied = [];
  for (const repair of proposedRepairs) {
    const occurrenceId = safeString(repair?.occurrenceId);
    const result = applyOccurrenceRepair({ state: working, occurrenceId, repair, now });
    if (!result.ok) {
      warnings.push(...result.warnings);
      continue;
    }
    working = result.nextState;
    changedOccurrenceIds.push(...result.changedOccurrenceIds);
    applied.push({ occurrenceId, type: repair.type });
  }

  return buildResult({
    ok: applied.length > 0,
    state,
    nextState: working,
    repairSummary: `${applied.length} load repair${applied.length > 1 ? "s" : ""} applied`,
    changedOccurrenceIds,
    warnings,
    confirmation: plan?.confirmation || null,
    extras: { applied },
  });
}
