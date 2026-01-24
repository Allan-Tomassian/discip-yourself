import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import SortableBlocks from "../components/SortableBlocks";
import ScreenShell from "./_ScreenShell";
import { Button, Card, IconButton, SelectMenu, Textarea } from "../components/UI";
import AccentItem from "../components/AccentItem";
import {
  addDays,
  addMonths,
  buildMonthGrid,
  getMonthLabelFR,
  startOfMonth,
} from "../utils/dates";
import { fromLocalDateKey, normalizeLocalDateKey, toLocalDateKey, todayLocalKey } from "../utils/dateKey";
import { setMainGoal } from "../logic/goals";
import { getDoneSessionsForDate, getSessionByDate, startSessionForDate } from "../logic/sessions";
import { ensureWindowForGoals } from "../logic/occurrencePlanner";
import { getChecksForDate, setMicroChecked } from "../logic/checks";
import { getAccentForPage } from "../utils/_theme";
import { getCategoryAccentVars } from "../utils/categoryAccent";
import { isPrimaryCategory, isPrimaryGoal } from "../logic/priority";
import { getDefaultBlockIds } from "../logic/blocks/registry";
import { resolveGoalType } from "../domain/goalType";
import { linkProcessToOutcome, splitProcessByLink } from "../logic/linking";

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
  for (const id of defaults) {
    if (!cleaned.includes(id)) cleaned.push(id);
  }
  return cleaned.length ? cleaned : [...defaults];
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
  onOpenLibrary,
  onOpenManageCategory,
  onOpenSession,
  onDayOpen,
  onAddOccurrence,
  onOpenPaywall,
  isPremiumPlan = false,
  planLimits = null,
  generationWindowDays = null,
  isPlanningUnlimited = false,
}) {
  const safeData = data && typeof data === "object" ? data : {};
  const selectedDateKey = normalizeLocalDateKey(safeData.ui?.selectedDate) || todayLocalKey();
  const selectedDate = fromLocalDateKey(selectedDateKey);
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
  const [railRange, setRailRange] = useState(() => ({ start: -7, end: 7 }));

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
  const todayKeyRef = useRef(localTodayKey);
  const railRef = useRef(null);
  const railItemRefs = useRef(new Map());
  const railScrollRaf = useRef(null);
  const railExtendRef = useRef(0);
  const lastSelectionSourceRef = useRef("auto");
  const noteSaveRef = useRef(null);
  const calendarIdleTimerRef = useRef(null);
  const skipAutoCenterRef = useRef(false);
  const didInitSelectedDateRef = useRef(false);
  const didHydrateLegacyRef = useRef(false);

  // Data slices
  const profile = safeData.profile || {};
  const categories = Array.isArray(safeData.categories) ? safeData.categories : [];
  const goals = Array.isArray(safeData.goals) ? safeData.goals : [];
  // per-view category selection for Home (fallback to legacy)
  const homeSelectedCategoryId =
    safeData.ui?.selectedCategoryByView?.home || safeData.ui?.selectedCategoryId || null;
  const noteCategoryId = homeSelectedCategoryId;
  const noteKeyPrefix = noteCategoryId ? `dailyNote:${noteCategoryId}:` : "dailyNote:";
  const noteMetaKeyPrefix = noteCategoryId ? `dailyNoteMeta:${noteCategoryId}:` : "dailyNoteMeta:";
  const noteStorageKey = `${noteKeyPrefix}${selectedDateKey}`;
  const noteMetaStorageKey = `${noteMetaKeyPrefix}${selectedDateKey}`;
  const noteHistoryStorageKey = noteCategoryId ? `dailyNoteHistory:${noteCategoryId}` : "dailyNoteHistory";
  const sessions = Array.isArray(safeData.sessions) ? safeData.sessions : [];
  const checks = safeData.checks || {};
  const occurrences = Array.isArray(safeData.occurrences) ? safeData.occurrences : [];
  const dayChecks = useMemo(() => {
    return getChecksForDate(safeData, selectedDateKey);
  }, [safeData, selectedDateKey]);
  const plannedByDate = useMemo(() => {
    const map = new Map();
    for (const occ of occurrences) {
      if (!occ || typeof occ.date !== "string") continue;
      if (occ.status !== "planned") continue;
      map.set(occ.date, (map.get(occ.date) || 0) + 1);
    }
    return map;
  }, [occurrences]);
  const doneByDate = useMemo(() => {
    const map = new Map();
    const addId = (key, id) => {
      if (!key || !id) return;
      const set = map.get(key) || new Set();
      set.add(id);
      map.set(key, set);
    };
    if (checks && typeof checks === "object") {
      for (const key of Object.keys(checks)) {
        const { habits } = getChecksForDate(safeData, key);
        for (const id of habits) addId(key, id);
      }
    }
    for (const s of sessions) {
      if (!s || s.status !== "done") continue;
      const key = typeof s.dateKey === "string" ? s.dateKey : typeof s.date === "string" ? s.date : "";
      if (!key) continue;
      const doneIds = Array.isArray(s.doneHabitIds)
        ? s.doneHabitIds
        : Array.isArray(s.doneHabits)
          ? s.doneHabits
          : [];
      if (doneIds.length) {
        for (const id of doneIds) addId(key, id);
      } else {
        if (s.habitId) addId(key, s.habitId);
        if (Array.isArray(s.habitIds)) {
          for (const id of s.habitIds) addId(key, id);
        }
      }
    }
    const counts = new Map();
    for (const [key, set] of map.entries()) counts.set(key, set.size);
    return counts;
  }, [checks, sessions]);

  // Effects
  useEffect(() => {
    if (typeof setData !== "function") return;

    const today = toLocalDateKey(new Date());
    const raw = safeData.ui?.selectedDate;
    const isValid = typeof raw === "string" && /^\d{4}-\d{2}-\d{2}$/.test(raw);

    if (!didInitSelectedDateRef.current) {
      didInitSelectedDateRef.current = true;
      if (raw !== today) {
        setData((prev) => ({
          ...prev,
          ui: { ...(prev.ui || {}), selectedDate: today },
        }));
      }
      try {
        sessionStorage.removeItem("home:selectedDateTouched");
      } catch (err) {
   void err;
        // Ignore storage failures.
      }
      return;
    }

    // Still keep the safety net for invalid values.
    if (!isValid) {
      setData((prev) => ({
        ...prev,
        ui: { ...(prev.ui || {}), selectedDate: today },
      }));
    }
  }, [safeData.ui?.selectedDate, setData]);

  useEffect(() => {
    return () => {
      if (typeof setData !== "function") return;
      const today = toLocalDateKey(new Date());
      setData((prev) => {
        const prevUi = prev?.ui && typeof prev.ui === "object" ? prev.ui : {};
        if (prevUi.selectedDate === today) return prev;
        return {
          ...prev,
          ui: { ...prevUi, selectedDate: today },
        };
      });
      try {
        sessionStorage.removeItem("home:selectedDateTouched");
      } catch (err) {
   void err;
        // Ignore storage failures.
      }
    };
  }, [setData]);

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

  useEffect(() => {
    if (typeof setData !== "function") return;
    const id = setInterval(() => {
      const nowKey = toLocalDateKey(new Date());
      if (nowKey === todayKeyRef.current) return;
      todayKeyRef.current = nowKey;
      setData((prev) => {
        const prevUi = prev.ui || {};
        if (prevUi.selectedDate === nowKey) return prev;
        return { ...prev, ui: { ...prevUi, selectedDate: nowKey } };
      });
    }, 60000);
    return () => clearInterval(id);
  }, [setData]);

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

  const dayDoneSessions = useMemo(
    () => getDoneSessionsForDate(sessions, selectedDateKey),
    [sessions, selectedDateKey]
  );
  const sessionForDay = useMemo(
    () => getSessionByDate({ sessions }, selectedDateKey, selectedGoal?.id || null),
    [sessions, selectedDateKey, selectedGoal?.id]
  );
  const sessionHabit = useMemo(() => {
    if (!sessionForDay?.habitIds?.length) return null;
    const firstId = sessionForDay.habitIds[0];
    return firstId ? goals.find((g) => g.id === firstId) || null : null;
  }, [sessionForDay?.habitIds, goals]);
  const doneHabitIds = useMemo(() => {
    const ids = new Set(dayChecks.habits);
    for (const s of dayDoneSessions) {
      if (s?.habitId) ids.add(s.habitId);
      if (Array.isArray(s?.doneHabitIds)) {
        for (const id of s.doneHabitIds) ids.add(id);
      }
    }
    return ids;
  }, [dayChecks.habits, dayDoneSessions]);

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
  const hasLinkedHabits = linkedHabits.length > 0;
  const hasSelectableHabits = selectableHabits.length > 0;
  const plannedWindowDays = Number.isFinite(generationWindowDays) && generationWindowDays > 0
    ? Math.floor(generationWindowDays)
    : 14;
  const plannedLinkedWindowCount = useMemo(() => {
    if (!linkedHabits.length) return 0;
    const linkedIds = new Set(linkedHabits.map((h) => h.id));
    const startKey = localTodayKey;
    const endKey = toLocalDateKey(addDays(fromLocalDateKey(localTodayKey), plannedWindowDays - 1));
    let count = 0;
    for (const occ of occurrences) {
      if (!occ || occ.status !== "planned") continue;
      const dateKey = typeof occ.date === "string" ? occ.date : "";
      if (!dateKey || dateKey < startKey || dateKey > endKey) continue;
      if (!linkedIds.has(occ.goalId)) continue;
      count += 1;
    }
    return count;
  }, [linkedHabits, occurrences, localTodayKey, plannedWindowDays]);
  const showTodayEmptyCta =
    selectedStatus === "today" && (!selectedGoal || !hasLinkedHabits || plannedLinkedWindowCount === 0);
  const emptyCtaSubtitle = !selectedGoal
    ? "Aucun objectif sélectionné pour le moment."
    : !hasLinkedHabits
      ? "Aucune action liée à cet objectif pour le moment."
      : isPlanningUnlimited
        ? "Planning illimité : aucune occurrence planifiée pour le moment."
        : Number.isFinite(generationWindowDays) && generationWindowDays > 0
          ? `0 occurrence planifiée sur les ${Math.floor(generationWindowDays)} prochains jours.`
          : "0 occurrence planifiée sur les prochains jours.";

  // Actions actives uniquement (progression)
  const activeHabits = useMemo(() => linkedHabits.filter((g) => safeString(g.status) === "active"), [linkedHabits]);
  const canManageCategory = Boolean(typeof onOpenManageCategory === "function" && focusCategory?.id);
  const selectedHabitsByGoal = safeData.ui?.selectedHabits || {};
  const storedSelectedHabits =
    selectedGoal?.id && Array.isArray(selectedHabitsByGoal[selectedGoal.id])
      ? selectedHabitsByGoal[selectedGoal.id]
      : null;
  const selectedActionIds = useMemo(() => {
    const valid = new Set(selectableHabits.map((h) => h.id));
    if (Array.isArray(storedSelectedHabits)) {
      const filtered = storedSelectedHabits.filter((id) => valid.has(id));
      // If user previously had selections but the set is now empty due to link changes,
      // fall back to all linked actions to avoid a dead GO.
      if (storedSelectedHabits.length && filtered.length === 0) {
        return selectableHabits.map((h) => h.id);
      }
      return filtered;
    }
    return selectableHabits.map((h) => h.id);
  }, [selectableHabits, storedSelectedHabits]);
  const hasSelectedActions = selectedActionIds.length > 0;

  // ---- Outcome goal lookup helpers and dominant outcome by date
  const goalsById = useMemo(() => {
    const map = new Map();
    for (const g of goals) if (g && g.id) map.set(g.id, g);
    return map;
  }, [goals]);

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

    // 1) Session active: use objectiveId / goalId
    for (const s of sessions) {
      if (!s) continue;
      const key = typeof s.dateKey === "string" ? s.dateKey : typeof s.date === "string" ? s.date : "";
      if (!key) continue;
      const sid =
        (typeof s.objectiveId === "string" && s.objectiveId) ||
        (typeof s.goalId === "string" && s.goalId) ||
        null;
      const out = sid ? getOutcomeForGoalId(sid) : null;
      if (out?.id) map.set(key, out.id);
    }

    // 2) Occurrences planned: map PROCESS -> parent OUTCOME
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
  }, [sessions, occurrences, goalsById, getOutcomeForGoalId]);

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
    const count = Object.keys(dayChecks.micro || {}).length;
    return Math.min(3, count);
  }, [dayChecks.micro]);

  const canOpenSession = Boolean(canValidate && selectedGoal && hasSelectedActions);

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

    // UX: start discipline at 100% for brand-new users (no history yet).
    const hasAnyChecks = checks && typeof checks === "object" && Object.keys(checks).length > 0;
    const hasAnySessions = Array.isArray(sessions) && sessions.some((s) => s && typeof s.status === "string");
    const hasAnyDoneOutcome = goals.some((g) => resolveGoalType(g) === "OUTCOME" && g.status === "done");
    const hasAnyHistory = hasAnyChecks || hasAnySessions || hasAnyDoneOutcome;

    if (!hasAnyHistory) {
      const outcomesTotal = goals.filter((g) => resolveGoalType(g) === "OUTCOME").length;
      return {
        score: 100,
        ratio: 1,
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
      const { habits } = getChecksForDate(safeData, key);
      const ids = new Set(habits);
      for (const s of sessions || []) {
        if (!s || s.date !== key || s.status !== "done") continue;
        if (s.habitId) ids.add(s.habitId);
        if (Array.isArray(s.doneHabitIds)) {
          for (const id of s.doneHabitIds) ids.add(id);
        }
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
      const { micro } = getChecksForDate(safeData, key);
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

    const scoreRaw = habit14.ratio * 0.7 + microRatio14 * 0.1 + reliabilityRatio * 0.2;
    const score = Math.round(Math.max(0, Math.min(1, scoreRaw)) * 100);
    const ratio = score / 100;

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
  }, [checks, goals, sessions]);

  const sessionBadgeLabel = useMemo(() => {
    if (!sessionForDay || sessionForDay?.status !== "partial") return "";
    const sessionMinutes = Number.isFinite(sessionHabit?.sessionMinutes)
      ? sessionHabit.sessionMinutes
      : null;
    if (sessionMinutes) return `Session en cours · ${sessionMinutes} min`;
    return "Session en cours";
  }, [sessionForDay, sessionHabit]);

  const railAnchorDate = useMemo(() => fromLocalDateKey(localTodayKey), [localTodayKey]);
  const railItems = useMemo(() => {
    const items = [];
    for (let offset = railRange.start; offset <= railRange.end; offset += 1) {
      const d = addDays(railAnchorDate, offset);
      const key = toLocalDateKey(d);
      const parts = key.split("-");
      items.push({
        key,
        date: d,
        day: parts[2] || "",
        month: parts[1] || "",
        isSelected: key === selectedDateKey,
        status: key === localTodayKey ? "today" : key < localTodayKey ? "past" : "future",
      });
    }
    return items;
  }, [railAnchorDate, railRange.start, railRange.end, selectedDateKey, localTodayKey]);

  const ensureRailRangeForOffset = useCallback((offset) => {
    const buffer = 7;
    setRailRange((prev) => {
      let start = prev.start;
      let end = prev.end;
      if (offset < start + buffer) start = offset - buffer;
      if (offset > end - buffer) end = offset + buffer;
      if (start === prev.start && end === prev.end) return prev;
      return { start, end };
    });
  }, []);

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

  useEffect(() => {
    const offset = diffDays(railAnchorDate, selectedDate);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    ensureRailRangeForOffset(offset);
  }, [railAnchorDate, selectedDate, ensureRailRangeForOffset]);

  const selectedDateLabel =
    selectedStatus === "today" ? `${calendarRangeLabel} · Aujourd’hui` : calendarRangeLabel;

  const monthGrid = useMemo(() => buildMonthGrid(monthCursor), [monthCursor]);

  useEffect(() => {
    if (microState.dayKey === selectedDateKey) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMicroState(initMicroState(selectedDateKey));
  }, [microState.dayKey, selectedDateKey]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMonthCursor(startOfMonth(selectedDate));
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
  const scheduleCalendarIdleReset = useCallback(() => {
    if (calendarIdleTimerRef.current) clearTimeout(calendarIdleTimerRef.current);
    calendarIdleTimerRef.current = setTimeout(() => {
      const today = toLocalDateKey(new Date());
      lastSelectionSourceRef.current = "auto";
      setData((prev) => {
        const prevUi = prev?.ui && typeof prev.ui === "object" ? prev.ui : {};
        if (prevUi.selectedDate === today) return prev;
        return {
          ...prev,
          ui: { ...prevUi, selectedDate: today },
        };
      });
      try {
        sessionStorage.removeItem("home:selectedDateTouched");
      } catch (err) {
   void err;
        // ignore
      }
    }, 1200);
  }, [setData]);
  const setSelectedDate = useCallback(
    (nextKey, source = "user") => {
      if (!nextKey || typeof setData !== "function") return;
      lastSelectionSourceRef.current = source;
      const isUser = source === "user";
      if (isUser) {
        try {
          sessionStorage.setItem("home:selectedDateTouched", nextKey);
        } catch (err) {
   void err;
          // ignore
        }
      }
      setData((prev) => {
        const prevUi = prev?.ui && typeof prev.ui === "object" ? prev.ui : {};
        if (prevUi.selectedDate === nextKey) return prev;
        return {
          ...prev,
          ui: { ...prevUi, selectedDate: nextKey },
        };
      });
      if (isUser) scheduleCalendarIdleReset();
    },
    [scheduleCalendarIdleReset, setData]
  );

  useEffect(() => {
    if (calendarView === "day") return;
    if (lastSelectionSourceRef.current === "user") return;
    if (selectedDateKey !== localTodayKey) {
      setSelectedDate(localTodayKey, "auto");
    }
  }, [calendarView, localTodayKey, selectedDateKey, setSelectedDate]);
  useEffect(() => {
    return () => {
      if (calendarIdleTimerRef.current) clearTimeout(calendarIdleTimerRef.current);
    };
  }, []);
  const handleDayOpen = useCallback(
    (nextKey) => {
      if (!nextKey) return;
      setSelectedDate(nextKey, "user");
      if (typeof onDayOpen === "function") onDayOpen(nextKey);
    },
    [onDayOpen, setSelectedDate]
  );
  const handleAddOccurrence = useCallback(
    (nextKey, goalId) => {
      if (!nextKey) return;
      if (!isPlanningUnlimited && Number.isFinite(generationWindowDays) && generationWindowDays > 0) {
        const endKey = toLocalDateKey(
          addDays(fromLocalDateKey(localTodayKey), Math.floor(generationWindowDays) - 1)
        );
        if (nextKey > endKey) {
          if (typeof onOpenPaywall === "function") {
            onOpenPaywall(
              `Planning limité à ${Math.floor(generationWindowDays)} jours.`
            );
          }
          return;
        }
      }
      if (typeof onAddOccurrence === "function") {
        onAddOccurrence(nextKey, goalId || null);
      }
    },
    [generationWindowDays, isPlanningUnlimited, localTodayKey, onAddOccurrence, onOpenPaywall]
  );

  useEffect(() => {
    if (!isPlanningUnlimited) return;
    if (!Number.isFinite(generationWindowDays) || generationWindowDays <= 0) return;
    const endKey = toLocalDateKey(
      addDays(fromLocalDateKey(localTodayKey), Math.floor(generationWindowDays) - 1)
    );
    const thresholdKey = toLocalDateKey(addDays(fromLocalDateKey(endKey), -7));
    if (selectedDateKey < thresholdKey) return;
    setData((prev) => {
      const goalsList = Array.isArray(prev?.goals) ? prev.goals : [];
      let processIds = [];
      if (selectedGoal?.id) {
        processIds = linkedHabits.map((goal) => goal.id).filter(Boolean);
      } else if (focusCategory?.id) {
        processIds = goalsList
          .filter((goal) => resolveGoalType(goal) === "PROCESS" && goal.categoryId === focusCategory.id)
          .map((goal) => goal.id)
          .filter(Boolean);
      }
      if (!processIds.length) return prev;
      return ensureWindowForGoals(prev, processIds, localTodayKey, Math.floor(generationWindowDays));
    });
  }, [
    focusCategory?.id,
    generationWindowDays,
    isPlanningUnlimited,
    linkedHabits,
    localTodayKey,
    selectedDateKey,
    selectedGoal?.id,
    setData,
  ]);

  const getRailStepPx = useCallback(() => {
    const fallback = 62;
    if (typeof window === "undefined") return fallback;
    const container = railRef.current;
    if (!container) return fallback;
    let itemWidth = 54;
    const sample = railItemRefs.current.values().next().value;
    if (sample && sample.offsetWidth) itemWidth = sample.offsetWidth;
    let gap = 8;
    const style = window.getComputedStyle(container);
    const gapRaw = style.columnGap || style.gap || "0";
    const parsedGap = parseFloat(gapRaw);
    if (Number.isFinite(parsedGap)) gap = parsedGap;
    return itemWidth + gap;
  }, []);

  const extendRailRange = useCallback(
    (direction) => {
      const now = Date.now();
      if (now - railExtendRef.current < 200) return;
      railExtendRef.current = now;
      const delta = 14;
      setRailRange((prev) => {
        if (direction === "start") return { start: prev.start - delta, end: prev.end };
        if (direction === "end") return { start: prev.start, end: prev.end + delta };
        return prev;
      });
      if (direction === "start") {
        const container = railRef.current;
        if (!container) return;
        const step = getRailStepPx();
        container.scrollLeft += step * delta;
      }
    },
    [getRailStepPx]
  );

  const maybeExtendRailRange = useCallback(() => {
    const container = railRef.current;
    if (!container) return;
    const step = getRailStepPx();
    const threshold = step * 2;
    const left = container.scrollLeft;
    const right = container.scrollWidth - (left + container.clientWidth);
    if (left < threshold) {
      extendRailRange("start");
    } else if (right < threshold) {
      extendRailRange("end");
    }
  }, [extendRailRange, getRailStepPx]);

  const scrollRailToKey = useCallback((dateKeyValue, behavior = "smooth") => {
    const container = railRef.current;
    if (!container || !dateKeyValue) return;
    const refEl = railItemRefs.current.get(dateKeyValue);
    const el = refEl || container.querySelector(`[data-datekey="${dateKeyValue}"]`);
    if (!el) return;
    const targetLeft = el.offsetLeft - (container.clientWidth / 2 - el.clientWidth / 2);
    if (Number.isFinite(targetLeft)) {
      container.scrollTo({ left: Math.max(0, targetLeft), behavior });
      return;
    }
    if (typeof el.scrollIntoView === "function") {
      el.scrollIntoView({ behavior, inline: "center", block: "nearest" });
    }
  }, []);

  const updateSelectedFromScroll = useCallback(() => {
    const container = railRef.current;
    if (!container || !railItemRefs.current.size) return;
    const centerX = container.scrollLeft + container.clientWidth / 2;
    let closestKey = null;
    let minDist = Number.POSITIVE_INFINITY;
    railItemRefs.current.forEach((el, key) => {
      if (!el) return;
      const itemCenter = el.offsetLeft + el.offsetWidth / 2;
      const dist = Math.abs(itemCenter - centerX);
      if (dist < minDist) {
        minDist = dist;
        closestKey = key;
      }
    });
    if (closestKey && closestKey !== selectedDateKey) {
      skipAutoCenterRef.current = true;
      setSelectedDate(closestKey, "auto");
    }
  }, [selectedDateKey, setSelectedDate]);

  const handleRailScroll = useCallback(() => {
    if (railScrollRaf.current) return;
    railScrollRaf.current = requestAnimationFrame(() => {
      railScrollRaf.current = null;
      updateSelectedFromScroll();
      maybeExtendRailRange();
    });
    scheduleCalendarIdleReset();
  }, [maybeExtendRailRange, scheduleCalendarIdleReset, updateSelectedFromScroll]);

  useEffect(() => {
    if (calendarView !== "day") return;
    if (!selectedDateKey) return;
    if (skipAutoCenterRef.current) {
      skipAutoCenterRef.current = false;
      return;
    }
    requestAnimationFrame(() => scrollRailToKey(selectedDateKey, "auto"));
  }, [calendarView, scrollRailToKey, selectedDateKey, railItems.length]);

  useEffect(() => {
    return () => {
      if (railScrollRaf.current) cancelAnimationFrame(railScrollRaf.current);
    };
  }, []);

  function openSessionFlow() {
    if (!selectedGoal?.id || !canValidate || !hasSelectedActions || typeof setData !== "function") return;
    setData((prev) =>
      startSessionForDate(
        ensureWindowForGoals(prev, selectedActionIds, selectedDateKey, 1),
        selectedDateKey,
        {
          objectiveId: selectedGoal.id,
          habitIds: selectedActionIds,
        }
      )
    );
    if (typeof onOpenSession === "function") {
      onOpenSession({ categoryId: focusCategory?.id || null, dateKey: selectedDateKey });
    }
  }

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
    selectedDateKey,
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
    const already = Boolean(dayChecks.micro?.[microId]);
    if (already) return;
    if (microDoneToday >= 3) return;

    setData((prev) => setMicroChecked(prev, selectedDateKey, microId, true));
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
                <Card data-tour-id="today-focus-card">
                  <div className="p18">
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
                      <div className="cardSectionTitle">Focus du jour</div>
                      <div className="flex1" />
                      {canManageCategory ? (
                        <Button
                          variant="ghost"
                          onClick={() => onOpenManageCategory(focusCategory.id)}
                          aria-label="Gérer la catégorie"
                        >
                          Gérer
                        </Button>
                      ) : null}
                    </div>
                    <div className="mt12">
                      <div className="small2">Catégorie</div>
                      <div
                        className="mt8 accentRow"
                        data-tour-id="today-focus-category"
                        style={accentVars}
                      >
                        <div className="itemTitle">{focusCategory?.name || "Catégorie"}</div>
                      </div>
                    </div>

                    <div className="mt12">
                      <div className="small2">Objectif principal</div>
                    {outcomeGoals.length ? (
                      <div className="mt8 accentRow" style={accentVars}>
                        <SelectMenu
                          value={selectedGoal?.id || ""}
                          onChange={(next) => setCategoryMainGoal(next)}
                          disabled={!canEdit}
                          placeholder="Choisir un objectif"
                          options={outcomeGoals.map((g) => ({ value: g.id, label: g.title || "Objectif" }))}
                          className="accentInput"
                        />
                      </div>
                    ) : (
                      <div className="mt8 small2">Aucun objectif principal pour cette catégorie.</div>
                    )}
                    </div>

                    {showTodayEmptyCta ? (
                      <div className="mt12" data-tour-id="today-empty-cta">
                        <div className="small2">Aujourd’hui est vide.</div>
                        <div className="sectionSub" style={{ marginTop: 6 }}>
                          {emptyCtaSubtitle}
                        </div>
                        <div className="mt10">
                          <div className="small2 textMuted">
                            Utilise le + pour créer un objectif ou une action.
                          </div>
                          {!canEdit ? (
                            <div className="sectionSub" style={{ marginTop: 8 }}>
                              {lockMessage}
                            </div>
                          ) : null}
                        </div>
                      </div>
                    ) : null}

                    {selectedGoal && hasSelectableHabits ? (
                      <div className="mt12">
                        <div className="small2">Actions à faire</div>
                        <div className="mt8 col gap8">
                          {selectableHabits.map((habit) => {
                            const isSelected = selectedActionIds.includes(habit.id);
                            return (
                              <AccentItem
                                key={habit.id}
                                color={goalAccent}
                                selected={isSelected}
                                compact
                                onClick={canEdit ? () => toggleActionSelection(habit.id) : undefined}
                                aria-label={`${isSelected ? "Désélectionner" : "Sélectionner"} ${habit.title}`}
                              >
                                <div className="itemTitle">{habit.title}</div>
                              </AccentItem>
                            );
                          })}
                        </div>
                        {!hasSelectedActions ? (
                          <div className="sectionSub mt8">
                            Sélectionne au moins une action.
                          </div>
                        ) : null}
                      </div>
                    ) : null}

                    {selectedGoal && unlinkedHabits.length ? (
                      <div className="mt12">
                        <div className="small2">Actions non liées</div>
                        <div className="sectionSub mt6">
                          Ces actions existent dans la catégorie mais ne sont liées à aucun objectif.
                        </div>
                        <div className="mt8 col gap8">
                          {unlinkedHabits.map((habit) => (
                            <div key={habit.id} className="row gap8 alignCenter">
                              <div className="itemTitle textMuted2">
                                {habit.title || "Action"}
                              </div>
                              {typeof setData === "function" && selectedGoal ? (
                                <button
                                  className="linkBtn"
                                  type="button"
                                  onClick={() =>
                                    setData((prev) => linkProcessToOutcome(prev, habit.id, selectedGoal.id))
                                  }
                                >
                                  Lier
                                </button>
                              ) : null}
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null}

                    <div className="mt12">
                      <div className="row rowEnd">
                        <Button onClick={openSessionFlow} disabled={!canOpenSession} data-tour-id="today-go">
                          GO
                        </Button>
                      </div>
                      {!selectedGoal ? (
                        <div className="sectionSub mt8">
                          Sélectionne un objectif pour activer GO.
                        </div>
                      ) : !canValidate ? (
                        <div className="sectionSub mt8">
                          {lockMessage}
                        </div>
                      ) : !hasLinkedHabits ? (
                        <div className="sectionSub mt8">
                          Aucune action liée à cet objectif (ou tes actions ne sont pas reliées correctement).
                          {canManageCategory && !showTodayEmptyCta ? (
                            <>
                              {" "}
                              <button
                                className="linkBtn"
                                type="button"
                                onClick={() => onOpenManageCategory(focusCategory.id)}
                              >
                                Ajouter une action
                              </button>
                            </>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                </div>
              </Card>
            );
          }

          if (blockId === "calendar") {
            return (
              <Card
                data-tour-id="today-calendar-card"
                onPointerDown={scheduleCalendarIdleReset}
                onWheel={scheduleCalendarIdleReset}
              >
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
                      <div>
                        <div className="cardSectionTitle">Calendrier</div>
                        <div className="small2 mt8" aria-live="polite" aria-atomic="true">
                          {selectedDateLabel || "—"}
                        </div>
                      </div>
                    </div>
                    <div className="row" style={{ gap: 8 }}>
                      {(() => {
                        const isOnToday = selectedDateKey === toLocalDateKey(new Date());
                        return (
                          <IconButton
                            onClick={() => {
                              const today = toLocalDateKey(new Date());
                              handleDayOpen(today);
                              if (calendarView === "day") {
                                requestAnimationFrame(() => scrollRailToKey(today));
                              }
                            }}
                            aria-label="Revenir à aujourd’hui"
                            title="Revenir à aujourd’hui"
                            data-tour-id="today-calendar-today"
                            disabled={isOnToday}
                          >
                            ⟳
                          </IconButton>
                        );
                      })()}
                      <Button
                        variant="ghost"
                        onClick={() => setCalendarView("day")}
                        disabled={calendarView === "day"}
                        aria-pressed={calendarView === "day"}
                        data-tour-id="today-calendar-day"
                      >
                        Jour
                      </Button>
                      <Button
                        variant="ghost"
                        onClick={() => setCalendarView("month")}
                        disabled={calendarView === "month"}
                        aria-pressed={calendarView === "month"}
                        data-tour-id="today-calendar-month"
                      >
                        Mois
                      </Button>
                    </div>
                  </div>
                  <div
                    key={calendarPaneKey}
                    className={`calPane ${calendarPanePhase}`}
                    style={{
                      willChange: "transform, opacity",
                      transition: "transform 220ms ease, opacity 220ms ease",
                      opacity: calendarPanePhase === "enter" ? 0 : 1,
                      transform: calendarPanePhase === "enter" ? "translateY(6px)" : "translateY(0px)",
                    }}
                  >
                    {calendarView === "day" ? (
                      <div className="calendarRailWrap mt12">
                        <div className="calendarSelector" aria-hidden="true">
                          <span className="calendarSelectorDot" />
                        </div>
                        <div
                          className="calendarRail scrollNoBar"
                          ref={railRef}
                          onScroll={handleRailScroll}
                          data-tour-id="today-calendar-rail"
                          role="listbox"
                          aria-label="Sélecteur de jour"
                          style={{
                            scrollSnapType: "x mandatory",
                            WebkitOverflowScrolling: "touch",
                            overscrollBehaviorX: "contain",
                          }}
                        >
                          {railItems.map((item) => {
                            const plannedCount = plannedByDate.get(item.key) || 0;
                            const doneCount = doneByDate.get(item.key) || 0;
                            const isToday = item.key === localTodayKey;
                            const plannedLabel = plannedCount
                              ? `${plannedCount} planifié${plannedCount > 1 ? "s" : ""}`
                              : "0 planifié";
                            const doneLabel = doneCount ? `${doneCount} fait${doneCount > 1 ? "s" : ""}` : "0 fait";
                            const ariaLabel = `${item.key} · ${plannedLabel} · ${doneLabel}${
                              isToday ? " · Aujourd’hui" : ""
                            }`;
                            return (
                              <button
                                key={item.key}
                                ref={(el) => {
                                  if (el) railItemRefs.current.set(item.key, el);
                                  else railItemRefs.current.delete(item.key);
                                }}
                                className={`dayPill calendarItem ${
                                  item.key === selectedDateKey
                                    ? "is-current"
                                    : item.key < selectedDateKey
                                      ? "is-past"
                                      : "is-future"
                                }`}
                                data-datekey={item.key}
                                data-status={item.status}
                                data-planned={plannedCount}
                                data-done={doneCount}
                                aria-label={ariaLabel}
                                aria-pressed={item.key === selectedDateKey}
                                aria-current={isToday ? "date" : undefined}
                                role="option"
                                onClick={() => {
                                  scrollRailToKey(item.key);
                                  handleDayOpen(item.key);
                                }}
                                type="button"
                                style={{
                                  scrollSnapAlign: "center",
                                  borderColor:
                                    item.key === selectedDateKey
                                      ? selectedDayAccent
                                      : goalAccentByDate.get(item.key) || "rgba(255,255,255,.14)",
                                  boxShadow:
                                    item.key === selectedDateKey
                                      ? `0 0 0 2px ${selectedDayAccent}33`
                                      : undefined,
                                }}
                              >
                                <div className="dayPillDay">{item.day}</div>
                                <div className="dayPillMonth">/{item.month}</div>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ) : (
                      <div className="mt12">
                        <div className="calendarMonthHeader" style={{ display: "grid", gridTemplateColumns: "48px 1fr 48px", alignItems: "center" }}>
                          <Button
                            variant="ghost"
                            onClick={() => setMonthCursor((d) => addMonths(d, -1))}
                            aria-label="Mois précédent"
                          >
                            ←
                          </Button>
                          <div className="titleSm calendarMonthTitle" style={{ textAlign: "center" }}>
                            {getMonthLabelFR(monthCursor)}
                          </div>
                          <Button
                            variant="ghost"
                            onClick={() => setMonthCursor((d) => addMonths(d, 1))}
                            aria-label="Mois suivant"
                          >
                            →
                          </Button>
                        </div>
                        {typeof onAddOccurrence === "function" ? (
                          <div className="calendarMonthActions">
                            <Button
                              variant="ghost"
                              onClick={() => handleAddOccurrence(selectedDateKey, selectedGoal?.id || null)}
                              data-tour-id="today-calendar-add-occurrence"
                            >
                              Ajouter
                            </Button>
                          </div>
                        ) : null}
                        <div
                          className="mt10 calMonthGrid"
                          style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 6, textAlign: "center", contain: "content" }}
                          data-tour-id="today-calendar-month-grid"
                        >
                          {["L", "M", "M", "J", "V", "S", "D"].map((label, idx) => (
                            <div key={`${label}-${idx}`} className="small2">
                              {label}
                            </div>
                          ))}
                          {monthGrid.map((cell) => {
                            const dayKey = toLocalDateKey(cell.dateObj);
                            const plannedCount = plannedByDate.get(dayKey) || 0;
                            const doneCount = doneByDate.get(dayKey) || 0;
                            const isSelected = dayKey === selectedDateKey;
                            const isToday = dayKey === localTodayKey;
                            const plannedLabel = plannedCount
                              ? `${plannedCount} planifié${plannedCount > 1 ? "s" : ""}`
                              : "0 planifié";
                            const doneLabel = doneCount ? `${doneCount} fait${doneCount > 1 ? "s" : ""}` : "0 fait";
                            const ariaLabel = `${dayKey} · ${plannedLabel} · ${doneLabel}${isToday ? " · Aujourd’hui" : ""}`;
                            return (
                              <button
                                key={dayKey}
                                type="button"
                                className={`dayPill${isSelected ? " dayPillActive" : ""}`}
                                data-datekey={dayKey}
                                data-planned={plannedCount}
                                data-done={doneCount}
                                aria-label={ariaLabel}
                                aria-pressed={isSelected}
                                aria-current={isToday ? "date" : undefined}
                                onClick={() => handleDayOpen(dayKey)}
                                style={{
                                  width: "100%",
                                  minHeight: 56,
                                  borderRadius: 12,
                                  padding: 6,
                                  opacity: cell.inMonth ? 1 : 0.4,
                                  borderColor: isSelected
                                    ? selectedDayAccent
                                    : goalAccentByDate.get(dayKey) || "rgba(255,255,255,.14)",
                                  boxShadow: isSelected ? `0 0 0 2px ${selectedDayAccent}33` : undefined,
                                }}
                              >
                                <div className="dayPillDay">{cell.dayNumber}</div>
                                <div className="small2">{plannedCount ? `${plannedCount} planifié` : ""}{plannedCount && doneCount ? " · " : ""}{doneCount ? `${doneCount} fait` : ""}</div>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="sectionSub" style={{ marginTop: 8 }}>
                    {selectedStatus === "past"
                      ? "Lecture seule"
                      : selectedStatus === "today"
                        ? "Aujourd’hui"
                        : "À venir"}
                  </div>
                </div>
              </Card>
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
                          const isMicroDone = Boolean(dayChecks.micro?.[item.id]);
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
                      className="accentInput"
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
                          className="accentInput"
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
                          className="accentInput"
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
                          className="input accentInput"
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
          className="modalBackdrop disciplineOverlay"
          onClick={() => {
            setShowNotesHistory(false);
            setNoteDeleteMode(false);
            setNoteDeleteTargetId(null);
          }}
        >
          <Card className="disciplineCard" onClick={(e) => e.stopPropagation()}>
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
            <div className="mt12 col" style={{ gap: 10, maxHeight: 320, overflow: "auto" }}>
              {noteHistoryItems.length ? (
                noteHistoryItems.map((item) => {
                  const meta = item.meta || {};
                  const metaParts = [];
                  if (meta.forme) metaParts.push(`Forme: ${meta.forme}`);
                  if (meta.humeur) metaParts.push(`Humeur: ${meta.humeur}`);
                  if (meta.motivation) metaParts.push(`Motivation: ${meta.motivation}/10`);
                  const isSelected = noteDeleteMode && noteDeleteTargetId === item.id;
                  return (
                    <div
                      key={item.id || item.dateKey}
                      className={`listItem${isSelected ? " catAccentRow" : ""}`}
                      style={isSelected ? accentVars : undefined}
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
