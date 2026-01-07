import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  DndContext,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { restrictToParentElement, restrictToVerticalAxis } from "@dnd-kit/modifiers";
import ScreenShell from "./_ScreenShell";
import { Button, Card, IconButton, Select, Textarea } from "../components/UI";
import {
  addDays,
  addMonths,
  buildMonthGrid,
  getMonthLabelFR,
  startOfMonth,
} from "../utils/dates";
import { setMainGoal } from "../logic/goals";
import { getDoneSessionsForDate, getSessionByDate, startSessionForDate } from "../logic/sessions";
import { getAccentForPage } from "../utils/_theme";
import { getCategoryAccentVars } from "../utils/categoryAccent";
import { isPrimaryCategory, isPrimaryGoal } from "../logic/priority";

// TOUR MAP:
// - primary_action: start session (GO) for today
// - key_elements: focus section, calendar, micro-actions, daily note
// - optional_elements: day stats/discipline stats modals
// ---- Helpers
function resolveGoalType(goal) {
  const raw = typeof goal?.type === "string" ? goal.type.toUpperCase() : "";
  if (raw === "OUTCOME" || raw === "PROCESS") return raw;
  if (raw === "STATE") return "OUTCOME";
  if (raw === "ACTION" || raw === "ONE_OFF") return "PROCESS";
  const legacy = typeof goal?.kind === "string" ? goal.kind.toUpperCase() : "";
  if (legacy === "OUTCOME") return "OUTCOME";
  if (goal?.metric && typeof goal.metric === "object") return "OUTCOME";
  return "PROCESS";
}

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

// ---- Micro-actions
const MICRO_ACTIONS = [
  { id: "micro_flexions", label: "Faire 10 flexions" },
  { id: "micro_mot", label: "Apprendre un mot" },
  { id: "micro_respiration", label: "10 respirations" },
  { id: "micro_eau", label: "Boire un verre d’eau" },
  { id: "micro_rangement", label: "Ranger 2 minutes" },
  { id: "micro_etirements", label: "Étirements rapides" },
];
const DEFAULT_BLOCK_ORDER = ["focus", "calendar", "micro", "notes"];

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

// Build a local date key without UTC shift (timezone-safe).
function toLocalDateKey(d) {
  if (!(d instanceof Date)) return "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// Parse a local date key at midday to avoid DST edge cases.
function fromLocalDateKey(key) {
  if (typeof key !== "string") return new Date();
  const [y, m, d] = key.split("-").map((v) => parseInt(v, 10));
  if (!y || !m || !d) return new Date();
  return new Date(y, m - 1, d, 12, 0, 0);
}

function normalizeBlockOrder(raw) {
  if (!Array.isArray(raw)) return [...DEFAULT_BLOCK_ORDER];
  const cleaned = raw.filter((id) => DEFAULT_BLOCK_ORDER.includes(id));
  for (const id of DEFAULT_BLOCK_ORDER) {
    if (!cleaned.includes(id)) cleaned.push(id);
  }
  return cleaned.length ? cleaned : [...DEFAULT_BLOCK_ORDER];
}

// ---- Drag & drop
function DragHandle({ setActivatorNodeRef, listeners, attributes }) {
  return (
    <button
      ref={setActivatorNodeRef}
      type="button"
      aria-label="Réorganiser"
      {...listeners}
      {...attributes}
      style={{
        width: 18,
        height: 18,
        padding: 0,
        border: 0,
        borderRadius: 6,
        background: "transparent",
        color: "rgba(255,255,255,0.5)",
        fontSize: 12,
        lineHeight: 1,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: "grab",
      }}
    >
      ⋮⋮
    </button>
  );
}

function SortableBlock({ id, children }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } =
    useSortable({ id });
  const scale = isDragging ? 1.02 : 1;
  const transformString = CSS.Transform.toString(transform);
  const style = {
    transform: transformString ? `${transformString} scale(${scale})` : `scale(${scale})`,
    transition,
    boxShadow: isDragging ? "0 16px 28px rgba(0,0,0,0.25)" : undefined,
  };

  return (
    <div ref={setNodeRef} style={style}>
      {typeof children === "function"
        ? children({ attributes, listeners, setActivatorNodeRef, isDragging })
        : children}
    </div>
  );
}

export default function Home({
  data,
  setData,
  onOpenLibrary,
  onOpenManageCategory,
  onOpenCreate,
  onOpenCreateCategory,
  onOpenSession,
  onDayOpen,
  onAddOccurrence,
}) {
  const safeData = data && typeof data === "object" ? data : {};
  const selectedDateKey = safeData.ui?.selectedDate || toLocalDateKey(new Date());
  const selectedDate = fromLocalDateKey(selectedDateKey);
  const localTodayKey = toLocalDateKey(new Date());
  const selectedStatus =
    selectedDateKey === localTodayKey ? "today" : selectedDateKey < localTodayKey ? "past" : "future";
  const canValidate = selectedStatus === "today";
  const canEdit = selectedStatus !== "past";
  const lockMessage = selectedStatus === "past" ? "Lecture seule" : "Disponible le jour J";

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
  const [blockOrder, setBlockOrder] = useState(() => {
    try {
      const stored = JSON.parse(localStorage.getItem("todayBlocksOrder"));
      return normalizeBlockOrder(stored);
    } catch (_) {
      return [...DEFAULT_BLOCK_ORDER];
    }
  });
  const [monthCursor, setMonthCursor] = useState(() => startOfMonth(selectedDate));

  // Refs
  const todayKeyRef = useRef(localTodayKey);
  const railRef = useRef(null);
  const railItemRefs = useRef(new Map());
  const railScrollRaf = useRef(null);
  const skipAutoCenterRef = useRef(false);
  const didInitSelectedDateRef = useRef(false);

  // Data slices
  const profile = safeData.profile || {};
  const categories = Array.isArray(safeData.categories) ? safeData.categories : [];
  const goals = Array.isArray(safeData.goals) ? safeData.goals : [];
  const sessions = Array.isArray(safeData.sessions) ? safeData.sessions : [];
  const checks = safeData.checks || {};
  const occurrences = Array.isArray(safeData.occurrences) ? safeData.occurrences : [];
  const dayChecks = useMemo(() => {
    const bucket = checks?.[selectedDateKey];
    const habits = Array.isArray(bucket?.habits) ? bucket.habits : [];
    const micro = Array.isArray(bucket?.micro) ? bucket.micro : [];
    return { habits, micro };
  }, [checks, selectedDateKey]);
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
      for (const [key, bucket] of Object.entries(checks)) {
        const habits = Array.isArray(bucket?.habits) ? bucket.habits : [];
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

    // If the user didn't touch the calendar during this browser session,
    // force Home to start on the real local day.
    let touched = false;
    try {
      touched = sessionStorage.getItem("home:selectedDateTouched") === "1";
    } catch (_) {
      touched = false;
    }

    if (!didInitSelectedDateRef.current) {
      didInitSelectedDateRef.current = true;
      if (!touched && raw !== today) {
        setData((prev) => ({
          ...prev,
          ui: { ...(prev.ui || {}), selectedDate: today },
        }));
        return;
      }
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
    try {
      localStorage.setItem("todayBlocksOrder", JSON.stringify(blockOrder));
    } catch (_) {
      // Ignore storage failures.
    }
  }, [blockOrder]);

  useEffect(() => {
    let next = "";
    try {
      next = localStorage.getItem(`dailyNote:${selectedDateKey}`) || "";
    } catch (_) {
      next = "";
    }
    setDailyNote(next);
  }, [selectedDateKey]);

  useEffect(() => {
    let next = { forme: "", humeur: "", motivation: "" };
    try {
      const raw = localStorage.getItem(`dailyNoteMeta:${selectedDateKey}`) || "";
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
    } catch (_) {
      // Ignore storage failures.
    }
    setNoteMeta(next);
  }, [selectedDateKey]);

  useEffect(() => {
    if (typeof setData !== "function") return;
    const id = setInterval(() => {
      const nowKey = toLocalDateKey(new Date());
      if (nowKey === todayKeyRef.current) return;
      const prevKey = todayKeyRef.current;
      todayKeyRef.current = nowKey;
      setData((prev) => {
        const prevUi = prev.ui || {};
        if (prevUi.selectedDate !== prevKey) return prev;
        return { ...prev, ui: { ...prevUi, selectedDate: nowKey } };
      });
    }, 60000);
    return () => clearInterval(id);
  }, [setData]);

  // Derived data
  // per-view category selection for Home (fallback to legacy)
  const homeSelectedCategoryId =
    safeData.ui?.selectedCategoryByView?.home || safeData.ui?.selectedCategoryId || null;

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
    return goals.filter((g) => g.categoryId === focusCategory.id && resolveGoalType(g) === "PROCESS");
  }, [goals, focusCategory?.id]);

  // Actions liées à l’objectif sélectionné (queued/active)
  const linkedHabits = useMemo(() => {
    if (!mainGoalId) return [];
    return processGoals.filter((g) => g.parentId === mainGoalId);
  }, [processGoals, mainGoalId]);

  // Actions actives uniquement
  const activeHabits = useMemo(() => {
    return linkedHabits.filter((g) => g.status === "active");
  }, [linkedHabits]);

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
      return parentId ? outcomeById.get(parentId) || null : null;
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
    const unique = new Set(Array.isArray(dayChecks.micro) ? dayChecks.micro : []);
    return Math.min(3, unique.size);
  }, [dayChecks.micro]);

  const hasActiveSession = Boolean(sessionForDay && sessionForDay.status === "partial");
  const canOpenSession = Boolean(canValidate && selectedGoal);

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
    const processAll = goals.filter((g) => resolveGoalType(g) === "PROCESS" && g.status === "active");
    const processIds = processAll.map((g) => g.id);
    const plannedPerDay = processIds.length;

    function getDoneIdsForDate(key) {
      const bucket = checks?.[key];
      const ids = new Set(Array.isArray(bucket?.habits) ? bucket.habits : []);
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
      const bucket = checks?.[key];
      const list = Array.isArray(bucket?.micro) ? bucket.micro : [];
      const unique = new Set(list);
      microDone14 += Math.min(3, unique.size);
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
    const offsets = Array.from({ length: 31 }, (_, i) => i - 15);
    return offsets.map((offset) => {
      const d = addDays(railAnchorDate, offset);
      const key = toLocalDateKey(d);
      const parts = key.split("-");
      return {
        key,
        date: d,
        day: parts[2] || "",
        month: parts[1] || "",
        isSelected: key === selectedDateKey,
        status: key === localTodayKey ? "today" : key < localTodayKey ? "past" : "future",
      };
    });
  }, [railAnchorDate, selectedDateKey, localTodayKey]);

  const calendarRangeLabel = useMemo(() => {
    try {
      const fmt = new Intl.DateTimeFormat("fr-FR", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      });
      return fmt.format(selectedDate);
    } catch {
      return selectedDateKey || "";
    }
  }, [selectedDate, selectedDateKey]);

  const selectedDateLabel =
    selectedStatus === "today" ? `${calendarRangeLabel} · Aujourd’hui` : calendarRangeLabel;

  const monthGrid = useMemo(() => buildMonthGrid(monthCursor), [monthCursor]);

  useEffect(() => {
    if (microState.dayKey === selectedDateKey) return;
    setMicroState(initMicroState(selectedDateKey));
  }, [microState.dayKey, selectedDateKey]);

  useEffect(() => {
    setMonthCursor(startOfMonth(selectedDate));
  }, [selectedDateKey]);

  useEffect(() => {
    // Lightweight in-app transition (GPU-friendly): opacity + translate.
    setCalendarPanePhase("enter");
    setCalendarPaneKey((k) => k + 1);
    const raf = requestAnimationFrame(() => {
      setCalendarPanePhase("enterActive");
    });
    return () => cancelAnimationFrame(raf);
  }, [calendarView]);

  // Handlers
  const setSelectedDate = useCallback(
    (nextKey) => {
      if (!nextKey || typeof setData !== "function") return;
      try {
        sessionStorage.setItem("home:selectedDateTouched", "1");
      } catch (_) {
        // ignore
      }
      setData((prev) => ({
        ...prev,
        ui: { ...(prev.ui || {}), selectedDate: nextKey },
      }));
    },
    [setData]
  );
  const handleDayOpen = useCallback(
    (nextKey) => {
      if (!nextKey) return;
      setSelectedDate(nextKey);
      if (typeof onDayOpen === "function") onDayOpen(nextKey);
    },
    [onDayOpen, setSelectedDate]
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
      setSelectedDate(closestKey);
    }
  }, [selectedDateKey, setSelectedDate]);

  const handleRailScroll = useCallback(() => {
    if (railScrollRaf.current) return;
    railScrollRaf.current = requestAnimationFrame(() => {
      railScrollRaf.current = null;
      updateSelectedFromScroll();
    });
  }, [updateSelectedFromScroll]);

  useEffect(() => {
    if (!selectedDateKey) return;
    if (skipAutoCenterRef.current) {
      skipAutoCenterRef.current = false;
      return;
    }
    requestAnimationFrame(() => scrollRailToKey(selectedDateKey, "auto"));
  }, [scrollRailToKey, selectedDateKey, railItems.length]);

  useEffect(() => {
    return () => {
      if (railScrollRaf.current) cancelAnimationFrame(railScrollRaf.current);
    };
  }, []);

  function openCreateFlow(kind) {
    if (kind === "category" && typeof onOpenCreateCategory === "function") {
      onOpenCreateCategory();
      return;
    }
    if (typeof onOpenCreate === "function") {
      onOpenCreate();
      return;
    }
    if (typeof onOpenLibrary === "function") onOpenLibrary();
  }

  function openSessionFlow() {
    if (!selectedGoal?.id || !canValidate || typeof setData !== "function") return;
    setData((prev) =>
      startSessionForDate(prev, selectedDateKey, {
        objectiveId: selectedGoal.id,
        habitIds: activeHabits.map((h) => h.id),
      })
    );
    if (typeof onOpenSession === "function") {
      onOpenSession({ categoryId: focusCategory?.id || null, dateKey: selectedDateKey });
    }
  }

  function setCategoryMainGoal(nextGoalId) {
    if (!nextGoalId || typeof setData !== "function") return;
    const g = goals.find((x) => x.id === nextGoalId) || null;
    if (!g || !focusCategory?.id || g.categoryId !== focusCategory.id) return;
    setData((prev) => setMainGoal(prev, nextGoalId));
  }

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 120, tolerance: 6 } })
  );

  const handleDragEnd = useCallback((event) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setBlockOrder((items) => {
      const oldIndex = items.indexOf(active.id);
      const newIndex = items.indexOf(over.id);
      if (oldIndex === -1 || newIndex === -1) return items;
      return arrayMove(items, oldIndex, newIndex);
    });
  }, []);

  const noteHistoryItems = useMemo(() => {
    if (!showNotesHistory) return [];
    try {
      const items = [];
      let history = [];
      try {
        const raw = localStorage.getItem("dailyNoteHistory") || "";
        const parsed = raw ? JSON.parse(raw) : [];
        if (Array.isArray(parsed)) history = parsed;
      } catch (_) {
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
        if (key.startsWith("dailyNote:")) {
          const dateKey = key.replace("dailyNote:", "");
          const note = localStorage.getItem(key) || "";
          const entry = entries.get(dateKey) || { dateKey, note: "", meta: {} };
          entry.note = note;
          entries.set(dateKey, entry);
        }
        if (key.startsWith("dailyNoteMeta:")) {
          const dateKey = key.replace("dailyNoteMeta:", "");
          let meta = {};
          try {
            const raw = localStorage.getItem(key) || "";
            const parsed = raw ? JSON.parse(raw) : null;
            if (parsed && typeof parsed === "object") meta = parsed;
          } catch (_) {
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

      return items.sort((a, b) => {
        const aTime = a.savedAt || 0;
        const bTime = b.savedAt || 0;
        if (aTime && bTime) return bTime - aTime;
        if (aTime) return -1;
        if (bTime) return 1;
        return (b.dateKey || "").localeCompare(a.dateKey || "");
      });
    } catch (_) {
      return [];
    }
  }, [showNotesHistory]);

  function updateNoteMeta(patch) {
    setNoteMeta((prev) => {
      const next = { ...prev, ...patch };
      try {
        localStorage.setItem(`dailyNoteMeta:${selectedDateKey}`, JSON.stringify(next));
      } catch (_) {
        // Ignore storage failures.
      }
      return next;
    });
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
      const raw = localStorage.getItem("dailyNoteHistory") || "";
      const parsed = raw ? JSON.parse(raw) : [];
      const history = Array.isArray(parsed) ? parsed : [];
      history.unshift(entry);
      localStorage.setItem("dailyNoteHistory", JSON.stringify(history));
    } catch (_) {
      // Ignore storage failures.
    }
    setDailyNote("");
    const nextMeta = { forme: "", humeur: "", motivation: "" };
    setNoteMeta(nextMeta);
    try {
      localStorage.setItem(`dailyNote:${selectedDateKey}`, "");
      localStorage.setItem(`dailyNoteMeta:${selectedDateKey}`, JSON.stringify(nextMeta));
    } catch (_) {
      // Ignore storage failures.
    }
  }


  // Render
  if (!categories.length) {
    return (
      <ScreenShell
        accent={getAccentForPage(safeData, "home")}
        backgroundImage={profile.whyImage || ""}
        headerTitle={<span className="textAccent" data-tour-id="today-title">Aujourd’hui</span>}
        headerSubtitle={<span data-tour-id="today-empty-subtitle">Aucune catégorie</span>}
      >
        <Card accentBorder>
          <div className="p18">
            <div className="titleSm">Aucune catégorie</div>
            <div className="small" style={{ marginTop: 6 }}>
              Ajoute une première catégorie pour commencer.
            </div>
            <div className="mt12">
              <Button
                onClick={() => openCreateFlow("category")}
                disabled={!canEdit}
                data-tour-id="today-empty-create-category"
              >
                Créer une catégorie
              </Button>
              {!canEdit ? <div className="sectionSub" style={{ marginTop: 8 }}>{lockMessage}</div> : null}
            </div>
          </div>
        </Card>
      </ScreenShell>
    );
  }

  const accent = focusCategory && focusCategory.color ? focusCategory.color : getAccentForPage(safeData, "home");
  const goalAccent = selectedGoal?.color || accent;
  const selectedDayAccent = goalAccentByDate.get(selectedDateKey) || goalAccent || accent;
  const backgroundImage = profile.whyImage || "";
  const catAccentVars = getCategoryAccentVars(accent);

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
        onClick={() => setShowDisciplineStats(true)}
        data-tour-id="today-stats-discipline"
      >
        <div className="small2" style={{ textAlign: "right" }}>
          Discipline
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
                width: `${Math.round(disciplineBreakdown.ratio * 100)}%`,
                height: "100%",
                background: "var(--accent)",
                borderRadius: 999,
              }}
            />
          </div>
          <div className="small2" style={{ minWidth: 36, textAlign: "right" }}>
            {disciplineBreakdown.score}%
          </div>
        </div>
      </button>

      {sessionBadgeLabel ? (
        <div className="mt10" style={{ display: "flex", justifyContent: "flex-end" }}>
          <span className="badge" style={{ borderColor: "var(--accent)", color: "var(--accent)" }}>
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
      headerTitle={<span className="textAccent" data-tour-id="today-title">Aujourd’hui</span>}
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

        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
          modifiers={[restrictToVerticalAxis, restrictToParentElement]}
        >
          <SortableContext items={blockOrder} strategy={verticalListSortingStrategy}>
            <div className="stack stackGap12">
              {blockOrder.map((blockId) => (
                <SortableBlock key={blockId} id={blockId}>
                  {({ attributes, listeners, setActivatorNodeRef }) => {
                    if (blockId === "focus") {
                      return (
                        <Card data-tour-id="today-focus-card">
                          <div className="p18">
                            <div className="cardSectionTitleRow">
                              <DragHandle
                                attributes={attributes}
                                listeners={listeners}
                                setActivatorNodeRef={setActivatorNodeRef}
                              />
                              <div className="cardSectionTitle">Focus du jour</div>
                            </div>
                            <div className="mt12">
                              <div className="small2">Catégorie</div>
                              <div
                                className="mt8 listItem catAccentRow"
                                style={catAccentVars}
                                data-tour-id="today-focus-category"
                              >
                                <div
                                  className="itemTitle"
                                  style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}
                                >
                                  {focusCategory?.name || "Catégorie"}
                                </div>
                              </div>
                            </div>

                            <div className="mt12">
                              <div className="small2">Objectif principal</div>
                            {outcomeGoals.length ? (
                              <div className="mt8 catAccentField liquidSelect" style={catAccentVars}>
                                <Select
                                  value={selectedGoal?.id || ""}
                                  onChange={(e) => setCategoryMainGoal(e.target.value)}
                                  style={{ fontSize: 16 }}
                                  disabled={!canEdit}
                                  data-tour-id="today-focus-goal-select"
                                  >
                                    <option value="" disabled>
                                      Choisir un objectif
                                    </option>
                                    {outcomeGoals.map((g) => (
                                      <option key={g.id} value={g.id}>
                                        {g.title || "Objectif"}
                                      </option>
                                    ))}
                                  </Select>
                                </div>
                              ) : (
                                <div className="mt8 small2">Aucun objectif principal pour cette catégorie.</div>
                              )}
                            </div>

                            <div className="mt12">
                              <div className="row" style={{ justifyContent: "flex-end" }}>
                                <Button onClick={openSessionFlow} disabled={!canOpenSession} data-tour-id="today-go">
                                  GO
                                </Button>
                              </div>
                              {!selectedGoal ? (
                                <div className="sectionSub" style={{ marginTop: 8 }}>
                                  Sélectionne un objectif pour activer GO.
                                </div>
                              ) : !activeHabits.length ? (
                                <div className="sectionSub" style={{ marginTop: 8 }}>
                                  Aucune action liée. Tu peux démarrer quand même, puis ajouter une action depuis Bibliothèque.
                                </div>
                              ) : !canValidate ? (
                                <div className="sectionSub" style={{ marginTop: 8 }}>
                                  Lecture seule.
                                </div>
                              ) : null}
                            </div>
                        </div>
                      </Card>
                    );
                  }

                  if (blockId === "calendar") {
                    return (
                      <Card data-tour-id="today-calendar-card">
                        <div className="p18">
                          <div className="row">
                            <div className="cardSectionTitleRow">
                              <DragHandle
                                attributes={attributes}
                                listeners={listeners}
                                setActivatorNodeRef={setActivatorNodeRef}
                              />
                              <div>
                                <div className="cardSectionTitle">Calendrier</div>
                                <div className="small2 mt8">{selectedDateLabel || "—"}</div>
                              </div>
                            </div>
                            <div className="row" style={{ gap: 8 }}>
                              {/*
                                Add isOnToday const before IconButton for "Revenir à aujourd’hui"
                              */}
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
                                data-tour-id="today-calendar-day"
                              >
                                Jour
                              </Button>
                              <Button
                                variant="ghost"
                                onClick={() => setCalendarView("month")}
                                disabled={calendarView === "month"}
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
                                  style={{
                                    scrollSnapType: "x mandatory",
                                    WebkitOverflowScrolling: "touch",
                                    overscrollBehaviorX: "contain",
                                  }}
                                >
                                  {railItems.map((item) => {
                                    const plannedCount = plannedByDate.get(item.key) || 0;
                                    const doneCount = doneByDate.get(item.key) || 0;
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
                                    return (
                                      <button
                                        key={dayKey}
                                        type="button"
                                        className={`dayPill${isSelected ? " dayPillActive" : ""}`}
                                        data-datekey={dayKey}
                                        data-planned={plannedCount}
                                        data-done={doneCount}
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
                              <DragHandle
                                attributes={attributes}
                                listeners={listeners}
                                setActivatorNodeRef={setActivatorNodeRef}
                              />
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
                                  const isMicroDone = dayChecks.micro.includes(item.id);
                                  const canAddMicro = canValidate && microDoneToday < 3 && !isMicroDone;
                                  return (
                                    <div key={item.uid} className="listItem catAccentRow" style={catAccentVars}>
                                      <div
                                        className="row"
                                        style={{ alignItems: "center", justifyContent: "space-between", gap: 10 }}
                                      >
                                        <div className="itemTitle" style={{ flex: 1, minWidth: 0 }}>
                                          {item.label}
                                        </div>
                                        <Button
                                          variant="ghost"
                                          disabled={!canAddMicro}
                                          onClick={() => {
                                            if (!canAddMicro) return;
                                            setData((prev) => {
                                              const nextChecks = { ...(prev.checks || {}) };
                                              const rawBucket = nextChecks[selectedDateKey];
                                              const dayBucket =
                                                rawBucket && typeof rawBucket === "object" ? { ...rawBucket } : {};
                                              const microIds = Array.isArray(dayBucket.micro)
                                                ? [...dayBucket.micro]
                                                : [];
                                              const unique = new Set(microIds);
                                              if (unique.size >= 3 || unique.has(item.id)) return prev;
                                              dayBucket.micro = [...microIds, item.id];
                                              nextChecks[selectedDateKey] = dayBucket;
                                              return { ...prev, checks: nextChecks };
                                            });
                                            setMicroState((prev) => {
                                              const remaining = prev.items.filter((i) => i.uid !== item.uid);
                                              const nextItem = MICRO_ACTIONS[prev.cursor % MICRO_ACTIONS.length];
                                              const next = nextItem
                                                ? {
                                                    uid: `${nextItem.id}-${selectedDateKey}-${Date.now()}`,
                                                    id: nextItem.id,
                                                    label: nextItem.label,
                                                  }
                                                : null;
                                              return {
                                                ...prev,
                                                cursor: (prev.cursor + 1) % MICRO_ACTIONS.length,
                                                items: next ? [...remaining, next] : remaining,
                                              };
                                            });
                                          }}
                                        >
                                          +1
                                        </Button>
                                      </div>
                                      {!canValidate ? (
                                        <div className="sectionSub" style={{ marginTop: 8 }}>
                                          {lockMessage}
                                        </div>
                                      ) : null}
                                    </div>
                                  );
                                })}
                              </div>
                            </>
                          ) : null}
                        </div>
                      </Card>
                    );
                  }

                    return (
                      <Card data-tour-id="today-notes-card">
                        <div className="p18">
                          <div className="row">
                            <div className="cardSectionTitleRow">
                              <DragHandle
                                attributes={attributes}
                                listeners={listeners}
                                setActivatorNodeRef={setActivatorNodeRef}
                              />
                              <div className="cardSectionTitle">Note du jour</div>
                            </div>
                            <div className="row" style={{ gap: 8 }}>
                              <IconButton
                                aria-label="Historique des notes"
                                onClick={() => setShowNotesHistory(true)}
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
                                const next = e.target.value;
                                setDailyNote(next);
                                try {
                                  localStorage.setItem(`dailyNote:${selectedDateKey}`, next);
                                } catch (_) {
                                  // Ignore storage failures (private mode, quota, etc.)
                                }
                              }}
                              placeholder="Écris une remarque, une idée ou un ressenti pour aujourd’hui…"
                              data-tour-id="today-notes-text"
                            />
                          </div>
                          <div className="mt12">
                            <div className="small2">Check-in rapide</div>
                            <div className="noteMetaGrid mt8" data-tour-id="today-notes-meta">
                              <div>
                                <div className="small2">Forme</div>
                                <Select
                                  value={noteMeta.forme || ""}
                                  onChange={(e) => updateNoteMeta({ forme: e.target.value })}
                                >
                                  <option value="" disabled>
                                    Choisir
                                  </option>
                                  <option value="Excellente">Excellente</option>
                                  <option value="Bonne">Bonne</option>
                                  <option value="Moyenne">Moyenne</option>
                                  <option value="Faible">Faible</option>
                                </Select>
                              </div>
                              <div>
                                <div className="small2">Humeur</div>
                                <Select
                                  value={noteMeta.humeur || ""}
                                  onChange={(e) => updateNoteMeta({ humeur: e.target.value })}
                                >
                                  <option value="" disabled>
                                    Choisir
                                  </option>
                                  <option value="Positif">Positif</option>
                                  <option value="Neutre">Neutre</option>
                                  <option value="Basse">Basse</option>
                                </Select>
                              </div>
                              <div>
                                <div className="small2">Motivation</div>
                                <input
                                  className="input"
                                  type="number"
                                  min="0"
                                  max="10"
                                  step="1"
                                  value={noteMeta.motivation || ""}
                                  onChange={(e) => updateNoteMeta({ motivation: e.target.value })}
                                  placeholder="0-10"
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
                  }}
                </SortableBlock>
              ))}
            </div>
          </SortableContext>
        </DndContext>
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
        <div className="modalBackdrop disciplineOverlay" onClick={() => setShowNotesHistory(false)}>
          <Card className="disciplineCard" onClick={(e) => e.stopPropagation()}>
            <div className="row" style={{ alignItems: "center", justifyContent: "space-between" }}>
              <div className="titleSm">Historique des notes</div>
              <button className="linkBtn" type="button" onClick={() => setShowNotesHistory(false)}>
                Fermer
              </button>
            </div>
            <div className="mt12 col" style={{ gap: 10, maxHeight: 320, overflow: "auto" }}>
              {noteHistoryItems.length ? (
                noteHistoryItems.map((item) => {
                  const meta = item.meta || {};
                  const metaParts = [];
                  if (meta.forme) metaParts.push(`Forme: ${meta.forme}`);
                  if (meta.humeur) metaParts.push(`Humeur: ${meta.humeur}`);
                  if (meta.motivation) metaParts.push(`Motivation: ${meta.motivation}/10`);
                  return (
                    <div key={item.id || item.dateKey} className="listItem">
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
