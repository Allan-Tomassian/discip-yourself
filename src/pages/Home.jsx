/* eslint-disable no-unused-vars */
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AppScreen, AppSheet, AppSheetContent, GhostButton, SectionHeader } from "../shared/ui/app";
import "../features/today/today.css";
import {
  addDays,
  addMonths,
  buildMonthGrid,
  startOfMonth,
} from "../utils/dates";
import { fromLocalDateKey, normalizeLocalDateKey, toLocalDateKey, todayLocalKey } from "../utils/dateKey";
import { backfillMissedOccurrences, ensureWindowFromScheduleRules } from "../logic/occurrencePlanner";
import { normalizeOccurrenceForUI } from "../logic/compat";
import { isRuntimeSessionOpen, resolveRuntimeSessionGate } from "../logic/sessionRuntime";
import { emitSessionRuntimeNotificationHook } from "../logic/sessionRuntimeNotifications";
import { getAccentForPage } from "../utils/_theme";
import { resolveCategoryColor } from "../utils/categoryPalette";
import { getDefaultBlockIds } from "../logic/blocks/registry";
import { getCategoryProfileSummary } from "../domain/categoryProfile";
import {
  BASIC_MICRO_REROLL_LIMIT,
  completeMicroAction,
  ensureMicroActionsV1,
  getDefaultMicroCategoryId,
  rerollMicroActions,
} from "../logic/microActionsV1";
import { showRewardedAd, setRewardedAdPresenter } from "../logic/rewardedAds";
import {
  MICRO_ACTION_COINS_REWARD,
  REWARDED_AD_COINS_REWARD,
  addCoins,
  appendWalletEvent,
  applyAdReward,
  canWatchAd,
  ensureWallet,
} from "../logic/walletV1";
import { ensureTotemV1 } from "../logic/totemV1";
import TodayDailyState from "../components/today/TodayDailyState";
import TodayHero from "../components/today/TodayHero";
import TodayNextActions from "../components/today/TodayNextActions";
import TodayValuePulse from "../components/today/TodayValuePulse";
import { emitTotemEvent } from "../ui/totem/totemEvents";
import {
  ANALYSIS_COPY,
  LABELS,
  MAIN_PAGE_COPY,
  SURFACE_LABELS,
  TODAY_SCREEN_COPY,
  UI_COPY,
} from "../ui/labels";
import { useAuth } from "../auth/useAuth";
import { buildTodayCanonicalContextSummary, resolveTodayOccurrenceStartPolicy } from "../domain/todayIntervention";
import { computeCategoryScopedRecommendation } from "../domain/todayCategoryCoherence";
import { deriveTodayNowModel } from "../features/today/nowModel";
import { deriveTodayCalendarModel } from "../features/today/todayCalendarModel";
import { deriveTodayProgressModel } from "../features/today/todayProgressModel";
import { deriveTodayV2State } from "../features/today/todayV2State";
import {
  buildTodayManualAiContextKey,
  createPersistedNowAnalysisEntry,
} from "../features/manualAi/manualAiAnalysis";
import { resolveManualAiDisplayState } from "../features/manualAi/displayState";
import { isAiFoundationPlanningGoal } from "../logic/aiFoundation";
import {
  buildLocalTodayHeroModel,
} from "../features/today/aiNowHeroAdapter";
import { useTypingReveal } from "../features/today/useTypingReveal";
import { useManualAiAnalysis } from "../hooks/useManualAiAnalysis";
import { requestAiNow } from "../infra/aiNowClient";
import {
  CATEGORY_VIEW,
  getSelectedCategoryForView,
  getVisibleCategories,
  resolvePreferredVisibleCategoryId,
  withExecutionActiveCategoryId,
} from "../domain/categoryVisibility";
import { useBehaviorFeedback } from "../feedback/behaviorFeedbackStore";
import { deriveBehaviorFeedbackSignal, deriveTodayBehaviorCue } from "../feedback/feedbackDerivers";

// TOUR MAP:
// - primary_action: start session (GO) for today
// - key_elements: focus section, calendar, micro-actions, daily note
// - optional_elements: day stats/discipline stats modals
const DEFAULT_BLOCK_ORDER = getDefaultBlockIds("home");
const TODAY_COMPLETED_STATUSES = new Set(["done"]);
const TODAY_HIDDEN_BLOCK_STATUSES = new Set(["canceled", "skipped", "missed", "rescheduled"]);

function diffDays(anchor, target) {
  if (!(anchor instanceof Date) || !(target instanceof Date)) return 0;
  const a = new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate(), 12, 0, 0);
  const b = new Date(target.getFullYear(), target.getMonth(), target.getDate(), 12, 0, 0);
  const diff = b.getTime() - a.getTime();
  return Math.round(diff / (24 * 60 * 60 * 1000));
}

function normalizeBlockOrder(raw, defaults = DEFAULT_BLOCK_ORDER) {
  if (!Array.isArray(raw)) return [...defaults];
  const ids = raw
    .map((item) => (typeof item === "string" ? item : item?.id))
    .filter(Boolean);
  const cleaned = ids.filter((id) => defaults.includes(id));
  if (!cleaned.length) return [...defaults];
  const ordered = [...cleaned];
  const present = new Set(ordered);
  for (let i = 0; i < defaults.length; i += 1) {
    const id = defaults[i];
    if (present.has(id)) continue;
    let insertAt = ordered.length;
    for (let j = i + 1; j < defaults.length; j += 1) {
      const nextId = defaults[j];
      const existingIndex = ordered.indexOf(nextId);
      if (existingIndex !== -1) {
        insertAt = existingIndex;
        break;
      }
    }
    ordered.splice(insertAt, 0, id);
    present.add(id);
  }
  return ordered;
}

const arrayEqual = (a, b) =>
  Array.isArray(a) &&
  Array.isArray(b) &&
  a.length === b.length &&
  a.every((id, idx) => id === b[idx]);

function formatRelativeCoachTimestamp(fetchedAt) {
  if (!Number.isFinite(fetchedAt)) return "";
  const diffMs = Math.max(0, Date.now() - fetchedAt);
  if (diffMs < 45 * 1000) return "à l’instant";
  const diffMinutes = Math.round(diffMs / (60 * 1000));
  if (diffMinutes < 60) return `il y a ${diffMinutes} min`;
  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) return `il y a ${diffHours} h`;
  try {
    return new Intl.DateTimeFormat("fr-FR", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(fetchedAt));
  } catch {
    return "";
  }
}

function resolveTodayAnalysisModeLabel(visibleAnalysis) {
  return visibleAnalysis ? ANALYSIS_COPY.coachAnalysis : ANALYSIS_COPY.localDiagnostic;
}

function resolveTodayAnalysisStorageLabel(visibleAnalysis, persistenceScope = "local_fallback") {
  if (!visibleAnalysis) return "";
  return persistenceScope === "cloud"
    ? ANALYSIS_COPY.syncedAcrossDevices
    : ANALYSIS_COPY.savedOnDevice;
}

function normalizeProfileCopy(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function appendTodayProfileContext(reason, subject) {
  const baseReason = String(reason || "").trim();
  const safeSubject = String(subject || "").trim();
  if (!safeSubject) return baseReason;
  if (!baseReason) return `Contexte: ${safeSubject}.`;
  if (normalizeProfileCopy(baseReason).includes(normalizeProfileCopy(safeSubject))) return baseReason;
  return `${baseReason} Contexte: ${safeSubject}.`;
}

function resolveTodayImpactLabel({ profileSummary, fallbackImpact }) {
  if (profileSummary?.currentPriority) {
    return `Priorité cohérente avec ${profileSummary.currentPriority}`;
  }
  return fallbackImpact;
}

function buildTodayAnalysisHeroModel({
  analysis,
  localHero,
  occurrencesForSelectedDay,
  goalsById,
  categoriesById,
  activeCategoryId,
  activeCategoryName,
}) {
  if (!analysis || typeof analysis !== "object" || !localHero) return null;
  const primaryAction = analysis.primaryAction && typeof analysis.primaryAction === "object" ? analysis.primaryAction : null;
  if (!primaryAction) return null;
  const occurrence =
    primaryAction.occurrenceId && Array.isArray(occurrencesForSelectedDay)
      ? occurrencesForSelectedDay.find((item) => item?.id === primaryAction.occurrenceId) || null
      : null;
  const goal =
    (occurrence?.goalId && goalsById.get(occurrence.goalId)) ||
    (primaryAction.actionId && goalsById.get(primaryAction.actionId)) ||
    null;
  const recommendedCategoryId = goal?.categoryId || primaryAction.categoryId || activeCategoryId || null;
  const recommendedCategoryName = categoriesById.get(recommendedCategoryId || "")?.name || activeCategoryName || "";
  let mappedPrimaryAction = null;
  if (primaryAction.intent === "start_occurrence") {
    mappedPrimaryAction = {
      kind: "start_occurrence",
      occurrence,
      occurrenceId: primaryAction.occurrenceId || null,
      categoryId: recommendedCategoryId,
    };
  } else if (primaryAction.intent === "resume_session") {
    mappedPrimaryAction = {
      kind: "resume_session",
      categoryId: primaryAction.categoryId || activeCategoryId || null,
    };
  } else if (primaryAction.intent === "open_library") {
    mappedPrimaryAction = { kind: "open_library" };
  } else if (primaryAction.intent === "open_pilotage") {
    mappedPrimaryAction = { kind: "open_pilotage" };
  }

  return {
    ...localHero,
    source: "ai",
    title: analysis.headline || localHero.title,
    meta: analysis.reason || localHero.meta,
    primaryLabel: primaryAction.label || localHero.primaryLabel,
    primaryAction: mappedPrimaryAction,
    recommendedCategoryLabel: recommendedCategoryName || localHero.recommendedCategoryLabel || "",
    recommendedCategoryId: recommendedCategoryId || localHero.recommendedCategoryId || activeCategoryId || null,
    contributionLabel: localHero.contributionLabel || activeCategoryName || "ta priorité active",
    savedAt: analysis.savedAt || null,
    storageScope: analysis.storageScope || "local_fallback",
    decisionSource: analysis.decisionSource || "ai",
    requestId: analysis.requestId || null,
  };
}

function resolveImpactText({ heroGoal, heroCategory, goalsById }) {
  const linkedOutcomeId =
    (typeof heroGoal?.outcomeId === "string" && heroGoal.outcomeId.trim()) ||
    (typeof heroGoal?.parentId === "string" && heroGoal.parentId.trim()) ||
    "";
  const linkedOutcome = linkedOutcomeId ? goalsById.get(linkedOutcomeId) || null : null;
  if (linkedOutcome?.title) return `Faire avancer ${linkedOutcome.title}`;

  const mainGoalId = typeof heroCategory?.mainGoalId === "string" ? heroCategory.mainGoalId.trim() : "";
  const mainGoal = mainGoalId ? goalsById.get(mainGoalId) || null : null;
  if (mainGoal?.title) return `Faire avancer ${mainGoal.title}`;

  if (heroCategory?.name) return `Maintenir l’élan en ${heroCategory.name}`;
  return "Maintenir l’élan sur la priorité active.";
}

function resolveOccurrenceHeroCopy({ occurrence, goalsById, categoriesById }) {
  if (!occurrence) {
    return {
      title: TODAY_SCREEN_COPY.noReadyActionTitle,
      meta: TODAY_SCREEN_COPY.noReadyActionReason,
    };
  }
  const goal = goalsById.get(occurrence.goalId || "") || null;
  const category = categoriesById.get(goal?.categoryId || "") || null;
  const title = goal?.title || occurrence?.title || "Action du moment";
  const timeLabel =
    (typeof occurrence?.start === "string" && occurrence.start) ||
    (typeof occurrence?.slotKey === "string" && occurrence.slotKey) ||
    "";
  const meta = [timeLabel, category?.name || ""].filter(Boolean).join(" • ");
  return {
    title,
    meta: meta || "C’est le prochain pas le plus simple à lancer maintenant.",
  };
}

function compareTodayOccurrences(left, right) {
  const leftStart = typeof left?.start === "string" ? left.start : "";
  const rightStart = typeof right?.start === "string" ? right.start : "";
  if (leftStart !== rightStart) return leftStart.localeCompare(rightStart);
  return String(left?.title || "").localeCompare(String(right?.title || ""));
}

function buildTodayRecommendedActions({
  occurrencesForSelectedDay,
  goalsById,
  categoriesById,
  heroOccurrenceId = "",
  selectedDateKey = "",
  activeCategoryName = "",
  hasOpenSession = false,
}) {
  const remainingOccurrences = (Array.isArray(occurrencesForSelectedDay) ? occurrencesForSelectedDay : [])
    .filter((occurrence) => {
      const status = typeof occurrence?.status === "string" ? occurrence.status : "";
      return (
        occurrence?.id &&
        occurrence.id !== heroOccurrenceId &&
        status !== "done" &&
        status !== "skipped" &&
        status !== "canceled" &&
        status !== "missed" &&
        status !== "rescheduled"
      );
    })
    .sort(compareTodayOccurrences);

  const seenTitles = new Set();
  const suggestions = [];

  for (const occurrence of remainingOccurrences) {
    const goal = goalsById.get(occurrence?.goalId || "") || null;
    const category = categoriesById.get(goal?.categoryId || "") || null;
    const rawTitle = String(goal?.title || occurrence?.title || "").trim();
    const normalizedTitle = rawTitle.toLowerCase();
    if (!rawTitle || seenTitles.has(normalizedTitle)) continue;
    seenTitles.add(normalizedTitle);
    suggestions.push({
      id: `suggestion:${occurrence.id}`,
      intent: "start_occurrence",
      occurrence,
      category,
      title: `Lancer ${rawTitle}`,
      isAiPriority: false,
    });
    if (suggestions.length >= 3) return suggestions;
  }

  if (!hasOpenSession) {
    suggestions.push({
      id: `suggestion:planning:${selectedDateKey || todayLocalKey()}`,
      intent: "open_planning",
      title: "Clarifier le prochain bloc du jour",
      category: null,
      isAiPriority: false,
    });
  }

  suggestions.push({
    id: `suggestion:objectives:${selectedDateKey || todayLocalKey()}`,
    intent: "open_objectives",
    title: activeCategoryName
      ? `Structurer la suite en ${activeCategoryName}`
      : "Structurer la prochaine action",
    category: null,
    isAiPriority: false,
  });

  return suggestions.slice(0, 3);
}

function resolveTodayNextBlockLabel({ todayState, heroTitle, heroOccurrence, nextActions }) {
  if (todayState === "validated") return "Essentiel terminé";
  if (todayState === "overload") return "Charge à alléger";
  if (todayState === "clarify") return TODAY_SCREEN_COPY.progressNothingReady;
  if (heroOccurrence?.id && heroTitle) return heroTitle;
  const fallbackAction = Array.isArray(nextActions)
    ? nextActions.find((item) => typeof item?.title === "string" && item.title.trim())
    : null;
  return fallbackAction?.title || TODAY_SCREEN_COPY.progressNothingReady;
}

function resolveTodayWelcomeSubtitle({ hour }) {
  if (hour < 12) return TODAY_SCREEN_COPY.welcomeMorningSubtitle;
  if (hour < 18) return TODAY_SCREEN_COPY.welcomeDaySubtitle;
  return TODAY_SCREEN_COPY.welcomeEveningSubtitle || TODAY_SCREEN_COPY.welcomeFallbackSubtitle;
}

function resolveTodayHeroStateLabel({ todayState, hasActiveSession }) {
  if (hasActiveSession) return TODAY_SCREEN_COPY.heroStateSession;
  if (todayState === "ready") return TODAY_SCREEN_COPY.heroStateReady;
  if (todayState === "clarify") return TODAY_SCREEN_COPY.heroStateClarify;
  if (todayState === "overload") return TODAY_SCREEN_COPY.heroStateOverload;
  if (todayState === "validated") return TODAY_SCREEN_COPY.heroStateValidated;
  return TODAY_SCREEN_COPY.heroStateFallback;
}

function resolveTodayHeroGuideLabel({ todayState }) {
  if (todayState === "clarify") return TODAY_SCREEN_COPY.heroGuideClarify;
  if (todayState === "overload") return TODAY_SCREEN_COPY.heroGuideOverload;
  if (todayState === "validated") return TODAY_SCREEN_COPY.heroGuideValidated;
  return "";
}

function resolveTodayHeroTimingLabel(occurrence) {
  const rawStart =
    (typeof occurrence?.start === "string" && occurrence.start.trim()) ||
    (typeof occurrence?.slotKey === "string" && occurrence.slotKey.trim()) ||
    "";
  if (!rawStart || occurrence?.noTime) return "";
  return rawStart;
}

function resolveTodayValuePulse({
  dailyState,
  doneBlocksCount,
  todayState,
  nextBlockLabel,
  todayBehaviorCue,
}) {
  const safeDoneMinutes = Number.isFinite(dailyState?.doneMinutes) ? Math.max(0, Math.round(dailyState.doneMinutes)) : 0;
  const safeDoneBlocksCount = Number.isFinite(doneBlocksCount) ? Math.max(0, doneBlocksCount) : 0;

  if (safeDoneBlocksCount > 0) {
    return {
      title: `${safeDoneBlocksCount} bloc${safeDoneBlocksCount > 1 ? "s" : ""} validé${safeDoneBlocksCount > 1 ? "s" : ""} aujourd’hui`,
      meta:
        safeDoneMinutes > 0
          ? `${safeDoneMinutes} min exécutées${todayState === "validated" ? "" : ` • ${nextBlockLabel}`}`
          : nextBlockLabel,
      tone: todayState === "validated" ? "continuity" : "momentum",
    };
  }

  if (safeDoneMinutes > 0) {
    return {
      title: `${safeDoneMinutes} min déjà exécutées aujourd’hui`,
      meta: nextBlockLabel || TODAY_SCREEN_COPY.valuePulseFallbackMeta,
      tone: "continuity",
    };
  }

  if (todayState === "ready" && todayBehaviorCue?.message) {
    return {
      title: todayBehaviorCue.message,
      meta:
        nextBlockLabel && nextBlockLabel !== TODAY_SCREEN_COPY.progressNothingReady
          ? `Prochain: ${nextBlockLabel}`
          : "",
      tone: todayBehaviorCue.cueKind || "structure",
    };
  }

  return null;
}

function normalizeMicroItemForCompare(item) {
  if (!item || typeof item !== "object") return null;
  return {
    id: typeof item.id === "string" ? item.id : "",
    title: typeof item.title === "string" ? item.title : "",
    subtitle: typeof item.subtitle === "string" ? item.subtitle : "",
    categoryId: typeof item.categoryId === "string" ? item.categoryId : "",
    status: typeof item.status === "string" ? item.status : "",
    createdAt: typeof item.createdAt === "string" ? item.createdAt : "",
    doneAt: typeof item.doneAt === "string" ? item.doneAt : "",
    templateId: typeof item.templateId === "string" ? item.templateId : "",
    durationMin: Number.isFinite(item.durationMin) ? item.durationMin : 0,
  };
}

function buildLocalGapSummary({
  activeDate,
  systemToday,
  activeCategoryId,
  categories,
  goals,
  occurrences,
  plannedActionsForActiveDate,
  preferredTimeBlocks = [],
}) {
  return {
    ...computeCategoryScopedRecommendation({
      activeDate,
      systemToday,
      activeCategoryId,
      categories,
      goals: Array.isArray(goals) ? goals.filter((goal) => !isAiFoundationPlanningGoal(goal)) : [],
      occurrences,
      plannedActionsForActiveDate,
      preferredTimeBlocks,
    }),
    activeDate,
  };
}

function isSameMicroActionsV1(a, b) {
  const left = a && typeof a === "object" ? a : {};
  const right = b && typeof b === "object" ? b : {};
  if ((left.dateKey || "") !== (right.dateKey || "")) return false;
  if ((left.categoryId || "") !== (right.categoryId || "")) return false;
  const leftRerolls = Number.isFinite(left.rerollsUsed) ? left.rerollsUsed : 0;
  const rightRerolls = Number.isFinite(right.rerollsUsed) ? right.rerollsUsed : 0;
  if (leftRerolls !== rightRerolls) return false;
  const leftCredits = Number.isFinite(left.rerollCredits) ? left.rerollCredits : 0;
  const rightCredits = Number.isFinite(right.rerollCredits) ? right.rerollCredits : 0;
  if (leftCredits !== rightCredits) return false;
  const leftSequence = Number.isFinite(left.sequence) ? left.sequence : 0;
  const rightSequence = Number.isFinite(right.sequence) ? right.sequence : 0;
  if (leftSequence !== rightSequence) return false;
  const leftItems = Array.isArray(left.items) ? left.items.map(normalizeMicroItemForCompare) : [];
  const rightItems = Array.isArray(right.items) ? right.items.map(normalizeMicroItemForCompare) : [];
  if (leftItems.length !== rightItems.length) return false;
  for (let i = 0; i < leftItems.length; i += 1) {
    if (JSON.stringify(leftItems[i]) !== JSON.stringify(rightItems[i])) return false;
  }
  return true;
}

function normalizeWalletEventForCompare(event) {
  const safe = event && typeof event === "object" ? event : {};
  return {
    ts: Number.isFinite(safe.ts) ? safe.ts : 0,
    type: typeof safe.type === "string" ? safe.type : "",
    amount: Number.isFinite(safe.amount) ? safe.amount : 0,
    meta: safe.meta && typeof safe.meta === "object" ? safe.meta : null,
  };
}

function isSameWalletV1(a, b) {
  const left = a && typeof a === "object" ? a : {};
  const right = b && typeof b === "object" ? b : {};
  if (Number(left.version || 0) !== Number(right.version || 0)) return false;
  if (Number(left.balance || 0) !== Number(right.balance || 0)) return false;
  if (Number(left.earnedToday || 0) !== Number(right.earnedToday || 0)) return false;
  if (Number(left.adsToday || 0) !== Number(right.adsToday || 0)) return false;
  if ((left.dateKey || "") !== (right.dateKey || "")) return false;
  const leftEvents = Array.isArray(left.lastEvents) ? left.lastEvents.map(normalizeWalletEventForCompare) : [];
  const rightEvents = Array.isArray(right.lastEvents) ? right.lastEvents.map(normalizeWalletEventForCompare) : [];
  if (leftEvents.length !== rightEvents.length) return false;
  for (let i = 0; i < leftEvents.length; i += 1) {
    if (JSON.stringify(leftEvents[i]) !== JSON.stringify(rightEvents[i])) return false;
  }
  return true;
}

function normalizeTotemForCompare(totem) {
  const safe = ensureTotemV1(totem);
  return {
    version: Number(safe.version || 0),
    equipped: {
      bodyColor: safe.equipped.bodyColor,
      accessoryIds: [...safe.equipped.accessoryIds],
    },
    owned: {
      colors: [...safe.owned.colors],
      accessories: [...safe.owned.accessories],
    },
    lastAnimationAt: Number(safe.lastAnimationAt || 0),
    animationEnabled: Boolean(safe.animationEnabled),
  };
}

function isSameTotemV1(a, b) {
  return JSON.stringify(normalizeTotemForCompare(a)) === JSON.stringify(normalizeTotemForCompare(b));
}

function loadLegacyBlockOrder() {
  if (typeof window === "undefined") return null;
  try {
    const stored = JSON.parse(localStorage.getItem("todayBlocksOrder"));
    return Array.isArray(stored) ? stored : null;
  } catch (err) {
   void err;
    return null;
  }
}

export default function Home({
  data,
  setData,
  persistenceScope = "local_fallback",
  onOpenLibrary,
  onOpenCoachGuided,
  onOpenSecondaryRoute,
  onOpenPlanning,
  onOpenPilotage,
  onOpenCreateHabit,
  onOpenSession,
  onDayOpen,
  onAddOccurrence,
  onOpenPaywall,
  isPremiumPlan = false,
  planLimits = null,
}) {
  const { emitBehaviorFeedback } = useBehaviorFeedback();
  const safeData = data && typeof data === "object" ? data : {};
  const legacyPendingDateKey = safeData.ui?.pendingDateKey;
  const selectedDateKey =
    normalizeLocalDateKey(safeData.ui?.selectedDateKey || safeData.ui?.selectedDate || legacyPendingDateKey) ||
    todayLocalKey();
  const selectedDate = useMemo(() => fromLocalDateKey(selectedDateKey), [selectedDateKey]);
  const localTodayKey = toLocalDateKey(new Date());
  const selectedStatus =
    selectedDateKey === localTodayKey ? "today" : selectedDateKey < localTodayKey ? "past" : "future";
  const canInteractWithMicroActions = typeof setData === "function";
  const historyLimitDays = !isPremiumPlan ? Number(planLimits?.historyDays) || 0 : 0;
  const historyMaxAge = historyLimitDays > 0 ? historyLimitDays - 1 : null;

  // State
  const [showWhy, setShowWhy] = useState(true);
  const [showDayStats, setShowDayStats] = useState(false);
  const [showDisciplineStats, setShowDisciplineStats] = useState(false);
  const [calendarView, setCalendarView] = useState("day");
  const [calendarPanePhase, setCalendarPanePhase] = useState("enterActive");
  const [calendarPaneKey, setCalendarPaneKey] = useState(0);
  const [dailyNote, setDailyNote] = useState("");
  const [noteMeta, setNoteMeta] = useState({ forme: "", humeur: "", motivation: "" });
  const [focusOverride, setFocusOverride] = useState(null);
  const [showNotesHistory, setShowNotesHistory] = useState(false);
  const [noteDeleteMode, setNoteDeleteMode] = useState(false);
  const [noteDeleteTargetId, setNoteDeleteTargetId] = useState(null);
  const [noteHistoryVersion, setNoteHistoryVersion] = useState(0);
  const [profileSheetOpen, setProfileSheetOpen] = useState(false);
  const { session } = useAuth();
  const legacyOrder = useMemo(() => loadLegacyBlockOrder(), []);
  const blockOrder = useMemo(() => {
    const raw = safeData?.ui?.blocksByPage?.home;
    if (Array.isArray(raw) && raw.length) return normalizeBlockOrder(raw, DEFAULT_BLOCK_ORDER);
    if (legacyOrder) return normalizeBlockOrder(legacyOrder, DEFAULT_BLOCK_ORDER);
    return [...DEFAULT_BLOCK_ORDER];
  }, [safeData?.ui?.blocksByPage?.home, legacyOrder]);
  const [monthCursor, setMonthCursor] = useState(() => startOfMonth(selectedDate));

  const handleReorder = useCallback(
    (nextOrder) => {
      if (typeof setData !== "function") return;
      const nextIds = Array.isArray(nextOrder) ? nextOrder.filter(Boolean) : [];
      setData((prev) => {
        const prevUi = prev?.ui && typeof prev.ui === "object" ? prev.ui : {};
        const prevBlocksByPage =
          prevUi.blocksByPage && typeof prevUi.blocksByPage === "object" ? prevUi.blocksByPage : {};
        const prevHome = Array.isArray(prevBlocksByPage.home) ? prevBlocksByPage.home : [];
        const prevIds = prevHome.map((b) => (typeof b === "string" ? b : b?.id)).filter(Boolean);
        if (arrayEqual(prevIds, nextIds)) return prev;
        const byId = new Map(
          prevHome
            .map((b) => (b && typeof b === "object" ? b : null))
            .filter(Boolean)
            .map((b) => [b.id, b])
        );
        const nextHome = nextIds.map((id) => {
          const existing = byId.get(id);
          return {
            ...(existing || { id, enabled: true }),
            id,
            enabled: existing ? existing.enabled !== false : true,
          };
        });
        return {
          ...prev,
          ui: {
            ...prevUi,
            blocksByPage: {
              ...prevBlocksByPage,
              home: nextHome,
            },
          },
        };
      });
    },
    [setData]
  );
  // Refs
  const noteSaveRef = useRef(null);
  const didHydrateLegacyRef = useRef(false);
  const legacyOrderSigRef = useRef("");
  const calendarDateInvariantLogRef = useRef(new Set());
  const rewardedAdResolverRef = useRef(null);
  const microRewardFeedbackTimeoutRef = useRef(null);
  const [microWatchAdLoading, setMicroWatchAdLoading] = useState(false);
  const [microRewardFeedback, setMicroRewardFeedback] = useState("");
  const [rewardedAdRequest, setRewardedAdRequest] = useState({ open: false, placement: "micro-reroll" });

  useEffect(() => {
    if (selectedDateKey === localTodayKey || typeof setData !== "function") return;
    setData((prev) => ({
      ...prev,
      ui: {
        ...(prev?.ui || {}),
        selectedDateKey: localTodayKey,
        selectedDate: localTodayKey,
      },
    }));
  }, [localTodayKey, selectedDateKey, setData]);

  // Data slices
  const profile = safeData.profile || {};
  // per-view category selection for Home (fallback to legacy)
  const homeSelectedCategoryIdRaw = getSelectedCategoryForView(safeData, CATEGORY_VIEW.TODAY);
  const categories = useMemo(
    () => getVisibleCategories(safeData.categories),
    [safeData.categories]
  );
  const homeSelectedCategoryId = useMemo(
    () =>
      resolvePreferredVisibleCategoryId({
        categories,
        candidates: [homeSelectedCategoryIdRaw, safeData.ui?.selectedCategoryId],
      }),
    [categories, homeSelectedCategoryIdRaw, safeData.ui?.selectedCategoryId]
  );
  const goals = useMemo(
    () =>
      (Array.isArray(safeData.goals) ? safeData.goals : []).filter(
        (goal) => goal?.categoryId && categories.some((category) => category.id === goal.categoryId)
      ),
    [categories, safeData.goals]
  );
  const totemV1 = useMemo(() => ensureTotemV1(safeData?.ui?.totemV1), [safeData?.ui?.totemV1]);
  const noteCategoryId = homeSelectedCategoryId || "today";
  const noteKeyPrefix = noteCategoryId ? `dailyNote:${noteCategoryId}:` : "dailyNote:";
  const noteMetaKeyPrefix = noteCategoryId ? `dailyNoteMeta:${noteCategoryId}:` : "dailyNoteMeta:";
  const noteStorageKey = `${noteKeyPrefix}${selectedDateKey}`;
  const noteMetaStorageKey = `${noteMetaKeyPrefix}${selectedDateKey}`;
  const noteHistoryStorageKey = noteCategoryId ? `dailyNoteHistory:${noteCategoryId}` : "dailyNoteHistory";
  const occurrences = useMemo(
    () => (Array.isArray(safeData.occurrences) ? safeData.occurrences : []),
    [safeData.occurrences]
  );
  const goalIdSet = useMemo(() => new Set(goals.map((g) => g?.id).filter(Boolean)), [goals]);
  const plannedCalendarOccurrences = useMemo(() => {
    const list = [];
    const mismatches = [];
    for (const occ of occurrences) {
      if (!occ || occ.status !== "planned") continue;
      const goalId = typeof occ.goalId === "string" ? occ.goalId : "";
      if (!goalIdSet.has(goalId)) continue;
      const rawDate = typeof occ.date === "string" ? occ.date : "";
      const dateKey = normalizeLocalDateKey(rawDate);
      if (!dateKey) continue;
      list.push({ occ, goalId, dateKey });
      if (rawDate && rawDate !== dateKey) {
        mismatches.push({ id: occ.id || "", rawDate, dateKey });
      }
    }
    return { list, mismatches };
  }, [goalIdSet, occurrences]);
  const plannedOccurrencesForDay = useMemo(
    () =>
      plannedCalendarOccurrences.list
        .filter((entry) => entry.dateKey === selectedDateKey)
        .map((entry) =>
          entry.occ?.date === entry.dateKey ? entry.occ : { ...entry.occ, date: entry.dateKey }
        ),
    [plannedCalendarOccurrences, selectedDateKey]
  );
  const microChecks = useMemo(
    () => (safeData.microChecks && typeof safeData.microChecks === "object" ? safeData.microChecks : {}),
    [safeData.microChecks]
  );
  const microDateKey = localTodayKey;
  const isMicroToday = selectedDateKey === microDateKey;
  const canUseMicroActions = canInteractWithMicroActions && isMicroToday;
  const microDefaultCategoryId = useMemo(() => getDefaultMicroCategoryId(safeData), [safeData]);
  const microCategoryOptions = useMemo(() => {
    const list = [];
    const seen = new Set();
    for (const category of categories) {
      const id = typeof category?.id === "string" ? category.id : "";
      if (!id || seen.has(id)) continue;
      seen.add(id);
      const name = typeof category?.name === "string" && category.name.trim() ? category.name.trim() : id;
      list.push({ value: id, label: name });
    }
    return list;
  }, [categories]);
  const microSelectedCategoryId = useMemo(() => {
    const fromUi = typeof safeData?.ui?.microActionsV1?.categoryId === "string" ? safeData.ui.microActionsV1.categoryId : "";
    const fallback = fromUi || microDefaultCategoryId || homeSelectedCategoryId || categories[0]?.id || null;
    const exists = microCategoryOptions.some((opt) => opt.value === fallback);
    return exists ? fallback : microDefaultCategoryId || homeSelectedCategoryId || categories[0]?.id || null;
  }, [categories, homeSelectedCategoryId, microCategoryOptions, microDefaultCategoryId, safeData?.ui?.microActionsV1?.categoryId]);
  const microActionsV1 = useMemo(
    () => ensureMicroActionsV1(safeData, microDateKey, microSelectedCategoryId),
    [microDateKey, microSelectedCategoryId, safeData]
  );
  const microTodayBucket = useMemo(() => {
    const bucket = microChecks?.[microDateKey];
    return bucket && typeof bucket === "object" ? bucket : {};
  }, [microChecks, microDateKey]);
  const microDoneToday = useMemo(() => Math.min(3, Object.keys(microTodayBucket).length), [microTodayBucket]);
  const microRerollsUsed = useMemo(
    () => Math.max(0, Number(microActionsV1?.rerollsUsed) || 0),
    [microActionsV1?.rerollsUsed]
  );
  const microRerollCredits = useMemo(
    () => Math.max(0, Number(microActionsV1?.rerollCredits) || 0),
    [microActionsV1?.rerollCredits]
  );
  const microWallet = useMemo(() => ensureWallet(safeData, { dateKey: microDateKey }), [microDateKey, safeData]);
  const microCanWatchAd = useMemo(
    () => (!isPremiumPlan ? canWatchAd(microWallet, { dateKey: microDateKey }) : false),
    [isPremiumPlan, microDateKey, microWallet]
  );
  const microRerollLimit = isPremiumPlan ? Number.POSITIVE_INFINITY : BASIC_MICRO_REROLL_LIMIT;
  useEffect(() => {
    const isDev = typeof import.meta !== "undefined" && import.meta.env && import.meta.env.DEV;
    if (!isDev || typeof console === "undefined") return;
    for (const item of plannedCalendarOccurrences.mismatches) {
      const sig = `${item.id}|${item.rawDate}|${item.dateKey}`;
      if (calendarDateInvariantLogRef.current.has(sig)) continue;
      calendarDateInvariantLogRef.current.add(sig);
      // eslint-disable-next-line no-console
      console.warn(
        `[calendar-datekey-invariant] occurrence=${item.id || "unknown"} rawDate=${item.rawDate} cellDate=${item.dateKey}`
      );
    }
  }, [plannedCalendarOccurrences.mismatches]);

  // Effects
  useEffect(() => {
    if (didHydrateLegacyRef.current) return;
    if (typeof setData !== "function") return;
    if (!legacyOrder) return;
    const raw = safeData?.ui?.blocksByPage?.home;
    if (Array.isArray(raw) && raw.length) {
      didHydrateLegacyRef.current = true;
      return;
    }
    didHydrateLegacyRef.current = true;
    const nextOrder = normalizeBlockOrder(legacyOrder, DEFAULT_BLOCK_ORDER);
    const sig = nextOrder.join(",");
    if (legacyOrderSigRef.current === sig) return;
    legacyOrderSigRef.current = sig;
    setData((prev) => {
      const prevUi = prev?.ui && typeof prev.ui === "object" ? prev.ui : {};
      const prevBlocksByPage =
        prevUi.blocksByPage && typeof prevUi.blocksByPage === "object" ? prevUi.blocksByPage : {};
      const prevHome = Array.isArray(prevBlocksByPage.home) ? prevBlocksByPage.home : [];
      const prevIds = prevHome.map((b) => (typeof b === "string" ? b : b?.id)).filter(Boolean);
      if (arrayEqual(prevIds, nextOrder)) return prev;
      const byId = new Map(
        prevHome
          .map((b) => (b && typeof b === "object" ? b : null))
          .filter(Boolean)
          .map((b) => [b.id, b])
      );
      const nextHome = nextOrder.map((id) => {
        const existing = byId.get(id);
        return {
          ...(existing || { id, enabled: true }),
          id,
          enabled: existing ? existing.enabled !== false : true,
        };
      });
      return {
        ...prev,
        ui: {
          ...prevUi,
          blocksByPage: {
            ...prevBlocksByPage,
            home: nextHome,
          },
        },
      };
    });
    try {
      localStorage.removeItem("todayBlocksOrder");
    } catch (err) {
   void err;
      // Ignore storage failures.
    }
  }, [legacyOrder, safeData?.ui?.blocksByPage?.home, setData]);

  useEffect(() => {
    if (typeof console === "undefined") return;
    const hasDuplicate = new Set(blockOrder).size !== blockOrder.length;
    if (hasDuplicate && typeof import.meta !== "undefined" && import.meta.env?.DEV) {
      // eslint-disable-next-line no-console
      console.warn("[blocks] duplicate ids in home block order");
    }
  }, [blockOrder]);

  useEffect(() => {
    if (typeof setData !== "function") return;
    setData((prev) => {
      const prevUi = prev?.ui && typeof prev.ui === "object" ? prev.ui : {};
      const current = prevUi.microActionsV1;
      const fallbackCategory = (current && typeof current.categoryId === "string" && current.categoryId) ||
        getDefaultMicroCategoryId(prev);
      const ensured = ensureMicroActionsV1(prev, microDateKey, fallbackCategory);
      const ensuredWallet = ensureWallet(prev, { dateKey: microDateKey });
      const ensuredTotem = ensureTotemV1(prevUi.totemV1);
      if (
        isSameMicroActionsV1(current, ensured) &&
        isSameWalletV1(prevUi.walletV1, ensuredWallet) &&
        isSameTotemV1(prevUi.totemV1, ensuredTotem)
      ) {
        return prev;
      }
      return {
        ...prev,
        ui: {
          ...prevUi,
          microActionsV1: ensured,
          walletV1: ensuredWallet,
          totemV1: ensuredTotem,
        },
      };
    });
  }, [microDateKey, setData]);

  useEffect(() => {
    const unregister = setRewardedAdPresenter(({ placement }) => {
      if (rewardedAdResolverRef.current) {
        return Promise.resolve({ ok: false, reason: "unavailable" });
      }
      return new Promise((resolve) => {
        rewardedAdResolverRef.current = resolve;
        setRewardedAdRequest({
          open: true,
          placement: typeof placement === "string" && placement ? placement : "micro-reroll",
        });
      });
    });

    return () => {
      unregister?.();
      if (rewardedAdResolverRef.current) {
        rewardedAdResolverRef.current({ ok: false, reason: "dismissed" });
        rewardedAdResolverRef.current = null;
      }
      if (microRewardFeedbackTimeoutRef.current) {
        window.clearTimeout(microRewardFeedbackTimeoutRef.current);
        microRewardFeedbackTimeoutRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    let next = "";
    try {
      next = localStorage.getItem(noteStorageKey) || "";
    } catch (err) {
   void err;
      next = "";
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDailyNote(next);
  }, [noteStorageKey]);

  useEffect(() => {
    let next = { forme: "", humeur: "", motivation: "" };
    try {
      const raw = localStorage.getItem(noteMetaStorageKey) || "";
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === "object") {
          next = {
            forme: typeof parsed.forme === "string" ? parsed.forme : "",
            humeur: typeof parsed.humeur === "string" ? parsed.humeur : "",
            motivation: typeof parsed.motivation === "string" ? parsed.motivation : "",
          };
        }
      }
    } catch (err) {
   void err;
      // Ignore storage failures.
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setNoteMeta(next);
  }, [noteMetaStorageKey]);

  useEffect(() => {
    if (noteSaveRef.current) clearTimeout(noteSaveRef.current);
    noteSaveRef.current = setTimeout(() => {
      try {
        localStorage.setItem(noteStorageKey, dailyNote || "");
      } catch (err) {
   void err;
        // Ignore storage failures (private mode, quota, etc.)
      }
    }, 400);
    return () => {
      if (noteSaveRef.current) clearTimeout(noteSaveRef.current);
    };
  }, [dailyNote, noteStorageKey]);

  useEffect(() => {
    if (!focusOverride?.dateKey) return;
    if (focusOverride.dateKey !== selectedDateKey) setFocusOverride(null);
  }, [focusOverride?.dateKey, selectedDateKey]);

  // Derived data
  const rawActiveSession =
    safeData.ui && typeof safeData.ui.activeSession === "object" ? safeData.ui.activeSession : null;
  const todayNowModel = useMemo(
    () =>
      deriveTodayNowModel({
        categories,
        goals,
        selectedCategoryId: homeSelectedCategoryId,
        rawActiveSession,
        selectedDateKey,
        focusOverride,
        plannedOccurrencesForDay,
      }),
    [categories, focusOverride, goals, homeSelectedCategoryId, plannedOccurrencesForDay, rawActiveSession, selectedDateKey]
  );
  const {
    activeDate,
    systemToday,
    activeSessionForActiveDate,
    openSessionOutsideActiveDate,
    futureSessions,
    plannedActionsForActiveDate,
    focusOccurrenceForActiveDate,
    focusCategory,
    selectedCategoryId: executionCategoryId,
    activeHabits,
    ensureProcessIds,
    sessionForDay,
    sessionHabit,
    focusBaseOccurrence,
    focusOverrideOccurrence,
    focusOccurrence,
    isFocusOverride,
    alternativeCandidates,
  } = todayNowModel;
  const todayAnalysisContextKey = useMemo(
    () =>
      buildTodayManualAiContextKey({
        userId: session?.user?.id || "",
        dateKey: activeDate,
        activeCategoryId: executionCategoryId,
      }),
    [activeDate, executionCategoryId, session?.user?.id]
  );
  const manualTodayAnalysis = useManualAiAnalysis({
    data: safeData,
    setData,
    contextKey: todayAnalysisContextKey,
    surface: "today",
  });
  const shouldShowFocusCard = isFocusOverride || alternativeCandidates.length > 0;
  const visibleBlockOrder = useMemo(
    () => blockOrder.filter((id) => id !== "focus" || shouldShowFocusCard),
    [blockOrder, shouldShowFocusCard]
  );
  const handleVisibleReorder = useCallback(
    (nextVisibleOrder) => {
      if (shouldShowFocusCard) {
        handleReorder(nextVisibleOrder);
        return;
      }
      const safeNextVisible = Array.isArray(nextVisibleOrder) ? nextVisibleOrder.filter(Boolean) : [];
      let visibleIndex = 0;
      const nextOrder = blockOrder.map((id) => {
        if (id === "focus") return id;
        const nextId = safeNextVisible[visibleIndex];
        visibleIndex += 1;
        return nextId || id;
      });
      handleReorder(nextOrder);
    },
    [blockOrder, handleReorder, shouldShowFocusCard]
  );
  const doneHabitIds = useMemo(() => {
    const ids = new Set();
    for (const occ of occurrences) {
      if (!occ || occ.status !== "done") continue;
      if (occ.date !== selectedDateKey) continue;
      if (occ.goalId) ids.add(occ.goalId);
    }
    if (Array.isArray(sessionForDay?.doneHabitIds)) {
      for (const id of sessionForDay.doneHabitIds) ids.add(id);
    }
    return ids;
  }, [occurrences, selectedDateKey, sessionForDay?.doneHabitIds]);

  const goalsById = useMemo(() => {
    const map = new Map();
    for (const g of goals) if (g && g.id) map.set(g.id, g);
    return map;
  }, [goals]);
  const categoriesById = useMemo(() => {
    const map = new Map();
    for (const c of categories) if (c && c.id) map.set(c.id, c);
    return map;
  }, [categories]);
  useEffect(() => {
    if (!focusOverride?.dateKey || focusOverride.dateKey !== selectedDateKey) return;
    if (!focusOverrideOccurrence) setFocusOverride(null);
  }, [focusOverride?.dateKey, focusOverrideOccurrence, selectedDateKey]);
  const logFocusDeviation = useCallback((event) => {
    try {
      const key = "focusDeviationEvents";
      const raw = localStorage.getItem(key);
      const list = raw ? JSON.parse(raw) : [];
      const next = Array.isArray(list) ? [...list, event] : [event];
      localStorage.setItem(key, JSON.stringify(next.slice(-200)));
    } catch (err) {
   void err;
    }
  }, []);
  const handleSelectFocusAlternative = useCallback(
    (item) => {
      if (!item?.occ || !item.occ.id) return;
      setFocusOverride({ dateKey: selectedDateKey, occurrenceId: item.occ.id });
      if (focusBaseOccurrence?.id && item.occ.id !== focusBaseOccurrence.id) {
        logFocusDeviation({
          dateKey: selectedDateKey,
          occurrenceId: item.occ.id,
          baseOccurrenceId: focusBaseOccurrence.id,
          kind: item.kind,
          chosenAt: new Date().toISOString(),
        });
      }
    },
    [focusBaseOccurrence?.id, logFocusDeviation, selectedDateKey]
  );
  const occurrenceSort = useCallback(
    (a, b) => {
      const ga = goalsById.get(a?.goalId) || null;
      const gb = goalsById.get(b?.goalId) || null;
      const sa = typeof a?.start === "string" ? a.start : "";
      const sb = typeof b?.start === "string" ? b.start : "";
      const ha = Boolean(ga?.startTime || (sa && sa !== "00:00"));
      const hb = Boolean(gb?.startTime || (sb && sb !== "00:00"));
      if (ha !== hb) return ha ? -1 : 1;
      if (ha && hb && sa !== sb) return sa.localeCompare(sb);
      const ta = ga?.title || "";
      const tb = gb?.title || "";
      return String(ta).localeCompare(String(tb));
    },
    [goalsById]
  );

  const occurrencesForSelectedDay = useMemo(() => {
    const list = [];
    for (const occ of occurrences) {
      if (!occ) continue;
      const dateKey = normalizeLocalDateKey(occ.date);
      if (!dateKey || dateKey !== selectedDateKey) continue;
      list.push(occ?.date === dateKey ? occ : { ...occ, date: dateKey });
    }
    return list.slice().sort(occurrenceSort);
  }, [occurrences, occurrenceSort, selectedDateKey]);
  useEffect(() => {
    const isDev = typeof import.meta !== "undefined" && import.meta.env && import.meta.env.DEV;
    if (!isDev) return;
    for (const occ of occurrencesForSelectedDay) {
      if (goalsById.has(occ.goalId)) continue;
      // eslint-disable-next-line no-console
      console.log("[orphan occurrence skipped]", occ);
    }
  }, [goalsById, occurrencesForSelectedDay]);
  const todayCalendarModel = useMemo(
    () =>
      deriveTodayCalendarModel({
        plannedCalendarOccurrences,
        occurrences,
        goalsById,
        categoriesById,
        goalIdSet,
        selectedDateKey,
        selectedCategoryId: executionCategoryId,
        fallbackAccent: resolveCategoryColor(focusCategory, getAccentForPage(safeData, "home")),
        defaultActionId: focusOccurrence?.goalId || sessionHabit?.id || ensureProcessIds[0] || null,
      }),
    [
      categoriesById,
      ensureProcessIds,
      executionCategoryId,
      focusCategory?.color,
      focusOccurrence?.goalId,
      goalIdSet,
      goalsById,
      occurrences,
      plannedCalendarOccurrences,
      safeData,
      selectedDateKey,
      sessionHabit?.id,
    ]
  );
  const {
    plannedByDate,
    doneByDate,
    categoryDotsByDate,
    accentByDate,
    selectedDateAccent,
    addActionContext,
  } = todayCalendarModel;
  const getDayDots = useCallback(
    (dateKey, max = 3) => {
      const list = categoryDotsByDate.get(dateKey) || [];
      const dots = list.slice(0, max);
      const extra = Math.max(0, list.length - max);
      return { dots, extra };
    },
    [categoryDotsByDate]
  );

  const todayProgressModel = useMemo(
    () =>
      deriveTodayProgressModel({
        activeHabits,
        doneHabitIds,
        goals,
        occurrences,
        microChecks,
        localTodayKey,
        safeData,
      }),
    [activeHabits, doneHabitIds, goals, localTodayKey, microChecks, occurrences, safeData]
  );
  const {
    coreProgress,
    habitsDoneCount,
    disciplineSummary: disciplineBreakdown,
  } = todayProgressModel;

  const calendarRangeLabel = useMemo(() => {
    try {
      const fmt = new Intl.DateTimeFormat("fr-FR", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      });
      return fmt.format(selectedDate);
    } catch (err) {
      void err;
      return selectedDateKey || "";
    }
  }, [selectedDate, selectedDateKey]);

  const selectedDateLabel =
    selectedStatus === "today" ? `${calendarRangeLabel} · Aujourd’hui` : calendarRangeLabel;

  const monthGrid = useMemo(() => buildMonthGrid(monthCursor), [monthCursor]);

  useEffect(() => {
    if (!legacyPendingDateKey || typeof setData !== "function") return;
    setData((prev) => {
      const prevUi = prev?.ui && typeof prev.ui === "object" ? prev.ui : {};
      if (!prevUi.pendingDateKey) return prev;
      const nextUi = { ...prevUi };
      delete nextUi.pendingDateKey;
      if (!nextUi.selectedDateKey) nextUi.selectedDateKey = prevUi.pendingDateKey;
      if (!nextUi.selectedDate) nextUi.selectedDate = prevUi.pendingDateKey;
      return {
        ...prev,
        ui: nextUi,
      };
    });
  }, [legacyPendingDateKey, setData]);

  useEffect(() => {
    // selectedDate is a Date object; avoid dependency loops by keying off the dateKey.
    const base = fromLocalDateKey(selectedDateKey);
    if (!base) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMonthCursor(startOfMonth(base));
  }, [selectedDateKey]);

  useEffect(() => {
    // Lightweight in-app transition (GPU-friendly): opacity + translate.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCalendarPanePhase("enter");
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCalendarPaneKey((k) => k + 1);
    const raf = requestAnimationFrame(() => {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCalendarPanePhase("enterActive");
    });
    return () => cancelAnimationFrame(raf);
  }, [calendarView]);

  // Handlers
  const commitDateKey = useCallback(
    (nextKey) => {
      if (!nextKey || typeof setData !== "function") return;
      setData((prev) => {
        const prevUi = prev?.ui && typeof prev.ui === "object" ? prev.ui : {};
        if (prevUi.selectedDateKey === nextKey && prevUi.selectedDate === nextKey) {
          return prev;
        }
        return {
          ...prev,
          ui: {
            ...prevUi,
            selectedDateKey: nextKey,
            selectedDate: nextKey,
          },
        };
      });
    },
    [setData]
  );

  const handleDayOpen = useCallback(
    (nextKey) => {
      if (!nextKey) return;
      commitDateKey(nextKey);
      if (typeof onDayOpen === "function") onDayOpen(nextKey);
    },
    [commitDateKey, onDayOpen]
  );
  const handleAddOccurrence = useCallback(
    (nextKey, actionId) => {
      if (!nextKey) return;
      if (typeof onAddOccurrence === "function") {
        onAddOccurrence(nextKey, actionId || null);
      }
    },
    [onAddOccurrence]
  );
  const handleStartSession = useCallback(
    (item) => {
      if (!item) return;
      if (item.intent === "open_planning") {
        onOpenPlanning?.();
        return;
      }
      if (item.intent === "open_objectives") {
        onOpenLibrary?.();
        return;
      }
      const occurrence = item.occurrence || item;
      if (!occurrence?.id) return;
      const startPolicy = resolveTodayOccurrenceStartPolicy({
        activeDate: selectedDateKey,
        systemToday: localTodayKey,
        occurrenceDate: occurrence.date || "",
      });
      if (!startPolicy.canStartDirectly) return;
      const gate = resolveRuntimeSessionGate(safeData, { occurrenceId: occurrence.id });
      if (gate.status !== "ready" && gate.activeSession?.occurrenceId) {
        const activeOccurrence = (Array.isArray(safeData.occurrences) ? safeData.occurrences : []).find(
          (entry) => entry?.id === gate.activeSession.occurrenceId
        ) || null;
        const activeGoal = activeOccurrence?.goalId ? goalsById.get(activeOccurrence.goalId) || null : null;
        if (typeof onOpenSession === "function") {
          onOpenSession({
            categoryId: activeGoal?.categoryId || null,
            dateKey: gate.activeSession.dateKey || activeOccurrence?.date || selectedDateKey,
            occurrenceId: gate.activeSession.occurrenceId || null,
          });
        }
        return;
      }
      const goal = occurrence.goalId ? goalsById.get(occurrence.goalId) || null : null;
      const categoryId = goal?.categoryId || null;
      if (typeof onOpenSession === "function") {
        onOpenSession({
          categoryId,
          dateKey: occurrence.date || selectedDateKey,
          occurrenceId: occurrence.id || null,
        });
      }
    },
    [goalsById, localTodayKey, onOpenLibrary, onOpenPlanning, onOpenSession, safeData, selectedDateKey]
  );
  const lastEnsureSigRef = useRef("");
  const ensureDebugCountRef = useRef(0);
  useEffect(() => {
    if (!selectedDateKey || typeof setData !== "function") return;

    // Make signature stable even if ensureProcessIds order changes between renders.
    const sortedIds = Array.isArray(ensureProcessIds)
      ? ensureProcessIds.filter(Boolean).slice().sort()
      : [];
    const sig = `${selectedDateKey}:${sortedIds.join(",")}`;
    if (lastEnsureSigRef.current === sig) return;
    lastEnsureSigRef.current = sig;

    setData((prev) => {
      let next = prev;
      if (sortedIds.length) {
        const baseDate = fromLocalDateKey(selectedDateKey);
        const fromKey = baseDate ? toLocalDateKey(addDays(baseDate, -1)) : selectedDateKey;
        const toKey = baseDate ? toLocalDateKey(addDays(baseDate, 1)) : selectedDateKey;
        next = ensureWindowFromScheduleRules(next, fromKey, toKey, sortedIds);
      }
      next = backfillMissedOccurrences(next);
      if (import.meta.env?.DEV && next !== prev) {
        ensureDebugCountRef.current += 1;
        // eslint-disable-next-line no-console
        console.debug("[home] ensureWindowFromScheduleRules", { sig, count: ensureDebugCountRef.current });
      }
      return next;
    });
  }, [ensureProcessIds, selectedDateKey, setData]);

  const { items: noteHistoryItems, hasHistoryBeyondLimit } = useMemo(() => {
    void noteHistoryVersion;
    if (!showNotesHistory) return { items: [], hasHistoryBeyondLimit: false };
    let nextItems = [];
    try {
      const items = [];
      let history = [];
      try {
        const raw = localStorage.getItem(noteHistoryStorageKey) || "";
        const parsed = raw ? JSON.parse(raw) : [];
        if (Array.isArray(parsed)) history = parsed;
      } catch (err) {
        void err;
        history = [];
      }
      history.forEach((entry, index) => {
        if (!entry || typeof entry !== "object") return;
        const dateKey = typeof entry.dateKey === "string" ? entry.dateKey : "";
        const note = typeof entry.note === "string" ? entry.note : "";
        const meta = entry.meta && typeof entry.meta === "object" ? entry.meta : {};
        const savedAt = Number(entry.savedAt) || 0;
        const hasNote = Boolean(note.trim());
        const hasMeta = Boolean(meta.forme || meta.humeur || meta.motivation);
        if (!hasNote && !hasMeta) return;
        items.push({
          id: savedAt ? `${dateKey}-${savedAt}` : `${dateKey}-${index}`,
          dateKey,
          note,
          meta,
          savedAt,
        });
      });

      const entries = new Map();
      for (let i = 0; i < localStorage.length; i += 1) {
        const key = localStorage.key(i);
        if (!key) continue;
        if (key.startsWith(noteKeyPrefix)) {
          const dateKey = key.slice(noteKeyPrefix.length);
          const note = localStorage.getItem(key) || "";
          const entry = entries.get(dateKey) || { dateKey, note: "", meta: {} };
          entry.note = note;
          entries.set(dateKey, entry);
        }
        if (key.startsWith(noteMetaKeyPrefix)) {
          const dateKey = key.slice(noteMetaKeyPrefix.length);
          let meta = {};
          try {
            const raw = localStorage.getItem(key) || "";
            const parsed = raw ? JSON.parse(raw) : null;
            if (parsed && typeof parsed === "object") meta = parsed;
          } catch (err) {
            void err;
            meta = {};
          }
          const entry = entries.get(dateKey) || { dateKey, note: "", meta: {} };
          entry.meta = { ...entry.meta, ...meta };
          entries.set(dateKey, entry);
        }
      }

      Array.from(entries.values()).forEach((item) => {
        const hasNote = Boolean((item.note || "").trim());
        const meta = item.meta || {};
        const hasMeta = Boolean(meta.forme || meta.humeur || meta.motivation);
        if (!hasNote && !hasMeta) return;
        items.push({
          id: `current-${item.dateKey}`,
          dateKey: item.dateKey,
          note: item.note,
          meta: item.meta,
          savedAt: 0,
        });
      });

      nextItems = items
        .sort((a, b) => {
          const aTime = a.savedAt || 0;
          const bTime = b.savedAt || 0;
          if (aTime && bTime) return bTime - aTime;
          if (aTime) return -1;
          if (bTime) return 1;
          return (b.dateKey || "").localeCompare(a.dateKey || "");
        })
        .slice(0, 120);
    } catch (err) {
      void err;
      nextItems = [];
    }
    if (!historyMaxAge && historyMaxAge !== 0) {
      return { items: nextItems, hasHistoryBeyondLimit: false };
    }
    const today = fromLocalDateKey(localTodayKey);
    const limited = nextItems.filter((item) => {
      const itemDate = fromLocalDateKey(item.dateKey);
      const age = diffDays(itemDate, today);
      return age >= 0 && age <= historyMaxAge;
    });
    const hasBeyond = nextItems.length > limited.length;
    return { items: limited, hasHistoryBeyondLimit: hasBeyond };
  }, [
    noteHistoryVersion,
    noteHistoryStorageKey,
    noteKeyPrefix,
    noteMetaKeyPrefix,
    showNotesHistory,
    historyMaxAge,
    localTodayKey,
  ]);

  function updateNoteMeta(patch) {
    setNoteMeta((prev) => {
      const next = { ...prev, ...patch };
      try {
        localStorage.setItem(noteMetaStorageKey, JSON.stringify(next));
      } catch (err) {
   void err;
        // Ignore storage failures.
      }
      return next;
    });
  }

  function clearDailyNote(dateKeyValue) {
    const targetDate = dateKeyValue || selectedDateKey;
    const nextMeta = { forme: "", humeur: "", motivation: "" };
    if (targetDate === selectedDateKey) {
      setDailyNote("");
      setNoteMeta(nextMeta);
    }
    try {
      localStorage.setItem(`${noteKeyPrefix}${targetDate}`, "");
      localStorage.setItem(`${noteMetaKeyPrefix}${targetDate}`, JSON.stringify(nextMeta));
    } catch (err) {
   void err;
      // Ignore storage failures.
    }
    setNoteHistoryVersion((v) => v + 1);
  }

  function deleteSelectedNote() {
    if (!noteDeleteTargetId) return;
    const target = noteHistoryItems.find((item) => item.id === noteDeleteTargetId) || null;
    if (!target) return;
    const targetDateKey = target.dateKey;
    const isCurrentEntry = typeof target.id === "string" && target.id.startsWith("current-");
    if (isCurrentEntry) {
      clearDailyNote(targetDateKey);
      setNoteDeleteTargetId(null);
      setNoteDeleteMode(false);
      return;
    }
    try {
      const raw = localStorage.getItem(noteHistoryStorageKey) || "";
      const parsed = raw ? JSON.parse(raw) : [];
      const history = Array.isArray(parsed) ? parsed : [];
      const targetSavedAt = Number(target.savedAt) || 0;
      const targetNote = typeof target.note === "string" ? target.note : "";
      const targetMeta = target.meta && typeof target.meta === "object" ? target.meta : {};
      const nextHistory = history.filter((entry) => {
        if (!entry || typeof entry !== "object") return false;
        const entryDate = typeof entry.dateKey === "string" ? entry.dateKey : "";
        if (entryDate !== targetDateKey) return true;
        const entrySavedAt = Number(entry.savedAt) || 0;
        if (targetSavedAt) return entrySavedAt !== targetSavedAt;
        const entryNote = typeof entry.note === "string" ? entry.note : "";
        const entryMeta = entry.meta && typeof entry.meta === "object" ? entry.meta : {};
        return entryNote !== targetNote || JSON.stringify(entryMeta) !== JSON.stringify(targetMeta);
      });
      localStorage.setItem(noteHistoryStorageKey, JSON.stringify(nextHistory));
    } catch (err) {
   void err;
      // Ignore storage failures.
    }
    setNoteHistoryVersion((v) => v + 1);
    setNoteDeleteTargetId(null);
    setNoteDeleteMode(false);
  }

  function addNoteToHistory() {
    const trimmedNote = (dailyNote || "").trim();
    const meta = noteMeta || {};
    const hasMeta = Boolean(meta.forme || meta.humeur || meta.motivation);
    if (!trimmedNote && !hasMeta) return;
    const entry = {
      dateKey: selectedDateKey,
      note: trimmedNote,
      meta: { ...meta },
      savedAt: Date.now(),
    };
    try {
      const raw = localStorage.getItem(noteHistoryStorageKey) || "";
      const parsed = raw ? JSON.parse(raw) : [];
      const history = Array.isArray(parsed) ? parsed : [];
      history.unshift(entry);
      localStorage.setItem(noteHistoryStorageKey, JSON.stringify(history));
    } catch (err) {
   void err;
      // Ignore storage failures.
    }
    setDailyNote("");
    const nextMeta = { forme: "", humeur: "", motivation: "" };
    setNoteMeta(nextMeta);
    try {
      localStorage.setItem(noteStorageKey, "");
      localStorage.setItem(noteMetaStorageKey, JSON.stringify(nextMeta));
    } catch (err) {
   void err;
      // Ignore storage failures.
    }
    setNoteHistoryVersion((v) => v + 1);
  }

  function handleMicroCategoryChange(nextCategoryId) {
    if (!canUseMicroActions) return;
    if (typeof setData !== "function") return;
    setData((prev) => {
      const prevUi = prev?.ui && typeof prev.ui === "object" ? prev.ui : {};
      const targetCategory = (typeof nextCategoryId === "string" && nextCategoryId) || getDefaultMicroCategoryId(prev);
      const nextMicro = ensureMicroActionsV1(prev, microDateKey, targetCategory, {
        resetItemsOnCategoryChange: true,
      });
      if (isSameMicroActionsV1(prevUi.microActionsV1, nextMicro)) return prev;
      return {
        ...prev,
        ui: {
          ...prevUi,
          microActionsV1: nextMicro,
        },
      };
    });
  }

  function handleMicroActionDone(slotIndex) {
    if (!canUseMicroActions) return;
    if (typeof setData !== "function") return;
    let coinGranted = false;
    let didComplete = false;
    let feedbackCategoryId = null;
    const eventTs = Date.now();
    setData((prev) => {
      const prevUi = prev?.ui && typeof prev.ui === "object" ? prev.ui : {};
      const selectedCategory = (typeof prevUi?.microActionsV1?.categoryId === "string" && prevUi.microActionsV1.categoryId)
        || getDefaultMicroCategoryId(prev);
      const result = completeMicroAction(prev, slotIndex, {
        dateKey: microDateKey,
        categoryId: selectedCategory,
      });
      if (!result.doneItem?.id) return prev;
      didComplete = true;
      feedbackCategoryId = selectedCategory;

      const prevMicroChecks = prev?.microChecks && typeof prev.microChecks === "object" ? prev.microChecks : {};
      const prevDay = prevMicroChecks?.[microDateKey] && typeof prevMicroChecks[microDateKey] === "object"
        ? prevMicroChecks[microDateKey]
        : {};
      const alreadyDone = Boolean(prevDay[result.doneItem.id]);
      const nextMicroChecks = prevDay[result.doneItem.id]
        ? prevMicroChecks
        : {
            ...prevMicroChecks,
            [microDateKey]: {
              ...prevDay,
              [result.doneItem.id]: true,
            },
          };
      const currentWallet = ensureWallet(prev, { dateKey: microDateKey });
      const nextWallet = alreadyDone
        ? currentWallet
        : addCoins(
            currentWallet,
            MICRO_ACTION_COINS_REWARD,
            {
              type: "micro_done",
              meta: {
                microItemId: result.doneItem.id,
                categoryId: selectedCategory,
              },
            },
            { dateKey: microDateKey }
          );
      coinGranted = !alreadyDone;
      const nextTotem = (() => {
        const currentTotem = ensureTotemV1(prevUi.totemV1);
        if (!coinGranted || !currentTotem.animationEnabled) return currentTotem;
        return {
          ...currentTotem,
          lastAnimationAt: eventTs,
        };
      })();

      return {
        ...prev,
        ui: {
          ...prevUi,
          microActionsV1: result.microActions,
          walletV1: nextWallet,
          totemV1: nextTotem,
        },
        microChecks: nextMicroChecks,
      };
    });
    if (didComplete) {
      emitBehaviorFeedback(
        deriveBehaviorFeedbackSignal({
          intent: "complete_micro_action",
          payload: {
            surface: "today",
            categoryId: feedbackCategoryId || executionCategoryId || focusCategory?.id || null,
          },
        })
      );
    }
    if (totemV1.animationEnabled) {
      emitTotemEvent({
        type: "MICRO_DONE",
        payload: { target: "categoryRail" },
      });
    }
  }

  function handleMicroReroll(indices = [], options = {}) {
    if (!canUseMicroActions) return;
    if (typeof setData !== "function") return;
    setData((prev) => {
      const prevUi = prev?.ui && typeof prev.ui === "object" ? prev.ui : {};
      const selectedCategory = (typeof prevUi?.microActionsV1?.categoryId === "string" && prevUi.microActionsV1.categoryId)
        || getDefaultMicroCategoryId(prev);
      const current = ensureMicroActionsV1(prev, microDateKey, selectedCategory);
      const rerollCredits = Math.max(0, Number(current.rerollCredits) || 0);
      const wantsCredit = options?.useCredit === true;
      const limitReached = !isPremiumPlan && Number(current.rerollsUsed || 0) >= BASIC_MICRO_REROLL_LIMIT;
      const canUseCredit = !isPremiumPlan && limitReached && rerollCredits > 0;
      if (wantsCredit && !canUseCredit) return prev;
      if (!wantsCredit && limitReached) return prev;
      const result = rerollMicroActions(prev, indices, {
        dateKey: microDateKey,
        categoryId: selectedCategory,
        incrementUsage: !wantsCredit,
      });
      if (!result.replacedCount) return prev;
      let nextMicro = result.microActions;
      let nextWallet = ensureWallet(prev, { dateKey: microDateKey });
      if (wantsCredit && canUseCredit) {
        nextMicro = {
          ...nextMicro,
          rerollCredits: Math.max(0, rerollCredits - 1),
        };
        nextWallet = appendWalletEvent(
          nextWallet,
          {
            type: "spend_reroll",
            amount: 1,
            meta: { replacedCount: result.replacedCount },
          },
          { dateKey: microDateKey }
        );
      }
      if (isSameMicroActionsV1(prevUi.microActionsV1, nextMicro) && isSameWalletV1(prevUi.walletV1, nextWallet)) return prev;
      return {
        ...prev,
        ui: {
          ...prevUi,
          microActionsV1: nextMicro,
          walletV1: nextWallet,
        },
      };
    });
  }

  function resolveRewardedAd(result) {
    const resolver = rewardedAdResolverRef.current;
    rewardedAdResolverRef.current = null;
    setRewardedAdRequest({ open: false, placement: "micro-reroll" });
    resolver?.(result);
  }

  function handleRewardedAdDismiss() {
    resolveRewardedAd({ ok: false, reason: "dismissed" });
  }

  function handleRewardedAdComplete() {
    resolveRewardedAd({ ok: true });
  }

  async function handleMicroWatchAd() {
    if (isPremiumPlan) return;
    if (!canUseMicroActions) return;
    if (typeof setData !== "function") return;
    if (!microCanWatchAd) return;
    if (microWatchAdLoading) return;

    setMicroWatchAdLoading(true);
    setMicroRewardFeedback("");
    try {
      const result = await showRewardedAd({ placement: "micro-reroll" });
      if (!result?.ok) {
        if (result?.reason === "unavailable") {
          setMicroRewardFeedback("Vidéo indisponible pour le moment.");
        } else if (result?.reason === "dismissed") {
          setMicroRewardFeedback("Vidéo fermée.");
        }
        return;
      }

      let rewardApplied = false;
      const eventTs = Date.now();
      setData((prev) => {
        const prevUi = prev?.ui && typeof prev.ui === "object" ? prev.ui : {};
        const selectedCategory = (typeof prevUi?.microActionsV1?.categoryId === "string" && prevUi.microActionsV1.categoryId)
          || getDefaultMicroCategoryId(prev);
        const currentMicro = ensureMicroActionsV1(prev, microDateKey, selectedCategory);
        const currentWallet = ensureWallet(prev, { dateKey: microDateKey });
        const rewarded = applyAdReward(currentWallet, {
          dateKey: microDateKey,
          coins: REWARDED_AD_COINS_REWARD,
          meta: { placement: "micro-reroll" },
        });
        if (!rewarded.granted) return prev;
        rewardApplied = true;
        const nextMicro = {
          ...currentMicro,
          rerollCredits: Math.max(0, Number(currentMicro.rerollCredits) || 0) + 1,
        };
        const currentTotem = ensureTotemV1(prevUi.totemV1);
        const nextTotem = currentTotem.animationEnabled
          ? { ...currentTotem, lastAnimationAt: eventTs }
          : currentTotem;
        if (
          isSameMicroActionsV1(prevUi.microActionsV1, nextMicro) &&
          isSameWalletV1(prevUi.walletV1, rewarded.wallet) &&
          isSameTotemV1(prevUi.totemV1, nextTotem)
        ) {
          return prev;
        }
        return {
          ...prev,
          ui: {
            ...prevUi,
            microActionsV1: nextMicro,
            walletV1: rewarded.wallet,
            totemV1: nextTotem,
          },
        };
      });
      if (rewardApplied) {
        setMicroRewardFeedback("");
      }
    } finally {
      setMicroWatchAdLoading(false);
    }
  }

  const handleMicroGoToToday = useCallback(() => {
    handleDayOpen(localTodayKey);
  }, [handleDayOpen, localTodayKey]);


  // Render
  const accent = getAccentForPage(safeData, "home");
  const backgroundImage = profile.whyImage || "";

  const whyText = (profile.whyText || "").trim();
  const whyDisplay = whyText || "Ajoute ton pourquoi dans l’onboarding.";
  const localGapSummary = useMemo(
    () =>
      buildLocalGapSummary({
        activeDate,
        systemToday,
        activeCategoryId: executionCategoryId || focusCategory?.id || null,
        categories,
        goals,
        occurrences,
        plannedActionsForActiveDate,
        preferredTimeBlocks: safeData?.user_ai_profile?.preferred_time_blocks || [],
      }),
    [
      activeDate,
      categories,
      executionCategoryId,
      focusCategory?.id,
      goals,
      occurrences,
      plannedActionsForActiveDate,
      safeData?.user_ai_profile?.preferred_time_blocks,
      systemToday,
    ]
  );
  const scopedFocusOccurrence = localGapSummary?.recommendedOccurrence || null;
  const scopedFocusCopy = useMemo(
    () =>
      resolveOccurrenceHeroCopy({
        occurrence: scopedFocusOccurrence,
        goalsById,
        categoriesById,
      }),
    [categoriesById, goalsById, scopedFocusOccurrence]
  );
  const localHeroModel = useMemo(
    () =>
      buildLocalTodayHeroModel({
        activeDate,
        systemTodayKey: systemToday,
        activeCategoryId: executionCategoryId || focusCategory?.id || null,
        activeCategoryHasMainGoal: Boolean(focusCategory?.mainGoalId),
        activeSessionForActiveDate,
        openSessionOutsideActiveDate,
        futureSessions,
        focusOccurrenceForActiveDate: scopedFocusOccurrence,
        focusTitle: scopedFocusCopy.title,
        focusMeta: scopedFocusCopy.meta,
        gapSummary: localGapSummary,
        activeCategoryName: focusCategory?.name || null,
      }),
    [
      activeDate,
      activeSessionForActiveDate,
      executionCategoryId,
      focusCategory?.id,
      focusCategory?.mainGoalId,
      focusCategory?.name,
      futureSessions,
      localGapSummary,
      openSessionOutsideActiveDate,
      scopedFocusCopy.meta,
      scopedFocusCopy.title,
      scopedFocusOccurrence,
      systemToday,
    ]
  );
  const canonicalContextSummary = useMemo(
    () =>
      buildTodayCanonicalContextSummary({
        activeDate,
        isToday: activeDate === systemToday,
        activeSessionForActiveDate,
        openSessionOutsideActiveDate,
        futureSessions,
        plannedActionsForActiveDate,
        focusOccurrenceForActiveDate: scopedFocusOccurrence,
      }),
    [
      activeSessionForActiveDate,
      activeDate,
      futureSessions,
      openSessionOutsideActiveDate,
      plannedActionsForActiveDate,
      scopedFocusOccurrence,
      systemToday,
    ]
  );
  const aiHeroViewModel = useMemo(
    () =>
      buildTodayAnalysisHeroModel({
        analysis: manualTodayAnalysis.visibleAnalysis,
        localHero: localHeroModel,
        occurrencesForSelectedDay,
        goalsById,
        categoriesById,
        activeCategoryId: executionCategoryId || focusCategory?.id || null,
        activeCategoryName: focusCategory?.name || null,
      }),
    [
      categoriesById,
      executionCategoryId,
      focusCategory?.id,
      focusCategory?.name,
      goalsById,
      localHeroModel,
      manualTodayAnalysis.visibleAnalysis,
      occurrencesForSelectedDay,
    ]
  );
  const baseHeroViewModel = useMemo(
    () => aiHeroViewModel || localHeroModel,
    [aiHeroViewModel, localHeroModel]
  );
  const hasPlannedOccurrencesToday = useMemo(
    () =>
      occurrencesForSelectedDay.some((occurrence) => {
        const status = typeof occurrence?.status === "string" ? occurrence.status : "";
        return status !== "canceled" && status !== "skipped" && status !== "missed";
      }),
    [occurrencesForSelectedDay]
  );
  const heroViewModel = useMemo(() => {
    if (
      selectedDateKey === localTodayKey &&
      !hasPlannedOccurrencesToday &&
      (baseHeroViewModel?.primaryAction?.kind === "open_pilotage" ||
        baseHeroViewModel?.primaryAction?.kind === "open_library")
    ) {
      return {
        ...baseHeroViewModel,
        primaryLabel: TODAY_SCREEN_COPY.createWithCoach,
        primaryAction: {
          kind: "open_coach_plan",
        },
      };
    }
    return baseHeroViewModel;
  }, [baseHeroViewModel, hasPlannedOccurrencesToday, localTodayKey, selectedDateKey]);
  const todayDecisionDiagnostics = useMemo(
    () =>
      ({
        mode: baseHeroViewModel?.source === "ai" ? "manual_ai" : "local",
        contextKey: todayAnalysisContextKey,
        storageScope: manualTodayAnalysis.visibleAnalysis?.storageScope || null,
        requestState: manualTodayAnalysis.loading ? "loading" : manualTodayAnalysis.visibleAnalysis ? "visible" : "local",
        canonicalContextSummary,
      }),
    [
      canonicalContextSummary,
      baseHeroViewModel?.source,
      manualTodayAnalysis.loading,
      manualTodayAnalysis.visibleAnalysis,
      todayAnalysisContextKey,
    ]
  );
  const shouldAnimateCoachResponse =
    manualTodayAnalysis.requestDiagnostics.deliverySource === "network" &&
    manualTodayAnalysis.requestDiagnostics.hadVisibleLoading &&
    heroViewModel?.source === "ai";
  const typedHeroTitle = useTypingReveal(heroViewModel.title, {
    enabled: shouldAnimateCoachResponse,
    charsPerTick: 1,
    intervalMs: 34,
  });
  useEffect(() => {
    const isDev = typeof import.meta !== "undefined" && import.meta.env && import.meta.env.DEV;
    const isLocalHost =
      typeof window !== "undefined" &&
      (window.location?.hostname === "localhost" || window.location?.hostname === "127.0.0.1");
    if (!isDev && !isLocalHost) return;
    // eslint-disable-next-line no-console
    console.log("[today-coach]", todayDecisionDiagnostics);
  }, [todayDecisionDiagnostics]);
  const handleHeroPrimaryAction = useCallback(() => {
    const action = heroViewModel.primaryAction;
    if (!action) return;
    if (action.kind === "start_occurrence") {
      if (!action.occurrence) return;
      handleStartSession(action.occurrence);
      return;
    }
    if (action.kind === "resume_session") {
      if (typeof onOpenSession !== "function") return;
      onOpenSession({
        categoryId: action.categoryId || executionCategoryId || focusCategory?.id || null,
        dateKey: selectedDateKey,
        occurrenceId: activeSessionForActiveDate?.occurrenceId || null,
      });
      return;
    }
    if (action.kind === "open_library") {
      if (typeof onOpenLibrary === "function") onOpenLibrary();
      return;
    }
    if (action.kind === "open_pilotage") {
      if (typeof onOpenPilotage === "function") onOpenPilotage();
    }
  }, [
    executionCategoryId,
    focusCategory?.id,
    handleStartSession,
    heroViewModel.primaryAction,
    onOpenLibrary,
    onOpenPilotage,
    onOpenSession,
    selectedDateKey,
  ]);

  const heroOccurrence = useMemo(() => {
    if (heroViewModel?.primaryAction?.kind === "start_occurrence" && heroViewModel.primaryAction.occurrence) {
      return heroViewModel.primaryAction.occurrence;
    }
    if (activeSessionForActiveDate?.occurrenceId) {
      return (
        occurrencesForSelectedDay.find((occ) => occ?.id === activeSessionForActiveDate.occurrenceId) ||
        scopedFocusOccurrence ||
        focusOccurrence ||
        null
      );
    }
    return scopedFocusOccurrence || focusOccurrence || null;
  }, [activeSessionForActiveDate?.occurrenceId, focusOccurrence, heroViewModel?.primaryAction, occurrencesForSelectedDay, scopedFocusOccurrence]);
  const heroGoal = heroOccurrence?.goalId ? goalsById.get(heroOccurrence.goalId) || null : null;
  const heroCategory = categoriesById.get(heroGoal?.categoryId || focusCategory?.id || "") || focusCategory || null;
  const activeCategoryProfileSummary = useMemo(
    () => getCategoryProfileSummary(safeData, executionCategoryId || focusCategory?.id || null),
    [executionCategoryId, focusCategory?.id, safeData]
  );
  const heroDurationLabel = Number.isFinite(heroOccurrence?.durationMinutes)
    ? `${heroOccurrence.durationMinutes} min`
    : "";
  const baseHeroImpactText = useMemo(
    () =>
      resolveImpactText({
        heroGoal,
        heroCategory,
        goalsById,
      }),
    [goalsById, heroCategory, heroGoal]
  );
  const heroAnalysisState = useMemo(
    () =>
      resolveManualAiDisplayState({
        loading: manualTodayAnalysis.loading,
        visibleAnalysis: manualTodayAnalysis.visibleAnalysis,
        wasRefreshed: manualTodayAnalysis.wasRefreshed,
      }),
    [manualTodayAnalysis.loading, manualTodayAnalysis.visibleAnalysis, manualTodayAnalysis.wasRefreshed]
  );
  const heroAnalysisModeLabel = useMemo(
    () => heroAnalysisState.label || resolveTodayAnalysisModeLabel(manualTodayAnalysis.visibleAnalysis),
    [heroAnalysisState.label, manualTodayAnalysis.visibleAnalysis]
  );
  const heroDisplayCategoryName = heroViewModel?.recommendedCategoryLabel || heroCategory?.name || "";
  const heroDisplayCategory =
    categoriesById.get(heroViewModel?.recommendedCategoryId || heroCategory?.id || "") || heroCategory || null;
  const heroContributionLabel =
    activeCategoryProfileSummary?.mainGoal ||
    heroViewModel?.contributionLabel ||
    baseHeroImpactText;
  const heroReasonText = useMemo(
    () => appendTodayProfileContext(heroViewModel?.meta || whyDisplay, activeCategoryProfileSummary?.subject),
    [activeCategoryProfileSummary?.subject, heroViewModel?.meta, whyDisplay]
  );
  const heroImpactText = useMemo(
    () =>
      resolveTodayImpactLabel({
        profileSummary: activeCategoryProfileSummary,
        fallbackImpact: baseHeroImpactText,
      }),
    [activeCategoryProfileSummary, baseHeroImpactText]
  );
  const heroStorageLabel = useMemo(
    () => resolveTodayAnalysisStorageLabel(manualTodayAnalysis.visibleAnalysis, persistenceScope),
    [manualTodayAnalysis.visibleAnalysis, persistenceScope]
  );
  const heroTimestampLabel = useMemo(
    () => formatRelativeCoachTimestamp(manualTodayAnalysis.visibleAnalysis?.savedAt),
    [manualTodayAnalysis.visibleAnalysis?.savedAt]
  );
  const sessionHistoryByOccurrenceId = useMemo(() => {
    const history = Array.isArray(safeData.sessionHistory) ? safeData.sessionHistory : [];
    const map = new Map();
    for (const entry of history) {
      if (!entry?.occurrenceId) continue;
      const previous = map.get(entry.occurrenceId) || null;
      const nextTs = Date.parse(entry?.endAt || entry?.startAt || "") || 0;
      const previousTs = Date.parse(previous?.endAt || previous?.startAt || "") || 0;
      if (!previous || nextTs >= previousTs) map.set(entry.occurrenceId, entry);
    }
    return map;
  }, [safeData.sessionHistory]);
  const nextActions = useMemo(
    () =>
      buildTodayRecommendedActions({
        occurrencesForSelectedDay,
        goalsById,
        categoriesById,
        heroOccurrenceId: heroOccurrence?.id || "",
        selectedDateKey,
        activeCategoryName: focusCategory?.name || heroDisplayCategoryName || "",
        hasOpenSession: Boolean(safeData?.ui?.activeSession && isRuntimeSessionOpen(safeData.ui.activeSession)),
      }),
    [
      categoriesById,
      focusCategory?.name,
      goalsById,
      heroDisplayCategoryName,
      heroOccurrence?.id,
      occurrencesForSelectedDay,
      safeData?.ui?.activeSession,
      selectedDateKey,
    ]
  );
  const dailyState = useMemo(() => {
    const plannedMinutes = occurrencesForSelectedDay.reduce((sum, occurrence) => {
      const status = typeof occurrence?.status === "string" ? occurrence.status : "";
      if (status === "canceled" || status === "skipped") return sum;
      return sum + (Number.isFinite(occurrence?.durationMinutes) ? occurrence.durationMinutes : 0);
    }, 0);
    const doneMinutes = occurrencesForSelectedDay.reduce((sum, occurrence) => {
      if (occurrence?.status !== "done") return sum;
      const runtimeEntry = sessionHistoryByOccurrenceId.get(occurrence.id) || null;
      if (Number.isFinite(runtimeEntry?.timerSeconds)) {
        return sum + Math.round(runtimeEntry.timerSeconds / 60);
      }
      return sum + (Number.isFinite(occurrence?.durationMinutes) ? occurrence.durationMinutes : 0);
    }, 0);
    return {
      plannedMinutes,
      doneMinutes,
      remainingMinutes: Math.max(plannedMinutes - doneMinutes, 0),
    };
  }, [occurrencesForSelectedDay, sessionHistoryByOccurrenceId]);
  const todayV2State = useMemo(
    () =>
      deriveTodayV2State({
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
      }),
    [
      activeSessionForActiveDate,
      dailyState,
      focusCategory,
      heroOccurrence,
      heroViewModel,
      localGapSummary,
      localTodayKey,
      nextActions,
      occurrencesForSelectedDay,
      selectedDateKey,
    ]
  );
  const todayBehaviorCue = useMemo(
    () =>
      deriveTodayBehaviorCue({
        disciplineSummary: disciplineBreakdown,
        coreProgress,
        activeCategory: heroCategory || focusCategory || null,
        profileSummary: activeCategoryProfileSummary,
      }),
    [activeCategoryProfileSummary, coreProgress, disciplineBreakdown, focusCategory, heroCategory]
  );
  const openPlanningForToday = useCallback(() => {
    if (typeof setData === "function") {
      setData((prev) => ({
        ...prev,
        ui: withExecutionActiveCategoryId(
          {
            ...(prev?.ui || {}),
            selectedDateKey: localTodayKey,
            selectedDate: localTodayKey,
          },
          executionCategoryId || focusCategory?.id || getSelectedCategoryForView(prev, CATEGORY_VIEW.TODAY) || null
        ),
      }));
    }
    onOpenPlanning?.();
  }, [executionCategoryId, focusCategory?.id, localTodayKey, onOpenPlanning, setData]);
  const handleTodayHeroAction = useCallback(
    (action) => {
      if (!action?.kind) return;
      if (action.kind === "open_coach") {
        onOpenCoachGuided?.({
          mode: action.mode === "plan" ? "plan" : "free",
          prefill: action.prefill || "",
        });
        return;
      }
      if (action.kind === "open_create_habit") {
        onOpenCreateHabit?.();
        return;
      }
      if (action.kind === "open_planning_for_today") {
        openPlanningForToday();
        return;
      }
      if (action.kind === "start_occurrence") {
        if (action.occurrence) handleStartSession(action.occurrence);
        return;
      }
      if (action.kind === "resume_session") {
        if (typeof onOpenSession !== "function") return;
        onOpenSession({
          categoryId: action.categoryId || executionCategoryId || focusCategory?.id || null,
          dateKey: selectedDateKey,
          occurrenceId: activeSessionForActiveDate?.occurrenceId || null,
        });
        return;
      }
      if (action.kind === "open_library") {
        onOpenLibrary?.();
        return;
      }
      if (action.kind === "open_pilotage") {
        onOpenPilotage?.();
      }
    },
    [
      activeSessionForActiveDate?.occurrenceId,
      executionCategoryId,
      focusCategory?.id,
      handleStartSession,
      onOpenCoachGuided,
      onOpenCreateHabit,
      onOpenLibrary,
      onOpenPilotage,
      onOpenSession,
      openPlanningForToday,
      selectedDateKey,
    ]
  );
  const canHandleTodayHeroAction = useCallback(
    (action) =>
      Boolean(
        action &&
          (
            action.kind === "open_coach" ||
            action.kind === "open_planning_for_today" ||
            action.kind === "open_library" ||
            action.kind === "open_pilotage" ||
            action.kind === "resume_session" ||
            action.kind === "open_create_habit" ||
            (action.kind === "start_occurrence" && action.occurrence)
          )
      ),
    []
  );
  const handleAnalyzeHero = useCallback(async () => {
    await manualTodayAnalysis.runAnalysis({
      execute: () =>
        requestAiNow({
          accessToken: session?.access_token || "",
          payload: {
            selectedDateKey,
            activeCategoryId: executionCategoryId,
            surface: "today",
            trigger: "manual",
          },
        }),
      serializeSuccess: (result) =>
        createPersistedNowAnalysisEntry({
          contextKey: todayAnalysisContextKey,
          storageScope: persistenceScope,
          coach: result?.coach,
        }),
    });
  }, [
    executionCategoryId,
    manualTodayAnalysis,
    persistenceScope,
    selectedDateKey,
    session?.access_token,
    todayAnalysisContextKey,
  ]);
  const canTriggerHeroPrimaryAction = Boolean(
    heroViewModel?.primaryAction?.kind === "resume_session" ||
      heroViewModel?.primaryAction?.kind === "open_library" ||
      heroViewModel?.primaryAction?.kind === "open_pilotage" ||
      heroViewModel?.primaryAction?.kind === "open_coach_plan" ||
      (heroViewModel?.primaryAction?.kind === "start_occurrence" && heroOccurrence)
  );
  const greetingName =
    String(profile?.full_name || profile?.username || profile?.name || "").trim() || TODAY_SCREEN_COPY.fallbackName;
  const currentHour = new Date().getHours();
  const greetingPeriod = (() => {
    const hour = currentHour;
    if (hour < 18) return TODAY_SCREEN_COPY.greetingMorning;
    return TODAY_SCREEN_COPY.greetingEvening;
  })();
  const headerDateLabel = (() => {
    try {
      return new Intl.DateTimeFormat("fr-FR", {
        weekday: "long",
        month: "long",
        day: "numeric",
      }).format(selectedDate);
    } catch {
      return selectedDateKey;
    }
  })();
  const plannedBlocksCount = useMemo(
    () =>
      occurrencesForSelectedDay.reduce((sum, occurrence) => {
        const status = typeof occurrence?.status === "string" ? occurrence.status : "";
        if (TODAY_HIDDEN_BLOCK_STATUSES.has(status)) return sum;
        return sum + 1;
      }, 0),
    [occurrencesForSelectedDay]
  );
  const doneBlocksCount = useMemo(
    () =>
      occurrencesForSelectedDay.reduce((sum, occurrence) => {
        const status = typeof occurrence?.status === "string" ? occurrence.status : "";
        return sum + (TODAY_COMPLETED_STATUSES.has(status) ? 1 : 0);
      }, 0),
    [occurrencesForSelectedDay]
  );
  const nextBlockLabel = useMemo(
    () =>
      resolveTodayNextBlockLabel({
        todayState: todayV2State.state,
        heroTitle: todayV2State.hero.title,
        heroOccurrence,
        nextActions: todayV2State.alternatives,
      }),
    [heroOccurrence, todayV2State.alternatives, todayV2State.hero.title, todayV2State.state]
  );
  const todayShellModel = useMemo(
    () => ({
      welcome: {
        greeting: greetingPeriod,
        name: greetingName,
        dateLabel: headerDateLabel,
        subtitle: resolveTodayWelcomeSubtitle({
          hour: currentHour,
        }),
      },
      progress: {
        ratio: plannedBlocksCount > 0 ? doneBlocksCount / plannedBlocksCount : 0,
        doneBlocksCount,
        plannedBlocksCount,
        doneMinutes: dailyState.doneMinutes,
        nextBlockLabel,
      },
      hero: {
        title:
          todayV2State.state === "ready" || todayV2State.state === "legacy_fallback"
            ? typedHeroTitle || todayV2State.hero.title
            : todayV2State.hero.title,
        reason: todayV2State.hero.reason,
        categoryLabel: todayV2State.hero.categoryLabel || heroDisplayCategoryName,
        durationLabel: todayV2State.hero.durationLabel,
        timingLabel: resolveTodayHeroTimingLabel(heroOccurrence),
        stateLabel: resolveTodayHeroStateLabel({
          todayState: todayV2State.state,
          hasActiveSession: Boolean(activeSessionForActiveDate),
        }),
        stateTone: activeSessionForActiveDate ? "session" : todayV2State.state,
        supportLabel: resolveTodayHeroGuideLabel({
          todayState: todayV2State.state,
        }),
        categoryColor: resolveCategoryColor(heroDisplayCategory || focusCategory, accent),
        primaryLabel: todayV2State.hero.primaryLabel || TODAY_SCREEN_COPY.primaryAction,
        primaryAction: todayV2State.hero.primaryAction,
        secondaryLabel: todayV2State.hero.secondaryLabel || "",
        secondaryAction: todayV2State.hero.secondaryAction,
      },
      secondaryActions: todayV2State.alternatives,
      valuePulse: resolveTodayValuePulse({
        dailyState,
        doneBlocksCount,
        todayState: todayV2State.state,
        nextBlockLabel,
        todayBehaviorCue,
      }),
    }),
    [
      activeSessionForActiveDate,
      currentHour,
      dailyState,
      doneBlocksCount,
      greetingName,
      greetingPeriod,
      headerDateLabel,
      heroContributionLabel,
      heroDisplayCategoryName,
        heroOccurrence,
        nextBlockLabel,
        plannedBlocksCount,
        todayBehaviorCue,
        todayV2State.alternatives,
        accent,
        todayV2State.hero.primaryAction,
        todayV2State.hero.primaryLabel,
        todayV2State.hero.reason,
      todayV2State.hero.secondaryAction,
      todayV2State.hero.secondaryLabel,
      todayV2State.hero.title,
      todayV2State.hero.durationLabel,
      todayV2State.hero.categoryLabel,
      todayV2State.state,
      typedHeroTitle,
    ]
  );
  const insightCopy = [
    manualTodayAnalysis.visibleAnalysis?.headline || "",
    heroReasonText || "",
  ]
    .filter(Boolean)
    .join(" ");
  const todayHeaderRight = (
    <div className="todayHeaderRightCluster">
      <button
        type="button"
        className="lovableIconButton todayProfileButton"
        aria-label={TODAY_SCREEN_COPY.profileAriaLabel}
        onClick={() => setProfileSheetOpen(true)}
      >
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
          <path d="M12 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4Z" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M5 20a7 7 0 0 1 14 0" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
    </div>
  );

  return (
    <>
      <AppScreen
        accent={accent}
        backgroundImage={backgroundImage}
        pageId="today"
        headerTitle={
          <span className="todayWelcomeTitle" data-tour-id="today-title">
            <span>{todayShellModel.welcome.greeting}, </span>
            <span className="todayWelcomeAccent">{todayShellModel.welcome.name}</span>
          </span>
        }
        headerSubtitle={
          <span className="todayWelcomeSubtitle">
            <span className="todayWelcomeDate">{todayShellModel.welcome.dateLabel}</span>
            <span className="todayWelcomeHint">{todayShellModel.welcome.subtitle}</span>
          </span>
        }
        headerRight={todayHeaderRight}
        headerRowAlign="start"
      >
        <div className="lovablePage todayShellPage">
          {todayV2State.showProgress ? (
            <TodayDailyState
              model={todayShellModel.progress}
            />
          ) : null}

          <TodayHero
            title={todayShellModel.hero.title}
            reason={todayShellModel.hero.reason}
            contributionLabel={heroContributionLabel}
            recommendedCategoryLabel={todayShellModel.hero.categoryLabel}
            durationLabel={todayShellModel.hero.durationLabel}
            timingLabel={todayShellModel.hero.timingLabel}
            stateLabel={todayShellModel.hero.stateLabel}
            stateTone={todayShellModel.hero.stateTone}
            supportLabel={todayShellModel.hero.supportLabel}
            categoryColor={todayShellModel.hero.categoryColor}
            primaryLabel={todayShellModel.hero.primaryLabel}
            secondaryLabel={todayShellModel.hero.secondaryLabel}
            onPrimaryAction={() => handleTodayHeroAction(todayShellModel.hero.primaryAction)}
            onSecondaryAction={() => handleTodayHeroAction(todayShellModel.hero.secondaryAction)}
            canPrimaryAction={canHandleTodayHeroAction(todayShellModel.hero.primaryAction)}
            canSecondaryAction={canHandleTodayHeroAction(todayShellModel.hero.secondaryAction)}
            isPreparing={manualTodayAnalysis.loading}
          />

          {todayShellModel.secondaryActions.length ? (
            <TodayNextActions
              actions={todayShellModel.secondaryActions}
              onOpenOccurrence={handleStartSession}
              activeCategory={heroDisplayCategory || focusCategory || null}
            />
          ) : null}

          {todayShellModel.valuePulse ? (
            <TodayValuePulse
              title={todayShellModel.valuePulse.title}
              meta={todayShellModel.valuePulse.meta}
              tone={todayShellModel.valuePulse.tone}
            />
          ) : null}
        </div>
      </AppScreen>

      <AppSheet open={profileSheetOpen} onClose={() => setProfileSheetOpen(false)} maxWidth={420}>
        <AppSheetContent
          title={TODAY_SCREEN_COPY.profileMenuTitle}
          subtitle={TODAY_SCREEN_COPY.profileMenuSubtitle}
        >
          <div className="todayProfileSheetActions">
            {[
              { id: "account", label: TODAY_SCREEN_COPY.profileRouteAccount },
              { id: "billing", label: TODAY_SCREEN_COPY.profileRouteBilling },
              { id: "settings", label: TODAY_SCREEN_COPY.profileRouteSettings },
              { id: "faq", label: TODAY_SCREEN_COPY.profileRouteFaq },
              { id: "legal", label: TODAY_SCREEN_COPY.profileRouteLegal },
            ].map((item) => (
              <GhostButton
                key={item.id}
                type="button"
                className="todayProfileSheetAction"
                onClick={() => {
                  setProfileSheetOpen(false);
                  onOpenSecondaryRoute?.(item.id);
                }}
              >
                {item.label}
              </GhostButton>
            ))}
          </div>
        </AppSheetContent>
      </AppSheet>
    </>
  );
}

// Manual tests:
// - Fresh load (no interaction): rail + grid highlight today and month aligns.
// - Refresh (same tab, no interaction): rail + grid highlight today and month aligns.
// - Scroll rail (auto): selection updates without touching sessionStorage.
// - Click a day or ⟳: selection updates and persists; month follows.
