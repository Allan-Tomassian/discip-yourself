import {
  EXECUTION_SURFACE_STATUS,
  deriveExecutionStatusForOccurrence,
} from "../../logic/executionStatus";
import { OCCURRENCE_STATUS, normalizeOccurrenceStatus } from "../../logic/occurrenceStatus";
import {
  PLANNING_REPAIR_TYPE,
  applyOccurrenceRecoveryRepair,
} from "../../logic/planningRepairModel";
import {
  addDaysLocal,
  normalizeLocalDateKey,
  parseTimeToMinutes,
  toLocalDateKey,
} from "../../utils/datetime";
import {
  RECOVERY_CONTEXT,
  RECOVERY_OPTION_REASON,
  RECOVERY_OPTION_TYPE,
} from "./recoveryTypes";

const MAX_RECOVERY_OPTIONS = 4;
const RECOVERY_CONTEXTS = new Set(Object.values(RECOVERY_CONTEXT));
const EVENING_START_MINUTES = 17 * 60;
const TODAY_RECOVERY_CUTOFF_MINUTES = (21 * 60) + 30;

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function safeString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function safeNow(value) {
  return value instanceof Date && !Number.isNaN(value.getTime()) ? value : new Date();
}

function normalizeDateKey(value) {
  return normalizeLocalDateKey(value) || "";
}

function getOccurrences(state) {
  return safeArray(state?.occurrences);
}

function getOccurrenceById(state, occurrenceId) {
  const id = safeString(occurrenceId);
  if (!id) return null;
  return getOccurrences(state).find((occurrence) => occurrence?.id === id) || null;
}

function getActiveSession(state) {
  return state?.ui?.activeSession && typeof state.ui.activeSession === "object" ? state.ui.activeSession : null;
}

function deriveSurfaceStatus(state, occurrence) {
  return deriveExecutionStatusForOccurrence(occurrence, {
    activeSession: getActiveSession(state),
    sessionHistory: state?.sessionHistory,
    dateKey: occurrence?.date,
  });
}

function normalizeContext(value) {
  const context = safeString(value).toLowerCase();
  return RECOVERY_CONTEXTS.has(context) ? context : "";
}

function getOccurrenceStart(occurrence) {
  return safeString(occurrence?.start) || safeString(occurrence?.slotKey) || "09:00";
}

function getOccurrenceDuration(occurrence, fallback = 30) {
  const raw = Number(occurrence?.durationMinutes);
  return Number.isFinite(raw) && raw > 0 ? Math.round(raw) : fallback;
}

function computeReducedDuration(occurrence) {
  const current = getOccurrenceDuration(occurrence, 30);
  if (current <= 10) return current;
  const halved = Math.round((current / 2) / 5) * 5;
  return Math.max(10, Math.min(current - 5, halved || 10));
}

function nowMinutes(now) {
  const current = safeNow(now);
  return (current.getHours() * 60) + current.getMinutes();
}

function isOccurrenceLate(occurrence, now, selectedDateKey) {
  if (normalizeOccurrenceStatus(occurrence?.status) !== OCCURRENCE_STATUS.PLANNED) return false;
  const current = safeNow(now);
  const dateKey = normalizeDateKey(selectedDateKey) || normalizeDateKey(occurrence?.date);
  if (!dateKey || dateKey !== toLocalDateKey(current)) return false;
  const startMinutes = parseTimeToMinutes(getOccurrenceStart(occurrence));
  if (!Number.isFinite(startMinutes)) return false;
  const endMinutes = startMinutes + getOccurrenceDuration(occurrence, 0);
  return endMinutes > 0 ? endMinutes < nowMinutes(current) : startMinutes < nowMinutes(current);
}

function canRecoverLaterToday({ occurrence, now, selectedDateKey }) {
  const current = safeNow(now);
  const dateKey = normalizeDateKey(selectedDateKey) || normalizeDateKey(occurrence?.date);
  if (dateKey !== toLocalDateKey(current)) return false;
  return nowMinutes(current) < TODAY_RECOVERY_CUTOFF_MINUTES;
}

function deriveContext({ state, occurrence, requestedContext, now, selectedDateKey }) {
  const normalizedRequested = normalizeContext(requestedContext);
  if (normalizedRequested) return normalizedRequested;

  const surface = deriveSurfaceStatus(state, occurrence);
  if (surface.status === EXECUTION_SURFACE_STATUS.MISSED) return RECOVERY_CONTEXT.MISSED;
  if (surface.status === EXECUTION_SURFACE_STATUS.BLOCKED) return RECOVERY_CONTEXT.BLOCKED;
  if (surface.status === EXECUTION_SURFACE_STATUS.REPORTED) return RECOVERY_CONTEXT.REPORTED;
  if (surface.status === EXECUTION_SURFACE_STATUS.POSTPONED) return RECOVERY_CONTEXT.POSTPONED;
  if (isOccurrenceLate(occurrence, now, selectedDateKey)) return RECOVERY_CONTEXT.LATE;
  return "";
}

function resolvePostponedTarget(state, occurrence) {
  const targetId = safeString(occurrence?.repairV1?.targetOccurrenceId);
  const target = targetId ? getOccurrenceById(state, targetId) : null;
  if (target && normalizeOccurrenceStatus(target.status) === OCCURRENCE_STATUS.PLANNED) {
    return { target, warnings: [] };
  }
  return { target: null, warnings: ["postponed_target_unavailable"] };
}

function resolveRecoveryOccurrence({ state, occurrenceId, context, now, selectedDateKey }) {
  const sourceOccurrence = getOccurrenceById(state, occurrenceId);
  if (!sourceOccurrence) {
    return {
      ok: false,
      context: normalizeContext(context),
      occurrence: null,
      sourceOccurrence: null,
      warnings: ["occurrence_missing"],
      issues: [],
    };
  }

  const resolvedContext = deriveContext({
    state,
    occurrence: sourceOccurrence,
    requestedContext: context,
    now,
    selectedDateKey,
  });
  const surface = deriveSurfaceStatus(state, sourceOccurrence);
  const issues = safeArray(surface.issues);

  if (!resolvedContext) {
    return {
      ok: false,
      context: "",
      occurrence: sourceOccurrence,
      sourceOccurrence,
      warnings: ["context_not_recoverable"],
      issues,
    };
  }

  if (resolvedContext === RECOVERY_CONTEXT.POSTPONED) {
    const { target, warnings } = resolvePostponedTarget(state, sourceOccurrence);
    return {
      ok: true,
      context: resolvedContext,
      occurrence: target || sourceOccurrence,
      sourceOccurrence,
      warnings,
      issues,
      targetAvailable: Boolean(target),
    };
  }

  return {
    ok: true,
    context: resolvedContext,
    occurrence: sourceOccurrence,
    sourceOccurrence,
    warnings: [],
    issues,
    targetAvailable: true,
  };
}

function buildProblem({ context, occurrence, sourceOccurrence }) {
  const occurrenceId = safeString(occurrence?.id);
  const sourceOccurrenceId = safeString(sourceOccurrence?.id) || occurrenceId;
  const copy = {
    [RECOVERY_CONTEXT.MISSED]: {
      title: "Ce bloc n’a pas été lancé.",
      description: "Tu peux le récupérer sans refaire toute la journée.",
    },
    [RECOVERY_CONTEXT.LATE]: {
      title: "Ce bloc est en retard.",
      description: "Choisis une version courte ou un nouvel horaire.",
    },
    [RECOVERY_CONTEXT.BLOCKED]: {
      title: "Ce bloc a été interrompu.",
      description: "Tu peux repartir avec une version plus simple.",
    },
    [RECOVERY_CONTEXT.REPORTED]: {
      title: "Ce bloc a été signalé.",
      description: "Replace-le dans un créneau clair.",
    },
    [RECOVERY_CONTEXT.POSTPONED]: {
      title: "Ce bloc a été déplacé.",
      description: "Vérifie le créneau ou choisis une option plus simple.",
    },
  }[context] || {
    title: "Bloc à récupérer.",
    description: "Choisis une correction simple.",
  };

  return {
    context,
    occurrenceId,
    sourceOccurrenceId,
    title: copy.title,
    description: copy.description,
  };
}

function formatTime(value) {
  return safeString(value) || "--:--";
}

function formatDate(value) {
  return normalizeDateKey(value) || "";
}

function getPreviewTarget(previewResult, sourceOccurrenceId) {
  const changedIds = safeArray(previewResult?.changedOccurrenceIds);
  const targetId = changedIds.find((id) => id && id !== sourceOccurrenceId) || sourceOccurrenceId;
  return getOccurrenceById(previewResult?.nextState, targetId);
}

function buildPreviewSummary(type, target) {
  if (!target) return "";
  const duration = getOccurrenceDuration(target, 0);
  const dateKey = formatDate(target.date);
  const start = formatTime(target.start || target.slotKey);
  if (type === RECOVERY_OPTION_TYPE.SKIP_ONCE) return "Marque ce bloc comme passé pour cette fois.";
  if (type === RECOVERY_OPTION_TYPE.REDUCE_DURATION) {
    return `Crée une version de ${duration} min le ${dateKey} à ${start}.`;
  }
  if (type === RECOVERY_OPTION_TYPE.MOVE_TOMORROW) {
    return `Déplace ce bloc le ${dateKey} à ${start}.`;
  }
  if (type === RECOVERY_OPTION_TYPE.MOVE_LATER_TODAY) {
    return `Déplace ce bloc aujourd’hui à ${start}.`;
  }
  return `Déplace ce bloc le ${dateKey} à ${start}.`;
}

function buildRepairOption({
  state,
  occurrence,
  type,
  repair,
  now,
  label,
  description,
  confirmationRequired = true,
  destructive = false,
  reason,
}) {
  const previewResult = applyOccurrenceRecoveryRepair({
    state,
    occurrenceId: occurrence?.id,
    repair,
    now,
  });
  if (!previewResult.ok) return null;

  const target = getPreviewTarget(previewResult, occurrence.id);
  const previewSummary = buildPreviewSummary(type, target);
  return {
    id: `${type}:${occurrence.id}`,
    type,
    label,
    description,
    confirmationRequired,
    destructive,
    disabled: false,
    reason,
    occurrenceId: occurrence.id,
    preview: {
      occurrenceId: occurrence.id,
      repair,
      summary: previewSummary,
      changedOccurrenceIds: previewResult.changedOccurrenceIds,
      warnings: previewResult.warnings,
      targetDateKey: formatDate(target?.date),
      targetStart: formatTime(target?.start || target?.slotKey),
      targetDurationMinutes: getOccurrenceDuration(target, 0),
    },
  };
}

function buildReduceOption({ state, occurrence, now, selectedDateKey }) {
  const repair = {
    type: PLANNING_REPAIR_TYPE.REDUCE_DURATION,
    occurrenceId: occurrence.id,
    selectedDateKey,
    reason: RECOVERY_OPTION_REASON.REDUCE_DURATION,
  };
  const preview = applyOccurrenceRecoveryRepair({ state, occurrenceId: occurrence.id, repair, now });
  if (!preview.ok) return null;
  const target = getPreviewTarget(preview, occurrence.id);
  const duration = getOccurrenceDuration(target, computeReducedDuration(occurrence));
  return buildRepairOption({
    state,
    occurrence,
    type: RECOVERY_OPTION_TYPE.REDUCE_DURATION,
    repair,
    now,
    label: `Réduire à ${duration} min`,
    description: `Crée une version de ${duration} min à ${formatTime(target?.start || target?.slotKey)}.`,
    reason: RECOVERY_OPTION_REASON.REDUCE_DURATION,
  });
}

function buildMoveLaterOption({ state, occurrence, now, selectedDateKey }) {
  const repair = {
    type: PLANNING_REPAIR_TYPE.MOVE_LATER_TODAY,
    occurrenceId: occurrence.id,
    selectedDateKey,
    reason: RECOVERY_OPTION_REASON.MOVE_LATER_TODAY,
  };
  const preview = applyOccurrenceRecoveryRepair({ state, occurrenceId: occurrence.id, repair, now });
  if (!preview.ok) return null;
  const target = getPreviewTarget(preview, occurrence.id);
  const start = formatTime(target?.start || target?.slotKey);
  const startMinutes = parseTimeToMinutes(start);
  const label = Number.isFinite(startMinutes) && startMinutes >= EVENING_START_MINUTES
    ? "Reporter ce soir"
    : `Reporter à ${start}`;
  return buildRepairOption({
    state,
    occurrence,
    type: RECOVERY_OPTION_TYPE.MOVE_LATER_TODAY,
    repair,
    now,
    label,
    description: `Déplace ce bloc aujourd’hui à ${start}.`,
    reason: RECOVERY_OPTION_REASON.MOVE_LATER_TODAY,
  });
}

function buildMoveTomorrowOption({ state, occurrence, now }) {
  const repair = {
    type: PLANNING_REPAIR_TYPE.MOVE_TOMORROW,
    occurrenceId: occurrence.id,
    reason: RECOVERY_OPTION_REASON.MOVE_TOMORROW,
  };
  const preview = applyOccurrenceRecoveryRepair({ state, occurrenceId: occurrence.id, repair, now });
  if (!preview.ok) return null;
  const target = getPreviewTarget(preview, occurrence.id);
  return buildRepairOption({
    state,
    occurrence,
    type: RECOVERY_OPTION_TYPE.MOVE_TOMORROW,
    repair,
    now,
    label: "Déplacer demain",
    description: `Déplace ce bloc demain à ${formatTime(target?.start || target?.slotKey)}.`,
    reason: RECOVERY_OPTION_REASON.MOVE_TOMORROW,
  });
}

function buildSkipOption({ state, occurrence, now }) {
  const repair = {
    type: PLANNING_REPAIR_TYPE.SKIP_ONCE,
    occurrenceId: occurrence.id,
    reason: RECOVERY_OPTION_REASON.SKIP_ONCE,
  };
  return buildRepairOption({
    state,
    occurrence,
    type: RECOVERY_OPTION_TYPE.SKIP_ONCE,
    repair,
    now,
    label: "Passer cette fois",
    description: "Marque seulement ce bloc comme passé. Rien n’est supprimé.",
    confirmationRequired: true,
    destructive: true,
    reason: RECOVERY_OPTION_REASON.SKIP_ONCE,
  });
}

function buildChooseTimeOption(occurrence) {
  return {
    id: `${RECOVERY_OPTION_TYPE.CHOOSE_TIME}:${occurrence.id}`,
    type: RECOVERY_OPTION_TYPE.CHOOSE_TIME,
    label: "Choisir une heure",
    description: "Sélectionner un créneau précis avant de déplacer ce bloc.",
    confirmationRequired: true,
    destructive: false,
    disabled: false,
    reason: RECOVERY_OPTION_REASON.CHOOSE_TIME,
    occurrenceId: occurrence.id,
    preview: {
      occurrenceId: occurrence.id,
      requiresInput: true,
      repair: {
        type: PLANNING_REPAIR_TYPE.CHOOSE_TIME,
        occurrenceId: occurrence.id,
        dateKey: normalizeDateKey(occurrence.date),
        reason: RECOVERY_OPTION_REASON.CHOOSE_TIME,
      },
      summary: "Aucun changement sans horaire validé.",
    },
  };
}

function buildCoachOption(occurrence) {
  return {
    id: `${RECOVERY_OPTION_TYPE.OPEN_COACH_FOR_HELP}:${safeString(occurrence?.id) || "unknown"}`,
    type: RECOVERY_OPTION_TYPE.OPEN_COACH_FOR_HELP,
    label: "Demander au Coach IA",
    description: "Obtenir de l’aide sans appliquer de changement automatique.",
    confirmationRequired: false,
    destructive: false,
    disabled: false,
    reason: RECOVERY_OPTION_REASON.OPEN_COACH_FOR_HELP,
    occurrenceId: safeString(occurrence?.id),
    preview: {
      occurrenceId: safeString(occurrence?.id),
      navigationTarget: "coach",
      summary: "Ouvre le Coach IA sans modifier le bloc.",
    },
  };
}

function buildPlanningOption(occurrence) {
  return {
    id: `${RECOVERY_OPTION_TYPE.OPEN_PLANNING_DETAIL}:${safeString(occurrence?.id) || "unknown"}`,
    type: RECOVERY_OPTION_TYPE.OPEN_PLANNING_DETAIL,
    label: "Ouvrir Planning",
    description: "Voir le bloc dans le planning avant de changer l’horaire.",
    confirmationRequired: false,
    destructive: false,
    disabled: false,
    reason: RECOVERY_OPTION_REASON.OPEN_PLANNING_DETAIL,
    occurrenceId: safeString(occurrence?.id),
    preview: {
      occurrenceId: safeString(occurrence?.id),
      navigationTarget: "planning",
      dateKey: normalizeDateKey(occurrence?.date),
      summary: "Ouvre Planning sans modifier le bloc.",
    },
  };
}

function compactOptions(options) {
  const seen = new Set();
  return safeArray(options)
    .filter(Boolean)
    .filter((option) => {
      const key = safeString(option?.type);
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, MAX_RECOVERY_OPTIONS);
}

function buildOptionsForContext({ state, occurrence, context, now, selectedDateKey, targetAvailable }) {
  const canUseToday = canRecoverLaterToday({ occurrence, now, selectedDateKey });
  if (context === RECOVERY_CONTEXT.LATE) {
    return compactOptions([
      buildReduceOption({ state, occurrence, now, selectedDateKey }),
      canUseToday ? buildMoveLaterOption({ state, occurrence, now, selectedDateKey }) : null,
      buildMoveTomorrowOption({ state, occurrence, now }),
      buildPlanningOption(occurrence),
    ]);
  }
  if (context === RECOVERY_CONTEXT.MISSED) {
    return compactOptions([
      canUseToday ? buildMoveLaterOption({ state, occurrence, now, selectedDateKey }) : null,
      buildMoveTomorrowOption({ state, occurrence, now }),
      buildSkipOption({ state, occurrence, now }),
      buildPlanningOption(occurrence),
    ]);
  }
  if (context === RECOVERY_CONTEXT.BLOCKED) {
    return compactOptions([
      buildReduceOption({ state, occurrence, now, selectedDateKey }),
      buildChooseTimeOption(occurrence),
      buildCoachOption(occurrence),
      buildSkipOption({ state, occurrence, now }),
    ]);
  }
  if (context === RECOVERY_CONTEXT.REPORTED) {
    return compactOptions([
      canUseToday ? buildMoveLaterOption({ state, occurrence, now, selectedDateKey }) : null,
      buildMoveTomorrowOption({ state, occurrence, now }),
      buildChooseTimeOption(occurrence),
      buildCoachOption(occurrence),
    ]);
  }
  if (context === RECOVERY_CONTEXT.POSTPONED) {
    if (!targetAvailable) {
      return compactOptions([
        buildPlanningOption(occurrence),
        buildCoachOption(occurrence),
      ]);
    }
    return compactOptions([
      canUseToday ? buildMoveLaterOption({ state, occurrence, now, selectedDateKey }) : null,
      buildMoveTomorrowOption({ state, occurrence, now }),
      buildChooseTimeOption(occurrence),
      buildPlanningOption(occurrence),
    ]);
  }
  return compactOptions([buildPlanningOption(occurrence), buildCoachOption(occurrence)]);
}

export function buildRecoveryOptions({ state, occurrenceId, context, now, selectedDateKey } = {}) {
  const current = safeNow(now);
  const requestedDateKey =
    normalizeDateKey(selectedDateKey) ||
    toLocalDateKey(current);
  const resolved = resolveRecoveryOccurrence({
    state,
    occurrenceId,
    context,
    now: current,
    selectedDateKey: requestedDateKey,
  });

  if (!resolved.ok) {
    return {
      ok: false,
      context: resolved.context,
      occurrence: resolved.occurrence,
      problem: buildProblem({
        context: resolved.context,
        occurrence: resolved.occurrence,
        sourceOccurrence: resolved.sourceOccurrence,
      }),
      options: [],
      warnings: resolved.warnings,
      issues: resolved.issues,
    };
  }

  const options = buildOptionsForContext({
    state,
    occurrence: resolved.occurrence,
    context: resolved.context,
    now: current,
    selectedDateKey: requestedDateKey,
    targetAvailable: resolved.targetAvailable,
  });

  return {
    ok: options.length > 0,
    context: resolved.context,
    occurrence: resolved.occurrence,
    problem: buildProblem({
      context: resolved.context,
      occurrence: resolved.occurrence,
      sourceOccurrence: resolved.sourceOccurrence,
    }),
    options,
    warnings: resolved.warnings,
    issues: resolved.issues,
  };
}

export function buildRecoveryContext({ state, occurrenceId, context, now, selectedDateKey, source = "" } = {}) {
  const model = buildRecoveryOptions({ state, occurrenceId, context, now, selectedDateKey });
  return {
    ...model,
    source: safeString(source),
    request: {
      occurrenceId: safeString(occurrenceId),
      context: model.context || normalizeContext(context),
      selectedDateKey: normalizeDateKey(selectedDateKey),
      source: safeString(source),
    },
  };
}

export function getRecoveryTomorrowDateKey(occurrence) {
  return addDaysLocal(normalizeDateKey(occurrence?.date), 1);
}
