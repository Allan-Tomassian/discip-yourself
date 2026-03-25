import {
  TODAY_GAP_REASON,
  TODAY_DIAGNOSTIC_REJECTION_REASON,
  TODAY_INTERVENTION_TYPE,
  resolveTodayOccurrenceStartPolicy,
  resolveTodayInterventionType,
} from "../../domain/todayIntervention";

const FRONTEND_TODAY_RESOLUTION_STATUS = Object.freeze({
  LOCAL_ONLY: "local_only",
  LOADING_AI: "loading_ai",
  BACKEND_ACCEPTED: "backend_accepted",
  BACKEND_RULES: "backend_rules",
  FRONTEND_LOCAL_FALLBACK: "frontend_local_fallback",
});

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizeText(value) {
  return String(value || "").trim();
}

function findOccurrenceById(occurrences, occurrenceId) {
  if (!Array.isArray(occurrences) || !occurrenceId) return null;
  return occurrences.find((occurrence) => occurrence && occurrence.id === occurrenceId) || null;
}

function formatDurationLabel(durationMin) {
  return Number.isFinite(durationMin) ? `${durationMin} min` : "";
}

function buildFallback(localHero, diagnostics = {}) {
  const hasBackendDecision = Boolean(diagnostics.backendDecisionSource);
  return {
    ...localHero,
    source: "local",
    decisionSource: "local",
    requestId: null,
    diagnostics: {
      resolutionStatus: hasBackendDecision
        ? FRONTEND_TODAY_RESOLUTION_STATUS.FRONTEND_LOCAL_FALLBACK
        : FRONTEND_TODAY_RESOLUTION_STATUS.LOCAL_ONLY,
      rejectionReason:
        diagnostics.rejectionReason ||
        diagnostics.backendRejectionReason ||
        TODAY_DIAGNOSTIC_REJECTION_REASON.NONE,
      decisionSource: "local",
      interventionType: localHero?.interventionType || null,
      canonicalContextSummary: diagnostics.canonicalContextSummary || null,
      backendDecisionSource: diagnostics.backendDecisionSource || null,
      backendResolutionStatus: diagnostics.backendResolutionStatus || null,
      backendRejectionReason: diagnostics.backendRejectionReason || TODAY_DIAGNOSTIC_REJECTION_REASON.NONE,
      badgeState: hasBackendDecision ? "coach_visible" : "hidden",
    },
  };
}

function withCategoryCoherence(model, {
  activeCategoryId = null,
  activeCategoryName = null,
  coherence = null,
} = {}) {
  const safeCoherence = coherence && typeof coherence === "object" ? coherence : {};
  return {
    ...model,
    activeCategoryId: activeCategoryId || null,
    selectionScope: safeCoherence.selectionScope || "none",
    reasonLinkType: safeCoherence.reasonLinkType || "direct_category",
    reasonLinkLabel:
      safeCoherence.reasonLinkLabel ||
      (activeCategoryName ? `Recommande dans ${activeCategoryName}` : "Recommande dans la categorie active"),
    contributionLabel: safeCoherence.contributionTargetLabel || activeCategoryName || "ta priorite active",
    recommendedCategoryLabel: safeCoherence.recommendedCategoryLabel || activeCategoryName || "",
    recommendedCategoryId: safeCoherence.recommendedCategoryId || activeCategoryId || null,
    recommendedActionId: safeCoherence.recommendedActionId || null,
    recommendedOccurrenceId: safeCoherence.recommendedOccurrenceId || null,
  };
}

function resolveCoachTargetCategoryId({ primaryAction, occurrence, goalsById }) {
  if (occurrence?.goalId) {
    return goalsById instanceof Map ? goalsById.get(occurrence.goalId)?.categoryId || null : null;
  }
  if (primaryAction?.actionId) {
    return goalsById instanceof Map ? goalsById.get(primaryAction.actionId)?.categoryId || primaryAction.categoryId || null : primaryAction.categoryId || null;
  }
  return primaryAction?.categoryId || null;
}

function isCoachCategoryCoherent({ localHero, primaryAction, occurrence = null, goalsById }) {
  const activeCategoryId = localHero?.activeCategoryId || null;
  if (!activeCategoryId) return true;
  const targetCategoryId = resolveCoachTargetCategoryId({ primaryAction, occurrence, goalsById });
  if (!targetCategoryId || targetCategoryId === activeCategoryId) return true;
  if (localHero?.reasonLinkType !== "cross_category") return false;
  if (localHero?.recommendedCategoryId && targetCategoryId !== localHero.recommendedCategoryId) return false;
  const targetActionId = occurrence?.goalId || primaryAction?.actionId || null;
  if (localHero?.recommendedActionId && targetActionId && targetActionId !== localHero.recommendedActionId) return false;
  if (localHero?.recommendedOccurrenceId && occurrence?.id && occurrence.id !== localHero.recommendedOccurrenceId) return false;
  return true;
}

export function buildLocalTodayHeroModel({
  activeDate = "",
  systemTodayKey = "",
  activeCategoryId = null,
  activeCategoryName = null,
  activeSessionForActiveDate = null,
  openSessionOutsideActiveDate = null,
  futureSessions = [],
  focusOccurrenceForActiveDate = null,
  focusTitle = "",
  focusMeta = "",
  gapSummary = null,
}) {
  const coherence = gapSummary && typeof gapSummary === "object" ? gapSummary : {};
  const interventionType = resolveTodayInterventionType({
    activeSessionForActiveDate,
    openSessionOutsideActiveDate,
    futureSessions,
    activeDate,
    systemToday: systemTodayKey,
    focusOccurrenceForActiveDate,
    gapSummary,
  });
  const startPolicy = resolveTodayOccurrenceStartPolicy({
    activeDate,
    systemToday: systemTodayKey,
    occurrenceDate: focusOccurrenceForActiveDate?.date || "",
  });
  const gapCandidate = Array.isArray(gapSummary?.candidateActionSummaries)
    ? gapSummary.candidateActionSummaries[0] || null
    : null;
  const durationLabel = formatDurationLabel(gapCandidate?.durationMin);
  const candidateWithDuration = [gapCandidate?.title || "", durationLabel].filter(Boolean).join(" • ");

  if (interventionType === TODAY_INTERVENTION_TYPE.SESSION_RESUME) {
    return withCategoryCoherence({
      interventionType,
      title: "Reprendre la session en cours",
      meta: "La session active reste le prochain levier utile.",
      primaryLabel: "Reprendre",
      primaryAction: {
        kind: "resume_session",
        categoryId: activeCategoryId,
      },
      secondaryLabel: "Voir progression",
    }, { activeCategoryId, activeCategoryName, coherence });
  }

  if (focusOccurrenceForActiveDate && startPolicy.canStartDirectly) {
    return withCategoryCoherence({
      interventionType: TODAY_INTERVENTION_TYPE.TODAY_RECOMMENDATION,
      title: focusTitle || "Action du moment",
      meta:
        coherence.reasonLinkType === "cross_category"
          ? coherence.explanation || "Cette action contribue a ta priorite active."
          : focusMeta || "C'est l'action la plus exécutable maintenant.",
      primaryLabel: "Démarrer",
      primaryAction: {
        kind: "start_occurrence",
        occurrence: focusOccurrenceForActiveDate,
      },
      secondaryLabel: "Voir progression",
    }, { activeCategoryId, activeCategoryName, coherence });
  }

  if (interventionType === TODAY_INTERVENTION_TYPE.SCHEDULE_WARNING) {
    return withCategoryCoherence({
      interventionType,
      title: "Une session ouverte est planifiée sur une autre date.",
      meta: openSessionOutsideActiveDate?.dateKey
        ? `La session ouverte reste liée au ${openSessionOutsideActiveDate.dateKey}. Vérifie le planning avant de reprendre.`
        : "Vérifie le planning avant de reprendre.",
      primaryLabel: "Voir pilotage",
      primaryAction: {
        kind: "open_pilotage",
      },
      secondaryLabel: "Voir progression",
    }, { activeCategoryId, activeCategoryName, coherence });
  }

  if (focusOccurrenceForActiveDate && startPolicy.requiresReschedule) {
    return withCategoryCoherence({
      interventionType: TODAY_INTERVENTION_TYPE.TODAY_RECOMMENDATION,
      title: focusTitle || "Cette action n'est pas exécutable directement aujourd'hui.",
      meta:
        coherence.reasonLinkType === "cross_category"
          ? coherence.explanation || "Cette action contribue a ta priorite active."
          : startPolicy.datePhase === "future"
          ? [focusMeta, "Planifiée pour une autre date. Replanifie-la pour l'exécuter aujourd'hui."]
              .filter(Boolean)
              .join(" • ")
          : [focusMeta, "Cette occurrence appartient à une date passée. Replanifie-la avant de la relancer."]
              .filter(Boolean)
              .join(" • "),
      primaryLabel: startPolicy.datePhase === "future" ? "Replanifier aujourd’hui" : "Replanifier",
      primaryAction: {
        kind: "open_pilotage",
      },
      secondaryLabel: "Voir progression",
    }, { activeCategoryId, activeCategoryName, coherence });
  }

  if (gapSummary?.hasGapToday) {
    let title = "Aucune action prévue aujourd’hui";
    const candidateCategoryName = gapCandidate?.categoryName || null;
    let meta = gapCandidate
      ? `Tu peux planifier ${candidateWithDuration || gapCandidate.title} aujourd'hui pour maintenir la continuité.`
      : "Planifie une action simple aujourd'hui pour maintenir la continuité.";

    if (gapSummary.selectionScope === "structure_missing") {
      title = activeCategoryName ? `Structurer ${activeCategoryName}` : "Structurer la categorie active";
      meta =
        coherence.explanation ||
        "Clarifie l'objectif de la categorie active ou cree une premiere action exploitable.";
    } else if (gapSummary.gapReason === TODAY_GAP_REASON.EMPTY_ACTIVE_CATEGORY && activeCategoryName) {
      title = `Rien de prévu en ${activeCategoryName} aujourd’hui`;
      meta =
        gapSummary.selectionScope === "cross_category" && gapCandidate
          ? coherence.explanation ||
            `Rien de credible n'est prevu en ${activeCategoryName} aujourd'hui. ${gapCandidate.title}${candidateCategoryName ? ` en ${candidateCategoryName}` : ""} contribue a ${coherence.contributionTargetLabel || activeCategoryName}.`
          : gapCandidate
            ? `${gapCandidate.title} n'est pas encore planifiée aujourd'hui. Une courte action suffit pour maintenir l'élan.`
            : "Une courte action suffit pour maintenir l'élan aujourd'hui.";
    } else if (gapSummary.gapReason === TODAY_GAP_REASON.LOW_LOAD_DAY) {
      title = gapCandidate ? `Ajoute ${gapCandidate.title} aujourd’hui` : "Le plan du jour reste léger";
      meta =
        gapSummary.selectionScope === "cross_category" && gapCandidate && activeCategoryName
          ? coherence.explanation ||
            `Rien de plus pertinent n'est disponible en ${activeCategoryName} aujourd'hui. ${gapCandidate.title}${candidateCategoryName ? ` en ${candidateCategoryName}` : ""} contribue a ${coherence.contributionTargetLabel || activeCategoryName}${durationLabel ? ` en ${durationLabel}` : ""}.`
          : gapCandidate
            ? `${gapCandidate.title} n'est pas encore planifiée aujourd'hui. ${durationLabel || "Une courte durée"} suffit pour compléter la journée.`
            : "Une action simple peut compléter la journée sans surcharge.";
    } else if (gapSummary.selectionScope === "cross_category" && gapCandidate && activeCategoryName) {
      meta =
        coherence.explanation ||
        `Rien de credible n'est prevu en ${activeCategoryName} aujourd'hui. Tu peux planifier ${candidateWithDuration || gapCandidate.title}${candidateCategoryName ? ` en ${candidateCategoryName}` : ""} pour contribuer a ${coherence.contributionTargetLabel || activeCategoryName}.`;
    }

    return withCategoryCoherence({
      interventionType: TODAY_INTERVENTION_TYPE.TODAY_RECOMMENDATION,
      title,
      meta,
      primaryLabel: gapSummary.selectionScope === "structure_missing" ? "Structurer" : "Planifier aujourd’hui",
      primaryAction: {
        kind: "open_pilotage",
      },
      secondaryLabel: "Voir progression",
    }, { activeCategoryId, activeCategoryName, coherence });
  }

  return withCategoryCoherence({
    interventionType: TODAY_INTERVENTION_TYPE.TODAY_RECOMMENDATION,
    title: focusTitle || "Aucune action planifiée pour cette date.",
    meta:
      activeDate === systemTodayKey
        ? focusMeta || "Planifie une action simple pour garder le rythme."
        : focusMeta || "Crée ou planifie une action depuis Bibliothèque.",
    primaryLabel: activeDate === systemTodayKey ? "Planifier aujourd’hui" : "Aucune action active",
    primaryAction:
      activeDate === systemTodayKey
        ? {
            kind: "open_pilotage",
          }
        : null,
    secondaryLabel: "Voir progression",
  }, { activeCategoryId, activeCategoryName, coherence });
}

export function deriveTodayHeroChrome({ todayDecisionDiagnostics }) {
  const resolutionStatus = todayDecisionDiagnostics?.resolutionStatus || FRONTEND_TODAY_RESOLUTION_STATUS.LOCAL_ONLY;

  if (resolutionStatus === FRONTEND_TODAY_RESOLUTION_STATUS.LOADING_AI) {
    return {
      mode: "loading",
      showBadge: true,
      badgeLabel: "Coach IA",
      badgeTone: "ai",
      showLiveDot: true,
      showHint: true,
      hintText: "Analyse du plan du jour",
      hintTone: "loading",
    };
  }

  if (resolutionStatus === FRONTEND_TODAY_RESOLUTION_STATUS.BACKEND_ACCEPTED) {
    return {
      mode: "coach",
      showBadge: true,
      badgeLabel: "Coach IA",
      badgeTone: "ai",
      showLiveDot: false,
      showHint: false,
      hintText: "",
      hintTone: "",
    };
  }

  if (
    resolutionStatus === FRONTEND_TODAY_RESOLUTION_STATUS.BACKEND_RULES ||
    resolutionStatus === FRONTEND_TODAY_RESOLUTION_STATUS.FRONTEND_LOCAL_FALLBACK
  ) {
    return {
      mode: "guarded",
      showBadge: true,
      badgeLabel: "Coach",
      badgeTone: "guarded",
      showLiveDot: false,
      showHint: true,
      hintText: "Suggestion sécurisée",
      hintTone: "guarded",
    };
  }

  return {
    mode: "local",
    showBadge: false,
    badgeLabel: "",
    badgeTone: "",
    showLiveDot: false,
    showHint: false,
    hintText: "",
    hintTone: "",
  };
}

function resolveFrontendFallbackReason({ coach, fallback, handlersAvailable, hasOpenSession }) {
  const intent = normalizeText(coach?.primaryAction?.intent);
  if (!intent) return TODAY_DIAGNOSTIC_REJECTION_REASON.INVALID_INTERVENTION_TYPE;
  if (intent === "resume_session" && !hasOpenSession) {
    return TODAY_DIAGNOSTIC_REJECTION_REASON.NO_ACTIVE_SESSION_FOR_DATE;
  }
  if (intent === "open_library" && !handlersAvailable.openLibrary) {
    return TODAY_DIAGNOSTIC_REJECTION_REASON.CANONICAL_FALLBACK_PREFERRED;
  }
  if (intent === "open_pilotage" && !handlersAvailable.openPilotage) {
    return TODAY_DIAGNOSTIC_REJECTION_REASON.CANONICAL_FALLBACK_PREFERRED;
  }
  if (intent === "start_occurrence" && !coach?.primaryAction?.occurrenceId) {
    return TODAY_DIAGNOSTIC_REJECTION_REASON.INVALID_INTERVENTION_TYPE;
  }
  if (intent === "open_today") {
    return TODAY_DIAGNOSTIC_REJECTION_REASON.INVALID_INTERVENTION_TYPE;
  }
  if (fallback?.interventionType && coach?.interventionType && fallback.interventionType !== coach.interventionType) {
    return TODAY_DIAGNOSTIC_REJECTION_REASON.CANONICAL_FALLBACK_PREFERRED;
  }
  return TODAY_DIAGNOSTIC_REJECTION_REASON.CANONICAL_FALLBACK_PREFERRED;
}

export function deriveTodayDecisionDiagnostics({
  aiNowState,
  heroViewModel,
  coach = null,
  canonicalContextSummary = null,
}) {
  const backendDiagnostics = coach?.meta?.diagnostics || null;
  if (heroViewModel?.source === "ai") {
    return {
      resolutionStatus:
        coach?.decisionSource === "rules"
          ? FRONTEND_TODAY_RESOLUTION_STATUS.BACKEND_RULES
          : FRONTEND_TODAY_RESOLUTION_STATUS.BACKEND_ACCEPTED,
      rejectionReason: backendDiagnostics?.rejectionReason || TODAY_DIAGNOSTIC_REJECTION_REASON.NONE,
      decisionSource: coach?.decisionSource || "rules",
      interventionType: coach?.interventionType || heroViewModel?.interventionType || null,
      canonicalContextSummary: canonicalContextSummary || backendDiagnostics?.canonicalContextSummary || null,
      badgeState: "coach_visible",
    };
  }

  if (aiNowState === "loading") {
    return {
      resolutionStatus: FRONTEND_TODAY_RESOLUTION_STATUS.LOADING_AI,
      rejectionReason: TODAY_DIAGNOSTIC_REJECTION_REASON.NONE,
      decisionSource: "local",
      interventionType: heroViewModel?.interventionType || null,
      canonicalContextSummary: canonicalContextSummary || null,
      badgeState: "loading",
    };
  }

  if (aiNowState === "success" && coach) {
    return {
      resolutionStatus: FRONTEND_TODAY_RESOLUTION_STATUS.FRONTEND_LOCAL_FALLBACK,
      rejectionReason:
        heroViewModel?.diagnostics?.rejectionReason ||
        TODAY_DIAGNOSTIC_REJECTION_REASON.CANONICAL_FALLBACK_PREFERRED,
      decisionSource: "local",
      interventionType: heroViewModel?.interventionType || null,
      canonicalContextSummary: canonicalContextSummary || backendDiagnostics?.canonicalContextSummary || null,
      badgeState: "coach_visible",
    };
  }

  return {
    resolutionStatus: FRONTEND_TODAY_RESOLUTION_STATUS.LOCAL_ONLY,
    rejectionReason: TODAY_DIAGNOSTIC_REJECTION_REASON.NONE,
      decisionSource: "local",
      interventionType: heroViewModel?.interventionType || null,
      canonicalContextSummary: canonicalContextSummary || null,
    badgeState: "hidden",
  };
}

export function deriveTodayHeroModel({
  localHero,
  coach,
  occurrencesForSelectedDay,
  goalsById,
  hasOpenSession = false,
  handlersAvailable = {},
  canonicalContextSummary = null,
  systemTodayKey = "",
}) {
  const fallback = buildFallback(localHero, { canonicalContextSummary });
  if (!isPlainObject(coach) || coach.kind !== "now") return fallback;

  const headline = normalizeText(coach.headline);
  const reason = normalizeText(coach.reason);
  const primaryAction = isPlainObject(coach.primaryAction) ? coach.primaryAction : null;
  const primaryLabel = normalizeText(primaryAction?.label);
  const intent = normalizeText(primaryAction?.intent);
  if (!headline || !reason || !primaryAction || !primaryLabel || !intent) {
    return buildFallback(localHero, {
      canonicalContextSummary,
      backendDecisionSource: coach?.decisionSource || null,
      backendResolutionStatus: coach?.meta?.diagnostics?.resolutionStatus || null,
      backendRejectionReason: coach?.meta?.diagnostics?.rejectionReason || TODAY_DIAGNOSTIC_REJECTION_REASON.NONE,
    });
  }

  if (intent === "start_occurrence") {
    const occurrence = findOccurrenceById(occurrencesForSelectedDay, primaryAction.occurrenceId);
    if (!occurrence) {
      return buildFallback(localHero, {
        canonicalContextSummary,
        backendDecisionSource: coach?.decisionSource || null,
        backendResolutionStatus: coach?.meta?.diagnostics?.resolutionStatus || null,
        backendRejectionReason: resolveFrontendFallbackReason({
          coach,
          fallback,
          handlersAvailable,
          hasOpenSession,
        }),
      });
    }
    if (!isCoachCategoryCoherent({ localHero, primaryAction, occurrence, goalsById })) {
      return buildFallback(localHero, {
        canonicalContextSummary,
        backendDecisionSource: coach?.decisionSource || null,
        backendResolutionStatus: coach?.meta?.diagnostics?.resolutionStatus || null,
        backendRejectionReason: TODAY_DIAGNOSTIC_REJECTION_REASON.CANONICAL_FALLBACK_PREFERRED,
      });
    }
    const startPolicy = resolveTodayOccurrenceStartPolicy({
      activeDate: canonicalContextSummary?.activeDate || primaryAction.dateKey || "",
      systemToday: systemTodayKey,
      occurrenceDate: occurrence?.date || primaryAction.dateKey || "",
    });
    if (!startPolicy.canStartDirectly) {
      return buildFallback(localHero, {
        canonicalContextSummary,
        backendDecisionSource: coach?.decisionSource || null,
        backendResolutionStatus: coach?.meta?.diagnostics?.resolutionStatus || null,
        backendRejectionReason: TODAY_DIAGNOSTIC_REJECTION_REASON.INVALID_INTERVENTION_TYPE,
      });
    }
    return {
      ...fallback,
      source: "ai",
      decisionSource: coach.decisionSource || "rules",
      interventionType: coach.interventionType || fallback.interventionType || null,
      requestId: coach?.meta?.requestId || null,
      title: headline,
      meta: reason,
      primaryLabel,
      primaryAction: {
        kind: "start_occurrence",
        occurrence,
      },
      diagnostics: {
        resolutionStatus:
          coach?.decisionSource === "rules"
            ? FRONTEND_TODAY_RESOLUTION_STATUS.BACKEND_RULES
            : FRONTEND_TODAY_RESOLUTION_STATUS.BACKEND_ACCEPTED,
        rejectionReason: coach?.meta?.diagnostics?.rejectionReason || TODAY_DIAGNOSTIC_REJECTION_REASON.NONE,
        decisionSource: coach?.decisionSource || "rules",
        interventionType: coach?.interventionType || fallback.interventionType || null,
        canonicalContextSummary:
          canonicalContextSummary || coach?.meta?.diagnostics?.canonicalContextSummary || null,
        backendDecisionSource: coach?.decisionSource || "rules",
        backendResolutionStatus: coach?.meta?.diagnostics?.resolutionStatus || null,
        backendRejectionReason: coach?.meta?.diagnostics?.rejectionReason || TODAY_DIAGNOSTIC_REJECTION_REASON.NONE,
        badgeState: "coach_visible",
      },
    };
  }

  if (intent === "resume_session") {
    if (!hasOpenSession) {
      return buildFallback(localHero, {
        canonicalContextSummary,
        backendDecisionSource: coach?.decisionSource || null,
        backendResolutionStatus: coach?.meta?.diagnostics?.resolutionStatus || null,
        backendRejectionReason: TODAY_DIAGNOSTIC_REJECTION_REASON.NO_ACTIVE_SESSION_FOR_DATE,
      });
    }
    return {
      ...fallback,
      source: "ai",
      decisionSource: coach.decisionSource || "rules",
      interventionType: coach.interventionType || fallback.interventionType || null,
      requestId: coach?.meta?.requestId || null,
      title: headline,
      meta: reason,
      primaryLabel,
      primaryAction: {
        kind: "resume_session",
        categoryId: primaryAction.categoryId || null,
      },
      diagnostics: {
        resolutionStatus:
          coach?.decisionSource === "rules"
            ? FRONTEND_TODAY_RESOLUTION_STATUS.BACKEND_RULES
            : FRONTEND_TODAY_RESOLUTION_STATUS.BACKEND_ACCEPTED,
        rejectionReason: coach?.meta?.diagnostics?.rejectionReason || TODAY_DIAGNOSTIC_REJECTION_REASON.NONE,
        decisionSource: coach?.decisionSource || "rules",
        interventionType: coach?.interventionType || fallback.interventionType || null,
        canonicalContextSummary:
          canonicalContextSummary || coach?.meta?.diagnostics?.canonicalContextSummary || null,
        backendDecisionSource: coach?.decisionSource || "rules",
        backendResolutionStatus: coach?.meta?.diagnostics?.resolutionStatus || null,
        backendRejectionReason: coach?.meta?.diagnostics?.rejectionReason || TODAY_DIAGNOSTIC_REJECTION_REASON.NONE,
        badgeState: "coach_visible",
      },
    };
  }

  if (intent === "open_library") {
    if (!handlersAvailable.openLibrary) {
      return buildFallback(localHero, {
        canonicalContextSummary,
        backendDecisionSource: coach?.decisionSource || null,
        backendResolutionStatus: coach?.meta?.diagnostics?.resolutionStatus || null,
        backendRejectionReason: TODAY_DIAGNOSTIC_REJECTION_REASON.CANONICAL_FALLBACK_PREFERRED,
      });
    }
    return {
      ...fallback,
      source: "ai",
      decisionSource: coach.decisionSource || "rules",
      interventionType: coach.interventionType || fallback.interventionType || null,
      requestId: coach?.meta?.requestId || null,
      title: headline,
      meta: reason,
      primaryLabel,
      primaryAction: {
        kind: "open_library",
      },
      diagnostics: {
        resolutionStatus:
          coach?.decisionSource === "rules"
            ? FRONTEND_TODAY_RESOLUTION_STATUS.BACKEND_RULES
            : FRONTEND_TODAY_RESOLUTION_STATUS.BACKEND_ACCEPTED,
        rejectionReason: coach?.meta?.diagnostics?.rejectionReason || TODAY_DIAGNOSTIC_REJECTION_REASON.NONE,
        decisionSource: coach?.decisionSource || "rules",
        interventionType: coach?.interventionType || fallback.interventionType || null,
        canonicalContextSummary:
          canonicalContextSummary || coach?.meta?.diagnostics?.canonicalContextSummary || null,
        backendDecisionSource: coach?.decisionSource || "rules",
        backendResolutionStatus: coach?.meta?.diagnostics?.resolutionStatus || null,
        backendRejectionReason: coach?.meta?.diagnostics?.rejectionReason || TODAY_DIAGNOSTIC_REJECTION_REASON.NONE,
        badgeState: "coach_visible",
      },
    };
  }

  if (intent === "open_pilotage") {
    if (!handlersAvailable.openPilotage) {
      return buildFallback(localHero, {
        canonicalContextSummary,
        backendDecisionSource: coach?.decisionSource || null,
        backendResolutionStatus: coach?.meta?.diagnostics?.resolutionStatus || null,
        backendRejectionReason: TODAY_DIAGNOSTIC_REJECTION_REASON.CANONICAL_FALLBACK_PREFERRED,
      });
    }
    if (!isCoachCategoryCoherent({ localHero, primaryAction, goalsById })) {
      return buildFallback(localHero, {
        canonicalContextSummary,
        backendDecisionSource: coach?.decisionSource || null,
        backendResolutionStatus: coach?.meta?.diagnostics?.resolutionStatus || null,
        backendRejectionReason: TODAY_DIAGNOSTIC_REJECTION_REASON.CANONICAL_FALLBACK_PREFERRED,
      });
    }
    return {
      ...fallback,
      source: "ai",
      decisionSource: coach.decisionSource || "rules",
      interventionType: coach.interventionType || fallback.interventionType || null,
      requestId: coach?.meta?.requestId || null,
      title: headline,
      meta: reason,
      primaryLabel,
      primaryAction: {
        kind: "open_pilotage",
      },
      diagnostics: {
        resolutionStatus:
          coach?.decisionSource === "rules"
            ? FRONTEND_TODAY_RESOLUTION_STATUS.BACKEND_RULES
            : FRONTEND_TODAY_RESOLUTION_STATUS.BACKEND_ACCEPTED,
        rejectionReason: coach?.meta?.diagnostics?.rejectionReason || TODAY_DIAGNOSTIC_REJECTION_REASON.NONE,
        decisionSource: coach?.decisionSource || "rules",
        interventionType: coach?.interventionType || fallback.interventionType || null,
        canonicalContextSummary:
          canonicalContextSummary || coach?.meta?.diagnostics?.canonicalContextSummary || null,
        backendDecisionSource: coach?.decisionSource || "rules",
        backendResolutionStatus: coach?.meta?.diagnostics?.resolutionStatus || null,
        backendRejectionReason: coach?.meta?.diagnostics?.rejectionReason || TODAY_DIAGNOSTIC_REJECTION_REASON.NONE,
        badgeState: "coach_visible",
      },
    };
  }

  return buildFallback(localHero, {
    canonicalContextSummary,
    backendDecisionSource: coach?.decisionSource || null,
    backendResolutionStatus: coach?.meta?.diagnostics?.resolutionStatus || null,
    backendRejectionReason: resolveFrontendFallbackReason({
      coach,
      fallback,
      handlersAvailable,
      hasOpenSession,
    }),
  });
}
