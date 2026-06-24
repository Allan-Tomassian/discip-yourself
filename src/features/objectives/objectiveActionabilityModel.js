import {
  EXECUTION_SURFACE_STATUS,
  deriveExecutionStatusForOccurrence,
} from "../../logic/executionStatus";
import { normalizeOccurrenceStatus, OCCURRENCE_STATUS } from "../../logic/occurrenceStatus";
import { resolveRuntimeSessionGate } from "../../logic/sessionRuntime";
import {
  normalizeLocalDateKey,
  parseTimeToMinutes,
  todayLocalKey,
  toLocalDateKey,
} from "../../utils/datetime";
import { buildRecoveryContext } from "../recovery/recoverySheetModel";
import { RECOVERY_CONTEXT } from "../recovery/recoveryTypes";

export const OBJECTIVE_ACTIONABILITY_STATE = Object.freeze({
  ACTIVE_SESSION: "active_session",
  NEEDS_RECOVERY: "needs_recovery",
  READY_TO_START: "ready_to_start",
  ON_TRACK: "on_track",
  NEEDS_PLANNING: "needs_planning",
  NEEDS_ACTION: "needs_action",
  COMPLETED: "completed",
  PAUSED: "paused",
});

const RECOVERABLE_CONTEXTS = new Set([
  RECOVERY_CONTEXT.LATE,
  RECOVERY_CONTEXT.MISSED,
  RECOVERY_CONTEXT.BLOCKED,
  RECOVERY_CONTEXT.REPORTED,
]);

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function safeString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeKey(value) {
  return safeString(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function lifecycleState(goal) {
  const status = normalizeKey(goal?.status || goal?.state || goal?.lifecycleStatus);
  if (["completed", "complete", "done", "finished", "termine", "terminee"].includes(status)) {
    return OBJECTIVE_ACTIONABILITY_STATE.COMPLETED;
  }
  if (["paused", "pause", "suspended", "on_hold", "hold", "en_pause"].includes(status)) {
    return OBJECTIVE_ACTIONABILITY_STATE.PAUSED;
  }
  return "";
}

function isExecutableAction(action) {
  const actionId = safeString(action?.id);
  if (!actionId) return false;
  const status = lifecycleState(action);
  return status !== OBJECTIVE_ACTIONABILITY_STATE.COMPLETED && status !== OBJECTIVE_ACTIONABILITY_STATE.PAUSED;
}

function actionPriorityRank(action) {
  const priority = normalizeKey(action?.priority || action?.priorityLabel || action?.importance);
  if (["urgent", "haute", "high", "prioritaire", "critical", "critique"].includes(priority)) return 0;
  if (["normal", "normale", "medium", "moyenne"].includes(priority)) return 1;
  if (["basse", "low", "secondaire"].includes(priority)) return 2;
  return 3;
}

function occurrenceDateKey(occurrence) {
  return normalizeLocalDateKey(occurrence?.date) || "";
}

function occurrenceStart(occurrence) {
  return safeString(occurrence?.start) || safeString(occurrence?.slotKey) || "";
}

function compareOccurrences(left, right) {
  const leftDate = occurrenceDateKey(left);
  const rightDate = occurrenceDateKey(right);
  if (leftDate !== rightDate) return leftDate.localeCompare(rightDate);
  const leftStart = occurrenceStart(left);
  const rightStart = occurrenceStart(right);
  if (leftStart !== rightStart) return leftStart.localeCompare(rightStart);
  return safeString(left?.id).localeCompare(safeString(right?.id));
}

function latestOccurrenceDateForAction(actionId, occurrences) {
  return safeArray(occurrences)
    .filter((occurrence) => safeString(occurrence?.goalId || occurrence?.actionId) === actionId)
    .map((occurrence) => `${occurrenceDateKey(occurrence)}T${occurrenceStart(occurrence) || "00:00"}`)
    .sort()
    .pop() || "";
}

function sortPlanningActions(actions, occurrences) {
  return [...actions].sort((left, right) => {
    const leftActive = normalizeKey(left?.status) === "active" ? 0 : 1;
    const rightActive = normalizeKey(right?.status) === "active" ? 0 : 1;
    if (leftActive !== rightActive) return leftActive - rightActive;
    const leftPriority = actionPriorityRank(left);
    const rightPriority = actionPriorityRank(right);
    if (leftPriority !== rightPriority) return leftPriority - rightPriority;
    const leftLatest = latestOccurrenceDateForAction(safeString(left?.id), occurrences);
    const rightLatest = latestOccurrenceDateForAction(safeString(right?.id), occurrences);
    if (leftLatest !== rightLatest) return rightLatest.localeCompare(leftLatest);
    const leftTitle = safeString(left?.title);
    const rightTitle = safeString(right?.title);
    if (leftTitle !== rightTitle) return leftTitle.localeCompare(rightTitle, "fr");
    return safeString(left?.id).localeCompare(safeString(right?.id));
  });
}

function buildStateSnapshot({ state, objective, linkedActions, occurrences, sessionHistory, activeSession }) {
  const source = state && typeof state === "object" ? state : {};
  return {
    ...source,
    goals: Array.isArray(source.goals) ? source.goals : [objective, ...linkedActions].filter(Boolean),
    occurrences: Array.isArray(source.occurrences) ? source.occurrences : occurrences,
    sessionHistory: Array.isArray(source.sessionHistory) ? source.sessionHistory : sessionHistory,
    ui: {
      ...(source.ui || {}),
      activeSession: activeSession || source.ui?.activeSession || null,
    },
  };
}

function formatDuration(occurrence, action) {
  const raw = Number(occurrence?.durationMinutes ?? action?.durationMinutes ?? action?.sessionMinutes);
  return Number.isFinite(raw) && raw > 0 ? `${Math.round(raw)} min` : "";
}

function formatDateLabel(dateKey, now) {
  const normalized = normalizeLocalDateKey(dateKey) || "";
  if (!normalized) return "";
  const todayKey = toLocalDateKey(now) || todayLocalKey();
  if (normalized === todayKey) return "aujourd’hui";
  try {
    return new Intl.DateTimeFormat("fr-FR", {
      weekday: "short",
      day: "numeric",
      month: "short",
    }).format(new Date(`${normalized}T12:00:00`));
  } catch {
    return normalized;
  }
}

function formatOccurrenceWhen(occurrence, now) {
  const date = formatDateLabel(occurrenceDateKey(occurrence), now);
  const start = occurrenceStart(occurrence);
  if (date && start && start !== "00:00") return `${date} · ${start}`;
  return date || (start && start !== "00:00" ? start : "");
}

function buildDescription(action, occurrence, now, mode) {
  const title = safeString(action?.title) || "Action liée";
  if (mode === "ready") {
    return [title, formatDuration(occurrence, action)].filter(Boolean).join(" · ");
  }
  if (mode === "scheduled") {
    return [title, formatOccurrenceWhen(occurrence, now)].filter(Boolean).join(" · ");
  }
  return title;
}

function actionByIdMap(actions) {
  return new Map(actions.map((action) => [safeString(action?.id), action]).filter(([id]) => Boolean(id)));
}

function linkedOccurrences(occurrences, actionIds) {
  const ids = new Set(actionIds);
  return safeArray(occurrences)
    .filter((occurrence) => ids.has(safeString(occurrence?.goalId || occurrence?.actionId)))
    .sort(compareOccurrences);
}

function hasValidRepairTarget(occurrence, occurrencesById) {
  const targetId = safeString(occurrence?.repairV1?.targetOccurrenceId);
  if (!targetId) return false;
  const target = occurrencesById.get(targetId) || null;
  if (!target) return false;
  const status = normalizeOccurrenceStatus(target.status);
  return status === OCCURRENCE_STATUS.PLANNED || status === OCCURRENCE_STATUS.IN_PROGRESS;
}

function isOpenRuntimeSession(session) {
  if (!session || typeof session !== "object") return false;
  const phase = normalizeKey(session.runtimePhase);
  if (phase === "in_progress" || phase === "paused") return true;
  const status = normalizeKey(session.status);
  return status === "partial" || session.timerRunning === true;
}

function resolveLinkedActiveSession({ activeSession, occurrences, actionIds, objectiveId }) {
  if (!isOpenRuntimeSession(activeSession)) return null;
  const activeOccurrenceId = safeString(activeSession?.occurrenceId);
  const activeObjectiveId = safeString(activeSession?.objectiveId);
  if (activeObjectiveId && (activeObjectiveId === objectiveId || actionIds.includes(activeObjectiveId))) {
    const occurrence = occurrences.find((item) => safeString(item?.id) === activeOccurrenceId) || null;
    return { occurrence, actionId: safeString(occurrence?.goalId || occurrence?.actionId) || activeObjectiveId };
  }
  if (!activeOccurrenceId) return null;
  const occurrence = occurrences.find((item) => safeString(item?.id) === activeOccurrenceId) || null;
  const actionId = safeString(occurrence?.goalId || occurrence?.actionId);
  return actionId && actionIds.includes(actionId) ? { occurrence, actionId } : null;
}

function hasEnabledRecoveryOptions(model) {
  return Boolean(model?.ok && safeArray(model.options).some((option) => option && !option.disabled));
}

function findRecoverableOccurrence({ state, occurrences, occurrencesById, now, selectedDateKey }) {
  for (const occurrence of occurrences) {
    if (!safeString(occurrence?.id)) continue;
    if (hasValidRepairTarget(occurrence, occurrencesById)) continue;
    const dateKey = occurrenceDateKey(occurrence) || normalizeLocalDateKey(selectedDateKey) || toLocalDateKey(now);
    const model = buildRecoveryContext({
      state,
      occurrenceId: occurrence.id,
      selectedDateKey: dateKey,
      now,
      source: "objectives",
    });
    if (!RECOVERABLE_CONTEXTS.has(model.context)) continue;
    if (!hasEnabledRecoveryOptions(model)) continue;
    return {
      occurrence: model.occurrence || occurrence,
      recoveryContext: model.context,
      issues: safeArray(model.issues),
    };
  }
  return null;
}

function nowMinutes(now) {
  const current = now instanceof Date && !Number.isNaN(now.getTime()) ? now : new Date();
  return (current.getHours() * 60) + current.getMinutes();
}

function isLaunchableNow({ occurrence, state, now }) {
  const occurrenceId = safeString(occurrence?.id);
  if (!occurrenceId) return false;
  const gate = resolveRuntimeSessionGate(state, { occurrenceId });
  if (gate.status === "blocked") return false;
  const derived = deriveExecutionStatusForOccurrence(occurrence, {
    activeSession: state?.ui?.activeSession,
    sessionHistory: state?.sessionHistory,
    dateKey: occurrence?.date,
  });
  if (derived.status === EXECUTION_SURFACE_STATUS.ACTIVE) return true;
  if (derived.status !== EXECUTION_SURFACE_STATUS.PLANNED) return false;
  const currentDateKey = toLocalDateKey(now) || todayLocalKey();
  const dateKey = occurrenceDateKey(occurrence);
  if (dateKey !== currentDateKey) return false;
  const start = occurrenceStart(occurrence);
  if (!start || start === "00:00" || occurrence?.noTime === true) return true;
  const startMinutes = parseTimeToMinutes(start);
  if (!Number.isFinite(startMinutes)) return true;
  return startMinutes <= nowMinutes(now);
}

function isScheduledOpenOccurrence({ occurrence, state }) {
  const derived = deriveExecutionStatusForOccurrence(occurrence, {
    activeSession: state?.ui?.activeSession,
    sessionHistory: state?.sessionHistory,
    dateKey: occurrence?.date,
  });
  return derived.status === EXECUTION_SURFACE_STATUS.PLANNED || derived.status === EXECUTION_SURFACE_STATUS.ACTIVE;
}

function result({
  state,
  label,
  description,
  action = null,
  occurrence = null,
  recoveryContext = "",
  cta = null,
  secondaryMetadata = "",
  issues = [],
}) {
  return {
    state,
    label,
    description,
    action,
    occurrence,
    recoveryContext,
    cta,
    secondaryMetadata,
    issues,
  };
}

export function buildObjectiveActionabilityModel({
  objective = null,
  linkedActions = [],
  occurrences = [],
  sessionHistory = [],
  activeSession = null,
  now = new Date(),
  selectedDateKey = "",
  state = null,
} = {}) {
  const current = now instanceof Date && !Number.isNaN(now.getTime()) ? now : new Date();
  const objectiveId = safeString(objective?.id);
  const lifecycle = lifecycleState(objective);
  if (lifecycle === OBJECTIVE_ACTIONABILITY_STATE.COMPLETED) {
    return result({
      state: OBJECTIVE_ACTIONABILITY_STATE.COMPLETED,
      label: "Terminé",
      description: "Objectif terminé.",
    });
  }
  if (lifecycle === OBJECTIVE_ACTIONABILITY_STATE.PAUSED) {
    return result({
      state: OBJECTIVE_ACTIONABILITY_STATE.PAUSED,
      label: "En pause",
      description: "Objectif en pause.",
    });
  }

  const executableActions = safeArray(linkedActions).filter(isExecutableAction);
  const sortedActions = sortPlanningActions(executableActions, occurrences);
  const actionIds = sortedActions.map((action) => safeString(action?.id)).filter(Boolean);
  const actionsById = actionByIdMap(sortedActions);
  const stateSnapshot = buildStateSnapshot({
    state,
    objective,
    linkedActions: sortedActions,
    occurrences: safeArray(occurrences),
    sessionHistory: safeArray(sessionHistory),
    activeSession,
  });
  const linked = linkedOccurrences(stateSnapshot.occurrences, actionIds);
  const occurrencesById = new Map(stateSnapshot.occurrences.map((occurrence) => [safeString(occurrence?.id), occurrence]));

  if (!objectiveId) {
    return result({
      state: OBJECTIVE_ACTIONABILITY_STATE.NEEDS_ACTION,
      label: "Action manquante",
      description: "Aucune action exécutable liée à cet objectif.",
      cta: { label: "Ajouter une action", kind: "add_action" },
      issues: ["objective_missing_id"],
    });
  }

  const active = resolveLinkedActiveSession({
    activeSession: stateSnapshot.ui.activeSession,
    occurrences: linked,
    actionIds,
    objectiveId,
  });
  if (active) {
    const action = actionsById.get(active.actionId) || sortedActions[0] || null;
    return result({
      state: OBJECTIVE_ACTIONABILITY_STATE.ACTIVE_SESSION,
      label: "Session en cours",
      description: buildDescription(action, active.occurrence, current, "ready") || "Une session liée est en cours.",
      action,
      occurrence: active.occurrence,
      cta: { label: "Reprendre", kind: "resume_session" },
    });
  }

  const recoverable = findRecoverableOccurrence({
    state: stateSnapshot,
    occurrences: linked,
    occurrencesById,
    now: current,
    selectedDateKey,
  });
  if (recoverable) {
    const actionId = safeString(recoverable.occurrence?.goalId || recoverable.occurrence?.actionId);
    return result({
      state: OBJECTIVE_ACTIONABILITY_STATE.NEEDS_RECOVERY,
      label: "Bloc à réparer",
      description: "Un bloc lié demande une réparation.",
      action: actionsById.get(actionId) || sortedActions[0] || null,
      occurrence: recoverable.occurrence,
      recoveryContext: recoverable.recoveryContext,
      cta: { label: "Réparer", kind: "repair" },
      issues: recoverable.issues,
    });
  }

  const launchable = linked.find((occurrence) => isLaunchableNow({ occurrence, state: stateSnapshot, now: current }));
  if (launchable) {
    const actionId = safeString(launchable?.goalId || launchable?.actionId);
    const action = actionsById.get(actionId) || sortedActions[0] || null;
    return result({
      state: OBJECTIVE_ACTIONABILITY_STATE.READY_TO_START,
      label: "Prêt à démarrer",
      description: buildDescription(action, launchable, current, "ready"),
      action,
      occurrence: launchable,
      cta: { label: "Démarrer", kind: "start_session" },
    });
  }

  const scheduled = linked.find((occurrence) => isScheduledOpenOccurrence({ occurrence, state: stateSnapshot }));
  if (scheduled) {
    const actionId = safeString(scheduled?.goalId || scheduled?.actionId);
    const action = actionsById.get(actionId) || sortedActions[0] || null;
    return result({
      state: OBJECTIVE_ACTIONABILITY_STATE.ON_TRACK,
      label: "Prochain bloc",
      description: buildDescription(action, scheduled, current, "scheduled"),
      action,
      occurrence: scheduled,
      secondaryMetadata: formatOccurrenceWhen(scheduled, current),
    });
  }

  if (sortedActions.length) {
    const action = sortedActions[0];
    return result({
      state: OBJECTIVE_ACTIONABILITY_STATE.NEEDS_PLANNING,
      label: "À planifier",
      description: "Aucun bloc planifié pour l’action liée.",
      action,
      cta: { label: "Planifier", kind: "plan_action" },
    });
  }

  return result({
    state: OBJECTIVE_ACTIONABILITY_STATE.NEEDS_ACTION,
    label: "Action manquante",
    description: "Aucune action exécutable liée à cet objectif.",
    cta: { label: "Ajouter une action", kind: "add_action" },
  });
}
