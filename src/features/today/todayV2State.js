import { TODAY_SCREEN_COPY } from "../../ui/labels";

const INACTIVE_OCCURRENCE_STATUSES = new Set(["done", "skipped", "canceled", "missed", "rescheduled"]);

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function safeNumber(value) {
  return Number.isFinite(value) ? Math.max(0, Math.round(value)) : 0;
}

function formatMinutesLabel(value) {
  const safe = safeNumber(value);
  return safe > 0 ? `${safe} min` : "";
}

function buildCoachPrefill(kind, categoryLabel = "") {
  const suffix = categoryLabel ? ` en ${categoryLabel}` : "";
  if (kind === "clarify") {
    return `Aide-moi à clarifier mon prochain bloc${suffix}. Je veux repartir avec une seule action concrète pour maintenant.`;
  }
  if (kind === "overload") {
    return `Aide-moi à alléger ma journée${suffix}. Je veux identifier quoi retirer, reporter ou simplifier sans tout refaire.`;
  }
  if (kind === "validated") {
    return `Aide-moi à préparer le prochain pas utile${suffix}. Je veux garder l’élan sans rallonger inutilement la journée.`;
  }
  return "";
}

function buildFallbackHero({
  heroViewModel,
  heroOccurrence,
  categoryLabel,
}) {
  return {
    title: heroViewModel?.title || TODAY_SCREEN_COPY.noPriorityTitle,
    reason: heroViewModel?.meta || TODAY_SCREEN_COPY.noPriorityReason,
    categoryLabel: categoryLabel || TODAY_SCREEN_COPY.priorityCategoryFallback,
    durationLabel: formatMinutesLabel(heroOccurrence?.durationMinutes),
    primaryLabel: heroViewModel?.primaryLabel || TODAY_SCREEN_COPY.primaryAction,
    primaryAction: heroViewModel?.primaryAction || null,
    secondaryLabel: "",
    secondaryAction: null,
  };
}

export function deriveTodayV2State({
  selectedDateKey,
  localTodayKey,
  activeSessionForActiveDate,
  heroViewModel,
  heroOccurrence,
  focusCategory,
  localGapSummary,
  dailyState,
  occurrencesForSelectedDay,
  nextActions,
}) {
  const isToday = selectedDateKey === localTodayKey;
  const categoryLabel =
    heroViewModel?.recommendedCategoryLabel ||
    focusCategory?.name ||
    TODAY_SCREEN_COPY.priorityCategoryFallback;
  const pendingOccurrences = safeArray(occurrencesForSelectedDay).filter((occurrence) => {
    const status = typeof occurrence?.status === "string" ? occurrence.status : "";
    return !INACTIVE_OCCURRENCE_STATUSES.has(status);
  });
  const pendingCount = pendingOccurrences.length;
  const remainingMinutes = safeNumber(dailyState?.remainingMinutes);
  const doneMinutes = safeNumber(dailyState?.doneMinutes);
  const hasActiveSession = Boolean(activeSessionForActiveDate);
  const startableNow = heroViewModel?.primaryAction?.kind === "start_occurrence" && Boolean(heroOccurrence?.id);
  const isValidated = isToday && !hasActiveSession && pendingCount === 0 && doneMinutes > 0;
  const isOverload =
    isToday &&
    !hasActiveSession &&
    (pendingCount >= 5 || (pendingCount >= 4 && remainingMinutes >= 120) || remainingMinutes >= 240);
  const alternatives = safeArray(nextActions).slice(0, 2);

  if (!isToday) {
    return {
      state: "legacy_fallback",
      hero: buildFallbackHero({ heroViewModel, heroOccurrence, categoryLabel }),
      alternatives,
      showProgress: true,
      coachPrefill: "",
    };
  }

  if (hasActiveSession) {
    return {
      state: "ready",
      hero: {
        ...buildFallbackHero({ heroViewModel, heroOccurrence, categoryLabel }),
        title: heroViewModel?.title || TODAY_SCREEN_COPY.resumeSessionTitle,
        primaryLabel: TODAY_SCREEN_COPY.resumeSessionAction,
        primaryAction: {
          kind: "resume_session",
          categoryId: focusCategory?.id || null,
        },
      },
      alternatives,
      showProgress: true,
      coachPrefill: "",
    };
  }

  if (isValidated) {
    const coachPrefill = buildCoachPrefill("validated", categoryLabel);
    return {
      state: "validated",
      hero: {
        title: TODAY_SCREEN_COPY.validatedTitle,
        reason: TODAY_SCREEN_COPY.validatedReason,
        categoryLabel,
        durationLabel: "",
        primaryLabel: TODAY_SCREEN_COPY.prepareNextStep,
        primaryAction: { kind: "open_coach", mode: "free", prefill: coachPrefill },
        secondaryLabel: "",
        secondaryAction: null,
      },
      alternatives: [],
      showProgress: true,
      coachPrefill,
    };
  }

  if (isOverload) {
    const coachPrefill = buildCoachPrefill("overload", categoryLabel);
    return {
      state: "overload",
      hero: {
        title: TODAY_SCREEN_COPY.overloadTitle,
        reason:
          pendingCount > 0 && remainingMinutes > 0
            ? `Encore ${pendingCount} bloc${pendingCount > 1 ? "s" : ""} et ${remainingMinutes} min à absorber aujourd’hui.`
            : TODAY_SCREEN_COPY.overloadReason,
        categoryLabel,
        durationLabel: "",
        primaryLabel: TODAY_SCREEN_COPY.relieveDay,
        primaryAction: { kind: "open_coach", mode: "free", prefill: coachPrefill },
        secondaryLabel: TODAY_SCREEN_COPY.reviewPlanning,
        secondaryAction: { kind: "open_planning_for_today" },
      },
      alternatives: [],
      showProgress: true,
      coachPrefill,
    };
  }

  if (startableNow) {
    return {
      state: "ready",
      hero: buildFallbackHero({ heroViewModel, heroOccurrence, categoryLabel }),
      alternatives,
      showProgress: true,
      coachPrefill: "",
    };
  }

  const clarifyReason =
    localGapSummary?.selectionScope === "structure_missing" && categoryLabel
      ? `Aucun bloc crédible n’est encore posé en ${categoryLabel}.`
      : localGapSummary?.explanation || TODAY_SCREEN_COPY.clarifyReason;
  const coachPrefill = buildCoachPrefill("clarify", categoryLabel);
  return {
    state: "clarify",
    hero: {
      title: TODAY_SCREEN_COPY.clarifyTitle,
      reason: clarifyReason,
      categoryLabel,
      durationLabel: "",
      primaryLabel: TODAY_SCREEN_COPY.clarifyNextBlock,
      primaryAction: { kind: "open_coach", mode: "free", prefill: coachPrefill },
      secondaryLabel: TODAY_SCREEN_COPY.createAction,
      secondaryAction: { kind: "open_create_habit" },
    },
    alternatives: [],
    showProgress: true,
    coachPrefill,
  };
}
