import React, { useEffect, useMemo, useState } from "react";
import ScreenShell from "./_ScreenShell";
import { Button, Card, Select } from "../components/UI";
import FocusCategoryPicker from "../components/FocusCategoryPicker";
import { startOfWeekKey, todayKey, yearKey } from "../utils/dates";
import { activateGoal, setMainGoal } from "../logic/goals";
import { incHabit } from "../logic/habits";
import { getBackgroundCss, getAccentForPage } from "../utils/_theme";

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

const DEFAULT_DAYS = [1, 2, 3, 4, 5, 6, 7];
const DEFAULT_SLOTS = ["09:00"];

function getDayIndex(d) {
  const day = d.getDay();
  return day === 0 ? 7 : day;
}

function getScheduleSlots(habit, now) {
  const schedule = habit?.schedule;
  if (!schedule || typeof schedule !== "object") return ["Aujourd’hui"];
  const days =
    Array.isArray(schedule.daysOfWeek) && schedule.daysOfWeek.length ? schedule.daysOfWeek : DEFAULT_DAYS;
  const slots = Array.isArray(schedule.timeSlots) ? schedule.timeSlots.filter(Boolean) : [];
  const dayIndex = getDayIndex(now);
  if (days.length && !days.includes(dayIndex)) return [];
  if (!slots.length) return ["Aujourd’hui"];
  return slots;
}

function getHabitCountForToday(habit, checks, now) {
  const cadence = habit?.cadence || "DAILY";
  const bucket = checks?.[habit.id] || { daily: {}, weekly: {}, yearly: {} };
  if (cadence === "DAILY") {
    const k = todayKey(now);
    return bucket.daily?.[k] || 0;
  }
  if (cadence === "YEARLY") {
    const y = yearKey(now);
    return bucket.yearly?.[y] || 0;
  }
  const wk = startOfWeekKey(now);
  return bucket.weekly?.[wk] || 0;
}

export default function Home({ data, setData, onOpenLibrary, onOpenPlan }) {
  const [showWhy, setShowWhy] = useState(true);
  const [whyExpanded, setWhyExpanded] = useState(false);
  const [activationByHabitId, setActivationByHabitId] = useState({});

  const safeData = data && typeof data === "object" ? data : {};
  const profile = safeData.profile || {};
  const categories = Array.isArray(safeData.categories) ? safeData.categories : [];
  const goals = Array.isArray(safeData.goals) ? safeData.goals : [];

  const today = todayKey();
  const todayChecks = safeData.ui?.processChecks || {};

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

  const outcomeGoals = useMemo(() => {
    if (!focusCategory?.id) return [];
    return goals.filter((g) => g.categoryId === focusCategory.id && resolveGoalType(g) === "OUTCOME");
  }, [goals, focusCategory?.id]);

  const selectedGoal = useMemo(() => {
    if (!focusCategory?.id) return null;
    const mainId = typeof focusCategory?.mainGoalId === "string" ? focusCategory.mainGoalId : null;
    const main = mainId ? outcomeGoals.find((g) => g.id === mainId) : null;
    if (main) return main;
    const active = outcomeGoals.find((g) => g.status === "active") || null;
    return active || outcomeGoals[0] || null;
  }, [focusCategory?.id, focusCategory?.mainGoalId, outcomeGoals]);

  const processGoals = useMemo(() => {
    if (!focusCategory?.id) return [];
    return goals.filter((g) => g.categoryId === focusCategory.id && resolveGoalType(g) === "PROCESS");
  }, [goals, focusCategory?.id]);

  // Habitudes liées à l’objectif sélectionné (peuvent être queued/active)
  const linkedHabits = useMemo(() => {
    if (!selectedGoal?.id) return [];
    return processGoals.filter((g) => g.parentId === selectedGoal.id);
  }, [processGoals, selectedGoal?.id]);

  // Habitudes actives uniquement (celles qui doivent apparaître sur Aujourd’hui > Action du jour)
  const activeHabits = useMemo(() => {
    return linkedHabits.filter((g) => g.status === "active");
  }, [linkedHabits]);

  // Next habit to do today among ACTIVE only
  const nextHabit = useMemo(() => {
    if (!activeHabits.length) return null;
    return activeHabits.find((g) => !todayChecks?.[g.id]?.[today]) || null;
  }, [activeHabits, todayChecks, today]);

  const slotItems = useMemo(() => {
    const now = new Date();
    const checks = safeData.checks || {};
    return activeHabits.flatMap((habit) => {
      const slots = getScheduleSlots(habit, now);
      if (!slots.length) return [];
      const count = getHabitCountForToday(habit, checks, now);
      return slots.map((slot, index) => ({
        id: `${habit.id}:${index}`,
        habit,
        label: slot,
        index,
        done: count >= index + 1,
      }));
    });
  }, [activeHabits, safeData.checks]);

  // Cursor habit (small selector for "Action du jour")
  const [habitCursorId, setHabitCursorId] = useState(null);

  useEffect(() => {
    const ids = activeHabits.map((h) => h.id);
    if (!ids.length) {
      setHabitCursorId(null);
      return;
    }
    if (nextHabit?.id) {
      setHabitCursorId(nextHabit.id);
      return;
    }
    if (habitCursorId && ids.includes(habitCursorId)) return;
    setHabitCursorId(ids[0]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusCategory?.id, selectedGoal?.id, activeHabits, nextHabit?.id]);

  const currentHabit = useMemo(() => {
    if (!activeHabits.length) return null;
    if (habitCursorId) return activeHabits.find((h) => h.id === habitCursorId) || activeHabits[0];
    return nextHabit || activeHabits[0];
  }, [activeHabits, habitCursorId, nextHabit]);

  const currentHabitDone = currentHabit ? Boolean(todayChecks?.[currentHabit.id]?.[today]) : false;

  function cycleHabit(dir) {
    if (!activeHabits.length) return;
    const idx = Math.max(0, activeHabits.findIndex((h) => h.id === (currentHabit?.id || "")));
    const nextIdx = (idx + dir + activeHabits.length) % activeHabits.length;
    setHabitCursorId(activeHabits[nextIdx].id);
  }

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

  // Open Plan with category context (+ optional openGoalEditId)
  function openPlanWith(categoryId, openGoalEditId) {
    if (!categoryId || typeof setData !== "function") return;
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
          selectedCategoryId: categoryId,
          openGoalEditId,
          selectedCategoryByView: {
            ...prevByView,
            plan: categoryId,
          },
        },
      };
    });
    if (typeof onOpenPlan === "function") onOpenPlan();
  }

  function markDoneToday(goalId) {
    if (!goalId || typeof setData !== "function") return;
    const g = goals.find((x) => x.id === goalId) || null;
    if (!g || resolveGoalType(g) !== "PROCESS") return;
    setData((prev) => {
      const prevUi = prev.ui || {};
      const prevChecks = prevUi.processChecks || {};
      const nextGoalChecks = { ...(prevChecks[goalId] || {}) };
      nextGoalChecks[today] = true;
      return {
        ...prev,
        ui: {
          ...prevUi,
          processChecks: { ...prevChecks, [goalId]: nextGoalChecks },
        },
      };
    });
  }

  function setCategoryMainGoal(nextGoalId) {
    if (!nextGoalId || typeof setData !== "function") return;
    const g = goals.find((x) => x.id === nextGoalId) || null;
    if (!g || !focusCategory?.id || g.categoryId !== focusCategory.id) return;
    setData((prev) => setMainGoal(prev, nextGoalId));
  }

  function activateHabitNow(goalId) {
    if (!goalId || typeof setData !== "function") return;

    const now = new Date();
    let activationMeta = null;

    setData((prev) => {
      const res = activateGoal(prev, goalId, { navigate: false, now });

      // Extract activation feedback (blocked/reason/conflicts) from either shape
      if (res && typeof res === "object" && !Array.isArray(res)) {
        const blocked = Boolean(res.blocked);
        const reason = typeof res.reason === "string" ? res.reason : "";
        const conflicts = Array.isArray(res.conflicts) ? res.conflicts : [];
        activationMeta = blocked || reason || conflicts.length ? { blocked, reason, conflicts, at: now.toISOString() } : null;
      }

      // Support both return shapes:
      // - legacy: { state: nextState, ... }
      // - direct: nextState
      if (res && typeof res === "object" && res.state && typeof res.state === "object") return res.state;
      if (res && typeof res === "object" && (res.goals || res.categories || res.ui)) return res;
      return prev;
    });

    // Update local UI feedback OUTSIDE the setData updater (React-safe)
    if (activationMeta) {
      setActivationByHabitId((m) => ({
        ...(m && typeof m === "object" ? m : {}),
        [goalId]: activationMeta,
      }));
    } else {
      setActivationByHabitId((m) => {
        if (!m || typeof m !== "object") return {};
        const next = { ...m };
        delete next[goalId];
        return next;
      });
    }
  }

  function startHabitNow(goalId) {
    if (!goalId || typeof setData !== "function") return;

    const now = new Date();
    const hh = String(now.getHours()).padStart(2, "0");
    const mm = String(now.getMinutes()).padStart(2, "0");
    // Keep startAt consistent with the rest of the app (ex: 2025-12-30T09:00)
    const nowLocal = `${todayKey(now)}T${hh}:${mm}`;

    let activationMeta = null;

    setData((prev) => {
      const prevGoals = Array.isArray(prev.goals) ? prev.goals : [];
      const nextGoals = prevGoals.map((g) => (g.id === goalId ? { ...g, startAt: nowLocal } : g));
      const seeded = { ...prev, goals: nextGoals };

      const res = activateGoal(seeded, goalId, { navigate: false, now });

      // Extract activation feedback (blocked/reason/conflicts) from either shape
      if (res && typeof res === "object" && !Array.isArray(res)) {
        const blocked = Boolean(res.blocked);
        const reason = typeof res.reason === "string" ? res.reason : "";
        const conflicts = Array.isArray(res.conflicts) ? res.conflicts : [];
        activationMeta = blocked || reason || conflicts.length ? { blocked, reason, conflicts, at: now.toISOString() } : null;
      }

      // Support both return shapes:
      // - legacy: { state: nextState, ... }
      // - direct: nextState
      if (res && typeof res === "object" && res.state && typeof res.state === "object") return res.state;
      if (res && typeof res === "object" && (res.goals || res.categories || res.ui)) return res;
      return seeded;
    });

    // Update local UI feedback OUTSIDE the setData updater (React-safe)
    if (activationMeta) {
      setActivationByHabitId((m) => ({
        ...(m && typeof m === "object" ? m : {}),
        [goalId]: activationMeta,
      }));
    } else {
      setActivationByHabitId((m) => {
        if (!m || typeof m !== "object") return {};
        const next = { ...m };
        delete next[goalId];
        return next;
      });
    }
  }

  if (!categories.length) {
    return (
      <ScreenShell
        accent={getAccentForPage(safeData, "home")}
        backgroundCss={getBackgroundCss({ data: safeData, pageId: "home", image: profile.whyImage || "" })}
        backgroundImage={profile.whyImage || ""}
        headerTitle="Aujourd’hui"
        headerSubtitle="Aucune catégorie"
      >
        <Card accentBorder>
          <div className="p18">
            <div className="titleSm">Aucune catégorie</div>
            <div className="small" style={{ marginTop: 6 }}>
              Ajoute une première catégorie pour commencer.
            </div>
            <div className="mt12">
              <Button onClick={() => (typeof onOpenLibrary === "function" ? onOpenLibrary() : null)}>
                Ouvrir la bibliothèque
              </Button>
            </div>
          </div>
        </Card>
      </ScreenShell>
    );
  }

  const accent = focusCategory && focusCategory.color ? focusCategory.color : getAccentForPage(safeData, "home");
  const backgroundImage = profile.whyImage || "";
  const backgroundCss = getBackgroundCss({ data: safeData, pageId: "home", image: backgroundImage });

  const whyText = (profile.whyText || "").trim();
  const whyDisplay = whyText || "Ajoute ton pourquoi dans l’onboarding.";
  const WHY_LIMIT = 150;
  const hasLongWhy = whyDisplay.length > WHY_LIMIT;
  const visibleWhy =
    !showWhy ? "Pourquoi masqué" : whyExpanded || !hasLongWhy ? whyDisplay : `${whyDisplay.slice(0, WHY_LIMIT)}…`;

  const hasLinkedHabits = linkedHabits.length > 0;
  const hasActiveHabits = activeHabits.length > 0;

  return (
    <ScreenShell
      accent={accent}
      backgroundCss={backgroundCss}
      backgroundImage={backgroundImage}
      headerTitle="Aujourd’hui"
      headerSubtitle="Exécution"
    >
      <div className="row" style={{ alignItems: "center", justifyContent: "space-between" }}>
        <div
          className="small2"
          style={{
            flex: 1,
            minWidth: 0,
            whiteSpace: showWhy && whyExpanded ? "normal" : "nowrap",
            overflow: showWhy && whyExpanded ? "visible" : "hidden",
            textOverflow: showWhy && whyExpanded ? "clip" : "ellipsis",
          }}
        >
          {visibleWhy}
        </div>
        <button className="linkBtn" onClick={() => setShowWhy((v) => !v)} aria-label="Afficher ou masquer le pourquoi">
          {showWhy ? "Masquer 👁" : "Afficher 👁"}
        </button>
      </div>

      {showWhy && hasLongWhy ? (
        <div className="row" style={{ justifyContent: "flex-end", marginTop: 6 }}>
          <button className="linkBtn" onClick={() => setWhyExpanded((v) => !v)}>
            {whyExpanded ? "Réduire" : "Afficher plus"}
          </button>
        </div>
      ) : null}

      <div className="mt12">
        <FocusCategoryPicker
          categories={categories}
          value={focusCategory?.id || ""}
          onChange={setFocusCategory}
          label="Focus sur une catégorie"
          emptyLabel="Catégorie à configurer"
        />
      </div>

      <Card accentBorder style={{ marginTop: 12, borderColor: accent }}>
        <div className="p18">
          <div className="titleSm">Objectif</div>
          <div className="small2">Sélectionné pour aujourd’hui</div>

          {selectedGoal ? (
            <div className="mt12 col">
              <div style={{ fontWeight: 800, fontSize: 18 }}>{selectedGoal.title || "Objectif"}</div>

              {outcomeGoals.length > 1 ? (
                <div className="mt10">
                  <div className="small" style={{ marginBottom: 6 }}>
                    Objectif principal de la catégorie
                  </div>
                  <Select
                    value={selectedGoal.id}
                    onChange={(e) => setCategoryMainGoal(e.target.value)}
                    style={{ fontSize: 16 }}
                  >
                    {outcomeGoals.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.title || "Objectif"}
                      </option>
                    ))}
                  </Select>
                </div>
              ) : (
                <div className="small2" style={{ marginTop: 6, opacity: 0.9 }}>
                  Objectif principal de la catégorie
                </div>
              )}

              <div className="mt10">
                <Button variant="ghost" onClick={() => openPlanWith(focusCategory?.id, null)}>
                  Gérer dans Plan
                </Button>
              </div>
            </div>
          ) : (
            <div className="mt12 col">
              <div className="small2">Aucun objectif dans cette catégorie.</div>
              <div className="mt10">
                <Button onClick={() => openPlanWith(focusCategory?.id, "__new_outcome__")}>Créer un objectif</Button>
              </div>
            </div>
          )}
        </div>
      </Card>

      <Card accentBorder style={{ marginTop: 12, borderColor: accent }}>
        <div className="p18">
          <div className="titleSm">Habitudes</div>
          <div className="small2">Liées à l’objectif sélectionné</div>

          {hasLinkedHabits ? (
            <div className="mt12 col" style={{ gap: 10 }}>
              {linkedHabits.map((h) => {
                const isActive = h.status === "active";
                return (
                  <div
                    key={h.id}
                    className="listItem"
                    style={{
                      borderLeft: `3px solid ${isActive ? accent : "rgba(255,255,255,.18)"}`,
                      paddingLeft: 12,
                    }}
                  >
                    <div className="row" style={{ alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {h.title || "Habitude"}
                        </div>
                        <div className="small2" style={{ opacity: 0.85 }}>
                          {isActive ? "Active" : "À activer"}
                        </div>
                      </div>
                      {!isActive ? (
                        <Button variant="ghost" onClick={() => activateHabitNow(h.id)}>
                          Activer
                        </Button>
                      ) : null}
                    </div>
                    {/* Activation feedback UI */}
                    {!isActive && activationByHabitId?.[h.id]?.blocked ? (
                      <div className="mt10" style={{ opacity: 0.95 }}>
                        <div className="small2" style={{ marginBottom: 8 }}>
                          Activation bloquée
                          {activationByHabitId[h.id].reason ? ` · ${activationByHabitId[h.id].reason}` : ""}
                        </div>
                        {activationByHabitId[h.id].conflicts?.length ? (
                          <div className="small2" style={{ opacity: 0.9, marginBottom: 8 }}>
                            {activationByHabitId[h.id].conflicts.slice(0, 4).map((c, idx) => (
                              <div key={idx}>• {String(c)}</div>
                            ))}
                          </div>
                        ) : null}
                        <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
                          <Button variant="ghost" onClick={() => openPlanWith(focusCategory?.id, h.id)}>
                            Modifier la date
                          </Button>
                          <Button onClick={() => startHabitNow(h.id)}>Démarrer maintenant</Button>
                        </div>
                      </div>
                    ) : null}
                  </div>
                );
              })}

              {hasActiveHabits ? (
                <div className="mt6 col">
                  <div className="small2">Micro-actions du jour</div>
                  {slotItems.length ? (
                    <div className="mt10 col">
                      {slotItems.map((item) => (
                        <div key={item.id} className="listItem">
                          <div className="row" style={{ alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                            <div className="small2" style={{ flex: 1, minWidth: 0 }}>
                              {item.label && item.label !== "Aujourd’hui"
                                ? `${item.label} · ${item.habit.title || "Habitude"}`
                                : `Aujourd’hui · ${item.habit.title || "Habitude"}`}
                            </div>
                            <Button
                              variant="ghost"
                              disabled={item.done}
                              onClick={() =>
                                setData((prev) => {
                                  const next = incHabit(prev, item.habit.id);
                                  return next && typeof next === "object" ? next : prev;
                                })
                              }
                            >
                              {item.done ? "Validé" : "Valider"}
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="mt10 small2">Aucune micro-action aujourd’hui.</div>
                  )}
                </div>
              ) : null}

              {!hasActiveHabits ? (
                <div className="small2" style={{ opacity: 0.9 }}>
                  Active au moins une habitude pour l’exécuter dans “Action du jour”.
                </div>
              ) : null}

              <div className="mt10">
                <Button variant="ghost" onClick={() => openPlanWith(focusCategory?.id, null)}>
                  Gérer dans Plan
                </Button>
              </div>
            </div>
          ) : (
            <div className="mt12 col">
              <div className="small2">Aucune habitude liée.</div>
              <div className="mt10">
                <Button onClick={() => openPlanWith(focusCategory?.id, selectedGoal ? "__new_process__" : "__new_outcome__")}>
                  Passer à l’action
                </Button>
              </div>
            </div>
          )}
        </div>
      </Card>

      <Card accentBorder style={{ marginTop: 12, borderColor: accent }}>
        <div className="p18">
          <div className="titleSm">Action du jour</div>

          {currentHabit ? (
            <div className="mt12 col">
              <div className="row" style={{ alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                <div
                  style={{
                    fontWeight: 800,
                    fontSize: 18,
                    minWidth: 0,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {currentHabit.title || "Habitude"}
                </div>

                {activeHabits.length > 1 ? (
                  <div className="row" style={{ gap: 6 }}>
                    <button className="btn btnGhost" onClick={() => cycleHabit(-1)} aria-label="Habitude précédente">
                      ▲
                    </button>
                    <button className="btn btnGhost" onClick={() => cycleHabit(1)} aria-label="Habitude suivante">
                      ▼
                    </button>
                  </div>
                ) : null}
              </div>

              <div className="mt12 row" style={{ alignItems: "center", justifyContent: "space-between" }}>
                <Button onClick={() => markDoneToday(currentHabit.id)} disabled={currentHabitDone}>
                  {currentHabitDone ? "Déjà validé" : "Valider"}
                </Button>
                <Button variant="ghost" onClick={() => openPlanWith(focusCategory?.id, null)}>
                  Voir dans Plan
                </Button>
              </div>
            </div>
          ) : hasLinkedHabits ? (
            <div className="mt12 col">
              <div className="small2">Aucune action disponible : active d’abord une habitude liée ci-dessus.</div>
              <div className="mt10">
                <Button variant="ghost" onClick={() => openPlanWith(focusCategory?.id, null)}>
                  Gérer dans Plan
                </Button>
              </div>
            </div>
          ) : (
            <div className="mt12 col">
              <div className="small2">Aucune action aujourd’hui.</div>
              <div className="mt10">
                <Button onClick={() => openPlanWith(focusCategory?.id, selectedGoal ? "__new_process__" : "__new_outcome__")}>
                  Passer à l’action
                </Button>
              </div>
            </div>
          )}
        </div>
      </Card>
    </ScreenShell>
  );
}
