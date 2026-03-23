import {
  TODAY_GAP_REASON,
  TODAY_INTERVENTION_TYPE,
  resolveTodayOccurrenceStartPolicy,
  resolveTodayInterventionType,
} from "../../../../src/domain/todayIntervention.js";

function buildAction({ label, intent, categoryId = null, actionId = null, occurrenceId = null, dateKey = null }) {
  return { label, intent, categoryId, actionId, occurrenceId, dateKey };
}

function formatDateLabel(dateKey) {
  if (!dateKey) return "";
  const parsed = new Date(`${dateKey}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return dateKey;
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "2-digit",
  }).format(parsed);
}

function formatDateTimeLabel({ dateKey, timeLabel }) {
  const dateLabel = formatDateLabel(dateKey);
  if (dateLabel && timeLabel) return `le ${dateLabel} ${timeLabel}`;
  if (dateLabel) return `le ${dateLabel}`;
  return timeLabel || "";
}

function formatDurationLabel(durationMin) {
  return Number.isFinite(durationMin) ? `${durationMin} min` : "";
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
    gapSummary: context.gapSummary,
  });

  if (interventionType === TODAY_INTERVENTION_TYPE.SESSION_RESUME && context.activeSessionForActiveDate?.isOpen) {
    const activeSessionTitle = context.activeSessionSummary?.title || "la session du jour";
    return {
      kind: "now",
      interventionType,
      decisionSource: "rules",
      headline: `Reprends ${activeSessionTitle}`.slice(0, 72),
      reason: "Une session du jour est déjà ouverte, c'est donc le point d'appui le plus direct.",
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

  if (context.focusOccurrenceForActiveDate && focusStartPolicy.canStartDirectly) {
    const title = String(context.focusOccurrenceSummary?.title || "Action");
    const duration = Number.isFinite(context.focusOccurrenceSummary?.durationMin)
      ? context.focusOccurrenceSummary.durationMin
      : Number.isFinite(context.focusOccurrenceForActiveDate.durationMinutes)
        ? context.focusOccurrenceForActiveDate.durationMinutes
        : null;
    return {
      kind: "now",
      interventionType: TODAY_INTERVENTION_TYPE.TODAY_RECOMMENDATION,
      decisionSource: "rules",
      headline: title.slice(0, 72),
      reason:
        context.focusSelectionReason === "upcoming_fixed" && context.focusOccurrenceSummary?.timeLabel
          ? `${title} est le prochain créneau fixe ${context.focusOccurrenceSummary.timeLabel} et reste le meilleur levier maintenant.`
          : context.focusSelectionReason === "earliest_fixed" && context.focusOccurrenceSummary?.timeLabel
            ? `${title} est le premier créneau fixe du plan ${context.focusOccurrenceSummary.timeLabel}.`
            : `${title} est l'action la plus exécutable dans le plan courant.`,
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

  if (interventionType === TODAY_INTERVENTION_TYPE.SCHEDULE_WARNING) {
    const scheduleTarget = formatDateTimeLabel({
      dateKey: context.scheduleSignalSummary?.targetDateKey || context.scheduleSignalSummary?.sessionDateKey || null,
      timeLabel: context.scheduleSignalSummary?.targetTimeLabel || null,
    });
    const scheduleTargetTitle = context.scheduleSignalSummary?.targetActionTitle || "cette action";
    return {
      kind: "now",
      interventionType,
      decisionSource: "rules",
      headline: "Une session ouverte est planifiée sur une autre date",
      reason: scheduleTarget
        ? `${scheduleTargetTitle} reste planifiée ${scheduleTarget}. Vérifie le planning avant de reprendre.`
        : "Vérifie le planning avant de reprendre ou de relancer une action.",
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

  if (context.focusOccurrenceForActiveDate && focusStartPolicy.requiresReschedule) {
    const title = String(context.focusOccurrenceSummary?.title || "Action");
    const focusDateTime = formatDateTimeLabel({
      dateKey: context.focusOccurrenceSummary?.dateKey || context.focusOccurrenceForActiveDate?.date || null,
      timeLabel: context.focusOccurrenceSummary?.timeLabel || null,
    });
    return {
      kind: "now",
      interventionType: TODAY_INTERVENTION_TYPE.TODAY_RECOMMENDATION,
      decisionSource: "rules",
      headline: title.slice(0, 72),
      reason:
        focusStartPolicy.datePhase === "future"
          ? focusDateTime
            ? `${title} est prévue ${focusDateTime}. Replanifie-la avant de la lancer aujourd'hui.`
            : `${title} est prévue pour une autre date. Replanifie-la avant de la lancer aujourd'hui.`
          : focusDateTime
            ? `${title} appartenait à ${focusDateTime}. Replanifie-la avant de la relancer.`
            : `${title} appartient à une date passée. Replanifie-la avant de la relancer.`,
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

  if (context.gapSummary?.hasGapToday) {
    const gapCandidate = Array.isArray(context.gapSummary?.candidateActionSummaries)
      ? context.gapSummary.candidateActionSummaries[0] || null
      : null;
    const categoryName = context.category?.name || null;
    const candidateCategoryName = gapCandidate?.categoryName || null;
    const durationLabel = formatDurationLabel(gapCandidate?.durationMin);
    const candidateWithDuration = [gapCandidate?.title || "", durationLabel].filter(Boolean).join(" • ");

    let headline = "Aucune action prévue aujourd’hui";
    let reason = gapCandidate
      ? `Tu peux planifier ${candidateWithDuration || gapCandidate.title} aujourd'hui pour maintenir la continuité.`
      : "Planifie une action simple aujourd'hui pour maintenir la continuité.";

    if (context.gapSummary.gapReason === TODAY_GAP_REASON.EMPTY_ACTIVE_CATEGORY && categoryName) {
      headline = `Rien de prévu en ${categoryName} aujourd’hui`.slice(0, 72);
      reason =
        context.gapSummary.selectionScope === "cross_category_fallback" && gapCandidate
          ? `Rien de crédible n'est prévu en ${categoryName} aujourd'hui. Tu peux avancer sur ${gapCandidate.title}${candidateCategoryName ? ` en ${candidateCategoryName}` : ""}.`
          : gapCandidate
            ? `${gapCandidate.title} n'est pas encore planifiée aujourd'hui. Une courte action suffit pour maintenir l'élan.`
            : "Une courte action suffit pour maintenir l'élan aujourd'hui.";
    } else if (context.gapSummary.gapReason === TODAY_GAP_REASON.LOW_LOAD_DAY) {
      headline = gapCandidate ? `Ajoute ${gapCandidate.title} aujourd’hui`.slice(0, 72) : "Le plan du jour reste léger";
      reason =
        context.gapSummary.selectionScope === "cross_category_fallback" && gapCandidate && categoryName
          ? `Rien de plus pertinent n'est disponible en ${categoryName} aujourd'hui. ${gapCandidate.title}${candidateCategoryName ? ` en ${candidateCategoryName}` : ""} peut compléter la journée${durationLabel ? ` en ${durationLabel}` : ""}.`
          : gapCandidate
            ? `${gapCandidate.title} n'est pas encore planifiée aujourd'hui. ${durationLabel || "Une courte durée"} suffit pour compléter la journée.`
            : "Une action simple peut compléter la journée sans surcharge.";
    } else if (context.gapSummary.selectionScope === "cross_category_fallback" && gapCandidate && categoryName) {
      reason = `Rien de crédible n'est prévu en ${categoryName} aujourd'hui. Tu peux planifier ${candidateWithDuration || gapCandidate.title}${candidateCategoryName ? ` en ${candidateCategoryName}` : ""}.`;
    }

    return {
      kind: "now",
      interventionType: TODAY_INTERVENTION_TYPE.TODAY_RECOMMENDATION,
      decisionSource: "rules",
      headline,
      reason,
      primaryAction: buildAction({
        label: "Planifier aujourd’hui",
        intent: "open_pilotage",
        categoryId: context.activeCategoryId || null,
        actionId: gapCandidate?.actionId || null,
        dateKey: context.activeDate,
      }),
      secondaryAction: null,
      suggestedDurationMin: gapCandidate?.durationMin || null,
      confidence: 0.84,
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
    headline: "Aucune action prévue aujourd’hui",
    reason: "Planifie une action simple aujourd'hui pour maintenir la continuité.",
    primaryAction: buildAction({
      label: "Planifier aujourd’hui",
      intent: "open_pilotage",
      categoryId: context.activeCategoryId,
      dateKey: context.activeDate,
    }),
    secondaryAction: null,
    suggestedDurationMin: null,
    confidence: 0.8,
    urgency: "low",
    uiTone: "steady",
    toolIntent: "suggest_reschedule_option",
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

export function buildChatFallback(context) {
  const focusStartPolicy = resolveTodayOccurrenceStartPolicy({
    activeDate: context.activeDate,
    systemToday: context.systemToday,
    occurrenceDate: context.focusOccurrenceForActiveDate?.date || "",
  });

  if (context.activeSessionForActiveDate?.isOpen) {
    return {
      kind: "chat",
      headline: "Reprends la session en cours",
      reason: "Le prochain pas le plus crédible reste la session déjà ouverte aujourd'hui.",
      primaryAction: buildAction({
        label: "Reprendre",
        intent: "resume_session",
        categoryId: context.activeCategoryId,
        occurrenceId: context.activeSessionForActiveDate.occurrenceId || null,
        dateKey: context.activeDate,
      }),
      secondaryAction: buildAction({
        label: "Voir aujourd’hui",
        intent: "open_today",
        categoryId: context.activeCategoryId,
        dateKey: context.activeDate,
      }),
      suggestedDurationMin: 10,
    };
  }

  if (context.focusOccurrenceForActiveDate && focusStartPolicy.canStartDirectly) {
    const title = String(context.focusOccurrenceSummary?.title || "Action");
    const duration = Number.isFinite(context.focusOccurrenceSummary?.durationMin)
      ? context.focusOccurrenceSummary.durationMin
      : Number.isFinite(context.focusOccurrenceForActiveDate?.durationMinutes)
        ? context.focusOccurrenceForActiveDate.durationMinutes
        : null;
    return {
      kind: "chat",
      headline: `Priorité: ${title}`.slice(0, 72),
      reason: `${title} est le bloc le plus exécutable maintenant dans Today.`,
      primaryAction: buildAction({
        label: "Démarrer",
        intent: "start_occurrence",
        categoryId: context.activeCategoryId,
        actionId: context.focusOccurrenceForActiveDate.goalId || null,
        occurrenceId: context.focusOccurrenceForActiveDate.id || null,
        dateKey: context.activeDate,
      }),
      secondaryAction: buildAction({
        label: "Voir aujourd’hui",
        intent: "open_today",
        categoryId: context.activeCategoryId,
        actionId: context.focusOccurrenceForActiveDate.goalId || null,
        occurrenceId: context.focusOccurrenceForActiveDate.id || null,
        dateKey: context.activeDate,
      }),
      suggestedDurationMin: duration,
    };
  }

  if (context.focusOccurrenceForActiveDate && focusStartPolicy.requiresReschedule) {
    const title = String(context.focusOccurrenceSummary?.title || "Action");
    return {
      kind: "chat",
      headline: `Replanifie ${title}`.slice(0, 72),
      reason: `${title} est sur un autre créneau ou une autre date. Recale-la avant exécution.`,
      primaryAction: buildAction({
        label: "Voir pilotage",
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
        actionId: context.focusOccurrenceForActiveDate.goalId || null,
        occurrenceId: context.focusOccurrenceForActiveDate.id || null,
        dateKey: context.activeDate,
      }),
      suggestedDurationMin: null,
    };
  }

  const gapCandidate = Array.isArray(context.gapSummary?.candidateActionSummaries)
    ? context.gapSummary.candidateActionSummaries[0] || null
    : null;
  if (context.gapSummary?.hasGapToday && gapCandidate) {
    return {
      kind: "chat",
      headline: `Ajoute ${gapCandidate.title}`.slice(0, 72),
      reason: `${gapCandidate.title} n'est pas encore planifiée aujourd'hui. Pose un bloc court crédible.`,
      primaryAction: buildAction({
        label: "Planifier aujourd’hui",
        intent: "open_pilotage",
        categoryId: context.activeCategoryId,
        actionId: gapCandidate.actionId || null,
        dateKey: context.activeDate,
      }),
      secondaryAction: buildAction({
        label: "Ouvrir bibliothèque",
        intent: "open_library",
        categoryId: context.activeCategoryId,
        dateKey: context.activeDate,
      }),
      suggestedDurationMin: gapCandidate.durationMin || null,
    };
  }

  return {
    kind: "chat",
    headline: "Recadre le prochain bloc",
    reason: "Ouvre le pilotage et pose une seule action courte et tenable aujourd'hui.",
    primaryAction: buildAction({
      label: "Voir pilotage",
      intent: "open_pilotage",
      categoryId: context.activeCategoryId,
      dateKey: context.activeDate,
    }),
    secondaryAction: buildAction({
      label: "Ouvrir bibliothèque",
      intent: "open_library",
      categoryId: context.activeCategoryId,
      dateKey: context.activeDate,
    }),
    suggestedDurationMin: 10,
  };
}
