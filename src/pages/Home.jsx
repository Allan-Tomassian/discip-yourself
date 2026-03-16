import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import SortableBlocks from "../components/SortableBlocks";
import ScreenShell from "./_ScreenShell";
import { GateButton, GateRow, GateSection } from "../shared/ui/gate/Gate";
import {
  addDays,
  addMonths,
  buildMonthGrid,
  startOfMonth,
} from "../utils/dates";
import { fromLocalDateKey, normalizeLocalDateKey, toLocalDateKey, todayLocalKey } from "../utils/dateKey";
import { backfillMissedOccurrences, ensureWindowFromScheduleRules } from "../logic/occurrencePlanner";
import { normalizeOccurrenceForUI } from "../logic/compat";
import { applySessionRuntimeTransition, isRuntimeSessionOpen } from "../logic/sessionRuntime";
import { emitSessionRuntimeNotificationHook } from "../logic/sessionRuntimeNotifications";
import { getAccentForPage } from "../utils/_theme";
import { getCategoryAccentVars } from "../utils/categoryAccent";
import { getDefaultBlockIds } from "../logic/blocks/registry";
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
import CalendarCard from "../ui/calendar/CalendarCard";
import FocusCard from "../ui/focus/FocusCard";
import MicroActionsCard from "../ui/today/MicroActionsCard";
import RewardedAdModal from "../ui/today/RewardedAdModal";
import { emitTotemEvent } from "../ui/totem/totemEvents";
import { LABELS, UI_COPY } from "../ui/labels";
import { useAuth } from "../auth/useAuth";
import { deriveTodayNowModel } from "../features/today/nowModel";
import { deriveTodayCalendarModel } from "../features/today/todayCalendarModel";
import { deriveTodayProgressModel } from "../features/today/todayProgressModel";
import { deriveTodayHeroChrome, deriveTodayHeroModel } from "../features/today/aiNowHeroAdapter";
import { useAiNow } from "../hooks/useAiNow";

// TOUR MAP:
// - primary_action: start session (GO) for today
// - key_elements: focus section, calendar, micro-actions, daily note
// - optional_elements: day stats/discipline stats modals
const DEFAULT_BLOCK_ORDER = getDefaultBlockIds("home");

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

function Button({ variant = "primary", className = "", ...props }) {
  const gateVariant = variant === "ghost" || variant === "danger" ? "ghost" : "primary";
  const dangerClass = variant === "danger" ? "todayDangerButton" : "";
  const mergedClassName = [className, dangerClass, "GatePressable"].filter(Boolean).join(" ");
  return <GateButton variant={gateVariant} className={mergedClassName} {...props} />;
}

function HomeCard({ className = "", children, ...props }) {
  const mergedClassName = ["GateSurfacePremium", "GateCardPremium", className].filter(Boolean).join(" ");
  return (
    <GateSection className={mergedClassName} collapsible={false} {...props}>
      {children}
    </GateSection>
  );
}

function IconButton({ className = "", children, ...props }) {
  const mergedClassName = ["GateIconButtonPremium", "GatePressable", className].filter(Boolean).join(" ");
  return (
    <button type="button" className={mergedClassName} {...props}>
      {children}
    </button>
  );
}

function SelectMenu({ value, onChange, options = [], placeholder = "", className = "", style }) {
  const mergedClassName = ["GateSelectPremium", className].filter(Boolean).join(" ");
  return (
    <select
      value={value}
      className={mergedClassName}
      style={style}
      onChange={(event) => onChange?.(event.target.value)}
    >
      {placeholder ? <option value="">{placeholder}</option> : null}
      {(Array.isArray(options) ? options : []).map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  );
}

function Textarea({ className = "", ...props }) {
  const mergedClassName = ["GateTextareaPremium", className].filter(Boolean).join(" ");
  return <textarea className={mergedClassName} {...props} />;
}


export default function Home({
  data,
  setData,
  onOpenLibrary,
  onOpenPilotage,
  onOpenManageCategory,
  onOpenSession,
  onDayOpen,
  onAddOccurrence,
  onOpenPaywall,
  isPremiumPlan = false,
  planLimits = null,
}) {
  const safeData = data && typeof data === "object" ? data : {};
  const legacyPendingDateKey = safeData.ui?.pendingDateKey;
  const selectedDateKey =
    normalizeLocalDateKey(safeData.ui?.selectedDateKey || safeData.ui?.selectedDate || legacyPendingDateKey) ||
    todayLocalKey();
  const selectedDate = useMemo(() => fromLocalDateKey(selectedDateKey), [selectedDateKey]);
  const localTodayKey = toLocalDateKey(new Date());
  const selectedStatus =
    selectedDateKey === localTodayKey ? "today" : selectedDateKey < localTodayKey ? "past" : "future";
  const canValidate = selectedStatus === "today";
  const canInteractWithMicroActions = typeof setData === "function";
  const canEdit = selectedStatus !== "past";
  const lockMessage = selectedStatus === "past" ? "Lecture seule" : "Disponible le jour J";
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

  // Data slices
  const profile = safeData.profile || {};
  // per-view category selection for Home (fallback to legacy)
  const homeSelectedCategoryIdRaw =
    safeData.ui?.selectedCategoryByView?.home || safeData.ui?.selectedCategoryId || null;
  const homeSelectedCategoryId = homeSelectedCategoryIdRaw || "general";
  const categories = useMemo(
    () => (Array.isArray(safeData.categories) ? safeData.categories : []),
    [safeData.categories]
  );
  const goals = useMemo(() => (Array.isArray(safeData.goals) ? safeData.goals : []), [safeData.goals]);
  const totemV1 = useMemo(() => ensureTotemV1(safeData?.ui?.totemV1), [safeData?.ui?.totemV1]);
  const noteCategoryId = homeSelectedCategoryId;
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
    if (!seen.has("general")) list.unshift({ value: "general", label: "Général" });
    return list;
  }, [categories]);
  const microSelectedCategoryId = useMemo(() => {
    const fromUi = typeof safeData?.ui?.microActionsV1?.categoryId === "string" ? safeData.ui.microActionsV1.categoryId : "";
    const fallback = fromUi || microDefaultCategoryId || "general";
    const exists = microCategoryOptions.some((opt) => opt.value === fallback);
    return exists ? fallback : microDefaultCategoryId || "general";
  }, [microCategoryOptions, microDefaultCategoryId, safeData?.ui?.microActionsV1?.categoryId]);
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
    activeSessionForActiveDate,
    focusCategory,
    selectedCategoryId: executionCategoryId,
    activeHabits,
    ensureProcessIds,
    activeSession,
    sessionForDay,
    sessionHabit,
    focusBaseOccurrence,
    focusOverrideOccurrence,
    focusOccurrence,
    isFocusOverride,
    alternativeCandidates,
    canStart,
    startPayload,
  } = todayNowModel;
  const aiNow = useAiNow({
    selectedDateKey,
    activeCategoryId: executionCategoryId,
    activeSessionId: activeSessionForActiveDate?.id || activeSessionForActiveDate?.occurrenceId || null,
    isAuthenticated: Boolean(session),
    enabled: true,
  });
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
        fallbackAccent: focusCategory?.color || getAccentForPage(safeData, "home"),
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

  const sessionBadgeLabel = useMemo(() => {
    if (!sessionForDay || !isRuntimeSessionOpen(sessionForDay)) return "";
    const sessionMinutes = Number.isFinite(sessionHabit?.sessionMinutes)
      ? sessionHabit.sessionMinutes
      : null;
    if (sessionMinutes) return `Session en cours · ${sessionMinutes} min`;
    return "Session en cours";
  }, [sessionForDay, sessionHabit]);

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
    (occurrence) => {
      if (!occurrence || typeof setData !== "function") return;
      const goal = occurrence.goalId ? goalsById.get(occurrence.goalId) || null : null;
      const categoryId = goal?.categoryId || null;
      setData((prev) => {
        return applySessionRuntimeTransition(prev, {
          type: "start",
          occurrenceId: occurrence.id,
          dateKey: occurrence.date || selectedDateKey,
          objectiveId: null,
          habitIds: occurrence.goalId ? [occurrence.goalId] : [],
        });
      });
      emitSessionRuntimeNotificationHook("start", {
        occurrenceId: occurrence.id,
        dateKey: occurrence.date || selectedDateKey,
        runtimePhase: "in_progress",
        source: "home_start",
      });
      if (typeof onOpenSession === "function") {
        onOpenSession({ categoryId, dateKey: occurrence.date || selectedDateKey });
      }
    },
    [goalsById, onOpenSession, selectedDateKey, setData]
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
  const accent = focusCategory && focusCategory.color ? focusCategory.color : getAccentForPage(safeData, "home");
  const backgroundImage = profile.whyImage || "";
  const accentVars = getCategoryAccentVars(accent);

  const whyText = (profile.whyText || "").trim();
  const whyDisplay = whyText || "Ajoute ton pourquoi dans l’onboarding.";
  const nowActionTitle = focusOccurrence?.title || "Aucune action planifiée pour cette date.";
  const nowActionMeta = focusOccurrence
    ? [focusOccurrence?.timeLabel, focusOccurrence?.categoryName].filter(Boolean).join(" • ")
    : "Crée ou planifie une action depuis Bibliothèque.";

  const headerRight = sessionBadgeLabel ? (
    <div className="todayHeaderSessionBadge" style={accentVars}>
      <span className="badge badgeAccent">
        {sessionBadgeLabel}
      </span>
    </div>
  ) : null;
  const localHeroModel = useMemo(
    () => ({
      title: nowActionTitle,
      meta: nowActionMeta,
      primaryLabel: canStart ? "Commencer maintenant" : "Aucune action active",
      primaryAction:
        canStart && focusOccurrence
          ? {
              kind: "start_occurrence",
              occurrence: focusOccurrence,
            }
          : null,
      secondaryLabel: "Voir progression",
    }),
    [canStart, focusOccurrence, nowActionMeta, nowActionTitle]
  );
  const heroViewModel = useMemo(
    () =>
      deriveTodayHeroModel({
        localHero: localHeroModel,
        coach: aiNow.state === "success" ? aiNow.coach : null,
        occurrencesForSelectedDay,
        hasOpenSession: isRuntimeSessionOpen(activeSessionForActiveDate),
        handlersAvailable: {
          openLibrary: typeof onOpenLibrary === "function",
          openPilotage: typeof onOpenPilotage === "function",
        },
      }),
    [
      activeSessionForActiveDate,
      aiNow.coach,
      aiNow.state,
      localHeroModel,
      occurrencesForSelectedDay,
      onOpenLibrary,
      onOpenPilotage,
    ]
  );
  const heroChrome = useMemo(
    () =>
      deriveTodayHeroChrome({
        heroSource: heroViewModel.source,
        aiNowState: aiNow.state,
      }),
    [aiNow.state, heroViewModel.source]
  );
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

  return (
    <ScreenShell
      accent={accent}
      backgroundImage={backgroundImage}
      headerTitle={<span data-tour-id="today-title">Aujourd’hui</span>}
      headerSubtitle={<span data-tour-id="today-subtitle">Exécution</span>}
      headerRight={headerRight}
      headerRowAlign="start"
    >
      <div className="stack stackGap12 todayPageShell">
        <GateSection className="todayHeroCard GateSurfacePremium GateCardPremium" collapsible={false}>
          <div className="todayHeroHeader">
            <div className="todayHeroHeaderCluster">
              <div className="todayHeroKicker">À faire maintenant</div>
              {heroChrome.showBadge ? (
                <span
                  className={[
                    "todayHeroCoachBadge",
                    heroChrome.mode === "loading" ? "isLoading" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                >
                  {heroChrome.badgeLabel}
                </span>
              ) : null}
            </div>
            <div className="todayHeroDate">{selectedDateLabel}</div>
          </div>
          <div className="todayHeroBody">
            {heroChrome.showHint ? <div className="todayHeroCoachHint">{heroChrome.hintText}</div> : null}
            <div className="todayHeroTitle">{heroViewModel.title}</div>
            {heroViewModel.meta ? <div className="todayHeroMeta">{heroViewModel.meta}</div> : null}
          </div>
          <div className="todayHeroActions GatePrimaryCtaRow">
            <GateButton
              className="GatePressable todayHeroPrimaryBtn"
              disabled={!heroViewModel.primaryAction}
              onClick={handleHeroPrimaryAction}
            >
              {heroViewModel.primaryLabel}
            </GateButton>
            <GateButton
              variant="ghost"
              className="GatePressable todayHeroSecondaryBtn"
              onClick={() => setShowDayStats(true)}
            >
              {heroViewModel.secondaryLabel}
            </GateButton>
          </div>
        </GateSection>

        <GateSection className="todayProgressCard GateSurfacePremium GateCardPremium" collapsible={false}>
          <div className="todayProgressHeader">
            <div className="todayProgressTitle">Progression du jour</div>
            <div className="todayProgressCaption">Suivi quotidien</div>
          </div>
          <div className="todayProgressMetrics">
            <button
              className="todayProgressMetric GatePressable"
              type="button"
              onClick={() => setShowDayStats(true)}
              data-tour-id="today-stats-day"
            >
              <div className="todayProgressMetricHead">
                <span className="todayProgressMetricLabel">Progression du jour</span>
                <span className="todayProgressMetricValue">{coreProgress.done}/{coreProgress.total || 0}</span>
              </div>
              <div className="todayProgressBarTrack">
                <div
                  className="todayProgressBarFill"
                  style={{ width: `${Math.round(coreProgress.ratio * 100)}%`, background: accent }}
                />
              </div>
            </button>

            <button
              className="todayProgressMetric GatePressable"
              type="button"
              style={accentVars}
              onClick={() => setShowDisciplineStats(true)}
              data-tour-id="today-stats-discipline"
            >
              <div className="todayProgressMetricHead">
                <span className="todayProgressMetricLabel">Discipline</span>
                <span className="todayProgressMetricValue">{disciplineBreakdown.score}%</span>
              </div>
              <div className="todayProgressBarTrack">
                <div
                  className="todayProgressBarFill"
                  style={{ width: `${Math.round(disciplineBreakdown.ratio * 100)}%`, background: accent }}
                />
              </div>
            </button>
          </div>
        </GateSection>

        <div className="row todayWhyRow">
          <div
            className="small2 todayWhyText"
            data-tour-id="today-why-text"
          >
            {showWhy ? whyDisplay : "Pourquoi masqué"}
          </div>
          <button
            className="linkBtn"
            onClick={() => setShowWhy((v) => !v)}
            aria-label="Afficher ou masquer le pourquoi"
            data-tour-id="today-why-toggle"
          >
            {showWhy ? "Masquer 👁" : "Afficher 👁"}
          </button>
        </div>

        <SortableBlocks
          items={blockOrder}
          getId={(id) => id}
          onReorder={handleReorder}
          className="stack stackGap12"
          renderItem={(blockId, drag) => {
            const { attributes, listeners, setActivatorNodeRef } = drag || {};
          if (blockId === "focus") {
            return (
              <FocusCard
                drag={drag}
                setActivatorNodeRef={setActivatorNodeRef}
                listeners={listeners}
                attributes={attributes}
                focusOccurrence={focusOccurrence}
                baseOccurrence={focusBaseOccurrence}
                alternativeCandidates={alternativeCandidates}
                onSelectAlternative={handleSelectFocusAlternative}
                onResetOverride={() => setFocusOverride(null)}
                isOverride={isFocusOverride}
                onStartSession={handleStartSession}
                normalizeOccurrenceForUI={normalizeOccurrenceForUI}
                goalsById={goalsById}
                categoriesById={categoriesById}
                activeOccurrenceId={activeSessionForActiveDate?.occurrenceId || null}
              />
            );
          }

          if (blockId === "micro") {
            return (
              <MicroActionsCard
                drag={drag}
                setActivatorNodeRef={setActivatorNodeRef}
                listeners={listeners}
                attributes={attributes}
                categoryId={microSelectedCategoryId}
                categoryOptions={microCategoryOptions}
                items={microActionsV1.items}
                microDoneToday={microDoneToday}
                rerollsUsed={microRerollsUsed}
                rerollCredits={microRerollCredits}
                rerollLimit={microRerollLimit}
                canWatchAd={microCanWatchAd}
                adLoading={microWatchAdLoading}
                adFeedback={microRewardFeedback}
                isPremiumPlan={isPremiumPlan}
                canValidate={canUseMicroActions}
                isMicroToday={isMicroToday}
                onCategoryChange={handleMicroCategoryChange}
                onDone={handleMicroActionDone}
                onReroll={(indices) => handleMicroReroll(indices, { useCredit: false })}
                onUseRerollCredit={(indices) => handleMicroReroll(indices, { useCredit: true })}
                onWatchAd={handleMicroWatchAd}
                onGoToToday={handleMicroGoToToday}
              />
            );
          }

          if (blockId === "notes") {
            return (
              <HomeCard className="todaySecondaryCard" data-tour-id="today-notes-card">
                <div className="p18">
                  <div className="row todayNotesHeader">
                    <div className="cardSectionTitleRow">
                      {drag ? (
                        <button
                          ref={setActivatorNodeRef}
                          {...listeners}
                          {...attributes}
                          className="dragHandle"
                          aria-label="Réorganiser"
                        >
                          ⋮⋮
                        </button>
                      ) : null}
                      <div className="cardSectionTitle">Note du jour</div>
                    </div>
                    <div className="row todayNotesHeaderActions" style={{ gap: 8 }}>
                      <IconButton
                        aria-label="Historique des notes"
                        onClick={() => {
                          setNoteHistoryVersion((v) => v + 1);
                          setNoteDeleteMode(false);
                          setNoteDeleteTargetId(null);
                          setShowNotesHistory(true);
                        }}
                        data-tour-id="today-notes-history"
                      >
                        +
                      </IconButton>
                    </div>
                  </div>
                  <div className="mt12">
                    <Textarea
                      rows={3}
                      value={dailyNote}
                      onChange={(e) => {
                        setDailyNote(e.target.value);
                      }}
                      className=""
                      placeholder="Écris une remarque, une idée ou un ressenti pour aujourd’hui…"
                      data-tour-id="today-notes-text"
                    />
                  </div>
                  <div className="mt12">
                    <div className="small2 todayNotesKicker">Check-in rapide</div>
                    <div className="noteMetaGrid mt8" data-tour-id="today-notes-meta">
                      <div>
                        <div className="small2 todayNotesLabel">Forme</div>
                        <SelectMenu
                          value={noteMeta.forme || ""}
                          onChange={(next) => updateNoteMeta({ forme: next })}
                          style={undefined}
                          className=""
                          placeholder="Choisir"
                          options={[
                            { value: "Excellente", label: "Excellente" },
                            { value: "Bonne", label: "Bonne" },
                            { value: "Moyenne", label: "Moyenne" },
                            { value: "Faible", label: "Faible" },
                          ]}
                        />
                      </div>
                      <div>
                        <div className="small2 todayNotesLabel">Humeur</div>
                        <SelectMenu
                          value={noteMeta.humeur || ""}
                          onChange={(next) => updateNoteMeta({ humeur: next })}
                          style={undefined}
                          className=""
                          placeholder="Choisir"
                          options={[
                            { value: "Positif", label: "Positif" },
                            { value: "Neutre", label: "Neutre" },
                            { value: "Basse", label: "Basse" },
                          ]}
                        />
                      </div>
                      <div>
                        <div className="small2 todayNotesLabel">Énergie</div>
                        <input
                          className="GateInputPremium"
                          type="number"
                          min="0"
                          max="10"
                          step="1"
                          value={noteMeta.motivation || ""}
                          onChange={(e) => updateNoteMeta({ motivation: e.target.value })}
                          placeholder="0-10"
                          style={undefined}
                        />
                      </div>
                    </div>
                  </div>
                  <div className="noteActions mt12 todayNotesFooter">
                    <Button onClick={addNoteToHistory} data-tour-id="today-notes-add">
                      {UI_COPY.save}
                    </Button>
                  </div>
                </div>
              </HomeCard>
            );
          }
          if (blockId === "calendar") {
            return (
              <CalendarCard
                drag={drag}
                setActivatorNodeRef={setActivatorNodeRef}
                listeners={listeners}
                attributes={attributes}
                selectedDateKey={selectedDateKey}
                selectedDateLabel={selectedDateLabel}
                localTodayKey={localTodayKey}
                calendarView={calendarView}
                onSetCalendarView={setCalendarView}
                calendarPaneKey={calendarPaneKey}
                calendarPanePhase={calendarPanePhase}
                plannedByDate={plannedByDate}
                doneByDate={doneByDate}
                accentByDate={accentByDate}
                selectedAccent={selectedDateAccent}
                accent={accent}
                getDayDots={getDayDots}
                onDayOpen={handleDayOpen}
                onCommitDateKey={commitDateKey}
                monthCursor={monthCursor}
                onPrevMonth={() => setMonthCursor((d) => addMonths(d, -1))}
                onNextMonth={() => setMonthCursor((d) => addMonths(d, 1))}
                monthGrid={monthGrid}
                selectedDayAccent={selectedDateAccent}
                onAddOccurrence={typeof onAddOccurrence === "function" ? handleAddOccurrence : null}
                addActionContext={addActionContext}
              />
            );
          }
          return null;
          }}
        />
      </div>
      {showDayStats ? (
        <div className="modalBackdrop disciplineOverlay" onClick={() => setShowDayStats(false)}>
          <HomeCard className="disciplineCard" onClick={(e) => e.stopPropagation()}>
            <div className="row" style={{ alignItems: "center", justifyContent: "space-between" }}>
              <div className="titleSm">Progression du jour</div>
              <button className="linkBtn" type="button" onClick={() => setShowDayStats(false)}>
                {UI_COPY.close}
              </button>
            </div>
            <div className="mt12 col" style={{ gap: 10 }}>
              <div className="row" style={{ justifyContent: "space-between" }}>
                <div className="small2">Date</div>
                <div className="titleSm">{selectedDateKey}</div>
              </div>
              <div className="row" style={{ justifyContent: "space-between" }}>
                <div className="small2">Actions du jour</div>
                <div className="titleSm">Tu as validé {habitsDoneCount} sur {activeHabits.length}</div>
              </div>
              <div className="row" style={{ justifyContent: "space-between" }}>
                <div className="small2">Total</div>
                <div className="titleSm">{coreProgress.done}/{coreProgress.total || 0}</div>
              </div>
            </div>
          </HomeCard>
        </div>
      ) : null}

      {showDisciplineStats ? (
        <div className="modalBackdrop disciplineOverlay" onClick={() => setShowDisciplineStats(false)}>
          <HomeCard className="disciplineCard" onClick={(e) => e.stopPropagation()}>
            <div className="row" style={{ alignItems: "center", justifyContent: "space-between" }}>
              <div className="titleSm">Discipline</div>
              <button className="linkBtn" type="button" onClick={() => setShowDisciplineStats(false)}>
                {UI_COPY.close}
              </button>
            </div>
            <div className="mt12 col" style={{ gap: 10 }}>
              <div className="row" style={{ justifyContent: "space-between" }}>
                <div className="small2">Assiduité (14j)</div>
                <div className="titleSm">{disciplineBreakdown.habitDaysKept14} jours tenus</div>
              </div>
              <div className="row" style={{ justifyContent: "space-between" }}>
                <div className="small2">Micro-actions (14j)</div>
                <div className="titleSm">{disciplineBreakdown.microDone14}/{disciplineBreakdown.microMax14}</div>
              </div>
              <div className="row" style={{ justifyContent: "space-between" }}>
                <div className="small2">Fiabilité (90j)</div>
                <div className="titleSm">{Math.round(disciplineBreakdown.reliabilityRatio * 100)}%</div>
              </div>
              <div className="row" style={{ justifyContent: "space-between" }}>
                <div className="small2">Score</div>
                <div className="titleSm">{disciplineBreakdown.score}%</div>
              </div>
            </div>
          </HomeCard>
        </div>
      ) : null}
      {showNotesHistory ? (
        <div
          className="modalBackdrop disciplineOverlay noteHistoryBackdrop"
          onClick={() => {
            setShowNotesHistory(false);
            setNoteDeleteMode(false);
            setNoteDeleteTargetId(null);
          }}
        >
          <HomeCard className="noteHistorySheet" onClick={(e) => e.stopPropagation()}>
            <div className="row" style={{ alignItems: "center", justifyContent: "space-between" }}>
              <div className="titleSm">Historique des notes</div>
              <div className="row" style={{ gap: 8 }}>
                <IconButton
                  aria-label="Mode suppression"
                  title="Mode suppression"
                  onClick={() => {
                    setNoteDeleteMode((v) => !v);
                    setNoteDeleteTargetId(null);
                  }}
                  aria-pressed={noteDeleteMode}
                >
                  🗑
                </IconButton>
                {noteDeleteMode ? (
                  <Button variant="danger" onClick={deleteSelectedNote} disabled={!noteDeleteTargetId}>
                    Supprimer
                  </Button>
                ) : null}
                {!isPremiumPlan && hasHistoryBeyondLimit ? (
                  <Button
                    variant="ghost"
                    onClick={() => (typeof onOpenPaywall === "function" ? onOpenPaywall("Historique complet") : null)}
                  >
                    Débloquer tout
                  </Button>
                ) : null}
                <button
                  className="linkBtn"
                  type="button"
                  onClick={() => {
                    setShowNotesHistory(false);
                    setNoteDeleteMode(false);
                    setNoteDeleteTargetId(null);
                  }}
                >
                  {UI_COPY.close}
                </button>
              </div>
            </div>
            <div className="noteHistoryBody col" style={{ gap: 10 }}>
              {noteHistoryItems.length ? (
                noteHistoryItems.map((item) => {
                  const meta = item.meta || {};
                  const metaParts = [];
                  if (meta.forme) metaParts.push(`Forme: ${meta.forme}`);
                  if (meta.humeur) metaParts.push(`Humeur: ${meta.humeur}`);
                  if (meta.motivation) metaParts.push(`Énergie: ${meta.motivation}/10`);
                  const isSelected = noteDeleteMode && noteDeleteTargetId === item.id;
                  if (isSelected) {
                    return (
                      <GateRow
                        key={item.id || item.dateKey}
                        className="listItem GateRowPremium GatePressable"
                        selected
                        onClick={
                          noteDeleteMode
                            ? () => setNoteDeleteTargetId((prev) => (prev === item.id ? null : item.id))
                            : undefined
                        }
                      >
                        <div className="small2">{item.dateKey}</div>
                        {metaParts.length ? <div className="small2 mt8">{metaParts.join(" · ")}</div> : null}
                        {item.note ? <div className="small2 mt8">{item.note}</div> : null}
                      </GateRow>
                    );
                  }

                  return (
                    <GateRow
                      key={item.id || item.dateKey}
                      className={`listItem GateRowPremium${noteDeleteMode ? " GatePressable" : ""}`}
                      onClick={noteDeleteMode ? () => setNoteDeleteTargetId((prev) => (prev === item.id ? null : item.id)) : undefined}
                    >
                      <div className="small2">{item.dateKey}</div>
                      {metaParts.length ? <div className="small2 mt8">{metaParts.join(" · ")}</div> : null}
                      {item.note ? <div className="small2 mt8">{item.note}</div> : null}
                    </GateRow>
                  );
                })
              ) : (
                <div className="small2">Aucune note enregistrée.</div>
              )}
            </div>
          </HomeCard>
        </div>
      ) : null}
      <RewardedAdModal
        open={rewardedAdRequest.open}
        placement={rewardedAdRequest.placement}
        onDismiss={handleRewardedAdDismiss}
        onComplete={handleRewardedAdComplete}
      />
    </ScreenShell>
  );
}

// Manual tests:
// - Fresh load (no interaction): rail + grid highlight today and month aligns.
// - Refresh (same tab, no interaction): rail + grid highlight today and month aligns.
// - Scroll rail (auto): selection updates without touching sessionStorage.
// - Click a day or ⟳: selection updates and persists; month follows.
