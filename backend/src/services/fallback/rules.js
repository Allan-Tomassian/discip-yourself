import {
  TODAY_GAP_REASON,
  TODAY_INTERVENTION_TYPE,
  resolveTodayOccurrenceStartPolicy,
  resolveTodayInterventionType,
} from "../../../../src/domain/todayIntervention.js";
import { LOCAL_ANALYSIS_SURFACES } from "../../../../src/domain/aiPolicy.js";

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

function resolveCategoryCoherence(context) {
  return context?.categoryCoherence || context?.gapSummary || null;
}

function resolveProfileContributionLabel(context) {
  const profile = context?.activeCategoryProfileSummary || null;
  return profile?.mainGoal || profile?.subject || null;
}

function resolveProfilePriorityLabel(context) {
  return context?.activeCategoryProfileSummary?.currentPriority || null;
}

function buildPlanningLocalAnalysisFallback(context) {
  const planningSummary = context?.planningSummary || {};
  const activeCategoryId = context?.activeCategoryId || null;
  const activePriority = resolveProfilePriorityLabel(context);

  if (planningSummary?.emptyWeek) {
    return {
      kind: "chat",
      headline: "Semaine vide",
      reason: activePriority
        ? `Aucun créneau n’est posé cette semaine pour ${activePriority}. Sans premier bloc visible, le rythme ne tient pas.`
        : "Aucun créneau n’est posé cette semaine. Sans premier bloc visible, le rythme ne tient pas.",
      primaryAction: buildAction({
        label: "Ouvrir Pilotage",
        intent: "open_pilotage",
        categoryId: activeCategoryId,
        dateKey: context.activeDate,
      }),
      secondaryAction: buildAction({
        label: "Voir Today",
        intent: "open_today",
        categoryId: activeCategoryId,
        dateKey: context.activeDate,
      }),
      suggestedDurationMin: 20,
    };
  }

  if (planningSummary?.emptyDay) {
    return {
      kind: "chat",
      headline: "Journée vide",
      reason: activePriority
        ? `Aucune occurrence n’est prévue aujourd’hui pour ${activePriority}. Pose un bloc court crédible.`
        : "Aucune occurrence n’est prévue aujourd’hui. Pose un bloc court crédible.",
      primaryAction: buildAction({
        label: "Voir Today",
        intent: "open_today",
        categoryId: activeCategoryId,
        dateKey: context.activeDate,
      }),
      secondaryAction: buildAction({
        label: "Ouvrir Pilotage",
        intent: "open_pilotage",
        categoryId: activeCategoryId,
        dateKey: context.activeDate,
      }),
      suggestedDurationMin: 20,
    };
  }

  if (Number(planningSummary?.selectedDayCount || 0) > 6) {
    return {
      kind: "chat",
      headline: "Charge trop dense",
      reason: "La journée contient trop de blocs. Le risque principal est la fragmentation de l’attention.",
      primaryAction: buildAction({
        label: "Ouvrir Pilotage",
        intent: "open_pilotage",
        categoryId: activeCategoryId,
        dateKey: context.activeDate,
      }),
      secondaryAction: buildAction({
        label: "Voir Today",
        intent: "open_today",
        categoryId: activeCategoryId,
        dateKey: context.activeDate,
      }),
      suggestedDurationMin: 15,
    };
  }

  if (Number(planningSummary?.dominantCategoryShare || 0) >= 0.8 && planningSummary?.dominantCategoryName) {
    return {
      kind: "chat",
      headline: `Déséquilibre ${planningSummary.dominantCategoryName}`.slice(0, 72),
      reason: `${planningSummary.dominantCategoryName} concentre ${Math.round(
        planningSummary.dominantCategoryShare * 100,
      )}% du temps prévu. Rééquilibre avant d’ajouter de la charge.`,
      primaryAction: buildAction({
        label: "Ouvrir bibliothèque",
        intent: "open_library",
        categoryId: activeCategoryId,
        dateKey: context.activeDate,
      }),
      secondaryAction: buildAction({
        label: "Ouvrir Pilotage",
        intent: "open_pilotage",
        categoryId: activeCategoryId,
        dateKey: context.activeDate,
      }),
      suggestedDurationMin: 20,
    };
  }

  return {
    kind: "chat",
    headline: "Charge crédible",
    reason: `${planningSummary?.selectedDayCount || 0} bloc${
      Number(planningSummary?.selectedDayCount || 0) > 1 ? "s" : ""
    } prévu${Number(planningSummary?.selectedDayCount || 0) > 1 ? "s" : ""} aujourd’hui. Protège surtout le prochain bloc utile.`,
    primaryAction: buildAction({
      label: "Voir Today",
      intent: "open_today",
      categoryId: activeCategoryId,
      dateKey: context.activeDate,
    }),
    secondaryAction: buildAction({
      label: "Ouvrir Pilotage",
      intent: "open_pilotage",
      categoryId: activeCategoryId,
      dateKey: context.activeDate,
    }),
    suggestedDurationMin: 20,
  };
}

function buildPilotageLocalAnalysisFallback(context) {
  const pilotageSummary = context?.pilotageSummary || {};
  const activeCategoryId = context?.activeCategoryId || null;
  const activePriority = resolveProfilePriorityLabel(context);

  if (!activeCategoryId) {
    return {
      kind: "chat",
      headline: "Choisis une catégorie",
      reason: "Le pilotage local a besoin d’une catégorie active pour lire les signaux avec précision.",
      primaryAction: buildAction({
        label: "Ouvrir bibliothèque",
        intent: "open_library",
        categoryId: null,
        dateKey: context.activeDate,
      }),
      secondaryAction: buildAction({
        label: "Ouvrir Pilotage",
        intent: "open_pilotage",
        categoryId: null,
        dateKey: context.activeDate,
      }),
      suggestedDurationMin: null,
    };
  }

  if (Number(pilotageSummary?.expected7 || 0) === 0) {
    return {
      kind: "chat",
      headline: "Aucun rythme visible",
      reason: activePriority
        ? `Aucun bloc attendu n’alimente ${activePriority} sur la fenêtre récente.`
        : "Aucun bloc attendu n’alimente cette catégorie sur la fenêtre récente.",
      primaryAction: buildAction({
        label: "Ouvrir Pilotage",
        intent: "open_pilotage",
        categoryId: activeCategoryId,
        dateKey: context.activeDate,
      }),
      secondaryAction: buildAction({
        label: "Ouvrir bibliothèque",
        intent: "open_library",
        categoryId: activeCategoryId,
        dateKey: context.activeDate,
      }),
      suggestedDurationMin: 15,
    };
  }

  if (pilotageSummary?.disciplineTrend14d?.trendLabel === "baisse") {
    return {
      kind: "chat",
      headline: "Discipline en baisse",
      reason: "Le score récent recule. Réduis la charge ou replannifie un bloc plus tenable.",
      primaryAction: buildAction({
        label: "Ouvrir Pilotage",
        intent: "open_pilotage",
        categoryId: activeCategoryId,
        dateKey: context.activeDate,
      }),
      secondaryAction: buildAction({
        label: "Voir Today",
        intent: "open_today",
        categoryId: activeCategoryId,
        dateKey: context.activeDate,
      }),
      suggestedDurationMin: 15,
    };
  }

  if (pilotageSummary?.disciplineTrend14d?.trendLabel === "irrégularité") {
    return {
      kind: "chat",
      headline: "Rythme irrégulier",
      reason: "Le signal varie trop d’un jour à l’autre. Protège un bloc simple avant d’ajouter de la charge.",
      primaryAction: buildAction({
        label: "Voir Today",
        intent: "open_today",
        categoryId: activeCategoryId,
        dateKey: context.activeDate,
      }),
      secondaryAction: buildAction({
        label: "Ouvrir Pilotage",
        intent: "open_pilotage",
        categoryId: activeCategoryId,
        dateKey: context.activeDate,
      }),
      suggestedDurationMin: 15,
    };
  }

  return {
    kind: "chat",
    headline: "Consolide l’élan",
    reason: "Le signal est exploitable, mais il reste à consolider avec un prochain bloc clair et tenable.",
    primaryAction: buildAction({
      label: "Voir Today",
      intent: "open_today",
      categoryId: activeCategoryId,
      dateKey: context.activeDate,
    }),
    secondaryAction: buildAction({
      label: "Ouvrir bibliothèque",
      intent: "open_library",
      categoryId: activeCategoryId,
      dateKey: context.activeDate,
    }),
    suggestedDurationMin: 20,
  };
}

export function buildNowFallback(context) {
  const categoryCoherence = resolveCategoryCoherence(context);
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
        categoryCoherence?.reasonLinkType === "cross_category"
          ? `${title}${categoryCoherence?.recommendedCategoryLabel ? ` en ${categoryCoherence.recommendedCategoryLabel}` : ""} contribue a ${resolveProfileContributionLabel(context) || categoryCoherence?.contributionTargetLabel || "ta priorite active"} et reste executable maintenant.`
          : context.focusSelectionReason === "upcoming_fixed" && context.focusOccurrenceSummary?.timeLabel
          ? `${title} est le prochain créneau fixe ${context.focusOccurrenceSummary.timeLabel} et reste le meilleur levier maintenant.`
          : context.focusSelectionReason === "earliest_fixed" && context.focusOccurrenceSummary?.timeLabel
            ? `${title} est le premier créneau fixe du plan ${context.focusOccurrenceSummary.timeLabel}.`
            : resolveProfilePriorityLabel(context)
              ? `${title} est l'action la plus exécutable maintenant pour ${resolveProfilePriorityLabel(context)}.`
              : `${title} est l'action la plus exécutable dans le plan courant.`,
      primaryAction: buildAction({
        label: "Démarrer",
        intent: "start_occurrence",
        categoryId: categoryCoherence?.recommendedCategoryId || context.activeCategoryId,
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
      ? `Planifie ${candidateWithDuration || gapCandidate.title} aujourd'hui pour garder un bloc concret.`
      : "Planifie un bloc court aujourd'hui pour relancer la journée.";

    if (context.gapSummary.selectionScope === "structure_missing") {
      headline = categoryName ? `Structure ${categoryName}`.slice(0, 72) : "Structure la categorie active";
      reason =
        categoryCoherence?.explanation ||
        `Clarifie ${resolveProfileContributionLabel(context) || "l'objectif de la categorie active"} ou cree une premiere action exploitable.`;
    } else if (context.gapSummary.selectionScope === "cross_category" && gapCandidate) {
      reason =
        categoryCoherence?.explanation ||
        `Rien de credible n'est disponible dans la categorie active. ${gapCandidate.title}${candidateCategoryName ? ` en ${candidateCategoryName}` : ""} contribue a ${resolveProfileContributionLabel(context) || categoryCoherence?.contributionTargetLabel || "ta priorite active"}.`;
    }

    if (context.gapSummary.gapReason === TODAY_GAP_REASON.EMPTY_ACTIVE_CATEGORY && categoryName) {
      headline = `Rien de prévu en ${categoryName} aujourd’hui`.slice(0, 72);
      reason =
        context.gapSummary.selectionScope === "cross_category" && gapCandidate
          ? categoryCoherence?.explanation ||
            `Rien de credible n'est prevu en ${categoryName} aujourd'hui. ${gapCandidate.title}${candidateCategoryName ? ` en ${candidateCategoryName}` : ""} contribue a ${resolveProfileContributionLabel(context) || categoryCoherence?.contributionTargetLabel || categoryName}.`
          : context.gapSummary.selectionScope === "structure_missing"
            ? categoryCoherence?.explanation ||
              `Tu n'as pas encore defini d'action exploitable pour ${resolveProfileContributionLabel(context) || categoryName}. Commence par clarifier l'objectif ou creer une premiere action.`
          : gapCandidate
            ? `${gapCandidate.title} n'est pas encore planifiée aujourd'hui. Une courte action suffit pour maintenir l'élan.`
            : "Ajoute un bloc court aujourd'hui pour recréer un point d'appui.";
    } else if (context.gapSummary.gapReason === TODAY_GAP_REASON.LOW_LOAD_DAY) {
      headline = gapCandidate ? `Ajoute ${gapCandidate.title} aujourd’hui`.slice(0, 72) : "Le plan du jour reste léger";
      reason =
        context.gapSummary.selectionScope === "cross_category" && gapCandidate && categoryName
          ? categoryCoherence?.explanation ||
            `Rien de plus pertinent n'est disponible en ${categoryName} aujourd'hui. ${gapCandidate.title}${candidateCategoryName ? ` en ${candidateCategoryName}` : ""} contribue a ${resolveProfileContributionLabel(context) || categoryCoherence?.contributionTargetLabel || categoryName}${durationLabel ? ` en ${durationLabel}` : ""}.`
          : context.gapSummary.selectionScope === "structure_missing"
            ? categoryCoherence?.explanation ||
              `Le plan du jour est leger mais ${categoryName} manque encore d'action exploitable. Clarifie ${resolveProfileContributionLabel(context) || "l'objectif"} ou cree une premiere action.`
          : gapCandidate
            ? `${gapCandidate.title} n'est pas encore planifiée aujourd'hui. ${durationLabel || "Une courte durée"} suffit pour compléter la journée.`
            : "Ajoute un bloc court pour compléter la journée sans surcharge.";
    } else if (context.gapSummary.selectionScope === "cross_category" && gapCandidate && categoryName) {
      reason =
        categoryCoherence?.explanation ||
        `Rien de credible n'est prevu en ${categoryName} aujourd'hui. ${candidateWithDuration || gapCandidate.title}${candidateCategoryName ? ` en ${candidateCategoryName}` : ""} contribue a ${resolveProfileContributionLabel(context) || categoryCoherence?.contributionTargetLabel || categoryName}.`;
    }

    return {
      kind: "now",
      interventionType: TODAY_INTERVENTION_TYPE.TODAY_RECOMMENDATION,
      decisionSource: "rules",
      headline,
      reason,
      primaryAction: buildAction({
        label: context.gapSummary.selectionScope === "structure_missing" ? "Structurer" : "Planifier aujourd’hui",
        intent: "open_pilotage",
        categoryId:
          context.gapSummary.selectionScope === "structure_missing"
            ? context.activeCategoryId || null
            : categoryCoherence?.recommendedCategoryId || context.activeCategoryId || null,
        actionId: context.gapSummary.selectionScope === "structure_missing" ? null : gapCandidate?.actionId || null,
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
    reason: "Planifie un bloc court aujourd'hui pour relancer la journée.",
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
  if (context.chatMode === "free") {
    return {
      kind: "conversation",
      mode: "free",
      message:
        "Je peux t’aider à clarifier un bloc, arbitrer une hésitation ou recadrer un prochain pas. Si tu veux construire quelque chose dans l’app, active Plan.",
      primaryAction: null,
      secondaryAction: null,
      proposal: null,
    };
  }

  if (context.chatMode === "plan") {
    return {
      kind: "conversation",
      mode: "plan",
      message:
        "Je peux structurer ce projet avec toi, mais j’ai encore besoin d’un peu plus de précision. Donne-moi la catégorie visée, l’objectif recherché, ou la première action que tu imagines.",
      primaryAction: null,
      secondaryAction: null,
      proposal: null,
    };
  }

  const categoryCoherence = resolveCategoryCoherence(context);
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
      reason:
        categoryCoherence?.reasonLinkType === "cross_category"
          ? `${title}${categoryCoherence?.recommendedCategoryLabel ? ` en ${categoryCoherence.recommendedCategoryLabel}` : ""} contribue a ${resolveProfileContributionLabel(context) || categoryCoherence?.contributionTargetLabel || "ta priorite active"}.`
          : resolveProfilePriorityLabel(context)
            ? `${title} est le bloc le plus exécutable maintenant pour ${resolveProfilePriorityLabel(context)}.`
            : `${title} est le bloc le plus exécutable maintenant dans Today.`,
      primaryAction: buildAction({
        label: "Démarrer",
        intent: "start_occurrence",
        categoryId: categoryCoherence?.recommendedCategoryId || context.activeCategoryId,
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
  if (context.gapSummary?.hasGapToday) {
    return {
      kind: "chat",
      headline:
        context.gapSummary.selectionScope === "structure_missing"
          ? `Structure ${context.category?.name || "la categorie active"}`.slice(0, 72)
          : `Ajoute ${gapCandidate?.title || "une action"}`.slice(0, 72),
      reason:
        context.gapSummary.selectionScope === "structure_missing"
          ? categoryCoherence?.explanation ||
            `Clarifie ${resolveProfileContributionLabel(context) || "l'objectif de la categorie active"} ou cree une premiere action exploitable.`
          : context.gapSummary.selectionScope === "cross_category"
            ? categoryCoherence?.explanation ||
              `${gapCandidate?.title || "Cette action"} contribue a ${resolveProfileContributionLabel(context) || categoryCoherence?.contributionTargetLabel || "ta priorite active"}. Programme-la sur un bloc court concret.`
            : `${gapCandidate?.title || "Cette action"} n'est pas encore planifiée aujourd'hui. Pose un bloc court crédible.`,
      primaryAction: buildAction({
        label: context.gapSummary.selectionScope === "structure_missing" ? "Structurer" : "Planifier aujourd’hui",
        intent: "open_pilotage",
        categoryId:
          context.gapSummary.selectionScope === "structure_missing"
            ? context.activeCategoryId
            : categoryCoherence?.recommendedCategoryId || context.activeCategoryId,
        actionId:
          context.gapSummary.selectionScope === "structure_missing" ? null : gapCandidate?.actionId || null,
        dateKey: context.activeDate,
      }),
      secondaryAction: buildAction({
        label: "Ouvrir bibliothèque",
        intent: "open_library",
        categoryId: context.activeCategoryId,
        dateKey: context.activeDate,
      }),
      suggestedDurationMin: gapCandidate?.durationMin || null,
    };
  }

  return {
    kind: "chat",
    headline: "Recadre le prochain bloc",
    reason: "Ouvre le pilotage et pose une seule action de 10 min, claire et tenable aujourd'hui.",
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

export function buildLocalAnalysisFallback(context) {
  if (context?.analysisSurface === LOCAL_ANALYSIS_SURFACES.PLANNING) {
    return buildPlanningLocalAnalysisFallback(context);
  }
  if (context?.analysisSurface === LOCAL_ANALYSIS_SURFACES.PILOTAGE) {
    return buildPilotageLocalAnalysisFallback(context);
  }
  return buildChatFallback(context);
}
