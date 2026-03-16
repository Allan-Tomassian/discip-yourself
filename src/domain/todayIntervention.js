export const TODAY_INTERVENTION_TYPE = Object.freeze({
  TODAY_RECOMMENDATION: "today_recommendation",
  SESSION_RESUME: "session_resume",
  SCHEDULE_WARNING: "schedule_warning",
  OVERLOAD_ADJUSTMENT: "overload_adjustment",
  PLANNING_ASSIST: "planning_assist",
  MOTIVATION_NUDGE: "motivation_nudge",
  REVIEW_FEEDBACK: "review_feedback",
});

export const TODAY_INTERVENTION_REGISTRY = Object.freeze({
  [TODAY_INTERVENTION_TYPE.TODAY_RECOMMENDATION]: {
    enabled: true,
    trigger: "focus_occurrence_for_active_date",
    priority: "medium",
    canonicalData: ["activeDate", "plannedActionsForActiveDate", "focusOccurrenceForActiveDate"],
    intensity: "steady",
    allowedCtas: ["start_occurrence", "open_library"],
    forbidden: ["resume_session_without_active_session", "mutation_without_confirmation"],
  },
  [TODAY_INTERVENTION_TYPE.SESSION_RESUME]: {
    enabled: true,
    trigger: "active_session_for_active_date",
    priority: "high",
    canonicalData: ["activeDate", "activeSessionForActiveDate"],
    intensity: "direct",
    allowedCtas: ["resume_session"],
    forbidden: ["resume_without_active_session", "mutation_without_confirmation"],
  },
  [TODAY_INTERVENTION_TYPE.SCHEDULE_WARNING]: {
    enabled: true,
    trigger: "deterministic_schedule_warning",
    priority: "high",
    canonicalData: ["activeDate", "openSessionOutsideActiveDate", "futureSessions"],
    intensity: "steady",
    allowedCtas: ["open_pilotage"],
    forbidden: ["warning_without_deterministic_signal", "mutation_without_confirmation"],
  },
  [TODAY_INTERVENTION_TYPE.OVERLOAD_ADJUSTMENT]: {
    enabled: false,
    trigger: "planned_future_extension",
    priority: "medium",
    canonicalData: ["dayLoad", "conflicts"],
    intensity: "steady",
    allowedCtas: [],
    forbidden: ["mutation_without_confirmation"],
  },
  [TODAY_INTERVENTION_TYPE.PLANNING_ASSIST]: {
    enabled: false,
    trigger: "planned_future_extension",
    priority: "medium",
    canonicalData: ["profile", "constraints", "plannedActionsForActiveDate"],
    intensity: "steady",
    allowedCtas: [],
    forbidden: ["mutation_without_confirmation"],
  },
  [TODAY_INTERVENTION_TYPE.MOTIVATION_NUDGE]: {
    enabled: false,
    trigger: "planned_future_extension",
    priority: "low",
    canonicalData: ["recentHistory"],
    intensity: "steady",
    allowedCtas: [],
    forbidden: ["mutation_without_confirmation"],
  },
  [TODAY_INTERVENTION_TYPE.REVIEW_FEEDBACK]: {
    enabled: false,
    trigger: "planned_future_extension",
    priority: "low",
    canonicalData: ["recentHistory", "plannedActionsForActiveDate"],
    intensity: "steady",
    allowedCtas: [],
    forbidden: ["mutation_without_confirmation"],
  },
});

function normalizeIntent(value) {
  return typeof value === "string" ? value.trim() : "";
}

export function hasDeterministicScheduleWarning({ openSessionOutsideActiveDate, futureSessions }) {
  if (openSessionOutsideActiveDate) return true;
  return Array.isArray(futureSessions) && futureSessions.length > 0;
}

export function resolveTodayInterventionType({
  activeSessionForActiveDate = null,
  openSessionOutsideActiveDate = null,
  futureSessions = [],
  primaryActionIntent = "",
}) {
  const intent = normalizeIntent(primaryActionIntent);
  const hasActiveSessionForActiveDate = Boolean(activeSessionForActiveDate);
  const hasWarningSignal = hasDeterministicScheduleWarning({
    openSessionOutsideActiveDate,
    futureSessions,
  });

  if (hasActiveSessionForActiveDate) {
    if (!intent) return TODAY_INTERVENTION_TYPE.SESSION_RESUME;
    return intent === "resume_session" ? TODAY_INTERVENTION_TYPE.SESSION_RESUME : null;
  }

  if (hasWarningSignal) {
    if (!intent) return TODAY_INTERVENTION_TYPE.SCHEDULE_WARNING;
    return intent === "open_pilotage" ? TODAY_INTERVENTION_TYPE.SCHEDULE_WARNING : null;
  }

  if (!intent) {
    return TODAY_INTERVENTION_TYPE.TODAY_RECOMMENDATION;
  }

  if (intent === "start_occurrence" || intent === "open_library" || intent === "open_today") {
    return TODAY_INTERVENTION_TYPE.TODAY_RECOMMENDATION;
  }

  return null;
}

export function isTodayInterventionAllowed({
  interventionType,
  primaryActionIntent = "",
  activeSessionForActiveDate = null,
  openSessionOutsideActiveDate = null,
  futureSessions = [],
}) {
  const spec = TODAY_INTERVENTION_REGISTRY[interventionType];
  const intent = normalizeIntent(primaryActionIntent);
  if (!spec?.enabled || !intent || !spec.allowedCtas.includes(intent)) return false;
  if (
    interventionType === TODAY_INTERVENTION_TYPE.SESSION_RESUME &&
    !activeSessionForActiveDate
  ) {
    return false;
  }
  if (
    interventionType === TODAY_INTERVENTION_TYPE.SCHEDULE_WARNING &&
    !hasDeterministicScheduleWarning({ openSessionOutsideActiveDate, futureSessions })
  ) {
    return false;
  }
  const resolvedType = resolveTodayInterventionType({
    activeSessionForActiveDate,
    openSessionOutsideActiveDate,
    futureSessions,
    primaryActionIntent: intent,
  });
  return resolvedType === interventionType;
}
