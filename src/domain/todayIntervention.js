export const TODAY_INTERVENTION_TYPE = Object.freeze({
  TODAY_RECOMMENDATION: "today_recommendation",
  SESSION_RESUME: "session_resume",
  SCHEDULE_WARNING: "schedule_warning",
  OVERLOAD_ADJUSTMENT: "overload_adjustment",
  PLANNING_ASSIST: "planning_assist",
  MOTIVATION_NUDGE: "motivation_nudge",
  REVIEW_FEEDBACK: "review_feedback",
});

export const TODAY_DATE_PHASE = Object.freeze({
  TODAY: "today",
  FUTURE: "future",
  PAST: "past",
});

export const TODAY_BACKEND_RESOLUTION_STATUS = Object.freeze({
  ACCEPTED_AI: "accepted_ai",
  REJECTED_TO_RULES: "rejected_to_rules",
  RULES_FALLBACK: "rules_fallback",
});

export const TODAY_DIAGNOSTIC_REJECTION_REASON = Object.freeze({
  NONE: "none",
  INVALID_MODEL_OUTPUT: "invalid_model_output",
  INVALID_INTERVENTION_TYPE: "invalid_intervention_type",
  GOVERNANCE_REJECTED: "governance_rejected",
  CANONICAL_FALLBACK_PREFERRED: "canonical_fallback_preferred",
  NO_MATERIAL_GAIN_OVER_LOCAL: "no_material_gain_over_local",
  NO_ACTIVE_SESSION_FOR_DATE: "no_active_session_for_date",
  NO_DETERMINISTIC_SIGNAL: "no_deterministic_signal",
  AMBIGUOUS_CONTEXT: "ambiguous_context",
  WARNING_SIGNAL_TOO_WEAK: "warning_signal_too_weak",
});

export const TODAY_INTERVENTION_REGISTRY = Object.freeze({
  [TODAY_INTERVENTION_TYPE.TODAY_RECOMMENDATION]: {
    enabled: true,
    trigger: "focus_occurrence_for_active_date",
    priority: "medium",
    canonicalData: ["activeDate", "plannedActionsForActiveDate", "focusOccurrenceForActiveDate"],
    intensity: "steady",
    allowedCtas: ["start_occurrence", "open_library", "open_pilotage"],
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

export const TODAY_ALLOWED_PRIMARY_INTENTS_BY_TYPE = Object.freeze({
  [TODAY_INTERVENTION_TYPE.TODAY_RECOMMENDATION]: ["start_occurrence", "open_library", "open_pilotage"],
  [TODAY_INTERVENTION_TYPE.SESSION_RESUME]: ["resume_session"],
  [TODAY_INTERVENTION_TYPE.SCHEDULE_WARNING]: ["open_pilotage"],
});

export function getTodaySupportedPrimaryIntents() {
  return [...new Set(Object.values(TODAY_ALLOWED_PRIMARY_INTENTS_BY_TYPE).flatMap((value) => value).filter(Boolean))];
}

export function isTodayPrimaryIntentSupportedByHero(intent) {
  return getTodaySupportedPrimaryIntents().includes(normalizeIntent(intent));
}

function normalizeIntent(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeDateKey(value) {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value.trim()) ? value.trim() : "";
}

export function resolveTodayDatePhase({ activeDate = "", systemToday = "" }) {
  const normalizedActiveDate = normalizeDateKey(activeDate);
  const normalizedSystemToday = normalizeDateKey(systemToday);
  if (!normalizedActiveDate || !normalizedSystemToday || normalizedActiveDate === normalizedSystemToday) {
    return TODAY_DATE_PHASE.TODAY;
  }
  return normalizedActiveDate > normalizedSystemToday ? TODAY_DATE_PHASE.FUTURE : TODAY_DATE_PHASE.PAST;
}

export function resolveTodayOccurrenceStartPolicy({
  activeDate = "",
  systemToday = "",
  occurrenceDate = "",
}) {
  const normalizedActiveDate = normalizeDateKey(activeDate);
  const normalizedOccurrenceDate = normalizeDateKey(occurrenceDate);
  const datePhase = resolveTodayDatePhase({ activeDate: normalizedActiveDate, systemToday });
  const matchesActiveDate = Boolean(
    normalizedActiveDate && normalizedOccurrenceDate && normalizedActiveDate === normalizedOccurrenceDate
  );
  const canStartDirectly = matchesActiveDate && datePhase === TODAY_DATE_PHASE.TODAY;
  return {
    datePhase,
    canStartDirectly,
    requiresReschedule: matchesActiveDate && !canStartDirectly,
    matchesActiveDate,
  };
}

export function buildTodayCanonicalContextSummary({
  activeDate = "",
  isToday = false,
  activeSessionForActiveDate = null,
  openSessionOutsideActiveDate = null,
  futureSessions = [],
  plannedActionsForActiveDate = [],
  focusOccurrenceForActiveDate = null,
}) {
  return {
    activeDate: typeof activeDate === "string" ? activeDate : "",
    isToday: Boolean(isToday),
    hasActiveSessionForActiveDate: Boolean(activeSessionForActiveDate),
    hasOpenSessionOutsideActiveDate: Boolean(openSessionOutsideActiveDate),
    futureSessionsCount: Array.isArray(futureSessions) ? futureSessions.length : 0,
    hasPlannedActionsForActiveDate: Array.isArray(plannedActionsForActiveDate) && plannedActionsForActiveDate.length > 0,
    hasFocusOccurrenceForActiveDate: Boolean(focusOccurrenceForActiveDate),
  };
}

export function hasDeterministicScheduleWarning({ openSessionOutsideActiveDate, futureSessions }) {
  if (openSessionOutsideActiveDate) return true;
  return Array.isArray(futureSessions) && futureSessions.length > 0;
}

export function resolveTodayInterventionType({
  activeSessionForActiveDate = null,
  openSessionOutsideActiveDate = null,
  futureSessions = [],
  activeDate = "",
  systemToday = "",
  focusOccurrenceForActiveDate = null,
  primaryActionDateKey = "",
  primaryActionIntent = "",
}) {
  const intent = normalizeIntent(primaryActionIntent);
  const hasActiveSessionForActiveDate = Boolean(activeSessionForActiveDate);
  const hasWarningSignal = hasDeterministicScheduleWarning({
    openSessionOutsideActiveDate,
    futureSessions,
  });
  const startPolicy = resolveTodayOccurrenceStartPolicy({
    activeDate,
    systemToday,
    occurrenceDate: primaryActionDateKey || focusOccurrenceForActiveDate?.date || "",
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

  if (intent === "open_pilotage" && focusOccurrenceForActiveDate && startPolicy.requiresReschedule) {
    return TODAY_INTERVENTION_TYPE.TODAY_RECOMMENDATION;
  }

  if (intent === "start_occurrence" || intent === "open_library") {
    return TODAY_INTERVENTION_TYPE.TODAY_RECOMMENDATION;
  }

  return null;
}

export function diagnoseTodayIntervention({
  requestedInterventionType = null,
  primaryActionIntent = "",
  primaryActionDateKey = "",
  activeSessionForActiveDate = null,
  openSessionOutsideActiveDate = null,
  futureSessions = [],
  activeDate = "",
  systemToday = "",
  focusOccurrenceForActiveDate = null,
}) {
  const intent = normalizeIntent(primaryActionIntent);
  const hasActiveSessionForActiveDate = Boolean(activeSessionForActiveDate);
  const hasWarningSignal = hasDeterministicScheduleWarning({
    openSessionOutsideActiveDate,
    futureSessions,
  });
  const startPolicy = resolveTodayOccurrenceStartPolicy({
    activeDate,
    systemToday,
    occurrenceDate: primaryActionDateKey || focusOccurrenceForActiveDate?.date || "",
  });

  if (intent === "resume_session" && !hasActiveSessionForActiveDate) {
    return {
      ok: false,
      resolvedInterventionType: null,
      rejectionReason: TODAY_DIAGNOSTIC_REJECTION_REASON.NO_ACTIVE_SESSION_FOR_DATE,
    };
  }

  if (intent === "start_occurrence" && !startPolicy.canStartDirectly) {
    return {
      ok: false,
      resolvedInterventionType: null,
      rejectionReason: TODAY_DIAGNOSTIC_REJECTION_REASON.INVALID_INTERVENTION_TYPE,
    };
  }

  if (intent === "open_pilotage" && !hasWarningSignal) {
    if (focusOccurrenceForActiveDate && startPolicy.requiresReschedule) {
      const resolvedInterventionType = resolveTodayInterventionType({
        activeSessionForActiveDate,
        openSessionOutsideActiveDate,
        futureSessions,
        activeDate,
        systemToday,
        focusOccurrenceForActiveDate,
        primaryActionDateKey,
        primaryActionIntent: intent,
      });
      return {
        ok: requestedInterventionType ? requestedInterventionType === resolvedInterventionType : true,
        resolvedInterventionType,
        rejectionReason:
          requestedInterventionType && requestedInterventionType !== resolvedInterventionType
            ? TODAY_DIAGNOSTIC_REJECTION_REASON.INVALID_INTERVENTION_TYPE
            : TODAY_DIAGNOSTIC_REJECTION_REASON.NONE,
      };
    }
    return {
      ok: false,
      resolvedInterventionType: null,
      rejectionReason: TODAY_DIAGNOSTIC_REJECTION_REASON.NO_DETERMINISTIC_SIGNAL,
    };
  }

  const resolvedInterventionType = resolveTodayInterventionType({
    activeSessionForActiveDate,
    openSessionOutsideActiveDate,
    futureSessions,
    activeDate,
    systemToday,
    focusOccurrenceForActiveDate,
    primaryActionDateKey,
    primaryActionIntent: intent,
  });

  if (!resolvedInterventionType) {
    return {
      ok: false,
      resolvedInterventionType: null,
      rejectionReason: intent
        ? TODAY_DIAGNOSTIC_REJECTION_REASON.INVALID_INTERVENTION_TYPE
        : TODAY_DIAGNOSTIC_REJECTION_REASON.AMBIGUOUS_CONTEXT,
    };
  }

  if (
    requestedInterventionType &&
    requestedInterventionType !== resolvedInterventionType
  ) {
    return {
      ok: false,
      resolvedInterventionType,
      rejectionReason: TODAY_DIAGNOSTIC_REJECTION_REASON.INVALID_INTERVENTION_TYPE,
    };
  }

  if (
    !isTodayInterventionAllowed({
      interventionType: resolvedInterventionType,
      primaryActionIntent: intent,
      primaryActionDateKey,
      activeSessionForActiveDate,
      openSessionOutsideActiveDate,
      futureSessions,
      activeDate,
      systemToday,
      focusOccurrenceForActiveDate,
    })
  ) {
    return {
      ok: false,
      resolvedInterventionType,
      rejectionReason: TODAY_DIAGNOSTIC_REJECTION_REASON.GOVERNANCE_REJECTED,
    };
  }

  return {
    ok: true,
    resolvedInterventionType,
    rejectionReason: TODAY_DIAGNOSTIC_REJECTION_REASON.NONE,
  };
}

export function isTodayInterventionAllowed({
  interventionType,
  primaryActionIntent = "",
  primaryActionDateKey = "",
  activeSessionForActiveDate = null,
  openSessionOutsideActiveDate = null,
  futureSessions = [],
  activeDate = "",
  systemToday = "",
  focusOccurrenceForActiveDate = null,
}) {
  const spec = TODAY_INTERVENTION_REGISTRY[interventionType];
  const intent = normalizeIntent(primaryActionIntent);
  const allowedPrimaryIntents = TODAY_ALLOWED_PRIMARY_INTENTS_BY_TYPE[interventionType] || [];
  const startPolicy = resolveTodayOccurrenceStartPolicy({
    activeDate,
    systemToday,
    occurrenceDate: primaryActionDateKey || focusOccurrenceForActiveDate?.date || "",
  });
  if (!spec?.enabled || !intent || !spec.allowedCtas.includes(intent) || !allowedPrimaryIntents.includes(intent)) {
    return false;
  }
  if (interventionType === TODAY_INTERVENTION_TYPE.TODAY_RECOMMENDATION) {
    if (intent === "start_occurrence" && !startPolicy.canStartDirectly) {
      return false;
    }
    if (intent === "open_pilotage" && (!focusOccurrenceForActiveDate || !startPolicy.requiresReschedule)) {
      return false;
    }
  }
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
    activeDate,
    systemToday,
    focusOccurrenceForActiveDate,
    primaryActionDateKey,
    primaryActionIntent: intent,
  });
  return resolvedType === interventionType;
}
