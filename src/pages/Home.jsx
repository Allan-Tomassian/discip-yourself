import React, { useEffect, useMemo, useState } from "react";
import ScreenShell from "./_ScreenShell";
import { Button, Card, Select } from "../components/UI";
import { addDays, dayKey, getDayStatus, todayKey } from "../utils/dates";
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
  const key = dayKeyValue || todayKey(new Date());
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

export default function Home({
  data,
  setData,
  onOpenLibrary,
  onOpenCreate,
  onOpenCreateCategory,
  onOpenSession,
}) {
  const safeData = data && typeof data === "object" ? data : {};
  const selectedDateKey = safeData.ui?.selectedDate || todayKey();
  const selectedDate = new Date(`${selectedDateKey}T12:00:00`);
  const selectedStatus = getDayStatus(selectedDateKey, new Date());
  const canValidate = selectedStatus === "today";
  const canEdit = selectedStatus !== "past";
  const lockMessage = selectedStatus === "past" ? "Lecture seule" : "Disponible le jour J";

  const [showWhy, setShowWhy] = useState(true);
  const [microState, setMicroState] = useState(() => initMicroState(selectedDateKey));
  const [showDayStats, setShowDayStats] = useState(false);
  const [showDisciplineStats, setShowDisciplineStats] = useState(false);
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
        const key = dayKey(addDays(now, -i));
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
      const key = dayKey(addDays(now, -i));
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

  const railItems = useMemo(() => {
    const offsets = [-3, -2, -1, 0, 1, 2, 3];
    return offsets.map((offset) => {
      const d = addDays(selectedDate, offset);
      const key = dayKey(d);
      const parts = key.split("-");
      return {
        key,
        day: parts[2] || "",
        month: parts[1] || "",
        isSelected: key === selectedDateKey,
        status: getDayStatus(key, new Date()),
      };
    });
  }, [selectedDate, selectedDateKey]);

  useEffect(() => {
    if (microState.dayKey === selectedDateKey) return;
    setMicroState(initMicroState(selectedDateKey));
  }, [microState.dayKey, selectedDateKey]);

  // Home focus change should NOT overwrite legacy selectedCategoryId
  function setFocusCategory(nextId) {
    if (!nextId || typeof setData !== "function") return;
    setData((prev) => {
      const prevUi = prev.ui || {};
      const prevByView =
        prevUi.selectedCategoryByView && typeof prevUi.selectedCategoryByView === "object"
          ? prevUi.selectedCategoryByView
          : {};
      return {
        ...prev,
        ui: {
          ...prevUi,
          selectedCategoryByView: {
            ...prevByView,
            home: nextId,
          },
        },
      };
    });
  }

  function setSelectedDate(nextKey) {
    if (!nextKey || typeof setData !== "function") return;
    setData((prev) => ({
      ...prev,
      ui: { ...(prev.ui || {}), selectedDate: nextKey },
    }));
  }

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
    if (typeof onOpenSession === "function") onOpenSession();
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
                background: accent,
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
      <div className="row dayRailWrap" style={{ alignItems: "flex-start", gap: 12 }}>
        <div className="col" style={{ flex: 1, minWidth: 0 }}>
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
                <div className="mt8 catAccentField" style={catAccentVars}>
                  <Select
                    value={focusCategory?.id || ""}
                    onChange={(e) => setFocusCategory(e.target.value)}
                    style={{ fontSize: 16 }}
                    disabled={!canEdit}
                  >
                    <option value="" disabled>
                      Choisir une catégorie
                    </option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </Select>
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
                  Passer à l’action
                </Button>
                {!activeHabits.length ? (
                  <div className="sectionSub" style={{ marginTop: 8 }}>
                    Ajoute une habitude dans Bibliothèque &gt; Gérer.
                  </div>
                ) : null}
                {!canValidate ? <div className="sectionSub" style={{ marginTop: 8 }}>{lockMessage}</div> : null}
              </div>
            </div>
          </Card>

          <Card style={{ marginTop: 12 }}>
            <div className="p18">
              <div className="sectionTitle textAccent">Habitudes</div>
              <div className="sectionSub">Du jour</div>

              {selectedGoal ? (
                activeHabits.length ? (
                  <div className="mt12 col" style={{ gap: 10 }}>
                    {activeHabits.map((h) => {
                      const done = doneHabitIds.has(h.id);
                      return (
                        <div key={h.id} className="listItem catAccentRow" style={catAccentVars}>
                          <div className="row" style={{ alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                            <div style={{ minWidth: 0 }}>
                              <div className="itemTitle" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                {h.title || "Habitude"}
                              </div>
                              <div className="sectionSub">{done ? "Fait aujourd’hui" : "À faire"}</div>
                            </div>
                            <span className="badge">{done ? "Fait" : "À faire"}</span>
                          </div>
                          {!canValidate ? <div className="sectionSub" style={{ marginTop: 8 }}>{lockMessage}</div> : null}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="mt12 col">
                  <div className="small2">Aucune habitude active liée à l’objectif.</div>
                  <div className="mt10">
                      <Button variant="ghost" onClick={openCreateFlow} disabled={!canEdit}>
                        Créer
                      </Button>
                      {!canEdit ? <div className="sectionSub" style={{ marginTop: 8 }}>{lockMessage}</div> : null}
                  </div>
                </div>
                )
              ) : (
                <div className="mt12 col">
                <div className="small2">Sélectionne un objectif principal pour afficher les habitudes.</div>
                <div className="mt10">
                    <Button variant="ghost" onClick={openCreateFlow} disabled={!canEdit}>
                      Créer
                    </Button>
                    {!canEdit ? <div className="sectionSub" style={{ marginTop: 8 }}>{lockMessage}</div> : null}
                </div>
              </div>
              )}
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

        <div className="dayRail">
          {railItems.map((item) => (
            <button
              key={item.key}
              className={`dayPill${item.isSelected ? " dayPillActive" : ""}`}
              onClick={() => setSelectedDate(item.key)}
              type="button"
            >
              <div className="dayPillDay">{item.day}</div>
              <div className="dayPillMonth">/{item.month}</div>
            </button>
          ))}
        </div>
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
    </ScreenShell>
  );
}
