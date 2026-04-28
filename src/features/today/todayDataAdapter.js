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
const TODAY_STATE_ORDER = Object.freeze([
  "loading_without_cache",
  "error_without_cache",
  "offline_without_cache",
  "empty_day",
  "first_day",
  "returning_after_absence",
  "locked",
  "in_progress",
  "late",
  "postponed",
  "risk",
  "control",
  "neutral",
]);
const TODAY_STATE_PRIORITY = Object.freeze(
  TODAY_STATE_ORDER.reduce((acc, state, index) => {
    acc[state] = index + 1;
    return acc;
  }, {})
);
const TODAY_ACCENTS = Object.freeze({
  control: "#35f06d",
  risk: "#ff9b45",
  late: "#ff4d4d",
  offline: "#a8afaa",
  error: "#ff4d4d",
  locked: "#35f06d",
  neutral: "#35f06d",
});
const TODAY_STATE_CONFIG = Object.freeze({
  loading_without_cache: {
    tone: "neutral",
    accent: TODAY_ACCENTS.neutral,
    motionIntensity: "frozen",
    welcome: "Chargement de ta journée — on garde le cockpit stable.",
    mode: "CHARGEMENT",
    title: "Journée en cours de chargement.",
    detail: "Tes données arrivent.",
  },
  error_without_cache: {
    tone: "error",
    accent: TODAY_ACCENTS.error,
    motionIntensity: "none",
    welcome: "Impossible de charger ta journée — tes données ne sont pas perdues.",
    mode: "JOURNÉE INDISPONIBLE",
    title: "Chargement impossible.",
    detail: "Réessaie sans perdre ton contexte.",
  },
  offline_without_cache: {
    tone: "offline",
    accent: TODAY_ACCENTS.offline,
    motionIntensity: "frozen",
    welcome: "Hors-ligne — aucune journée locale disponible.",
    mode: "HORS-LIGNE",
    title: "Données indisponibles.",
    detail: "Reviens en ligne pour récupérer ton cockpit.",
  },
  empty_day: {
    tone: "neutral",
    accent: TODAY_ACCENTS.neutral,
    motionIntensity: "low",
    welcome: "Aucun bloc aujourd’hui — sans structure, tu vas improviser.",
    mode: "SYSTÈME ACTIVÉ",
    title: "La journée attend sa structure.",
    detail: "Commence par un bloc simple, puis ajuste le reste.",
  },
  first_day: {
    tone: "control",
    accent: TODAY_ACCENTS.control,
    motionIntensity: "low",
    welcome: "Ton système est prêt — commence petit, mais commence maintenant.",
    mode: "SYSTÈME ACTIVÉ",
    title: "Premier bloc, pas tout le système.",
    detail: "Une preuve suffit pour démarrer.",
  },
  returning_after_absence: {
    tone: "risk",
    accent: TODAY_ACCENTS.risk,
    motionIntensity: "low",
    welcome: "Bon retour — reprends avec un bloc simple, pas une dette.",
    mode: "MODE REPRISE",
    title: "Reprise propre.",
    detail: "On réduit la friction aujourd’hui.",
  },
  locked: {
    tone: "locked",
    accent: TODAY_ACCENTS.locked,
    motionIntensity: "low",
    welcome: "Journée verrouillée — garde cette preuve pour demain.",
    mode: "JOURNÉE VERROUILLÉE",
    title: "Essentiel validé.",
    detail: "Protège la fin de journée au lieu d’ajouter du bruit.",
  },
  in_progress: {
    tone: "control",
    accent: TODAY_ACCENTS.control,
    motionIntensity: "elevated",
    welcome: "Bloc en cours — termine avant de renégocier.",
    mode: "MODE FOCUS",
    title: "Bloc en cours.",
    detail: "Termine ce qui est verrouillé avant d’ajuster la suite.",
  },
  late: {
    tone: "late",
    accent: TODAY_ACCENTS.late,
    motionIntensity: "low",
    welcome: "Tu as décroché — reprends avec un bloc simple.",
    mode: "MODE REPRISE",
    title: "Reprise maintenant.",
    detail: "Réduis avant de rattraper.",
  },
  postponed: {
    tone: "risk",
    accent: TODAY_ACCENTS.risk,
    motionIntensity: "low",
    welcome: "Bloc déplacé — garde une version simple disponible.",
    mode: "MODE RATTRAPAGE",
    title: "Bloc reporté.",
    detail: "Repars sans reconstruire toute la journée.",
  },
  risk: {
    tone: "risk",
    accent: TODAY_ACCENTS.risk,
    motionIntensity: "low",
    welcome: "La journée peut encore basculer — protège le prochain bloc.",
    mode: "MODE RATTRAPAGE",
    title: "Encore récupérable.",
    detail: "Protège le prochain bloc.",
  },
  control: {
    tone: "control",
    accent: TODAY_ACCENTS.control,
    motionIntensity: "normal",
    welcome: "Bon retour — aujourd’hui, on avance bloc par bloc.",
    mode: "MODE EXÉCUTION",
    title: "Tu es en contrôle.",
    detail: "Ne casse pas le rythme maintenant.",
  },
  neutral: {
    tone: "neutral",
    accent: TODAY_ACCENTS.neutral,
    motionIntensity: "normal",
    welcome: "La journée est ouverte — le prochain bloc décide du rythme.",
    mode: "MODE EXÉCUTION",
    title: "Journée ouverte.",
    detail: "Le prochain bloc donne le ton.",
  },
});
const NO_CACHE_STATES = new Set(["loading_without_cache", "error_without_cache", "offline_without_cache"]);

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

function normalizeTodayState(value) {
  const state = safeString(value);
  return TODAY_STATE_PRIORITY[state] ? state : "neutral";
}

function normalizeAiMode(value) {
  const mode = safeString(value);
  return ["available", "loading", "unavailable", "error", "hidden"].includes(mode) ? mode : "unavailable";
}

function isExpectedSignalOccurrence(occurrence) {
  const status = normalizeOccurrenceStatus(occurrence?.status);
  return status !== OCCURRENCE_STATUS.CANCELED && status !== OCCURRENCE_STATUS.SKIPPED;
}

function hasExpectedSignalOnDate(occurrences, dateKey) {
  const safeDateKey = normalizeLocalDateKey(dateKey);
  if (!safeDateKey) return false;
  return safeArray(occurrences).some(
    (occurrence) => normalizeLocalDateKey(occurrence?.date) === safeDateKey && isExpectedSignalOccurrence(occurrence)
  );
}

function hasPastExpectedSignal(occurrences, selectedDateKey) {
  const safeSelectedDateKey = normalizeLocalDateKey(selectedDateKey);
  if (!safeSelectedDateKey) return false;
  return safeArray(occurrences).some(
    (occurrence) => {
      const dateKey = normalizeLocalDateKey(occurrence?.date);
      return dateKey && dateKey < safeSelectedDateKey && isExpectedSignalOccurrence(occurrence);
    }
  );
}

function hasRecentExpectedSignal(occurrences, selectedDateKey, days = 3) {
  const safeSelectedDateKey = normalizeLocalDateKey(selectedDateKey);
  if (!safeSelectedDateKey) return false;
  for (let offset = 1; offset <= Math.max(1, days); offset += 1) {
    if (hasExpectedSignalOnDate(occurrences, addDaysKey(safeSelectedDateKey, -offset))) return true;
  }
  return false;
}

function hasOlderExpectedSignal(occurrences, selectedDateKey, recentDays = 3) {
  const safeSelectedDateKey = normalizeLocalDateKey(selectedDateKey);
  if (!safeSelectedDateKey) return false;
  const cutoffKey = addDaysKey(safeSelectedDateKey, -Math.max(1, recentDays));
  return safeArray(occurrences).some(
    (occurrence) => {
      const dateKey = normalizeLocalDateKey(occurrence?.date);
      return dateKey && dateKey < cutoffKey && isExpectedSignalOccurrence(occurrence);
    }
  );
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

function isOccurrenceAtRisk(occurrence, now, selectedDateKey, activeOccurrenceId = "") {
  const status = normalizeOccurrenceStatus(occurrence?.status);
  if (status !== OCCURRENCE_STATUS.PLANNED) return false;
  if (safeString(occurrence?.id) && safeString(occurrence.id) === activeOccurrenceId) return false;
  if (selectedDateKey !== toLocalDateKey(now)) return false;
  const startMin = parseTimeToMinutes(safeString(occurrence?.start) || safeString(occurrence?.slotKey));
  if (!Number.isFinite(startMin)) return false;
  const duration = Number.isFinite(occurrence?.durationMinutes) ? Math.max(0, occurrence.durationMinutes) : 0;
  const endMin = duration > 0 ? startMin + duration : startMin + 15;
  const nowMin = now.getHours() * 60 + now.getMinutes();
  return nowMin >= startMin && nowMin <= endMin;
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

  const postponed = occurrencesForDay
    .filter((occurrence) => normalizeOccurrenceStatus(occurrence?.status) === OCCURRENCE_STATUS.RESCHEDULED)
    .sort(compareOccurrences)[0];
  if (postponed) return { occurrence: postponed, status: "postponed" };

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
      label: "STRUCTURER LA JOURNÉE",
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
      secondaryLabel: "Planning",
      detailLabel: "Coach IA",
      canPrimary: true,
      canSecondary: true,
      canDetail: true,
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
        : status === "postponed"
          ? "Lancer quand même"
          : durationLabel
            ? `Verrouiller ${durationLabel}`
            : "Verrouiller le bloc";

  return {
    status,
    label: status === "in_progress" ? "BLOC EN COURS" : status === "late" ? "BLOC EN RETARD" : status === "postponed" ? "BLOC REPORTÉ" : "ACTION CRITIQUE",
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
    secondaryLabel: "Reporter",
    detailLabel: "Voir détail",
    canPrimary: true,
    canSecondary: true,
    canDetail: true,
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

function resolveTodayState({
  dataLoading,
  dataLoadError,
  hasCachedData,
  offline,
  activeSession,
  occurrences,
  occurrencesForDay,
  timelineItems,
  primaryAction,
  counts,
  now,
  selectedDateKey,
  activeOccurrenceId,
}) {
  if (dataLoading && !hasCachedData) return "loading_without_cache";
  if (dataLoadError && !hasCachedData) return "error_without_cache";
  if (offline && !hasCachedData) return "offline_without_cache";

  const hasPostponed = primaryAction?.status === "postponed" || timelineItems.some((item) => item?.status === "postponed");
  const hasLate = primaryAction?.status === "late" || timelineItems.some((item) => item?.status === "late");
  const hasRisk = hasLate || occurrencesForDay.some((occurrence) => isOccurrenceAtRisk(occurrence, now, selectedDateKey, activeOccurrenceId));
  const hasAnyPastSignal = hasPastExpectedSignal(occurrences, selectedDateKey);
  const hasRecentSignal = hasRecentExpectedSignal(occurrences, selectedDateKey, 3);
  const hasOlderSignal = hasOlderExpectedSignal(occurrences, selectedDateKey, 3);
  const hasOpenAction = primaryAction?.status && primaryAction.status !== "empty";
  const allBlocksDone = counts.totalBlocks > 0 && counts.completedBlocks >= counts.totalBlocks;

  if (counts.totalBlocks <= 0 && !hasPostponed) return "empty_day";
  if (!activeSession && hasOpenAction && counts.completedBlocks === 0 && !hasAnyPastSignal) return "first_day";
  if (!activeSession && hasOpenAction && counts.completedBlocks === 0 && !hasRecentSignal && hasOlderSignal) {
    return "returning_after_absence";
  }
  if (allBlocksDone) return "locked";
  if (activeSession) return "in_progress";
  if (primaryAction?.status === "late") return "late";
  if (hasPostponed) return "postponed";
  if (hasRisk) return "risk";
  if (counts.totalBlocks > 0 && counts.completedBlocks > 0) return "control";
  return "neutral";
}

function applyPrimaryState(primaryAction, state) {
  const next = {
    ...primaryAction,
    label: primaryAction?.label || "ACTION CRITIQUE",
    secondaryLabel: primaryAction?.secondaryLabel || "Reporter",
    detailLabel: primaryAction?.detailLabel || "Voir détail",
    canPrimary: primaryAction?.canPrimary !== false,
    canSecondary: primaryAction?.canSecondary !== false,
    canDetail: primaryAction?.canDetail !== false,
  };
  const hasAction = Boolean(next.occurrenceId || next.actionId);

  if (state === "loading_without_cache") {
    return {
      ...next,
      status: "loading",
      label: "CHARGEMENT",
      occurrenceId: null,
      actionId: null,
      title: "Chargement du bloc",
      description: "Préparation du cockpit.",
      durationLabel: "",
      timingLabel: "",
      categoryLabel: "",
      priorityLabel: "",
      reason: "On garde le cockpit stable pendant le chargement.",
      primaryLabel: "Patienter",
      secondaryLabel: "Patienter",
      detailLabel: "Chargement",
      canPrimary: false,
      canSecondary: false,
      canDetail: false,
    };
  }

  if (state === "error_without_cache") {
    return {
      ...next,
      status: "error",
      label: "ACTION INDISPONIBLE",
      occurrenceId: null,
      actionId: null,
      title: "Chargement impossible",
      description: "Le cockpit n’a pas pu récupérer ta journée.",
      durationLabel: "",
      timingLabel: "",
      categoryLabel: "",
      priorityLabel: "",
      reason: "Réessaie quand la connexion ou le service répond.",
      primaryLabel: "Réessayer",
      secondaryLabel: "Indisponible",
      detailLabel: "Support",
      canPrimary: false,
      canSecondary: false,
      canDetail: false,
    };
  }

  if (state === "offline_without_cache") {
    return {
      ...next,
      status: "offline",
      label: "HORS-LIGNE",
      occurrenceId: null,
      actionId: null,
      title: "Hors-ligne",
      description: "Aucune journée locale disponible.",
      durationLabel: "",
      timingLabel: "",
      categoryLabel: "",
      priorityLabel: "",
      reason: "Reviens en ligne pour récupérer ton cockpit.",
      primaryLabel: "Hors-ligne",
      secondaryLabel: "Indisponible",
      detailLabel: "Hors-ligne",
      canPrimary: false,
      canSecondary: false,
      canDetail: false,
    };
  }

  if (state === "empty_day") {
    return {
      ...next,
      status: "empty",
      label: "STRUCTURER LA JOURNÉE",
      title: next.title || "Construire le prochain bloc",
      description: "Aucun bloc structuré pour aujourd’hui.",
      reason: "Passe par Coach IA, Ajuster ou Planning pour structurer la journée.",
      primaryLabel: "Construire avec le Coach IA",
      secondaryLabel: "Planning",
      detailLabel: "Coach IA",
      canPrimary: true,
    };
  }

  if (state === "first_day" && hasAction) {
    return {
      ...next,
      label: "PREMIER BLOC",
      primaryLabel: "Verrouiller 20 min",
      secondaryLabel: "Reporter",
      detailLabel: "Voir détail",
      reason: next.reason || "Une preuve courte suffit pour lancer le système.",
    };
  }

  if (state === "returning_after_absence" && hasAction) {
    return {
      ...next,
      label: "BLOC DE REPRISE",
      primaryLabel: "Reprendre simple",
      secondaryLabel: "Reporter",
      detailLabel: "Voir détail",
      reason: next.reason || "Réduis la friction et ferme un bloc proprement.",
    };
  }

  if (state === "locked") {
    return {
      ...next,
      status: "locked",
      label: "JOURNÉE VERROUILLÉE",
      title: "Journée verrouillée",
      description: "Essentiel validé.",
      durationLabel: "",
      timingLabel: "",
      categoryLabel: "",
      priorityLabel: "",
      reason: "Protège la fin de journée au lieu d’ajouter du bruit.",
      primaryLabel: "Voir demain",
      secondaryLabel: "Planning",
      detailLabel: "Voir progression",
      canPrimary: false,
    };
  }

  if (state === "in_progress") {
    return {
      ...next,
      status: "in_progress",
      label: "BLOC EN COURS",
      primaryLabel: "Reprendre",
      secondaryLabel: "Reporter",
      detailLabel: "Voir détail",
      reason: next.reason || "Termine le bloc en cours avant d’ajuster la suite.",
    };
  }

  if (state === "late") {
    return {
      ...next,
      status: "late",
      label: "BLOC EN RETARD",
      primaryLabel: "Rattraper maintenant",
      secondaryLabel: "Réduire",
      detailLabel: "Reporter",
      reason: next.reason || "Reprends avec une version courte et utile.",
    };
  }

  if (state === "postponed") {
    return {
      ...next,
      status: "postponed",
      label: "BLOC REPORTÉ",
      primaryLabel: "Lancer quand même",
      secondaryLabel: "Changer l’heure",
      detailLabel: "Voir détail",
      reason: next.reason || "Garde une version simple disponible.",
    };
  }

  if (state === "risk") {
    return {
      ...next,
      label: "BLOC À PROTÉGER",
      primaryLabel: "Verrouiller 15 min",
      secondaryLabel: "Réduire",
      detailLabel: "Voir détail",
      reason: next.reason || "Protège une version courte avant que la journée ne bascule.",
    };
  }

  if (state === "neutral") {
    return {
      ...next,
      label: "PROCHAIN BLOC",
      secondaryLabel: "Reporter",
      detailLabel: "Voir détail",
    };
  }

  return {
    ...next,
    label: "ACTION CRITIQUE",
    secondaryLabel: "Reporter",
    detailLabel: "Voir détail",
  };
}

function applyStatePresentation(base, stateValue) {
  const state = normalizeTodayState(stateValue);
  const config = TODAY_STATE_CONFIG[state] || TODAY_STATE_CONFIG.neutral;
  const noCacheState = NO_CACHE_STATES.has(state);
  const aiMode = noCacheState ? "hidden" : normalizeAiMode(base.aiInsight?.status);
  const timelineItems = noCacheState ? [] : base.timelineItems;
  const timelineMode =
    noCacheState
      ? "disabled"
      : base.flags?.offline
        ? "offline_cached"
        : state === "empty_day"
          ? "empty"
          : "normal";
  const primaryAction = applyPrimaryState(base.primaryAction, state);
  const scoreLabel = noCacheState ? EMPTY_SCORE_LABEL : base.scoreDisplay;
  const deltaLabel = noCacheState || state === "first_day" ? DEFAULT_DELTA_LABEL : base.previousDayDeltaDisplay;
  const timelineProgressLabel = noCacheState ? EMPTY_SCORE_LABEL : base.timelineProgressLabel;
  const timelineProgressPercent = noCacheState ? null : base.timelineProgressPercent;

  return {
    ...base,
    state,
    statePriority: TODAY_STATE_PRIORITY[state],
    tone: config.tone,
    accent: config.accent,
    motionIntensity: config.motionIntensity,
    isActionable: Boolean(primaryAction.canPrimary),
    canUseLocalActions: Boolean(base.flags?.offline && base.flags?.hasCachedData),
    isRefreshing: Boolean(base.flags?.dataLoading && base.flags?.hasCachedData),
    timelineMode,
    aiMode,
    scoreDisplay: scoreLabel,
    scoreAvailable: noCacheState ? false : base.scoreAvailable,
    previousDayDeltaDisplay: deltaLabel,
    previousDayDeltaAvailable: noCacheState || state === "first_day" ? false : base.previousDayDeltaAvailable,
    timelineProgressPercent,
    timelineProgressLabel,
    primaryAction,
    timelineItems,
    aiInsight: {
      ...base.aiInsight,
      status: aiMode,
      canApply: aiMode === "available" && base.aiInsight?.canApply === true,
      headline:
        aiMode === "hidden"
          ? "Coach IA indisponible"
          : base.aiInsight?.headline,
      recommendation: aiMode === "hidden" ? "" : base.aiInsight?.recommendation,
      reason:
        aiMode === "hidden"
          ? "Le cockpit reste utilisable sans recommandation IA."
          : base.aiInsight?.reason,
    },
    cockpitStatus: {
      welcome: config.welcome,
      mode: config.mode,
      title: config.title,
      detail: config.detail,
    },
    copy: {
      welcomeLine: config.welcome,
      heroMode: config.mode,
      heroTitle: config.title,
      heroDetail: config.detail,
    },
    welcomeLine: config.welcome,
    hero: {
      ...base.hero,
      modeLabel: config.mode,
      scoreLabel,
      deltaLabel,
      statusTitle: config.title,
      statusDetail: config.detail,
    },
    timeline: {
      ...base.timeline,
      items: timelineItems,
      progressLabel: timelineProgressLabel,
      progressPercent: timelineProgressPercent,
      mode: timelineMode,
    },
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
        status: normalizeAiMode(safeString(visualSmokeModel.ai.status) || "available"),
        canApply: visualSmokeModel.ai.canApply === false ? false : normalizeAiMode(safeString(visualSmokeModel.ai.status) || "available") === "available",
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
  const flags = isPlainObject(visualSmokeModel.flags)
    ? {
        ...base.flags,
        ...visualSmokeModel.flags,
      }
    : base.flags;

  const overridden = {
    ...base,
    scoreDisplay: safeString(visualSmokeModel.scoreLabel) || base.scoreDisplay,
    scoreAvailable: parsePercentLabel(safeString(visualSmokeModel.scoreLabel) || base.scoreDisplay) !== null,
    previousDayDeltaDisplay: safeString(visualSmokeModel.deltaLabel) || base.previousDayDeltaDisplay,
    previousDayDeltaAvailable: safeString(visualSmokeModel.deltaLabel || base.previousDayDeltaDisplay) !== DEFAULT_DELTA_LABEL,
    completedBlocks,
    totalBlocks,
    timelineProgressPercent,
    timelineProgressLabel,
    primaryAction: primary,
    timelineItems,
    aiInsight: ai,
    flags,
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
  return applyStatePresentation(overridden, safeString(visualSmokeModel.state) || "control");
}

export function getTodayVisualSmokeModel() {
  if (typeof import.meta === "undefined" || !import.meta.env?.DEV) return null;
  if (typeof window === "undefined" || window.__TODAY_VISUAL_SMOKE__ !== true) return null;
  const state = safeString(window.__TODAY_VISUAL_SMOKE_STATE__) || "control";
  const base = {
    state,
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
  const fixtures = {
    empty_day: {
      scoreLabel: "--%",
      deltaLabel: "Point de départ",
      doneBlocksCount: 0,
      plannedBlocksCount: 0,
      timelineProgressLabel: "--%",
      primaryAction: {
        title: "Construire le prochain bloc",
        description: "Aucun bloc structuré pour aujourd’hui.",
        durationLabel: "",
        timingLabel: "À planifier",
        categoryLabel: "",
        priorityLabel: "",
        reason: "Passe par Coach IA, Ajuster ou Planning pour structurer la journée.",
        ctaLabel: "Construire avec le Coach IA",
      },
      timelineItems: [],
      ai: {
        status: "unavailable",
        canApply: false,
        headline: "Insight IA indisponible",
        recommendation: "",
        reason: "Ouvre le Coach IA pour analyser ta journée quand le service est disponible.",
      },
    },
    in_progress: {
      primaryAction: { ctaLabel: "Reprendre" },
    },
    risk: {
      scoreLabel: "41%",
      deltaLabel: "-12% vs hier",
      doneBlocksCount: 1,
      plannedBlocksCount: 3,
      timelineProgressLabel: "33%",
      primaryAction: { ctaLabel: "Verrouiller 15 min" },
      timelineItems: [
        { id: "smoke-routine", timeLabel: "07:00", title: "Routine", status: "done" },
        { id: "smoke-deep", timeLabel: "13:00", title: "Deep work", status: "in_progress" },
        { id: "smoke-review", timeLabel: "19:30", title: "Revue", status: "upcoming" },
      ],
    },
    late: {
      scoreLabel: "24%",
      deltaLabel: "-18% vs hier",
      doneBlocksCount: 0,
      plannedBlocksCount: 3,
      timelineProgressLabel: "0%",
      primaryAction: { ctaLabel: "Rattraper maintenant" },
      timelineItems: [
        { id: "smoke-late", timeLabel: "09:30", title: "Deep work", status: "late" },
        { id: "smoke-learning", timeLabel: "16:00", title: "Apprentissage", status: "upcoming" },
      ],
    },
    locked: {
      scoreLabel: "91%",
      deltaLabel: "+14% vs hier",
      doneBlocksCount: 3,
      plannedBlocksCount: 3,
      timelineProgressLabel: "100%",
      primaryAction: { ctaLabel: "Voir demain" },
      timelineItems: [
        { id: "smoke-routine", timeLabel: "07:00", title: "Routine", status: "done" },
        { id: "smoke-sport", timeLabel: "09:30", title: "Sport", status: "done" },
        { id: "smoke-deep", timeLabel: "13:00", title: "Deep work", status: "done" },
      ],
    },
    offline_without_cache: {
      scoreLabel: "--%",
      deltaLabel: "Point de départ",
      doneBlocksCount: 0,
      plannedBlocksCount: 0,
      timelineProgressLabel: "--%",
      flags: { offline: true, hasCachedData: false },
      timelineItems: [],
      ai: {
        status: "hidden",
        canApply: false,
        headline: "Coach IA indisponible",
        recommendation: "",
        reason: "Le cockpit reste utilisable sans recommandation IA.",
      },
    },
    offline_cached: {
      state: "control",
      flags: { offline: true, hasCachedData: true },
    },
    error_without_cache: {
      scoreLabel: "--%",
      deltaLabel: "Point de départ",
      doneBlocksCount: 0,
      plannedBlocksCount: 0,
      timelineProgressLabel: "--%",
      flags: { error: "Erreur de chargement", hasCachedData: false },
      timelineItems: [],
    },
    ai_unavailable: {
      state: "control",
      ai: {
        status: "unavailable",
        canApply: false,
        headline: "Insight IA indisponible",
        recommendation: "",
        reason: "Ouvre le Coach IA pour analyser ta journée quand le service est disponible.",
      },
    },
  };
  const fixture = fixtures[state] || {};
  return {
    ...base,
    ...fixture,
    primaryAction: {
      ...base.primaryAction,
      ...(fixture.primaryAction || {}),
    },
    ai: {
      ...base.ai,
      ...(fixture.ai || {}),
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
  dataLoading = false,
  dataLoadError = "",
  hasCachedData = false,
  isOnline = true,
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
  const dataError = safeString(dataLoadError);
  const profileError = safeString(profile?.loadError);
  const aiError = safeString(manualTodayAnalysis?.error);
  const offline =
    isOnline === false ||
    auth?.online === false ||
    auth?.offline === true ||
    manualTodayAnalysis?.errorDiagnostics?.probableCause === "offline";
  const flags = {
    authLoading: Boolean(auth?.loading),
    dataLoading: Boolean(dataLoading),
    dataError,
    profileLoading: Boolean(profile?.loading),
    aiLoading: Boolean(manualTodayAnalysis?.loading),
    error: dataError || profileError || aiError,
    profileError,
    aiError,
    offline,
    hasCachedData: Boolean(hasCachedData),
    persistenceScope,
  };
  const state = resolveTodayState({
    dataLoading: Boolean(dataLoading),
    dataLoadError: dataError,
    hasCachedData: Boolean(hasCachedData),
    offline,
    activeSession,
    occurrences,
    occurrencesForDay,
    timelineItems,
    primaryAction,
    counts,
    now: nowDate,
    selectedDateKey: safeSelectedDateKey,
    activeOccurrenceId,
  });

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

  return applyVisualSmokeModel(applyStatePresentation(result, state), visualSmokeModel);
}
