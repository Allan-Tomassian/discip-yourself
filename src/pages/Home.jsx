import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ScreenShell from "./_ScreenShell";
import { Button, Card, Select } from "../components/UI";
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

const MICRO_ACTIONS = [
  { id: "micro_flexions", label: "Faire 10 flexions" },
  { id: "micro_mot", label: "Apprendre un mot" },
  { id: "micro_respiration", label: "10 respirations" },
  { id: "micro_eau", label: "Boire un verre d’eau" },
  { id: "micro_rangement", label: "Ranger 2 minutes" },
  { id: "micro_etirements", label: "Étirements rapides" },
];

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

export default function Home({
  data,
  setData,
  onOpenLibrary,
  onOpenCreate,
  onOpenCreateCategory,
  onOpenSession,
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

  const [showWhy, setShowWhy] = useState(true);
  const [microState, setMicroState] = useState(() => initMicroState(selectedDateKey));
  const [showDayStats, setShowDayStats] = useState(false);
  const [showDisciplineStats, setShowDisciplineStats] = useState(false);
  const [showMonthPicker, setShowMonthPicker] = useState(false);
  const [monthCursor, setMonthCursor] = useState(() => startOfMonth(selectedDate));
  const todayKeyRef = useRef(localTodayKey);
  const railRef = useRef(null);
  const railItemRefs = useRef(new Map());
  const railScrollTimer = useRef(null);
  const skipAutoCenterRef = useRef(false);
  const profile = safeData.profile || {};
  const categories = Array.isArray(safeData.categories) ? safeData.categories : [];
  const goals = Array.isArray(safeData.goals) ? safeData.goals : [];
  const sessions = Array.isArray(safeData.sessions) ? safeData.sessions : [];
  const checks = safeData.checks || {};
  const dayChecks = useMemo(() => {
    const bucket = checks?.[selectedDateKey];
    const habits = Array.isArray(bucket?.habits) ? bucket.habits : [];
    const micro = Array.isArray(bucket?.micro) ? bucket.micro : [];
    return { habits, micro };
  }, [checks, selectedDateKey]);

  useEffect(() => {
    if (typeof setData !== "function") return;
    if (safeData.ui?.selectedDate) return;
    setData((prev) => ({
      ...prev,
      ui: { ...(prev.ui || {}), selectedDate: toLocalDateKey(new Date()) },
    }));
  }, [safeData.ui?.selectedDate, setData]);

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

  // per-view category selection for Home (fallback to legacy)
const homeSelectedCategoryId =
  safeData.ui?.selectedCategoryByView?.home || safeData.ui?.selectedCategoryId || null;

const focusCategory = useMemo(() => {
  if (!categories.length) return null;
  const selected = categories.find((c) => c.id === homeSelectedCategoryId) || null;
  if (selected) return selected;
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
  if (!focusCategory?.id || !mainGoalId) return null;
  return outcomeGoals.find((g) => g.id === mainGoalId) || null;
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

  // Habitudes liées à l’objectif sélectionné (queued/active)
  const linkedHabits = useMemo(() => {
    if (!mainGoalId) return [];
    return processGoals.filter((g) => g.parentId === mainGoalId);
  }, [processGoals, mainGoalId]);

  // Habitudes actives uniquement
  const activeHabits = useMemo(() => {
    return linkedHabits.filter((g) => g.status === "active");
  }, [linkedHabits]);

  const microItems = useMemo(() => {
    return microState.items;
  }, [microState.items]);

  const microDoneToday = useMemo(() => {
    const unique = new Set(Array.isArray(dayChecks.micro) ? dayChecks.micro : []);
    return Math.min(3, unique.size);
  }, [dayChecks.micro]);

  const hasActiveSession = Boolean(sessionForDay && sessionForDay.status === "partial");
  const canOpenSession = Boolean(canValidate && selectedGoal && activeHabits.length);

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

  const setSelectedDate = useCallback(
    (nextKey) => {
      if (!nextKey || typeof setData !== "function") return;
      setData((prev) => ({
        ...prev,
        ui: { ...(prev.ui || {}), selectedDate: nextKey },
      }));
    },
    [setData]
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
    if (railScrollTimer.current) clearTimeout(railScrollTimer.current);
    railScrollTimer.current = setTimeout(() => {
      updateSelectedFromScroll();
    }, 80);
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
      if (railScrollTimer.current) clearTimeout(railScrollTimer.current);
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
    if (!selectedGoal?.id || !activeHabits.length || typeof setData !== "function") return;
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


  if (!categories.length) {
    return (
      <ScreenShell
        accent={getAccentForPage(safeData, "home")}
        backgroundImage={profile.whyImage || ""}
        headerTitle={<span className="textAccent">Aujourd’hui</span>}
        headerSubtitle="Aucune catégorie"
      >
        <Card accentBorder>
          <div className="p18">
            <div className="titleSm">Aucune catégorie</div>
            <div className="small" style={{ marginTop: 6 }}>
              Ajoute une première catégorie pour commencer.
            </div>
            <div className="mt12">
              <Button onClick={() => openCreateFlow("category")} disabled={!canEdit}>
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
  const backgroundImage = profile.whyImage || "";
  const catAccentVars = getCategoryAccentVars(accent);

  const whyText = (profile.whyText || "").trim();
  const whyDisplay = whyText || "Ajoute ton pourquoi dans l’onboarding.";

  const headerRight = categories.length ? (
    <div style={{ minWidth: 180 }}>
      <button className="statButton" type="button" onClick={() => setShowDayStats(true)}>
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

      <button className="statButton mt10" type="button" onClick={() => setShowDisciplineStats(true)}>
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
      headerTitle={<span className="textAccent">Aujourd’hui</span>}
      headerSubtitle="Exécution"
      headerRight={headerRight}
    >
      <div className="col" style={{ maxWidth: 720, margin: "0 auto" }}>
          <div className="row" style={{ alignItems: "center", justifyContent: "space-between" }}>
            <div className="small2" style={{ flex: 1, minWidth: 0, whiteSpace: "normal" }}>
              {showWhy ? whyDisplay : "Pourquoi masqué"}
            </div>
            <button className="linkBtn" onClick={() => setShowWhy((v) => !v)} aria-label="Afficher ou masquer le pourquoi">
              {showWhy ? "Masquer 👁" : "Afficher 👁"}
            </button>
          </div>

          <Card style={{ marginTop: 12 }}>
            <div className="p18">
              <div className="sectionTitle textAccent">Focus du jour</div>
              <div className="mt12">
                <div className="small2">Catégorie</div>
                <div className="mt8 listItem catAccentRow" style={catAccentVars}>
                  <div className="itemTitle" style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {focusCategory?.name || "Catégorie"}
                  </div>
                </div>
              </div>

              <div className="mt12">
                <div className="small2">Objectif principal</div>
                {outcomeGoals.length ? (
                  <div className="mt8 catAccentField" style={catAccentVars}>
                    <Select
                      value={selectedGoal?.id || ""}
                      onChange={(e) => setCategoryMainGoal(e.target.value)}
                      style={{ fontSize: 16 }}
                      disabled={!canEdit}
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
                <Button onClick={openSessionFlow} disabled={!canOpenSession}>
                  GO
                </Button>
                {!selectedGoal ? (
                  <div className="sectionSub" style={{ marginTop: 8 }}>
                    Choisis un objectif principal.
                  </div>
                ) : !activeHabits.length ? (
                  <div className="sectionSub" style={{ marginTop: 8 }}>
                    Ajoute une habitude dans Bibliothèque &gt; Gérer.
                  </div>
                ) : !canValidate ? (
                  <div className="sectionSub" style={{ marginTop: 8 }}>
                    Lecture seule.
                  </div>
                ) : null}
              </div>
            </div>
          </Card>

          <Card style={{ marginTop: 12 }}>
            <div className="p18">
              <div className="row" style={{ alignItems: "center", justifyContent: "space-between" }}>
                <div>
                  <div className="sectionTitle textAccent">Calendrier</div>
                  <div className="small2 mt8">
                    {selectedDateLabel || "—"}
                  </div>
                </div>
                <div className="row" style={{ gap: 8 }}>
                  <Button
                    variant="ghost"
                    onClick={() => {
                      const today = toLocalDateKey(new Date());
                      setSelectedDate(today);
                      requestAnimationFrame(() => scrollRailToKey(today));
                    }}
                  >
                    Aujourd’hui
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => setShowMonthPicker(true)}
                    style={{ borderRadius: 999, width: 36, height: 36, padding: 0 }}
                  >
                    +
                  </Button>
                </div>
              </div>
              <div className="calendarRailWrap mt12">
                <div className="calendarSelector" aria-hidden="true">
                  <span className="calendarSelectorDot" />
                </div>
                <div
                  className="calendarRail scrollNoBar"
                  ref={railRef}
                  onScroll={handleRailScroll}
                >
                  {railItems.map((item) => (
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
                      onClick={() => {
                        scrollRailToKey(item.key);
                        setSelectedDate(item.key);
                      }}
                      type="button"
                    >
                      <div className="dayPillDay">{item.day}</div>
                      <div className="dayPillMonth">/{item.month}</div>
                    </button>
                  ))}
                </div>
              </div>
              <div className="sectionSub" style={{ marginTop: 8 }}>
                {selectedStatus === "past" ? "Lecture seule" : selectedStatus === "today" ? "Aujourd’hui" : "À venir"}
              </div>
            </div>
          </Card>

          <Card style={{ marginTop: 12 }}>
            <div className="p18">
              <div className="sectionTitle textAccent">Micro-actions</div>
              <div className="sectionSub">Trois impulsions simples</div>
              <div className="mt12 col" style={{ gap: 10 }}>
                {microItems.map((item) => {
                  const isMicroDone = dayChecks.micro.includes(item.id);
                  const canAddMicro = canValidate && microDoneToday < 3 && !isMicroDone;
                  return (
                    <div key={item.uid} className="listItem catAccentRow" style={catAccentVars}>
                      <div className="row" style={{ alignItems: "center", justifyContent: "space-between", gap: 10 }}>
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
                              const microIds = Array.isArray(dayBucket.micro) ? [...dayBucket.micro] : [];
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
                      {!canValidate ? <div className="sectionSub" style={{ marginTop: 8 }}>{lockMessage}</div> : null}
                    </div>
                  );
                })}
              </div>
            </div>
          </Card>
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
                <div className="small2">Habitudes du jour</div>
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
      {showMonthPicker ? (
        <div className="modalBackdrop disciplineOverlay" onClick={() => setShowMonthPicker(false)}>
          <Card className="disciplineCard" onClick={(e) => e.stopPropagation()}>
            <div className="row" style={{ alignItems: "center", justifyContent: "space-between" }}>
              <div className="row" style={{ alignItems: "center", gap: 8 }}>
                <Button variant="ghost" onClick={() => setMonthCursor((d) => addMonths(d, -1))}>
                  ←
                </Button>
                <div className="titleSm" style={{ minWidth: 140, textAlign: "center" }}>
                  {getMonthLabelFR(monthCursor)}
                </div>
                <Button variant="ghost" onClick={() => setMonthCursor((d) => addMonths(d, 1))}>
                  →
                </Button>
              </div>
              <button className="linkBtn" type="button" onClick={() => setShowMonthPicker(false)}>
                Fermer
              </button>
            </div>
            <div className="small2 mt10">Période rapide: {calendarRangeLabel || "—"}</div>
            <div
              className="mt12"
              style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 6, textAlign: "center" }}
            >
              {["L", "M", "M", "J", "V", "S", "D"].map((label, idx) => (
                <div key={`${label}-${idx}`} className="small2">
                  {label}
                </div>
              ))}
              {monthGrid.map((cell) => {
                const localKey = toLocalDateKey(cell.dateObj);
                const isSelected = localKey === selectedDateKey;
                const isCurrentMonth = cell.inMonth;
                return (
                  <button
                    key={localKey}
                    type="button"
                    className={`dayPill${isSelected ? " dayPillActive" : ""}`}
                    onClick={() => {
                      if (!localKey) return;
                      setSelectedDate(localKey);
                      setShowMonthPicker(false);
                    }}
                    style={{
                      width: "100%",
                      height: 44,
                      borderRadius: 12,
                      padding: 0,
                      opacity: isCurrentMonth ? 1 : 0.4,
                    }}
                  >
                    <div className="dayPillDay">{cell.dayNumber}</div>
                  </button>
                );
              })}
            </div>
          </Card>
        </div>
      ) : null}
    </ScreenShell>
  );
}
