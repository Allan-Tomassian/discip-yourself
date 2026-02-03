import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import SortableBlocks from "../components/SortableBlocks";
import ScreenShell from "./_ScreenShell";
import { Button, Card, IconButton, SelectMenu, Textarea } from "../components/UI";
import AccentItem from "../components/AccentItem";
import {
  addDays,
  addMonths,
  buildMonthGrid,
  startOfMonth,
} from "../utils/dates";
import { fromLocalDateKey, normalizeLocalDateKey, toLocalDateKey, todayLocalKey } from "../utils/dateKey";
import { setMainGoal } from "../logic/goals";
import { ensureWindowFromScheduleRules } from "../logic/occurrencePlanner";
import { normalizeActiveSessionForUI, normalizeOccurrenceForUI } from "../logic/compat";
import { getAccentForPage } from "../utils/_theme";
import { getCategoryAccentVars } from "../utils/categoryAccent";
import { isPrimaryCategory, isPrimaryGoal } from "../logic/priority";
import { getDefaultBlockIds } from "../logic/blocks/registry";
import { resolveCurrentPlannedOccurrence, resolveNextPlannedOccurrence } from "../ui/session/sessionPlanner";
import { resolveGoalType } from "../domain/goalType";
import { linkProcessToOutcome, splitProcessByLink } from "../logic/linking";
import { computeDisciplineScore } from "../logic/pilotage";
import { uid } from "../utils/helpers";
import CalendarCard from "../ui/calendar/CalendarCard";
import FocusCard from "../ui/focus/FocusCard";

// TOUR MAP:
// - primary_action: start session (GO) for today
// - key_elements: focus section, calendar, micro-actions, daily note
// - optional_elements: day stats/discipline stats modals
// ---- Priority helpers
function normalizePriorityValue(v) {
  const raw = typeof v === "string" ? v.toLowerCase() : "";
  if (raw === "prioritaire" || raw === "primary") return "prioritaire";
  if (raw === "secondaire" || raw === "secondary") return "secondaire";
  if (raw === "bonus") return "bonus";
  return "";
}

function priorityRank(v) {
  const p = normalizePriorityValue(v);
  if (p === "prioritaire") return 0;
  if (p === "secondaire") return 1;
  if (p === "bonus") return 2;
  return 3;
}

function safeString(v) {
  return typeof v === "string" ? v : "";
}

// ---- Micro-actions
const MICRO_ACTIONS = [
  { id: "micro_flexions", label: "Faire 10 flexions" },
  { id: "micro_mot", label: "Apprendre un mot" },
  { id: "micro_respiration", label: "10 respirations" },
  { id: "micro_eau", label: "Boire un verre d’eau" },
  { id: "micro_rangement", label: "Ranger 2 minutes" },
  { id: "micro_etirements", label: "Étirements rapides" },
];
const DEFAULT_BLOCK_ORDER = getDefaultBlockIds("home");

function initMicroState(dayKeyValue) {
  const key = dayKeyValue || toLocalDateKey(new Date());
  return {
    dayKey: key,
    cursor: Math.min(3, MICRO_ACTIONS.length),
    items: MICRO_ACTIONS.slice(0, 3).map((item, idx) => ({
      uid: `${item.id}-${key}-${idx}`,
      id: item.id,
      label: item.label,
    })),
  };
}

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
  const canEdit = selectedStatus !== "past";
  const lockMessage = selectedStatus === "past" ? "Lecture seule" : "Disponible le jour J";
  const historyLimitDays = !isPremiumPlan ? Number(planLimits?.historyDays) || 0 : 0;
  const historyMaxAge = historyLimitDays > 0 ? historyLimitDays - 1 : null;

  // State
  const [showWhy, setShowWhy] = useState(true);
  const [microState, setMicroState] = useState(() => initMicroState(selectedDateKey));
  const [showDayStats, setShowDayStats] = useState(false);
  const [showDisciplineStats, setShowDisciplineStats] = useState(false);
  const [calendarView, setCalendarView] = useState("day");
  const [calendarPanePhase, setCalendarPanePhase] = useState("enterActive");
  const [calendarPaneKey, setCalendarPaneKey] = useState(0);
  const [microOpen, setMicroOpen] = useState(false);
  const [dailyNote, setDailyNote] = useState("");
  const [noteMeta, setNoteMeta] = useState({ forme: "", humeur: "", motivation: "" });
  const [showNotesHistory, setShowNotesHistory] = useState(false);
  const [noteDeleteMode, setNoteDeleteMode] = useState(false);
  const [noteDeleteTargetId, setNoteDeleteTargetId] = useState(null);
  const [noteHistoryVersion, setNoteHistoryVersion] = useState(0);
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

  // Data slices
  const profile = safeData.profile || {};
  const categories = useMemo(
    () => (Array.isArray(safeData.categories) ? safeData.categories : []),
    [safeData.categories]
  );
  const goals = useMemo(() => (Array.isArray(safeData.goals) ? safeData.goals : []), [safeData.goals]);
  // per-view category selection for Home (fallback to legacy)
  const homeSelectedCategoryId =
    safeData.ui?.selectedCategoryByView?.home || safeData.ui?.selectedCategoryId || null;
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
  const microChecks = useMemo(
    () => (safeData.microChecks && typeof safeData.microChecks === "object" ? safeData.microChecks : {}),
    [safeData.microChecks]
  );
  const dayMicro = useMemo(() => {
    return microChecks?.[selectedDateKey] && typeof microChecks[selectedDateKey] === "object"
      ? microChecks[selectedDateKey]
      : {};
  }, [microChecks, selectedDateKey]);
  const plannedByDate = useMemo(() => {
    const map = new Map();
    for (const occ of occurrences) {
      if (!occ || typeof occ.date !== "string") continue;
      if (!goalIdSet.has(occ.goalId)) continue;
      if (occ.status !== "planned") continue;
      map.set(occ.date, (map.get(occ.date) || 0) + 1);
    }
    return map;
  }, [goalIdSet, occurrences]);
  const doneByDate = useMemo(() => {
    const map = new Map();
    for (const occ of occurrences) {
      if (!occ || occ.status !== "done") continue;
      const key = typeof occ.date === "string" ? occ.date : "";
      const id = typeof occ.goalId === "string" ? occ.goalId : "";
      if (!key || !id || !goalIdSet.has(id)) continue;
      const set = map.get(key) || new Set();
      set.add(id);
      map.set(key, set);
    }
    const counts = new Map();
    for (const [key, set] of map.entries()) counts.set(key, set.size);
    return counts;
  }, [goalIdSet, occurrences]);

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

  // Derived data
  const focusCategory = useMemo(() => {
    if (!categories.length) return null;
    const selected = categories.find((c) => c.id === homeSelectedCategoryId) || null;
    if (selected) return selected;
    const primary = categories.find((c) => isPrimaryCategory(c)) || null;
    if (primary) return primary;
    const withGoal = categories.find((c) =>
      goals.some((g) => g.categoryId === c.id && resolveGoalType(g) === "OUTCOME")
    );
    return withGoal || categories[0] || null;
  }, [categories, goals, homeSelectedCategoryId]);

  const mainGoalId = typeof focusCategory?.mainGoalId === "string" ? focusCategory.mainGoalId : null;

  const outcomeGoals = useMemo(() => {
    if (!focusCategory?.id) return [];
    return goals.filter((g) => g.categoryId === focusCategory.id && resolveGoalType(g) === "OUTCOME");
  }, [goals, focusCategory?.id]);

  const selectedGoal = useMemo(() => {
    if (!focusCategory?.id || !outcomeGoals.length) return null;
    if (mainGoalId) {
      const main = outcomeGoals.find((g) => g.id === mainGoalId) || null;
      if (main) return main;
    }
    const primary = outcomeGoals.find((g) => isPrimaryGoal(g)) || null;
    return primary || outcomeGoals[0] || null;
  }, [focusCategory?.id, mainGoalId, outcomeGoals]);

  const rawActiveSession =
    safeData.ui && typeof safeData.ui.activeSession === "object" ? safeData.ui.activeSession : null;
  const activeSession = useMemo(
    () => normalizeActiveSessionForUI(rawActiveSession),
    [rawActiveSession]
  );
  const sessionForDay = useMemo(() => {
    if (!activeSession) return null;
    const key = activeSession.dateKey || activeSession.date;
    if (key !== selectedDateKey) return null;
    if (selectedGoal?.id && activeSession.objectiveId && activeSession.objectiveId !== selectedGoal.id) {
      return null;
    }
    return activeSession;
  }, [activeSession, selectedDateKey, selectedGoal?.id]);
  const sessionHabit = useMemo(() => {
    if (!sessionForDay?.habitIds?.length) return null;
    const firstId = sessionForDay.habitIds[0];
    return firstId ? goals.find((g) => g.id === firstId) || null : null;
  }, [sessionForDay?.habitIds, goals]);
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

  const processGoals = useMemo(() => {
    if (!focusCategory?.id) return [];
    const list = goals.filter((g) => g && g.categoryId === focusCategory.id && resolveGoalType(g) === "PROCESS");
    // Stable order: keep explicit order if present, otherwise title.
    return list.slice().sort((a, b) => {
      const ao = Number.isFinite(a?.order) ? a.order : 0;
      const bo = Number.isFinite(b?.order) ? b.order : 0;
      if (ao !== bo) return ao - bo;
      return String(a?.title || "").localeCompare(String(b?.title || ""));
    });
  }, [goals, focusCategory?.id]);

  // Actions liées à l’objectif sélectionné (robuste)
  const { linked: linkedHabits, unlinked: unlinkedHabits } = useMemo(() => {
    if (!selectedGoal?.id) return { linked: [], unlinked: [] };
    return splitProcessByLink(processGoals, selectedGoal.id);
  }, [processGoals, selectedGoal?.id]);

  // Actions liées à l’objectif (toutes)
  const selectableHabits = linkedHabits;
  const hasSelectableHabits = selectableHabits.length > 0;
  const focusPlannedGoalIds = useMemo(() => {
    const source = linkedHabits.length ? linkedHabits : processGoals;
    const ids = new Set();
    for (const g of source) {
      if (g && g.id) ids.add(g.id);
    }
    return ids;
  }, [linkedHabits, processGoals]);
  const plannedFocusOccurrences = useMemo(() => {
    if (!focusPlannedGoalIds.size) return [];
    return occurrences.filter((occ) => occ && occ.status === "planned" && focusPlannedGoalIds.has(occ.goalId));
  }, [occurrences, focusPlannedGoalIds]);
  const currentPlannedOccurrence = useMemo(
    () => resolveCurrentPlannedOccurrence(plannedFocusOccurrences),
    [plannedFocusOccurrences]
  );
  const nextPlannedOccurrence = useMemo(
    () => resolveNextPlannedOccurrence(plannedFocusOccurrences),
    [plannedFocusOccurrences]
  );
  const ensureProcessIds = useMemo(() => {
    const base = selectedGoal?.id ? linkedHabits : processGoals;
    return base.map((g) => g.id).filter(Boolean);
  }, [linkedHabits, processGoals, selectedGoal?.id]);

  // Actions actives uniquement (progression)
  const activeHabits = useMemo(() => linkedHabits.filter((g) => safeString(g.status) === "active"), [linkedHabits]);
  const canManageCategory = Boolean(typeof onOpenManageCategory === "function" && focusCategory?.id);

  // ---- Outcome goal lookup helpers and dominant outcome by date
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
    const list = occurrences.filter((o) => o && o.date === selectedDateKey);
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

  const occurrencesCountByDateKey = useMemo(() => {
    const map = new Map();
    for (const occ of occurrences) {
      if (!occ || typeof occ.date !== "string") continue;
      if (!goalsById.has(occ.goalId)) continue;
      map.set(occ.date, (map.get(occ.date) || 0) + 1);
    }
    return map;
  }, [goalsById, occurrences]);


  // Calendar dots (multi-catégories) — used in day rail + month grid
  const categoryDotsByDate = useMemo(() => {
    const map = new Map(); // dateKey -> Map(categoryId -> { categoryId, color })

    for (const occ of occurrences) {
      if (!occ || typeof occ.date !== "string") continue;
      if (occ.status !== "planned") continue;

      const g = goalsById.get(occ.goalId);
      if (!g) continue;

      const catId = typeof g.categoryId === "string" ? g.categoryId : "";
      if (!catId) continue;

      const c = categoriesById.get(catId);
      const color = (c && c.color) || (g && g.color) || "";
      if (!color) continue;

      const dayMap = map.get(occ.date) || new Map();
      if (!dayMap.has(catId)) dayMap.set(catId, { categoryId: catId, color });
      map.set(occ.date, dayMap);
    }

    const out = new Map();
    for (const [dateKey, dayMap] of map.entries()) {
      out.set(dateKey, Array.from(dayMap.values()));
    }
    return out;
  }, [occurrences, goalsById, categoriesById]);

  const getDayDots = useCallback(
    (dateKey, max = 3) => {
      const list = categoryDotsByDate.get(dateKey) || [];
      const dots = list.slice(0, max);
      const extra = Math.max(0, list.length - max);
      return { dots, extra };
    },
    [categoryDotsByDate]
  );


  const outcomeById = useMemo(() => {
    const map = new Map();
    for (const g of goals) {
      if (!g || !g.id) continue;
      if (resolveGoalType(g) === "OUTCOME") map.set(g.id, g);
    }
    return map;
  }, [goals]);

  const getOutcomeForGoalId = useCallback(
    (goalId) => {
      const g = goalId ? goalsById.get(goalId) : null;
      if (!g) return null;
      const t = resolveGoalType(g);
      if (t === "OUTCOME") return g;
      const parentId = typeof g.parentId === "string" ? g.parentId : null;
      const primaryId = typeof g.primaryGoalId === "string" ? g.primaryGoalId : null;
      const linkId = parentId || primaryId;
      return linkId ? outcomeById.get(linkId) || null : null;
    },
    [goalsById, outcomeById]
  );

  const dominantOutcomeIdByDate = useMemo(() => {
    const map = new Map();

    // Helper: pick best outcome id from candidates
    const pickBest = (ids) => {
      const unique = Array.from(new Set(ids.filter(Boolean)));
      unique.sort((a, b) => {
        const ga = goalsById.get(a);
        const gb = goalsById.get(b);
        const ra = priorityRank(ga?.priority);
        const rb = priorityRank(gb?.priority);
        if (ra !== rb) return ra - rb;
        // fallback: stable by title
        return String(ga?.title || "").localeCompare(String(gb?.title || ""));
      });
      return unique[0] || null;
    };

    // Occurrences planned: map PROCESS -> parent OUTCOME
    for (const occ of occurrences) {
      if (!occ || typeof occ.date !== "string") continue;
      if (occ.status !== "planned") continue;
      const out = getOutcomeForGoalId(occ.goalId);
      if (!out?.id) continue;
      const key = occ.date;
      const prev = map.get(key);
      if (!prev) {
        map.set(key, out.id);
      } else if (prev !== out.id) {
        map.set(key, pickBest([prev, out.id]));
      }
    }

    return map;
  }, [occurrences, goalsById, getOutcomeForGoalId]);

  const goalAccentByDate = useMemo(() => {
    const map = new Map();
    for (const [key, outId] of dominantOutcomeIdByDate.entries()) {
      const g = outId ? goalsById.get(outId) : null;
      const c = g?.categoryId ? categories.find((x) => x.id === g.categoryId) : null;
      const color = (g && g.color) || (c && c.color) || "";
      if (color) map.set(key, color);
    }
    return map;
  }, [dominantOutcomeIdByDate, goalsById, categories]);

  const microItems = useMemo(() => {
    return microState.items;
  }, [microState.items]);

  const microDoneToday = useMemo(() => {
    const count = Object.keys(dayMicro || {}).length;
    return Math.min(3, count);
  }, [dayMicro]);


  const coreProgress = useMemo(() => {
    const activeIds = new Set(activeHabits.map((h) => h.id));
    const doneHabitsCount = Array.from(activeIds).reduce(
      (sum, id) => sum + (doneHabitIds.has(id) ? 1 : 0),
      0
    );
    const hasMainGoal = Boolean(selectedGoal);
    const goalDone = Boolean(selectedGoal && selectedGoal.status === "done");
    const total = activeHabits.length + (hasMainGoal ? 1 : 0);
    const done = doneHabitsCount + (goalDone ? 1 : 0);
    const ratio = total ? done / total : 0;
    return { total, done, ratio };
  }, [activeHabits, doneHabitIds, selectedGoal]);
  const goalDone = Boolean(selectedGoal && selectedGoal.status === "done");
  const habitsDoneCount = Math.max(0, coreProgress.done - (goalDone ? 1 : 0));

  const disciplineBreakdown = useMemo(() => {
    const now = new Date();
    const disciplineBase = computeDisciplineScore(occurrences, localTodayKey);

    // UX: start discipline at 100% for brand-new users (no history yet).
    const hasAnyOccurrences = occurrences.some((o) => o && typeof o.status === "string");
    const hasAnyMicro = Object.keys(microChecks).length > 0;
    const hasAnyDoneOutcome = goals.some((g) => resolveGoalType(g) === "OUTCOME" && g.status === "done");
    const hasAnyHistory = hasAnyOccurrences || hasAnyMicro || hasAnyDoneOutcome;

    if (!hasAnyHistory) {
      const outcomesTotal = goals.filter((g) => resolveGoalType(g) === "OUTCOME").length;
      return {
        score: disciplineBase.score,
        ratio: disciplineBase.ratio,
        habit14: { done: 0, planned: 0, ratio: 1, keptDays: 0 },
        habit90: { done: 0, planned: 0, ratio: 1, keptDays: 0 },
        microDone14: 0,
        microMax14: 0,
        microRatio14: 1,
        outcomesDone90: 0,
        outcomesTotal,
        reliabilityRatio: 1,
        habitDaysKept14: 0,
      };
    }
    const processAll = goals.filter((g) => resolveGoalType(g) === "PROCESS" && g.status === "active");
    const processIds = processAll.map((g) => g.id);
    const plannedPerDay = processIds.length;

    function getDoneIdsForDate(key) {
      const ids = new Set();
      for (const occ of occurrences) {
        if (!occ || occ.status !== "done") continue;
        if (occ.date !== key) continue;
        if (processIds.includes(occ.goalId)) ids.add(occ.goalId);
      }
      return ids;
    }

    function countDoneForWindow(days) {
      let done = 0;
      let keptDays = 0;
      for (let i = 0; i < days; i += 1) {
        const key = toLocalDateKey(addDays(now, -i));
        const doneIds = getDoneIdsForDate(key);
        let kept = true;
        for (const id of processIds) if (doneIds.has(id)) done += 1;
        if (processIds.length) {
          for (const id of processIds) {
            if (!doneIds.has(id)) {
              kept = false;
              break;
            }
          }
          if (kept) keptDays += 1;
        }
      }
      const planned = plannedPerDay * days;
      return { done, planned, ratio: planned ? done / planned : 0, keptDays };
    }

    const habit14 = countDoneForWindow(14);
    const habit90 = countDoneForWindow(90);

    let microDone14 = 0;
    for (let i = 0; i < 14; i += 1) {
      const key = toLocalDateKey(addDays(now, -i));
      const micro = microChecks?.[key] && typeof microChecks[key] === "object" ? microChecks[key] : {};
      const count = Object.keys(micro || {}).length;
      microDone14 += Math.min(3, count);
    }
    const microMax14 = 14 * 3;
    const microRatio14 = microMax14 ? microDone14 / microMax14 : 0;

    const outcomes = goals.filter((g) => resolveGoalType(g) === "OUTCOME");
    const cutoff = addDays(now, -89).getTime();
    const outcomesDone90 = outcomes.filter((g) => {
      if (g.status !== "done") return false;
      const key = typeof g.completedAt === "string" ? g.completedAt : "";
      if (!key) return false;
      const ts = new Date(`${key}T12:00:00`).getTime();
      return Number.isFinite(ts) && ts >= cutoff;
    }).length;
    const outcomeRatio90 = outcomes.length ? outcomesDone90 / outcomes.length : 0;
    const reliabilityRatio = outcomes.length ? (habit90.ratio + outcomeRatio90) / 2 : habit90.ratio;

    const score = disciplineBase.score;
    const ratio = disciplineBase.ratio;

    return {
      score,
      ratio,
      habit14,
      habit90,
      microDone14,
      microMax14,
      microRatio14,
      outcomesDone90,
      outcomesTotal: outcomes.length,
      reliabilityRatio,
      habitDaysKept14: habit14.keptDays,
    };
  }, [goals, microChecks, occurrences, localTodayKey]);

  const sessionBadgeLabel = useMemo(() => {
    if (!sessionForDay || sessionForDay?.status !== "partial") return "";
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
    if (microState.dayKey === selectedDateKey) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMicroState(initMicroState(selectedDateKey));
  }, [microState.dayKey, selectedDateKey]);
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
    (nextKey, goalId) => {
      if (!nextKey) return;
      if (typeof onAddOccurrence === "function") {
        onAddOccurrence(nextKey, goalId || null);
      }
    },
    [onAddOccurrence]
  );
  const handleStartSession = useCallback(
    (occurrence) => {
      if (!occurrence || typeof setData !== "function") return;
      const goal = occurrence.goalId ? goalsById.get(occurrence.goalId) || null : null;
      const objective = occurrence.goalId ? getOutcomeForGoalId(occurrence.goalId) : null;
      const categoryId = goal?.categoryId || focusCategory?.id || null;
      setData((prev) => {
        const prevUi = prev?.ui && typeof prev.ui === "object" ? prev.ui : {};
        const current = prevUi.activeSession && typeof prevUi.activeSession === "object" ? prevUi.activeSession : null;
        const nextSession = {
          id: current?.occurrenceId === occurrence.id && current?.id ? current.id : uid(),
          occurrenceId: occurrence.id,
          dateKey: occurrence.date || selectedDateKey,
          objectiveId: objective?.id || null,
          habitIds: occurrence.goalId ? [occurrence.goalId] : [],
          status: "partial",
          timerStartedAt: "",
          timerAccumulatedSec: 0,
          timerRunning: false,
          doneHabitIds: [],
        };
        if (
          current &&
          current.occurrenceId === nextSession.occurrenceId &&
          current.dateKey === nextSession.dateKey &&
          current.objectiveId === nextSession.objectiveId &&
          Array.isArray(current.habitIds) &&
          current.habitIds.length === nextSession.habitIds.length &&
          current.habitIds.every((id, idx) => id === nextSession.habitIds[idx]) &&
          current.status === nextSession.status
        ) {
          return prev;
        }
        return {
          ...prev,
          ui: {
            ...prevUi,
            activeSession: nextSession,
          },
        };
      });
      if (typeof onOpenSession === "function") {
        onOpenSession({ categoryId, dateKey: occurrence.date || selectedDateKey });
      }
    },
    [focusCategory?.id, getOutcomeForGoalId, goalsById, onOpenSession, selectedDateKey, setData]
  );
  const handlePrepareSession = useCallback(() => {
    if (typeof onOpenSession === "function") {
      onOpenSession({ categoryId: focusCategory?.id || null, dateKey: selectedDateKey });
    }
  }, [focusCategory?.id, onOpenSession, selectedDateKey]);

  const lastEnsureSigRef = useRef("");
  const ensureDebugCountRef = useRef(0);
  useEffect(() => {
    if (!selectedDateKey || typeof setData !== "function") return;

    // Make signature stable even if ensureProcessIds order changes between renders.
    const sortedIds = Array.isArray(ensureProcessIds)
      ? ensureProcessIds.filter(Boolean).slice().sort()
      : [];
    if (!sortedIds.length) return;

    const sig = `${selectedDateKey}:${sortedIds.join(",")}`;
    if (lastEnsureSigRef.current === sig) return;
    lastEnsureSigRef.current = sig;

    setData((prev) => {
      const baseDate = fromLocalDateKey(selectedDateKey);
      const fromKey = baseDate ? toLocalDateKey(addDays(baseDate, -1)) : selectedDateKey;
      const toKey = baseDate ? toLocalDateKey(addDays(baseDate, 1)) : selectedDateKey;
      const next = ensureWindowFromScheduleRules(prev, fromKey, toKey, sortedIds);
      if (import.meta.env?.DEV && next !== prev) {
        ensureDebugCountRef.current += 1;
        // eslint-disable-next-line no-console
        console.debug("[home] ensureWindowFromScheduleRules", { sig, count: ensureDebugCountRef.current });
      }
      return next;
    });
  }, [ensureProcessIds, selectedDateKey, setData]);

  const toggleActionSelection = useCallback(
    (habitId) => {
      if (!selectedGoal?.id || typeof setData !== "function" || !canEdit) return;
      setData((prev) => {
        const prevUi = prev.ui || {};
        const prevSelected = prevUi.selectedHabits || {};
        const current = Array.isArray(prevSelected[selectedGoal.id])
          ? prevSelected[selectedGoal.id]
          : selectableHabits.map((h) => h.id);
        const next = current.includes(habitId)
          ? current.filter((id) => id !== habitId)
          : [...current, habitId];
        return {
          ...prev,
          ui: {
            ...prevUi,
            selectedHabits: {
              ...prevSelected,
              [selectedGoal.id]: next,
            },
          },
        };
      });
    },
    [selectedGoal?.id, setData, selectableHabits, canEdit]
  );

  function setCategoryMainGoal(nextGoalId) {
    if (!nextGoalId || typeof setData !== "function") return;
    const g = goals.find((x) => x.id === nextGoalId) || null;
    if (!g || !focusCategory?.id || g.categoryId !== focusCategory.id) return;
    setData((prev) => setMainGoal(prev, nextGoalId));
  }


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

  function addMicroCheck(microId) {
    if (!microId || typeof setData !== "function") return;
    if (!canValidate) return;
    // Max 3 micro-actions/day and avoid duplicates
    const already = Boolean(dayMicro?.[microId]);
    if (already) return;
    if (microDoneToday >= 3) return;
    setData((prev) => {
      const prevMicro = prev?.microChecks && typeof prev.microChecks === "object" ? prev.microChecks : {};
      const prevDay = prevMicro?.[selectedDateKey] && typeof prevMicro[selectedDateKey] === "object"
        ? prevMicro[selectedDateKey]
        : {};
      return {
        ...prev,
        microChecks: {
          ...prevMicro,
          [selectedDateKey]: { ...prevDay, [microId]: true },
        },
      };
    });
  }


  // Render
  const accent = focusCategory && focusCategory.color ? focusCategory.color : getAccentForPage(safeData, "home");
  const goalAccent = selectedGoal?.color || accent;
  const selectedDayAccent = goalAccentByDate.get(selectedDateKey) || goalAccent || accent;
  const backgroundImage = profile.whyImage || "";
  const accentVars = getCategoryAccentVars(accent);

  const whyText = (profile.whyText || "").trim();
  const whyDisplay = whyText || "Ajoute ton pourquoi dans l’onboarding.";

  const headerRight = categories.length ? (
    <div style={{ minWidth: 180 }}>
      <button
        className="statButton"
        type="button"
        onClick={() => setShowDayStats(true)}
        data-tour-id="today-stats-day"
      >
        <div className="small2" style={{ textAlign: "right" }}>
          Progression du jour
        </div>
        <div className="row" style={{ alignItems: "center", gap: 8, marginTop: 4 }}>
          <div
            style={{
              flex: 1,
              height: 6,
              background: "rgba(255,255,255,.12)",
              borderRadius: 999,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                width: `${Math.round(coreProgress.ratio * 100)}%`,
                height: "100%",
                background: goalAccent,
                borderRadius: 999,
              }}
            />
          </div>
          <div className="small2" style={{ minWidth: 36, textAlign: "right" }}>
            {coreProgress.done}/{coreProgress.total || 0}
          </div>
        </div>
      </button>

      <button
        className="statButton mt10"
        type="button"
        style={accentVars}
        onClick={() => setShowDisciplineStats(true)}
        data-tour-id="today-stats-discipline"
      >
        <div className="small2 textRight">
          Discipline
        </div>
        <div className="row alignCenter gap8 mt4">
          <div
            style={{
              flex: 1,
              height: 6,
              background: "rgba(255,255,255,.12)",
              borderRadius: 999,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                width: `${Math.round(disciplineBreakdown.ratio * 100)}%`,
                height: "100%",
                background: accent,
                borderRadius: 999,
              }}
            />
          </div>
          <div className="small2 textRight minW36">
            {disciplineBreakdown.score}%
          </div>
        </div>
      </button>

      {sessionBadgeLabel ? (
        <div className="mt10 row rowEnd" style={accentVars}>
          <span className="badge badgeAccent">
            {sessionBadgeLabel}
          </span>
        </div>
      ) : null}
    </div>
  ) : null;

  return (
    <ScreenShell
      accent={accent}
      backgroundImage={backgroundImage}
      headerTitle={<span data-tour-id="today-title">Aujourd’hui</span>}
      headerSubtitle={<span data-tour-id="today-subtitle">Exécution</span>}
      headerRight={headerRight}
      headerRowAlign="start"
    >
      <div className="stack stackGap12" style={{ maxWidth: 720, margin: "0 auto" }}>
        <div className="row">
          <div
            className="small2"
            style={{ flex: 1, minWidth: 0, whiteSpace: "normal" }}
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
                focusCategory={focusCategory}
                selectedGoal={selectedGoal}
                canManageCategory={canManageCategory}
                onOpenManageCategory={onOpenManageCategory}
                currentPlannedOccurrence={currentPlannedOccurrence}
                nextPlannedOccurrence={nextPlannedOccurrence}
                onStartSession={handleStartSession}
                onPrepareSession={handlePrepareSession}
                normalizeOccurrenceForUI={normalizeOccurrenceForUI}
                goalsById={goalsById}
              />
            );
          }

          if (blockId === "micro") {
            return (
              <Card data-tour-id="today-micro-card">
                <div className="p18">
                  <div className="row">
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
                      <div className="cardSectionTitle">Micro-actions</div>
                    </div>
                    <button
                      className="linkBtn microToggle"
                      type="button"
                      onClick={() => setMicroOpen((v) => !v)}
                      data-tour-id="today-micro-toggle"
                    >
                      {microOpen ? "▾" : "▸"}
                    </button>
                  </div>
                  {microOpen ? (
                    <>
                      <div className="sectionSub">Trois impulsions simples</div>
                      <div className="mt12 col" style={{ gap: 10 }}>
                        {microItems.map((item) => {
                          const isMicroDone = Boolean(dayMicro?.[item.id]);
                          const canAddMicro = canValidate && microDoneToday < 3 && !isMicroDone;
                          return (
                            <AccentItem key={item.uid} color={accent} className="listItem">
                              <div className="row" style={{ justifyContent: "space-between" }}>
                                <div className="itemTitle">{item.label}</div>
                                <Button
                                  variant="ghost"
                                  onClick={() => addMicroCheck(item.id)}
                                  disabled={!canAddMicro}
                                  aria-label={isMicroDone ? "Déjà fait" : "Ajouter +1"}
                                  title={isMicroDone ? "Déjà fait" : microDoneToday >= 3 ? "Limite atteinte (3/jour)" : "Ajouter"}
                                >
                                  +1
                                </Button>
                              </div>
                            </AccentItem>
                          );
                        })}
                      </div>
                    </>
                  ) : null}
                </div>
              </Card>
            );
          }

          if (blockId === "notes") {
            return (
              <Card data-tour-id="today-notes-card">
                <div className="p18">
                  <div className="row">
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
                    <div className="row" style={{ gap: 8 }}>
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
                      className="accentSurface"
                      style={accentVars}
                      placeholder="Écris une remarque, une idée ou un ressenti pour aujourd’hui…"
                      data-tour-id="today-notes-text"
                    />
                  </div>
                  <div className="mt12">
                    <div className="small2">Check-in rapide</div>
                    <div className="noteMetaGrid mt8" data-tour-id="today-notes-meta">
                      <div>
                        <div className="small2">Forme</div>
                        <SelectMenu
                          value={noteMeta.forme || ""}
                          onChange={(next) => updateNoteMeta({ forme: next })}
                          style={accentVars}
                          className="accentSurface"
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
                        <div className="small2">Humeur</div>
                        <SelectMenu
                          value={noteMeta.humeur || ""}
                          onChange={(next) => updateNoteMeta({ humeur: next })}
                          style={accentVars}
                          className="accentSurface"
                          placeholder="Choisir"
                          options={[
                            { value: "Positif", label: "Positif" },
                            { value: "Neutre", label: "Neutre" },
                            { value: "Basse", label: "Basse" },
                          ]}
                        />
                      </div>
                      <div>
                        <div className="small2">Motivation</div>
                        <input
                          className="input accentSurface"
                          type="number"
                          min="0"
                          max="10"
                          step="1"
                          value={noteMeta.motivation || ""}
                          onChange={(e) => updateNoteMeta({ motivation: e.target.value })}
                          placeholder="0-10"
                          style={accentVars}
                        />
                      </div>
                    </div>
                  </div>
                  <div className="noteActions mt12">
                    <Button onClick={addNoteToHistory} data-tour-id="today-notes-add">
                      Enregistrer
                    </Button>
                  </div>
                </div>
              </Card>
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
                goalAccentByDate={goalAccentByDate}
                goalAccent={goalAccent}
                accent={accent}
                getDayDots={getDayDots}
                onDayOpen={handleDayOpen}
                onCommitDateKey={commitDateKey}
                monthCursor={monthCursor}
                onPrevMonth={() => setMonthCursor((d) => addMonths(d, -1))}
                onNextMonth={() => setMonthCursor((d) => addMonths(d, 1))}
                monthGrid={monthGrid}
                selectedDayAccent={selectedDayAccent}
                onAddOccurrence={typeof onAddOccurrence === "function" ? handleAddOccurrence : null}
                selectedGoalId={selectedGoal?.id || null}
              />
            );
          }
          return null;
          }}
        />
      </div>
      {showDayStats ? (
        <div className="modalBackdrop disciplineOverlay" onClick={() => setShowDayStats(false)}>
          <Card className="disciplineCard" onClick={(e) => e.stopPropagation()}>
            <div className="row" style={{ alignItems: "center", justifyContent: "space-between" }}>
              <div className="titleSm">Progression du jour</div>
              <button className="linkBtn" type="button" onClick={() => setShowDayStats(false)}>
                Fermer
              </button>
            </div>
            <div className="mt12 col" style={{ gap: 10 }}>
              <div className="row" style={{ justifyContent: "space-between" }}>
                <div className="small2">Date</div>
                <div className="titleSm">{selectedDateKey}</div>
              </div>
              <div className="row" style={{ justifyContent: "space-between" }}>
                <div className="small2">Objectif principal</div>
                <div className="titleSm">
                  {selectedGoal ? (goalDone ? "Terminé" : "En cours") : "—"}
                </div>
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
          </Card>
        </div>
      ) : null}

      {showDisciplineStats ? (
        <div className="modalBackdrop disciplineOverlay" onClick={() => setShowDisciplineStats(false)}>
          <Card className="disciplineCard" onClick={(e) => e.stopPropagation()}>
            <div className="row" style={{ alignItems: "center", justifyContent: "space-between" }}>
              <div className="titleSm">Discipline</div>
              <button className="linkBtn" type="button" onClick={() => setShowDisciplineStats(false)}>
                Fermer
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
          </Card>
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
          <Card className="noteHistorySheet" onClick={(e) => e.stopPropagation()}>
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
                  Fermer
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
                  if (meta.motivation) metaParts.push(`Motivation: ${meta.motivation}/10`);
                  const isSelected = noteDeleteMode && noteDeleteTargetId === item.id;
                  if (isSelected) {
                    return (
                      <AccentItem
                        key={item.id || item.dateKey}
                        className="listItem"
                        style={accentVars}
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
                      </AccentItem>
                    );
                  }

                  return (
                    <div
                      key={item.id || item.dateKey}
                      className="listItem"
                      role={noteDeleteMode ? "button" : undefined}
                      tabIndex={noteDeleteMode ? 0 : undefined}
                      onClick={
                        noteDeleteMode
                          ? () => setNoteDeleteTargetId((prev) => (prev === item.id ? null : item.id))
                          : undefined
                      }
                      onKeyDown={
                        noteDeleteMode
                          ? (e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault();
                                setNoteDeleteTargetId((prev) => (prev === item.id ? null : item.id));
                              }
                            }
                          : undefined
                      }
                    >
                      <div className="small2">{item.dateKey}</div>
                      {metaParts.length ? <div className="small2 mt8">{metaParts.join(" · ")}</div> : null}
                      {item.note ? <div className="small2 mt8">{item.note}</div> : null}
                    </div>
                  );
                })
              ) : (
                <div className="small2">Aucune note enregistrée.</div>
              )}
            </div>
          </Card>
        </div>
      ) : null}
    </ScreenShell>
  );
}

// Manual tests:
// - Fresh load (no interaction): rail + grid highlight today and month aligns.
// - Refresh (same tab, no interaction): rail + grid highlight today and month aligns.
// - Scroll rail (auto): selection updates without touching sessionStorage.
// - Click a day or ⟳: selection updates and persists; month follows.
