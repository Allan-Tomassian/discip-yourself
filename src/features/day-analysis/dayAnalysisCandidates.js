import {
  EXECUTION_SURFACE_STATUS,
  deriveExecutionStatusForOccurrence,
} from "../../logic/executionStatus";
import {
  PLANNING_REPAIR_TYPE,
  applyOccurrenceRepair,
} from "../../logic/planningRepairModel";
import { parseTimeToMinutes, toLocalDateKey } from "../../utils/datetime";
import { buildRecoveryContext } from "../recovery/recoverySheetModel";
import { RECOVERY_CONTEXT } from "../recovery/recoveryTypes";
import {
  DAY_ANALYSIS_ACTION_TYPE,
  DAY_ANALYSIS_DETERMINISTIC_KIND,
  DAY_ANALYSIS_SUPPORT_STATUS,
  DAY_ANALYSIS_TARGET_TYPE,
} from "./dayAnalysisTypes";

export const MAX_DAY_ANALYSIS_CANDIDATES = 8;

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function safeString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeNow(now) {
  const date = now instanceof Date ? now : new Date(now || Date.now());
  return Number.isNaN(date.getTime()) ? new Date() : date;
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
  return Number.isFinite(duration) && duration > 0 ? duration : 0;
}

function getActionIdForOccurrence(occurrence) {
  return (
    safeString(occurrence?.actionId) ||
    safeString(occurrence?.goalId) ||
    safeString(occurrence?.taskId)
  );
}

function indexById(items) {
  return new Map(
    safeArray(items)
      .filter((item) => item && item.id)
      .map((item) => [String(item.id), item]),
  );
}

function findPrimaryActionId(todayData) {
  return (
    safeString(todayData?.primaryAction?.actionId) ||
    safeString(todayData?.primaryAction?.goalId) ||
    ""
  );
}

function isPlannedOccurrenceLate({ occurrence, action, now, selectedDateKey }) {
  const dateKey = getOccurrenceDateKey(occurrence);
  if (!dateKey || dateKey !== selectedDateKey || selectedDateKey !== toLocalDateKey(now)) {
    return false;
  }

  const startMinutes = parseTimeToMinutes(getOccurrenceStart(occurrence));
  if (startMinutes == null) return false;

  const duration = getOccurrenceDuration(occurrence, action) || 30;
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  return startMinutes + duration < nowMinutes;
}

function deriveRecoveryContext({ occurrence, action, derivedStatus, now, selectedDateKey }) {
  if (derivedStatus === EXECUTION_SURFACE_STATUS.MISSED) return RECOVERY_CONTEXT.MISSED;
  if (derivedStatus === EXECUTION_SURFACE_STATUS.BLOCKED) return RECOVERY_CONTEXT.BLOCKED;
  if (derivedStatus === EXECUTION_SURFACE_STATUS.REPORTED) return RECOVERY_CONTEXT.REPORTED;
  if (derivedStatus === EXECUTION_SURFACE_STATUS.POSTPONED) return RECOVERY_CONTEXT.POSTPONED;
  if (
    derivedStatus === EXECUTION_SURFACE_STATUS.PLANNED &&
    isPlannedOccurrenceLate({ occurrence, action, now, selectedDateKey })
  ) {
    return RECOVERY_CONTEXT.LATE;
  }
  return null;
}

function buildRecoveryCandidate({ state, occurrence, action, context, statusResult, now, selectedDateKey }) {
  const model = buildRecoveryContext({
    state,
    occurrenceId: occurrence.id,
    context,
    now,
    selectedDateKey,
  });

  const enabledOptions = safeArray(model?.options).filter((option) => !option.disabled);
  if (!model?.ok || enabledOptions.length === 0) return null;

  const optionSummary = enabledOptions.slice(0, 4).map((option) => ({
    id: option.id,
    type: option.type,
    label: option.label,
    description: option.description,
  }));

  return {
    id: `recover_block:${context}:${occurrence.id}`,
    type: DAY_ANALYSIS_ACTION_TYPE.RECOVER_BLOCK,
    label: "Récupérer ce bloc",
    description:
      model.problem?.description ||
      "Ouvre les options de récupération pour reprendre sans refaire toute la journée.",
    targetType: DAY_ANALYSIS_TARGET_TYPE.OCCURRENCE,
    targetId: occurrence.id,
    supportStatus: DAY_ANALYSIS_SUPPORT_STATUS.RECOVERY_SHEET,
    confirmationRequired: true,
    deterministicAction: {
      kind: DAY_ANALYSIS_DETERMINISTIC_KIND.RECOVERY,
      occurrenceId: occurrence.id,
      context,
      optionIds: optionSummary.map((option) => option.id),
      optionTypes: optionSummary.map((option) => option.type),
    },
    preview: {
      summary:
        model.problem?.title ||
        `Bloc ${action?.title || occurrence.title || "à récupérer"}`,
      optionCount: enabledOptions.length,
      options: optionSummary,
    },
    evidence: [
      {
        type: "execution_status",
        status: statusResult.status,
        source: statusResult.source || null,
        reason: statusResult.reason || null,
        historyId: statusResult.historyId || null,
      },
    ],
  };
}

function buildReduceRepairCandidate({ state, occurrence, action }) {
  const duration = getOccurrenceDuration(occurrence, action);
  if (duration < 30) return null;

  const result = applyOccurrenceRepair({
    state,
    occurrenceId: occurrence.id,
    repair: {
      type: PLANNING_REPAIR_TYPE.REDUCE_DURATION,
      occurrenceId: occurrence.id,
      reason: "day_analysis_reduce_duration",
    },
  });

  if (!result?.ok) return null;

  const nextOccurrence = safeArray(result.nextState?.occurrences).find(
    (candidate) => candidate?.id === occurrence.id,
  );
  const nextDuration = getOccurrenceDuration(nextOccurrence || occurrence, action);

  return {
    id: `reduce_duration:${occurrence.id}`,
    type: DAY_ANALYSIS_ACTION_TYPE.REDUCE_DURATION,
    label: nextDuration ? `Réduire à ${nextDuration} min` : "Réduire le bloc",
    description: "Allège le prochain bloc sans changer l’objectif.",
    targetType: DAY_ANALYSIS_TARGET_TYPE.OCCURRENCE,
    targetId: occurrence.id,
    supportStatus: DAY_ANALYSIS_SUPPORT_STATUS.APPLICABLE,
    confirmationRequired: true,
    deterministicAction: {
      kind: DAY_ANALYSIS_DETERMINISTIC_KIND.PLANNING_REPAIR,
      occurrenceId: occurrence.id,
      repair: {
        type: PLANNING_REPAIR_TYPE.REDUCE_DURATION,
        occurrenceId: occurrence.id,
        durationMinutes: nextDuration,
        reason: "day_analysis_reduce_duration",
      },
    },
    preview: {
      summary: `Durée actuelle : ${duration} min. Nouvelle durée : ${nextDuration || "réduite"}.`,
      before: { durationMinutes: duration },
      after: { durationMinutes: nextDuration || null },
    },
    evidence: [{ type: "duration", durationMinutes: duration }],
  };
}

function buildSimplifyNextActionCandidate({ occurrence, action, reduceCandidate }) {
  if (!reduceCandidate) return null;
  return {
    id: `simplify_next_action:${occurrence.id}`,
    type: DAY_ANALYSIS_ACTION_TYPE.SIMPLIFY_NEXT_ACTION,
    label: "Simplifier le prochain bloc",
    description: "Garde le même cap et transforme le bloc en version plus courte.",
    targetType: DAY_ANALYSIS_TARGET_TYPE.OCCURRENCE,
    targetId: occurrence.id,
    supportStatus: DAY_ANALYSIS_SUPPORT_STATUS.APPLICABLE,
    confirmationRequired: true,
    deterministicAction: reduceCandidate.deterministicAction,
    preview: {
      ...reduceCandidate.preview,
      summary: `Bloc simplifié : ${action?.title || occurrence.title || "prochaine action"}.`,
    },
    evidence: reduceCandidate.evidence,
  };
}

function buildMoveRepairCandidate({ state, occurrence, action, selectedDateKey, type, now }) {
  if (
    type !== PLANNING_REPAIR_TYPE.MOVE_LATER_TODAY &&
    type !== PLANNING_REPAIR_TYPE.MOVE_TOMORROW
  ) {
    return null;
  }

  const result = applyOccurrenceRepair({
    state,
    occurrenceId: occurrence.id,
    repair: {
      type,
      occurrenceId: occurrence.id,
      selectedDateKey,
      reason: `day_analysis_${type}`,
    },
    now,
  });

  if (!result?.ok) return null;

  const changedIds = Array.isArray(result.changedOccurrenceIds) ? result.changedOccurrenceIds : [];
  const targetId = changedIds.find((id) => id && id !== occurrence.id) || occurrence.id;
  const targetOccurrence = safeArray(result.nextState?.occurrences).find(
    (candidate) => candidate?.id === targetId,
  );
  if (!targetOccurrence) return null;

  const isTomorrow = type === PLANNING_REPAIR_TYPE.MOVE_TOMORROW;
  return {
    id: `${type}:${occurrence.id}`,
    type: isTomorrow
      ? DAY_ANALYSIS_ACTION_TYPE.MOVE_TOMORROW
      : DAY_ANALYSIS_ACTION_TYPE.MOVE_LATER_TODAY,
    label: isTomorrow ? "Déplacer demain" : "Reporter ce soir",
    description: isTomorrow
      ? "Garde le même bloc et le replace demain."
      : "Garde le même bloc et le replace plus tard aujourd’hui.",
    targetType: DAY_ANALYSIS_TARGET_TYPE.OCCURRENCE,
    targetId: occurrence.id,
    supportStatus: DAY_ANALYSIS_SUPPORT_STATUS.APPLICABLE,
    confirmationRequired: true,
    deterministicAction: {
      kind: DAY_ANALYSIS_DETERMINISTIC_KIND.PLANNING_REPAIR,
      occurrenceId: occurrence.id,
      repair: {
        type,
        occurrenceId: occurrence.id,
        dateKey: targetOccurrence.date,
        start: targetOccurrence.start || targetOccurrence.slotKey,
        durationMinutes: targetOccurrence.durationMinutes,
        selectedDateKey,
        reason: `day_analysis_${type}`,
      },
    },
    preview: {
      summary: isTomorrow
        ? `Déplace le bloc au ${targetOccurrence.date} à ${targetOccurrence.start || targetOccurrence.slotKey}.`
        : `Déplace le bloc aujourd’hui à ${targetOccurrence.start || targetOccurrence.slotKey}.`,
      targetTitle: action?.title || occurrence.title || "",
      before: {
        summary: `${occurrence.date || selectedDateKey} ${occurrence.start || occurrence.slotKey || ""}`.trim(),
        start: occurrence.start || occurrence.slotKey || "",
      },
      after: {
        summary: `${targetOccurrence.date} ${targetOccurrence.start || targetOccurrence.slotKey || ""}`.trim(),
        start: targetOccurrence.start || targetOccurrence.slotKey || "",
      },
    },
    evidence: [{ type: "timing", dayKey: selectedDateKey }],
  };
}

function buildAddShortBlockCandidate({ primaryGoal, selectedDateKey }) {
  return {
    id: `add_short_block:${primaryGoal?.id || selectedDateKey}`,
    type: DAY_ANALYSIS_ACTION_TYPE.ADD_SHORT_BLOCK,
    label: "Préparer un bloc court",
    description: "Propose un bloc de 15 minutes à valider dans Planning ou avec le Coach.",
    targetType: primaryGoal?.id
      ? DAY_ANALYSIS_TARGET_TYPE.OBJECTIVE
      : DAY_ANALYSIS_TARGET_TYPE.DAY,
    targetId: primaryGoal?.id || selectedDateKey,
    supportStatus: DAY_ANALYSIS_SUPPORT_STATUS.REVIEW_ONLY,
    confirmationRequired: true,
    deterministicAction: {
      kind: DAY_ANALYSIS_DETERMINISTIC_KIND.REVIEW_ONLY,
      reviewOnly: true,
      dayKey: selectedDateKey,
      objectiveId: primaryGoal?.id || null,
      suggestedDurationMinutes: 15,
    },
    preview: {
      summary: primaryGoal?.title
        ? `Créer une proposition courte pour : ${primaryGoal.title}.`
        : "Créer une proposition courte pour aujourd’hui.",
      durationMinutes: 15,
    },
    evidence: [{ type: "empty_day", dayKey: selectedDateKey }],
  };
}

function buildOpenPlanningCandidate(selectedDateKey) {
  return {
    id: `open_planning:${selectedDateKey}`,
    type: DAY_ANALYSIS_ACTION_TYPE.OPEN_PLANNING,
    label: "Ouvrir Planning",
    description: "Voir la journée et choisir l’ajustement manuellement.",
    targetType: DAY_ANALYSIS_TARGET_TYPE.PLANNING,
    targetId: selectedDateKey,
    supportStatus: DAY_ANALYSIS_SUPPORT_STATUS.NAVIGATION_ONLY,
    confirmationRequired: false,
    deterministicAction: {
      kind: DAY_ANALYSIS_DETERMINISTIC_KIND.NAVIGATION,
      route: "planning",
      dayKey: selectedDateKey,
    },
    preview: { summary: "Aucune modification automatique." },
    evidence: [],
  };
}

function buildNoChangeCandidate(selectedDateKey) {
  return {
    id: `no_change:${selectedDateKey}`,
    type: DAY_ANALYSIS_ACTION_TYPE.NO_CHANGE,
    label: "Garder la journée validée",
    description: "Aucun ajustement nécessaire pour aujourd’hui.",
    targetType: DAY_ANALYSIS_TARGET_TYPE.DAY,
    targetId: selectedDateKey,
    supportStatus: DAY_ANALYSIS_SUPPORT_STATUS.NO_CHANGE,
    confirmationRequired: false,
    deterministicAction: {
      kind: DAY_ANALYSIS_DETERMINISTIC_KIND.NO_CHANGE,
      dayKey: selectedDateKey,
    },
    preview: { summary: "La journée est déjà cohérente." },
    evidence: [{ type: "completed_day", dayKey: selectedDateKey }],
  };
}

function removeDuplicateCandidates(candidates) {
  const seen = new Set();
  return candidates.filter((candidate) => {
    if (!candidate?.id || seen.has(candidate.id)) return false;
    seen.add(candidate.id);
    return true;
  });
}

function candidateTargetsExistingData(candidate, { occurrencesById, goalsById }) {
  if (candidate.targetType === DAY_ANALYSIS_TARGET_TYPE.OCCURRENCE) {
    return occurrencesById.has(candidate.targetId);
  }
  if (
    candidate.targetType === DAY_ANALYSIS_TARGET_TYPE.ACTION ||
    candidate.targetType === DAY_ANALYSIS_TARGET_TYPE.OBJECTIVE
  ) {
    return goalsById.has(candidate.targetId);
  }
  return true;
}

export function buildDayAnalysisCandidates({
  state,
  todayData,
  now,
  selectedDateKey,
  primaryGoal = null,
} = {}) {
  const safeState = state && typeof state === "object" ? state : {};
  const date = normalizeNow(now);
  const dayKey = selectedDateKey || toLocalDateKey(date);
  const goalsById = indexById(safeState.goals);
  const occurrences = safeArray(safeState.occurrences).filter(
    (occurrence) => getOccurrenceDateKey(occurrence) === dayKey,
  );
  const occurrencesById = indexById(occurrences);
  const activeSession = safeState.ui?.activeSession || safeState.activeSession || null;
  const primaryActionId = findPrimaryActionId(todayData);
  const candidates = [];

  for (const occurrence of occurrences) {
    const actionId = getActionIdForOccurrence(occurrence);
    const action = goalsById.get(actionId) || null;
    const statusResult = deriveExecutionStatusForOccurrence(occurrence, {
      sessionHistory: safeState.sessionHistory,
      activeSession,
      dateKey: getOccurrenceDateKey(occurrence),
    });
    const context = deriveRecoveryContext({
      occurrence,
      action,
      derivedStatus: statusResult.status,
      now: date,
      selectedDateKey: dayKey,
    });

    if (context) {
      const recoveryCandidate = buildRecoveryCandidate({
        state: safeState,
        occurrence,
        action,
        context,
        statusResult,
        now: date,
        selectedDateKey: dayKey,
      });
      if (recoveryCandidate) candidates.push(recoveryCandidate);
      continue;
    }

    if (
      statusResult.status === EXECUTION_SURFACE_STATUS.PLANNED &&
      (!primaryActionId || actionId === primaryActionId)
    ) {
      const reduceCandidate = buildReduceRepairCandidate({
        state: safeState,
        occurrence,
        action,
      });
      if (reduceCandidate) {
        candidates.push(reduceCandidate);
        const simplifyCandidate = buildSimplifyNextActionCandidate({
          occurrence,
          action,
          reduceCandidate,
        });
        if (simplifyCandidate) candidates.push(simplifyCandidate);
      }
      const moveLaterCandidate = buildMoveRepairCandidate({
        state: safeState,
        occurrence,
        action,
        selectedDateKey: dayKey,
        type: PLANNING_REPAIR_TYPE.MOVE_LATER_TODAY,
        now: date,
      });
      if (moveLaterCandidate) candidates.push(moveLaterCandidate);
      const moveTomorrowCandidate = buildMoveRepairCandidate({
        state: safeState,
        occurrence,
        action,
        selectedDateKey: dayKey,
        type: PLANNING_REPAIR_TYPE.MOVE_TOMORROW,
        now: date,
      });
      if (moveTomorrowCandidate) candidates.push(moveTomorrowCandidate);
    }
  }

  const hasExecutableOccurrence = occurrences.some((occurrence) => {
    const statusResult = deriveExecutionStatusForOccurrence(occurrence, {
      sessionHistory: safeState.sessionHistory,
      activeSession,
      dateKey: getOccurrenceDateKey(occurrence),
    });
    return [
      EXECUTION_SURFACE_STATUS.PLANNED,
      EXECUTION_SURFACE_STATUS.ACTIVE,
      EXECUTION_SURFACE_STATUS.DONE,
    ].includes(statusResult.status);
  });

  const allOccurrencesDone =
    occurrences.length > 0 &&
    occurrences.every((occurrence) => {
      const statusResult = deriveExecutionStatusForOccurrence(occurrence, {
        sessionHistory: safeState.sessionHistory,
        activeSession,
        dateKey: getOccurrenceDateKey(occurrence),
      });
      return statusResult.status === EXECUTION_SURFACE_STATUS.DONE;
    });

  if (allOccurrencesDone) {
    candidates.push(buildNoChangeCandidate(dayKey));
  } else if (occurrences.length === 0 || !hasExecutableOccurrence) {
    candidates.push(
      buildAddShortBlockCandidate({
        primaryGoal,
        selectedDateKey: dayKey,
      }),
    );
  }

  if (candidates.length === 0) {
    candidates.push(buildOpenPlanningCandidate(dayKey));
  }

  return removeDuplicateCandidates(candidates)
    .filter((candidate) => candidateTargetsExistingData(candidate, { occurrencesById, goalsById }))
    .slice(0, MAX_DAY_ANALYSIS_CANDIDATES);
}
