import {
  TODAY_INTERVENTION_TYPE,
  resolveTodayOccurrenceStartPolicy,
  resolveTodayInterventionType,
} from "../../../../src/domain/todayIntervention.js";

function buildAction({ label, intent, categoryId = null, actionId = null, occurrenceId = null, dateKey = null }) {
  return { label, intent, categoryId, actionId, occurrenceId, dateKey };
}

export function buildNowFallback(context) {
  const focusStartPolicy = resolveTodayOccurrenceStartPolicy({
    activeDate: context.activeDate,
    systemToday: context.systemToday,
    occurrenceDate: context.focusOccurrenceForActiveDate?.date || "",
  });
  const interventionType = resolveTodayInterventionType({
    activeSessionForActiveDate: context.activeSessionForActiveDate,
    openSessionOutsideActiveDate: context.openSessionOutsideActiveDate,
    futureSessions: context.futureSessions,
    activeDate: context.activeDate,
    systemToday: context.systemToday,
    focusOccurrenceForActiveDate: context.focusOccurrenceForActiveDate,
  });

  if (interventionType === TODAY_INTERVENTION_TYPE.SESSION_RESUME && context.activeSessionForActiveDate?.isOpen) {
    return {
      kind: "now",
      interventionType,
      decisionSource: "rules",
      headline: "Reprends la session en cours",
      reason: "La session active est le prochain levier utile.",
      primaryAction: buildAction({
        label: "Reprendre",
        intent: "resume_session",
        categoryId: context.activeCategoryId,
        occurrenceId: context.activeSessionForActiveDate.occurrenceId,
        dateKey: context.activeDate,
      }),
      secondaryAction: context.focusOccurrenceForActiveDate
        ? buildAction({
            label: "Voir le plan",
            intent: "open_today",
            categoryId: context.activeCategoryId,
            occurrenceId: context.focusOccurrenceForActiveDate.id || null,
            actionId: context.focusOccurrenceForActiveDate.goalId || null,
            dateKey: context.activeDate,
          })
        : null,
      suggestedDurationMin: 10,
      confidence: 0.94,
      urgency: "high",
      uiTone: "direct",
      toolIntent: "suggest_resume_session",
      rewardSuggestion: { kind: "none", label: null },
    };
  }

  if (interventionType === TODAY_INTERVENTION_TYPE.SCHEDULE_WARNING) {
    return {
      kind: "now",
      interventionType,
      decisionSource: "rules",
      headline: "Une session ouverte est planifiée sur une autre date",
      reason: "Vérifie le planning avant de reprendre ou de relancer une action.",
      primaryAction: buildAction({
        label: "Voir pilotage",
        intent: "open_pilotage",
        categoryId: context.activeCategoryId,
        dateKey: context.activeDate,
      }),
      secondaryAction: null,
      suggestedDurationMin: null,
      confidence: 0.89,
      urgency: "medium",
      uiTone: "steady",
      toolIntent: "suggest_reschedule_option",
      rewardSuggestion: { kind: "none", label: null },
    };
  }

  if (context.focusOccurrenceForActiveDate) {
    const title = String(context.goalsById.get(context.focusOccurrenceForActiveDate.goalId)?.title || "Action");
    const duration = Number.isFinite(context.focusOccurrenceForActiveDate.durationMinutes)
      ? context.focusOccurrenceForActiveDate.durationMinutes
      : null;
    if (focusStartPolicy.requiresReschedule) {
      return {
        kind: "now",
        interventionType: TODAY_INTERVENTION_TYPE.TODAY_RECOMMENDATION,
        decisionSource: "rules",
        headline: title.slice(0, 72),
        reason:
          focusStartPolicy.datePhase === "future"
            ? "Cette action est prévue pour une autre date. Replanifie-la avant de la lancer."
            : "Cette action appartient à une date passée. Replanifie-la avant de la relancer.",
        primaryAction: buildAction({
          label: focusStartPolicy.datePhase === "future" ? "Replanifier aujourd’hui" : "Replanifier",
          intent: "open_pilotage",
          categoryId: context.activeCategoryId,
          actionId: context.focusOccurrenceForActiveDate.goalId || null,
          occurrenceId: context.focusOccurrenceForActiveDate.id || null,
          dateKey: context.activeDate,
        }),
        secondaryAction: buildAction({
          label: "Voir aujourd’hui",
          intent: "open_today",
          categoryId: context.activeCategoryId,
          occurrenceId: context.focusOccurrenceForActiveDate.id || null,
          actionId: context.focusOccurrenceForActiveDate.goalId || null,
          dateKey: context.activeDate,
        }),
        suggestedDurationMin: null,
        confidence: 0.87,
        urgency: "medium",
        uiTone: "steady",
        toolIntent: "suggest_reschedule_option",
        rewardSuggestion: { kind: "none", label: null },
      };
    }
    return {
      kind: "now",
      interventionType: TODAY_INTERVENTION_TYPE.TODAY_RECOMMENDATION,
      decisionSource: "rules",
      headline: title.slice(0, 72),
      reason: "C’est l’action la plus exécutable dans le plan courant.",
      primaryAction: buildAction({
        label: "Démarrer",
        intent: "start_occurrence",
        categoryId: context.activeCategoryId,
        occurrenceId: context.focusOccurrenceForActiveDate.id || null,
        actionId: context.focusOccurrenceForActiveDate.goalId || null,
        dateKey: context.activeDate,
      }),
      secondaryAction: buildAction({
        label: "Voir aujourd’hui",
        intent: "open_today",
        categoryId: context.activeCategoryId,
        occurrenceId: context.focusOccurrenceForActiveDate.id || null,
        actionId: context.focusOccurrenceForActiveDate.goalId || null,
        dateKey: context.activeDate,
      }),
      suggestedDurationMin: duration,
      confidence: 0.88,
      urgency: "medium",
      uiTone: "steady",
      toolIntent: "suggest_start_occurrence",
      rewardSuggestion: { kind: "none", label: null },
    };
  }

  return {
    kind: "now",
    interventionType: TODAY_INTERVENTION_TYPE.TODAY_RECOMMENDATION,
    decisionSource: "rules",
    headline: "Aucune action prête",
    reason: "Le plan du jour est vide ou déjà clos.",
    primaryAction: buildAction({
      label: "Ouvrir bibliothèque",
      intent: "open_library",
      categoryId: context.activeCategoryId,
      dateKey: context.activeDate,
    }),
    secondaryAction: buildAction({
      label: "Voir pilotage",
      intent: "open_pilotage",
      categoryId: context.activeCategoryId,
      dateKey: context.activeDate,
    }),
    suggestedDurationMin: null,
    confidence: 0.8,
    urgency: "low",
    uiTone: "steady",
    toolIntent: "suggest_open_library",
    rewardSuggestion: { kind: "none", label: null },
  };
}

export function buildRecoveryFallback(context) {
  if (context.activeSession?.isOpen) {
    return {
      kind: "recovery",
      interventionType: null,
      decisionSource: "rules",
      headline: "Repars avec la session active",
      reason: "Le plus court chemin est de reprendre ce qui est déjà lancé.",
      primaryAction: buildAction({
        label: "Reprendre",
        intent: "resume_session",
        categoryId: context.activeCategoryId,
        occurrenceId: context.activeSession.occurrenceId,
        dateKey: context.selectedDateKey,
      }),
      secondaryAction: null,
      suggestedDurationMin: 10,
      confidence: 0.93,
      urgency: "high",
      uiTone: "reset",
      toolIntent: "suggest_resume_session",
      rewardSuggestion: { kind: "light_reset", label: "Repars sur 10 min." },
    };
  }

  const smallestRemaining = context.sortedOccurrences.find((occurrence) => occurrence?.status === "planned") || null;
  if (smallestRemaining) {
    const title = String(context.goalsById.get(smallestRemaining.goalId)?.title || "Action");
    const duration = Number.isFinite(smallestRemaining.durationMinutes) ? smallestRemaining.durationMinutes : 10;
    const boundedDuration = Math.max(5, Math.min(duration, 20));
    return {
      kind: "recovery",
      interventionType: null,
      decisionSource: "rules",
      headline: title.slice(0, 72),
      reason: "Repars avec l’action la plus légère encore ouverte.",
      primaryAction: buildAction({
        label: "Relancer",
        intent: "start_occurrence",
        categoryId: context.activeCategoryId,
        occurrenceId: smallestRemaining.id || null,
        actionId: smallestRemaining.goalId || null,
        dateKey: context.selectedDateKey,
      }),
      secondaryAction: buildAction({
        label: "Voir le plan",
        intent: "open_today",
        categoryId: context.activeCategoryId,
        occurrenceId: smallestRemaining.id || null,
        actionId: smallestRemaining.goalId || null,
        dateKey: context.selectedDateKey,
      }),
      suggestedDurationMin: boundedDuration,
      confidence: 0.86,
      urgency: context.missedToday > 0 ? "high" : "medium",
      uiTone: "reset",
      toolIntent: "suggest_recovery_action",
      rewardSuggestion: { kind: "light_reset", label: "Un reset court suffit." },
    };
  }

  return {
    kind: "recovery",
    interventionType: null,
    decisionSource: "rules",
    headline: "Recrée un point d’appui",
    reason: "Pas d’action récupérable aujourd’hui, il faut rouvrir le système.",
    primaryAction: buildAction({
      label: "Ouvrir bibliothèque",
      intent: "open_library",
      categoryId: context.activeCategoryId,
      dateKey: context.selectedDateKey,
    }),
    secondaryAction: buildAction({
      label: "Voir pilotage",
      intent: "open_pilotage",
      categoryId: context.activeCategoryId,
      dateKey: context.selectedDateKey,
    }),
    suggestedDurationMin: 5,
    confidence: 0.74,
    urgency: "medium",
    uiTone: "reset",
    toolIntent: "suggest_open_library",
    rewardSuggestion: { kind: "micro_action", label: "Refais un point d’appui simple." },
  };
}
