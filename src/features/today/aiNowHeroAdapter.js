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

function buildFallback(localHero) {
  return {
    ...localHero,
    source: "local",
    decisionSource: "local",
    requestId: null,
  };
}

export function deriveTodayHeroChrome({ heroSource, aiNowState }) {
  if (heroSource === "ai") {
    return {
      mode: "coach",
      showBadge: true,
      badgeLabel: "Coach IA",
      showHint: false,
      hintText: "",
    };
  }

  if (aiNowState === "loading") {
    return {
      mode: "loading",
      showBadge: true,
      badgeLabel: "Coach IA",
      showHint: true,
      hintText: "Prepare la suggestion du moment",
    };
  }

  return {
    mode: "local",
    showBadge: false,
    badgeLabel: "",
    showHint: false,
    hintText: "",
  };
}

export function deriveTodayHeroModel({
  localHero,
  coach,
  occurrencesForSelectedDay,
  hasOpenSession = false,
  handlersAvailable = {},
}) {
  const fallback = buildFallback(localHero);
  if (!isPlainObject(coach) || coach.kind !== "now") return fallback;

  const headline = normalizeText(coach.headline);
  const reason = normalizeText(coach.reason);
  const primaryAction = isPlainObject(coach.primaryAction) ? coach.primaryAction : null;
  const primaryLabel = normalizeText(primaryAction?.label);
  const intent = normalizeText(primaryAction?.intent);
  if (!headline || !reason || !primaryAction || !primaryLabel || !intent) return fallback;

  if (intent === "start_occurrence") {
    const occurrence = findOccurrenceById(occurrencesForSelectedDay, primaryAction.occurrenceId);
    if (!occurrence) return fallback;
    return {
      ...fallback,
      source: "ai",
      decisionSource: coach.decisionSource || "rules",
      requestId: coach?.meta?.requestId || null,
      title: headline,
      meta: reason,
      primaryLabel,
      primaryAction: {
        kind: "start_occurrence",
        occurrence,
      },
    };
  }

  if (intent === "resume_session") {
    if (!hasOpenSession) return fallback;
    return {
      ...fallback,
      source: "ai",
      decisionSource: coach.decisionSource || "rules",
      requestId: coach?.meta?.requestId || null,
      title: headline,
      meta: reason,
      primaryLabel,
      primaryAction: {
        kind: "resume_session",
        categoryId: primaryAction.categoryId || null,
      },
    };
  }

  if (intent === "open_library") {
    if (!handlersAvailable.openLibrary) return fallback;
    return {
      ...fallback,
      source: "ai",
      decisionSource: coach.decisionSource || "rules",
      requestId: coach?.meta?.requestId || null,
      title: headline,
      meta: reason,
      primaryLabel,
      primaryAction: {
        kind: "open_library",
      },
    };
  }

  if (intent === "open_pilotage") {
    if (!handlersAvailable.openPilotage) return fallback;
    return {
      ...fallback,
      source: "ai",
      decisionSource: coach.decisionSource || "rules",
      requestId: coach?.meta?.requestId || null,
      title: headline,
      meta: reason,
      primaryLabel,
      primaryAction: {
        kind: "open_pilotage",
      },
    };
  }

  return fallback;
}
