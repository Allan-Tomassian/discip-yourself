import { normalizeActiveSessionForUI } from "../../logic/compat";
import { computeWindowStats } from "../../logic/progressionModel";
import { isRuntimeSessionOpen } from "../../logic/sessionRuntime";
import {
  OCCURRENCE_STATUS,
  normalizeOccurrenceStatus,
} from "../../logic/occurrenceStatus";
import { isPrimaryGoal } from "../../logic/priority";
import { normalizeLocalDateKey, fromLocalDateKey, toLocalDateKey } from "../../utils/dateKey";
import { parseTimeToMinutes } from "../../utils/datetime";

const SCORE_WINDOW_DAYS = 14;
const EMPTY_SCORE_LABEL = "--%";
const DEFAULT_DELTA_LABEL = "Point de départ";
const DEFAULT_FALLBACK_NAME = "Discip Yourself";
const TOTAL_EXCLUDED_STATUSES = new Set([
  OCCURRENCE_STATUS.CANCELED,
  OCCURRENCE_STATUS.SKIPPED,
  OCCURRENCE_STATUS.RESCHEDULED,
]);
const TIMELINE_HIDDEN_STATUSES = new Set([
  OCCURRENCE_STATUS.CANCELED,
  OCCURRENCE_STATUS.SKIPPED,
]);

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function safeString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function safeNow(value) {
  return value instanceof Date && !Number.isNaN(value.getTime()) ? value : new Date();
}

function addDaysKey(dateKey, delta) {
  const base = fromLocalDateKey(dateKey);
  base.setDate(base.getDate() + delta);
  return toLocalDateKey(base);
}

function formatDateLabel(date, fallbackKey = "") {
  try {
    return new Intl.DateTimeFormat("fr-FR", {
      weekday: "long",
      month: "long",
      day: "numeric",
    }).format(date);
  } catch {
    return fallbackKey;
  }
}

function formatDateCode(date, fallbackKey = "") {
  try {
    const day = new Intl.DateTimeFormat("fr-FR", { day: "2-digit" }).format(date);
    const month = new Intl.DateTimeFormat("fr-FR", { month: "short" })
      .format(date)
      .replace(".", "")
      .toUpperCase();
    return `${day} ${month}.`;
  } catch {
    return fallbackKey;
  }
}

function formatDurationLabel(value) {
  const numeric = typeof value === "string" ? Number(value) : value;
  if (!Number.isFinite(numeric) || numeric <= 0) return "";
  return `${Math.round(numeric)} min`;
}

function parsePercentLabel(value) {
  const raw = safeString(value).replace("%", "");
  const numeric = Number(raw);
  return Number.isFinite(numeric) ? numeric : null;
}

function compareOccurrences(left, right) {
  const leftStart = safeString(left?.start) || safeString(left?.slotKey);
  const rightStart = safeString(right?.start) || safeString(right?.slotKey);
  if (leftStart !== rightStart) return leftStart.localeCompare(rightStart);
  return safeString(left?.title).localeCompare(safeString(right?.title));
}

function resolveProfileRow(profile) {
  if (!profile) return {};
  if (isPlainObject(profile.profile)) return profile.profile;
  return isPlainObject(profile) ? profile : {};
}

function buildUserDisplay({ data, auth, profile }) {
  const providerProfile = resolveProfileRow(profile);
  const legacyProfile = isPlainObject(data?.profile) ? data.profile : {};
  const authUser = isPlainObject(auth?.user) ? auth.user : {};
  const emailName = safeString(authUser.email).split("@")[0] || "";
  const displayName =
    safeString(providerProfile.full_name) ||
    safeString(providerProfile.username) ||
    safeString(legacyProfile.full_name) ||
    safeString(legacyProfile.username) ||
    safeString(legacyProfile.name) ||
    emailName ||
    DEFAULT_FALLBACK_NAME;

  return {
    displayName,
    avatarLabel: displayName,
    avatarUrl:
      safeString(providerProfile.avatar_url) ||
      safeString(providerProfile.avatarUrl) ||
      safeString(legacyProfile.avatar_url) ||
      safeString(legacyProfile.avatarUrl),
    profileLoading: Boolean(profile?.loading),
    profileError: safeString(profile?.loadError),
  };
}

function buildScoreWindow(data, endKey, windowDays = SCORE_WINDOW_DAYS) {
  const safeEnd = normalizeLocalDateKey(endKey);
  if (!safeEnd) {
    return { available: false, score: null, expected: 0 };
  }
  const fromKey = addDaysKey(safeEnd, -(Math.max(1, windowDays) - 1));
  const stats = computeWindowStats(data, fromKey, safeEnd, { includeMicroContribution: true });
  const expected = Number.isFinite(stats?.discipline?.expected) ? stats.discipline.expected : 0;
  if (expected <= 0) {
    return { available: false, score: null, expected: 0, fromKey, toKey: safeEnd };
  }
  const score = Number.isFinite(stats?.discipline?.score)
    ? Math.max(0, Math.min(100, Math.round(stats.discipline.score)))
    : null;
  return {
    available: Number.isFinite(score),
    score,
    expected,
    fromKey,
    toKey: safeEnd,
  };
}

function buildScoreDisplay(data, selectedDateKey) {
  const yesterdayKey = addDaysKey(selectedDateKey, -1);
  const dayBeforeKey = addDaysKey(selectedDateKey, -2);
  const current = buildScoreWindow(data, yesterdayKey);
  const previous = buildScoreWindow(data, dayBeforeKey);

  const scoreAvailable = Boolean(current.available);
  const scoreDisplay = scoreAvailable ? `${current.score}%` : EMPTY_SCORE_LABEL;

  if (!current.available || !previous.available) {
    return {
      scoreDisplay,
      scoreAvailable,
      previousDayDeltaDisplay: DEFAULT_DELTA_LABEL,
      previousDayDeltaAvailable: false,
    };
  }

  const delta = Math.round(current.score - previous.score);
  const prefix = delta > 0 ? "+" : "";
  return {
    scoreDisplay,
    scoreAvailable,
    previousDayDeltaDisplay: `${prefix}${delta}% vs hier`,
    previousDayDeltaAvailable: true,
  };
}

function resolveOccurrenceTimeLabel(occurrence) {
  if (!occurrence || occurrence.noTime === true) return "--:--";
  return safeString(occurrence.start) || safeString(occurrence.slotKey) || "--:--";
}

function resolveOccurrenceGoal(occurrence, goalsById) {
  return goalsById.get(safeString(occurrence?.goalId)) || null;
}

function resolveOccurrenceCategory(goal, categoriesById) {
  return categoriesById.get(safeString(goal?.categoryId)) || null;
}

function isHighPriority(occurrence, goal) {
  const raw =
    safeString(occurrence?.priority) ||
    safeString(occurrence?.priorityLevel) ||
    safeString(goal?.priority) ||
    safeString(goal?.priorityLevel);
  const key = raw.toLowerCase();
  return key === "prioritaire" || key === "primary" || key === "high";
}

function resolvePriorityLabel(occurrence, goal) {
  if (isHighPriority(occurrence, goal)) return "Priorité haute";
  const raw = safeString(goal?.priority || occurrence?.priority).toLowerCase();
  if (raw === "bonus") return "Bonus";
  return "";
}

function resolveActionDescription(goal, category) {
  return (
    safeString(goal?.habitNotes) ||
    safeString(goal?.description) ||
    (category?.name ? `Bloc planifié en ${category.name}.` : "Bloc planifié aujourd’hui.")
  );
}

function resolveActionReason(goal) {
  return safeString(goal?.whyText) || safeString(goal?.notes) || "";
}

function isOccurrenceLate(occurrence, now, selectedDateKey) {
  const status = normalizeOccurrenceStatus(occurrence?.status);
  if (status === OCCURRENCE_STATUS.MISSED) return true;
  if (status !== OCCURRENCE_STATUS.PLANNED) return false;
  const todayKey = toLocalDateKey(now);
  if (selectedDateKey !== todayKey) return false;
  const startMin = parseTimeToMinutes(safeString(occurrence?.start) || safeString(occurrence?.slotKey));
  if (!Number.isFinite(startMin)) return false;
  const duration = Number.isFinite(occurrence?.durationMinutes) ? occurrence.durationMinutes : 0;
  const endMin = startMin + Math.max(0, duration);
  const nowMin = now.getHours() * 60 + now.getMinutes();
  return endMin > 0 ? endMin < nowMin : startMin < nowMin;
}

function mapTimelineStatus({ occurrence, activeOccurrenceId, goal, now, selectedDateKey }) {
  const status = normalizeOccurrenceStatus(occurrence?.status);
  if (status === OCCURRENCE_STATUS.DONE) return "done";
  if (safeString(occurrence?.id) && safeString(occurrence.id) === activeOccurrenceId) return "in_progress";
  if (status === OCCURRENCE_STATUS.IN_PROGRESS) return "in_progress";
  if (status === OCCURRENCE_STATUS.RESCHEDULED) return "postponed";
  if (isOccurrenceLate(occurrence, now, selectedDateKey)) return "late";
  void goal;
  return "upcoming";
}

function buildTimelineItems({ occurrencesForDay, goalsById, activeOccurrenceId, now, selectedDateKey }) {
  return occurrencesForDay
    .filter((occurrence) => !TIMELINE_HIDDEN_STATUSES.has(normalizeOccurrenceStatus(occurrence?.status)))
    .sort(compareOccurrences)
    .map((occurrence) => {
      const goal = resolveOccurrenceGoal(occurrence, goalsById);
      return {
        id: safeString(occurrence?.id) || `${safeString(occurrence?.goalId)}:${safeString(occurrence?.date)}:${safeString(occurrence?.start)}`,
        occurrenceId: safeString(occurrence?.id),
        actionId: safeString(occurrence?.goalId),
        timeLabel: resolveOccurrenceTimeLabel(occurrence),
        title: safeString(goal?.title) || safeString(occurrence?.title) || "Bloc",
        status: mapTimelineStatus({ occurrence, activeOccurrenceId, goal, now, selectedDateKey }),
      };
    })
    .filter((item) => item.id);
}

function buildBlockCounts(occurrencesForDay) {
  const countable = occurrencesForDay.filter(
    (occurrence) => !TOTAL_EXCLUDED_STATUSES.has(normalizeOccurrenceStatus(occurrence?.status))
  );
  const completedBlocks = countable.reduce(
    (sum, occurrence) => sum + (normalizeOccurrenceStatus(occurrence?.status) === OCCURRENCE_STATUS.DONE ? 1 : 0),
    0
  );
  const totalBlocks = countable.length;
  const timelineProgressPercent = totalBlocks > 0
    ? Math.min(100, Math.round((completedBlocks / totalBlocks) * 100))
    : null;
  return {
    completedBlocks,
    totalBlocks,
    timelineProgressPercent,
    timelineProgressLabel: Number.isFinite(timelineProgressPercent) ? `${timelineProgressPercent}%` : EMPTY_SCORE_LABEL,
  };
}

function resolvePrimaryActionCandidate({ occurrencesForDay, goalsById, activeSession, now, selectedDateKey }) {
  const activeOccurrenceId = safeString(activeSession?.occurrenceId);
  if (activeOccurrenceId) {
    const activeOccurrence = occurrencesForDay.find((occurrence) => safeString(occurrence?.id) === activeOccurrenceId) || null;
    if (activeOccurrence) return { occurrence: activeOccurrence, status: "in_progress" };
    const activeGoalId = safeArray(activeSession?.habitIds)[0] || "";
    if (activeGoalId && goalsById.has(activeGoalId)) {
      return { occurrence: { id: activeOccurrenceId, goalId: activeGoalId, date: selectedDateKey, status: "in_progress" }, status: "in_progress" };
    }
  }

  const actionable = occurrencesForDay
    .filter((occurrence) => {
      const status = normalizeOccurrenceStatus(occurrence?.status);
      return status !== OCCURRENCE_STATUS.DONE && !TOTAL_EXCLUDED_STATUSES.has(status);
    })
    .sort(compareOccurrences);

  const lateCritical = actionable.find((occurrence) => {
    const goal = resolveOccurrenceGoal(occurrence, goalsById);
    return isOccurrenceLate(occurrence, now, selectedDateKey) && isHighPriority(occurrence, goal);
  });
  if (lateCritical) return { occurrence: lateCritical, status: "late" };

  const highPriority = actionable.find((occurrence) => {
    const goal = resolveOccurrenceGoal(occurrence, goalsById);
    return isHighPriority(occurrence, goal) || isPrimaryGoal(goal);
  });
  if (highPriority) return { occurrence: highPriority, status: "upcoming" };

  const firstPending = actionable[0] || null;
  if (firstPending) {
    return {
      occurrence: firstPending,
      status: isOccurrenceLate(firstPending, now, selectedDateKey) ? "late" : "upcoming",
    };
  }

  return null;
}

function buildPrimaryAction({ occurrencesForDay, goalsById, categoriesById, activeSession, now, selectedDateKey }) {
  const candidate = resolvePrimaryActionCandidate({ occurrencesForDay, goalsById, activeSession, now, selectedDateKey });
  if (!candidate?.occurrence) {
    return {
      status: "empty",
      occurrenceId: null,
      actionId: null,
      title: "Construire le prochain bloc",
      description: "Aucun bloc structuré pour aujourd’hui.",
      durationLabel: "",
      timingLabel: "À planifier",
      categoryLabel: "",
      priorityLabel: "",
      reason: "Passe par Coach IA, Ajuster ou Planning pour structurer la journée.",
      primaryLabel: "Construire avec le Coach IA",
    };
  }

  const { occurrence, status } = candidate;
  const goal = resolveOccurrenceGoal(occurrence, goalsById);
  const category = resolveOccurrenceCategory(goal, categoriesById);
  const durationLabel = formatDurationLabel(occurrence.durationMinutes || goal?.durationMinutes);
  const primaryLabel =
    status === "in_progress"
      ? "Reprendre"
      : status === "late"
        ? "Rattraper maintenant"
        : durationLabel
          ? `Verrouiller ${durationLabel}`
          : "Verrouiller le bloc";

  return {
    status,
    occurrenceId: safeString(occurrence?.id) || null,
    actionId: safeString(occurrence?.goalId) || null,
    title: safeString(goal?.title) || safeString(occurrence?.title) || (status === "in_progress" ? "Session en cours" : "Bloc prioritaire"),
    description:
      status === "in_progress"
        ? "Termine le bloc en cours avant d’ajuster la suite."
        : resolveActionDescription(goal, category),
    durationLabel,
    timingLabel: resolveOccurrenceTimeLabel(occurrence) === "--:--" ? "À planifier" : resolveOccurrenceTimeLabel(occurrence),
    categoryLabel: safeString(category?.name),
    priorityLabel: resolvePriorityLabel(occurrence, goal),
    reason: resolveActionReason(goal),
    primaryLabel,
  };
}

function buildCockpitStatus({ activeSession, totalBlocks, completedBlocks }) {
  if (activeSession) {
    return {
      welcome: "Bloc en cours — termine avant de renégocier.",
      mode: "MODE FOCUS",
      title: "Bloc en cours.",
      detail: "Termine ce qui est verrouillé avant d’ajuster la suite.",
    };
  }
  if (totalBlocks > 0 && completedBlocks >= totalBlocks) {
    return {
      welcome: "Journée verrouillée — garde cette preuve pour demain.",
      mode: "JOURNÉE VERROUILLÉE",
      title: "Essentiel validé.",
      detail: "Protège la fin de journée au lieu d’ajouter du bruit.",
    };
  }
  if (totalBlocks <= 0) {
    return {
      welcome: "Aucun bloc aujourd’hui — sans structure, tu vas improviser.",
      mode: "SYSTÈME ACTIVÉ",
      title: "La journée attend sa structure.",
      detail: "Commence par un bloc simple, puis ajuste le reste.",
    };
  }
  return {
    welcome: "Bon retour — aujourd’hui, on avance bloc par bloc.",
    mode: "MODE EXÉCUTION",
    title: "Tu es en contrôle.",
    detail: "Ne casse pas le rythme maintenant.",
  };
}

function buildAiInsight(manualTodayAnalysis) {
  const visibleAnalysis = manualTodayAnalysis?.visibleAnalysis;
  if (isPlainObject(visibleAnalysis) && safeString(visibleAnalysis.headline)) {
    return {
      status: "available",
      canApply: Boolean(visibleAnalysis.primaryAction),
      headline: safeString(visibleAnalysis.headline),
      recommendation: safeString(visibleAnalysis.summary),
      reason: safeString(visibleAnalysis.reason),
      requestState: manualTodayAnalysis?.loading ? "loading" : "visible",
      error: "",
    };
  }
  if (manualTodayAnalysis?.loading) {
    return {
      status: "loading",
      canApply: false,
      headline: "Analyse IA en cours.",
      recommendation: "",
      reason: safeString(manualTodayAnalysis.loadingStageLabel),
      requestState: "loading",
      error: "",
    };
  }
  return {
    status: manualTodayAnalysis?.error ? "error" : "unavailable",
    canApply: false,
    headline: "Insight IA indisponible",
    recommendation: "",
    reason: safeString(manualTodayAnalysis?.error) || "Ouvre le Coach IA pour analyser ta journée quand le service est disponible.",
    requestState: "unavailable",
    error: safeString(manualTodayAnalysis?.error),
  };
}

function normalizeSmokeTimelineItem(item) {
  const status = safeString(item?.status);
  const normalizedStatus =
    status === "active" ? "in_progress"
      : status === "future" ? "upcoming"
      : status || "upcoming";
  return {
    ...item,
    status: normalizedStatus,
  };
}

function applyVisualSmokeModel(base, visualSmokeModel) {
  if (!isPlainObject(visualSmokeModel)) return base;
  const completedBlocks = Number.isFinite(visualSmokeModel.doneBlocksCount)
    ? visualSmokeModel.doneBlocksCount
    : base.completedBlocks;
  const totalBlocks = Number.isFinite(visualSmokeModel.plannedBlocksCount)
    ? visualSmokeModel.plannedBlocksCount
    : base.totalBlocks;
  const timelineProgressLabel = safeString(visualSmokeModel.timelineProgressLabel) || base.timelineProgressLabel;
  const timelineProgressPercent = parsePercentLabel(timelineProgressLabel);
  const cockpitStatus = isPlainObject(visualSmokeModel.cockpitStatus)
    ? visualSmokeModel.cockpitStatus
    : base.cockpitStatus;
  const primary = isPlainObject(visualSmokeModel.primaryAction)
    ? {
        ...base.primaryAction,
        ...visualSmokeModel.primaryAction,
        primaryLabel: visualSmokeModel.primaryAction.ctaLabel || visualSmokeModel.primaryAction.primaryLabel || base.primaryAction.primaryLabel,
        status: "upcoming",
      }
    : base.primaryAction;
  const ai = isPlainObject(visualSmokeModel.ai)
    ? {
        status: "available",
        canApply: true,
        headline: safeString(visualSmokeModel.ai.headline),
        recommendation: safeString(visualSmokeModel.ai.recommendation),
        reason: safeString(visualSmokeModel.ai.reason),
        requestState: "visible",
        error: "",
      }
    : base.aiInsight;
  const timelineItems = Array.isArray(visualSmokeModel.timelineItems)
    ? visualSmokeModel.timelineItems.map(normalizeSmokeTimelineItem)
    : base.timelineItems;

  return {
    ...base,
    scoreDisplay: safeString(visualSmokeModel.scoreLabel) || base.scoreDisplay,
    scoreAvailable: true,
    previousDayDeltaDisplay: safeString(visualSmokeModel.deltaLabel) || base.previousDayDeltaDisplay,
    previousDayDeltaAvailable: true,
    completedBlocks,
    totalBlocks,
    timelineProgressPercent,
    timelineProgressLabel,
    primaryAction: primary,
    timelineItems,
    aiInsight: ai,
    cockpitStatus,
    welcomeLine: cockpitStatus.welcome || base.welcomeLine,
    hero: {
      ...base.hero,
      modeLabel: cockpitStatus.mode || base.hero.modeLabel,
      scoreLabel: safeString(visualSmokeModel.scoreLabel) || base.hero.scoreLabel,
      deltaLabel: safeString(visualSmokeModel.deltaLabel) || base.hero.deltaLabel,
      statusTitle: cockpitStatus.title || base.hero.statusTitle,
      statusDetail: cockpitStatus.detail || base.hero.statusDetail,
      completedBlocks,
      totalBlocks,
    },
    timeline: {
      ...base.timeline,
      items: timelineItems,
      progressLabel: timelineProgressLabel,
      progressPercent: timelineProgressPercent,
    },
  };
}

export function getTodayVisualSmokeModel() {
  if (typeof import.meta === "undefined" || !import.meta.env?.DEV) return null;
  if (typeof window === "undefined" || window.__TODAY_VISUAL_SMOKE__ !== true) return null;
  return {
    scoreLabel: "72%",
    deltaLabel: "+8% vs hier",
    doneBlocksCount: 2,
    plannedBlocksCount: 3,
    timelineProgressLabel: "67%",
    cockpitStatus: {
      welcome: "Bon retour — aujourd’hui, on avance bloc par bloc.",
      mode: "MODE EXÉCUTION",
      title: "Tu es en contrôle.",
      detail: "Ne casse pas le rythme maintenant.",
    },
    primaryAction: {
      title: "Deep work",
      description: "Avancer sur ton objectif principal.",
      durationLabel: "30 min",
      timingLabel: "13:00",
      categoryLabel: "Travail",
      priorityLabel: "Priorité haute",
      reason: "C’est le bloc qui débloque ta journée.",
      ctaLabel: "Verrouiller 30 min",
    },
    timelineItems: [
      { id: "smoke-routine", timeLabel: "07:00", title: "Routine", status: "done" },
      { id: "smoke-sport", timeLabel: "09:30", title: "Sport", status: "done" },
      { id: "smoke-deep", timeLabel: "13:00", title: "Deep work", status: "in_progress" },
      { id: "smoke-learning", timeLabel: "16:00", title: "Apprentissage", status: "upcoming" },
      { id: "smoke-review", timeLabel: "19:30", title: "Revue", status: "upcoming" },
    ],
    ai: {
      headline: "Tu tiens mieux les blocs courts.",
      recommendation: "Garde ce bloc à 30 min.",
      reason: "Tes sessions de 20–40 min ont 67% de taux de complétion ces 7 derniers jours.",
    },
  };
}

export function buildTodayData({
  data,
  auth,
  profile,
  manualTodayAnalysis,
  persistenceScope = "local_fallback",
  selectedDateKey,
  now,
  visualSmokeModel,
} = {}) {
  const safeData = isPlainObject(data) ? data : {};
  const nowDate = safeNow(now);
  const safeSelectedDateKey =
    normalizeLocalDateKey(selectedDateKey) ||
    normalizeLocalDateKey(safeData?.ui?.selectedDateKey || safeData?.ui?.selectedDate) ||
    toLocalDateKey(nowDate);
  const selectedDate = fromLocalDateKey(safeSelectedDateKey);
  const goals = safeArray(safeData.goals);
  const categories = safeArray(safeData.categories);
  const occurrences = safeArray(safeData.occurrences);
  const goalsById = new Map(goals.filter((goal) => goal?.id).map((goal) => [goal.id, goal]));
  const categoriesById = new Map(categories.filter((category) => category?.id).map((category) => [category.id, category]));
  const rawActiveSession = isPlainObject(safeData?.ui?.activeSession) ? safeData.ui.activeSession : null;
  const normalizedActiveSession = normalizeActiveSessionForUI(rawActiveSession);
  const activeSession = isRuntimeSessionOpen(normalizedActiveSession) ? normalizedActiveSession : null;
  const activeOccurrenceId = safeString(activeSession?.occurrenceId);
  const occurrencesForDay = occurrences
    .filter((occurrence) => normalizeLocalDateKey(occurrence?.date) === safeSelectedDateKey)
    .map((occurrence) => ({ ...occurrence, date: safeSelectedDateKey }));

  const user = buildUserDisplay({ data: safeData, auth, profile });
  const score = buildScoreDisplay(safeData, safeSelectedDateKey);
  const counts = buildBlockCounts(occurrencesForDay);
  const cockpitStatus = buildCockpitStatus({
    activeSession,
    totalBlocks: counts.totalBlocks,
    completedBlocks: counts.completedBlocks,
  });
  const primaryAction = buildPrimaryAction({
    occurrencesForDay,
    goalsById,
    categoriesById,
    activeSession,
    now: nowDate,
    selectedDateKey: safeSelectedDateKey,
  });
  const timelineItems = buildTimelineItems({
    occurrencesForDay,
    goalsById,
    activeOccurrenceId,
    now: nowDate,
    selectedDateKey: safeSelectedDateKey,
  });
  const aiInsight = buildAiInsight(manualTodayAnalysis);
  const flags = {
    authLoading: Boolean(auth?.loading),
    profileLoading: Boolean(profile?.loading),
    aiLoading: Boolean(manualTodayAnalysis?.loading),
    error: safeString(profile?.loadError) || safeString(manualTodayAnalysis?.error),
    offline: auth?.online === false || auth?.offline === true || manualTodayAnalysis?.errorDiagnostics?.probableCause === "offline",
    persistenceScope,
  };

  const result = {
    date: {
      key: safeSelectedDateKey,
      label: formatDateLabel(selectedDate, safeSelectedDateKey),
      code: formatDateCode(selectedDate, safeSelectedDateKey),
    },
    user,
    scoreDisplay: score.scoreDisplay,
    scoreAvailable: score.scoreAvailable,
    previousDayDeltaDisplay: score.previousDayDeltaDisplay,
    previousDayDeltaAvailable: score.previousDayDeltaAvailable,
    completedBlocks: counts.completedBlocks,
    totalBlocks: counts.totalBlocks,
    timelineProgressPercent: counts.timelineProgressPercent,
    timelineProgressLabel: counts.timelineProgressLabel,
    primaryAction,
    timelineItems,
    aiInsight,
    flags,
    cockpitStatus,
    welcomeLine: cockpitStatus.welcome,
    header: {
      dateLabel: formatDateLabel(selectedDate, safeSelectedDateKey),
      avatarLabel: user.avatarLabel,
      avatarUrl: user.avatarUrl,
    },
    hero: {
      modeLabel: cockpitStatus.mode,
      dateLabel: formatDateCode(selectedDate, safeSelectedDateKey),
      scoreLabel: score.scoreDisplay,
      deltaLabel: score.previousDayDeltaDisplay,
      statusTitle: cockpitStatus.title,
      statusDetail: cockpitStatus.detail,
      completedBlocks: counts.completedBlocks,
      totalBlocks: counts.totalBlocks,
    },
    timeline: {
      items: timelineItems,
      progressLabel: counts.timelineProgressLabel,
      progressPercent: counts.timelineProgressPercent,
    },
  };

  return applyVisualSmokeModel(result, visualSmokeModel);
}
