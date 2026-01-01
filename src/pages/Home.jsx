import React, { useEffect, useMemo, useState } from "react";
import ScreenShell from "./_ScreenShell";
import { Button, Card, Select } from "../components/UI";
import FocusCategoryPicker from "../components/FocusCategoryPicker";
import { startOfWeekKey, todayKey, yearKey } from "../utils/dates";
import { activateGoal, setMainGoal } from "../logic/goals";
import { incHabit, decHabit } from "../logic/habits";
import { getAccentForPage } from "../utils/_theme";

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

function parseStartAtMs(value) {
  if (!value || typeof value !== "string") return null;
  const dt = new Date(value);
  const ts = dt.getTime();
  return Number.isNaN(ts) ? null : ts;
}

function formatDateFr(value) {
  if (!value || typeof value !== "string") return "";
  const parts = value.split("-");
  if (parts.length !== 3) return value;
  const [y, m, d] = parts;
  if (!y || !m || !d) return value;
  return `${d}/${m}/${y}`;
}

function formatStartDateFr(value) {
  if (!value || typeof value !== "string") return "";
  const datePart = value.includes("T") ? value.split("T")[0] : value;
  return formatDateFr(datePart);
}

export default function Home({ data, setData, onOpenLibrary, onOpenPlan, onOpenCreate }) {
  const [showWhy, setShowWhy] = useState(true);
  const [whyExpanded, setWhyExpanded] = useState(false);

  // activation feedback per habit
  // shape: { [goalId]: { ok:false, reason, blockers, conflicts, at } }
  const [activationByHabitId, setActivationByHabitId] = useState({});

  const safeData = data && typeof data === "object" ? data : {};
  const profile = safeData.profile || {};
  const categories = Array.isArray(safeData.categories) ? safeData.categories : [];
  const goals = Array.isArray(safeData.goals) ? safeData.goals : [];
  const checks = safeData.checks || {};

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

  // Habitudes liées à l’objectif sélectionné (queued/active)
  const linkedHabits = useMemo(() => {
    if (!selectedGoal?.id) return [];
    return processGoals.filter((g) => g.parentId === selectedGoal.id);
  }, [processGoals, selectedGoal?.id]);

  // Habitudes actives uniquement
  const activeHabits = useMemo(() => {
    return linkedHabits.filter((g) => g.status === "active");
  }, [linkedHabits]);

  // Next habit to do today among ACTIVE only: first with count=0 today
  const nextHabit = useMemo(() => {
    if (!activeHabits.length) return null;
    const now = new Date();
    return activeHabits.find((g) => getHabitCountForToday(g, checks, now) <= 0) || null;
  }, [activeHabits, checks]);

  // Micro-action slots based on schedule + count (data.checks)
  // NOTE: startAt must NOT block execution; it will later drive reminders/notifications.
  const slotItems = useMemo(() => {
    const now = new Date();
    return activeHabits.flatMap((habit) => {
      const slots = getScheduleSlots(habit, now);
      if (!slots.length) return [];
      const count = getHabitCountForToday(habit, checks, now);
      return slots.map((slot, index) => {
        const done = count >= index + 1;
        return {
          id: `${habit.id}:${index}`,
          habit,
          label: slot,
          index,
          done,
        };
      });
    });
  }, [activeHabits, checks]);

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

  const currentHabitDone = useMemo(() => {
    if (!currentHabit) return false;
    const now = new Date();
    return getHabitCountForToday(currentHabit, checks, now) >= 1;
  }, [currentHabit, checks]);

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

  function openCreateHub() {
    if (typeof onOpenCreate === "function") onOpenCreate();
  }

  function setCategoryMainGoal(nextGoalId) {
    if (!nextGoalId || typeof setData !== "function") return;
    const g = goals.find((x) => x.id === nextGoalId) || null;
    if (!g || !focusCategory?.id || g.categoryId !== focusCategory.id) return;
    setData((prev) => setMainGoal(prev, nextGoalId));
  }

  function clearActivationFeedback(goalId) {
    setActivationByHabitId((m) => {
      if (!m || typeof m !== "object") return {};
      if (!m[goalId]) return m;
      const next = { ...m };
      delete next[goalId];
      return next;
    });
  }

  function setActivationFeedback(goalId, meta) {
    setActivationByHabitId((m) => ({
      ...(m && typeof m === "object" ? m : {}),
      [goalId]: meta,
    }));
  }

  function activateHabitNow(goalId) {
    if (!goalId || typeof setData !== "function") return;

    const now = new Date();
    let feedback = null;

    setData((prev) => {
      const res = activateGoal(prev, goalId, { navigate: false, now });

      // normalize return shapes + capture feedback
      if (res && typeof res === "object" && !Array.isArray(res)) {
        const ok = typeof res.ok === "boolean" ? res.ok : true;
        if (!ok) {
          feedback = {
            ok: false,
            reason: typeof res.reason === "string" ? res.reason : "",
            blockers: Array.isArray(res.blockers) ? res.blockers : [],
            conflicts: Array.isArray(res.conflicts) ? res.conflicts : [],
            at: now.toISOString(),
          };
        }
      }

      if (res && typeof res === "object" && res.state && typeof res.state === "object") return res.state;
      if (res && typeof res === "object" && (res.goals || res.categories || res.ui)) return res;
      return prev;
    });

    if (feedback) setActivationFeedback(goalId, feedback);
    else clearActivationFeedback(goalId);
  }

  function startHabitNow(goalId) {
    if (!goalId || typeof setData !== "function") return;

    const now = new Date();
    const hh = String(now.getHours()).padStart(2, "0");
    const mm = String(now.getMinutes()).padStart(2, "0");
    const nowLocal = `${todayKey(now)}T${hh}:${mm}`;

    let feedback = null;

    setData((prev) => {
      // Seed startAt to now to align schedule rendering
      const prevGoals = Array.isArray(prev.goals) ? prev.goals : [];
      const nextGoals = prevGoals.map((g) => (g.id === goalId ? { ...g, startAt: nowLocal } : g));
      const seeded = { ...prev, goals: nextGoals };

      const res = activateGoal(seeded, goalId, { navigate: false, now });

      if (res && typeof res === "object" && !Array.isArray(res)) {
        const ok = typeof res.ok === "boolean" ? res.ok : true;
        if (!ok) {
          feedback = {
            ok: false,
            reason: typeof res.reason === "string" ? res.reason : "",
            blockers: Array.isArray(res.blockers) ? res.blockers : [],
            conflicts: Array.isArray(res.conflicts) ? res.conflicts : [],
            at: now.toISOString(),
          };
        }
      }

      if (res && typeof res === "object" && res.state && typeof res.state === "object") return res.state;
      if (res && typeof res === "object" && (res.goals || res.categories || res.ui)) return res;
      return seeded;
    });

    if (feedback) setActivationFeedback(goalId, feedback);
    else clearActivationFeedback(goalId);
  }

  function deactivateHabitNow(goalId) {
    if (!goalId || typeof setData !== "function") return;
    clearActivationFeedback(goalId);
    setData((prev) => {
      const prevGoals = Array.isArray(prev.goals) ? prev.goals : [];
      const nextGoals = prevGoals.map((g) => {
        if (g.id !== goalId) return g;
        // Minimal, UI-safe deactivation: back to queued. Do not delete history.
        return {
          ...g,
          status: "queued",
          activeSince: "",
        };
      });
      return { ...prev, goals: nextGoals };
    });
  }

  if (!categories.length) {
    return (
      <ScreenShell
        accent={getAccentForPage(safeData, "home")}
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
                  Gérer dans Outils
                </Button>
              </div>
            </div>
          ) : (
            <div className="mt12 col">
              <div className="small2">Aucun objectif dans cette catégorie.</div>
              <div className="mt10">
                <Button variant="ghost" onClick={openCreateHub}>
                  Créer
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
                <Button
                  onClick={() =>
                    setData((prev) => {
                      const fn = currentHabitDone ? decHabit : incHabit;
                      const next = fn(prev, currentHabit.id);
                      return next && typeof next === "object" ? next : prev;
                    })
                  }
                >
                  {currentHabitDone ? "Annuler" : "Valider"}
                </Button>

              </div>
            </div>
          ) : hasLinkedHabits ? (
            <div className="mt12 col">
              <div className="small2">Aucune action disponible : active d’abord une habitude liée ci-dessous.</div>
            </div>
          ) : (
            <div className="mt12 col">
              <div className="small2">Aucune action aujourd’hui.</div>
              <div className="mt10">
                <Button variant="ghost" onClick={openCreateHub}>
                  Créer
                </Button>
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
                const startAtMs = parseStartAtMs(h.startAt);
                const hasFutureStart = Boolean(isActive && startAtMs && startAtMs > Date.now());
                const startLabel = hasFutureStart ? formatStartDateFr(h.startAt) : "";
                const statusLabel = hasFutureStart && startLabel ? `Planifiée (début : ${startLabel})` : isActive ? "Active" : "À activer";
                const fb = activationByHabitId?.[h.id] || null;
                const isBlocked = Boolean(fb && fb.reason && fb.reason !== "START_IN_FUTURE");

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
                          {statusLabel}
                        </div>
                      </div>

                      {!isActive ? (
                        <Button variant="ghost" onClick={() => activateHabitNow(h.id)}>
                          Activer
                        </Button>
                      ) : (
                        <Button variant="ghost" onClick={() => deactivateHabitNow(h.id)}>
                          Désactiver
                        </Button>
                      )}
                    </div>

                    {!isActive && isBlocked ? (
                      <div className="mt10" style={{ opacity: 0.95 }}>
                        <div className="small2" style={{ marginBottom: 8 }}>
                          Activation bloquée{fb.reason ? ` · ${fb.reason}` : ""}
                        </div>

                        {fb.blockers?.length ? (
                          <div className="small2" style={{ opacity: 0.9, marginBottom: 8 }}>
                            {fb.blockers.slice(0, 4).map((b) => (
                              <div key={b.id}>• {b.title || b.name || "Objectif"}</div>
                            ))}
                          </div>
                        ) : null}

                        {fb.conflicts?.length ? (
                          <div className="small2" style={{ opacity: 0.9, marginBottom: 8 }}>
                            {fb.conflicts.slice(0, 4).map((c, idx) => (
                              <div key={idx}>• {c.title || String(c)}</div>
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
                              onClick={() =>
                                setData((prev) => {
                                  const fn = item.done ? decHabit : incHabit;
                                  const next = fn(prev, item.habit.id);
                                  return next && typeof next === "object" ? next : prev;
                                })
                              }
                            >
                              {item.done ? "Annuler" : "Valider"}
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
            </div>
          ) : (
            <div className="mt12 col">
              <div className="small2">Aucune habitude liée.</div>
              <div className="mt10">
                <Button variant="ghost" onClick={openCreateHub}>
                  Créer
                </Button>
              </div>
            </div>
          )}
        </div>
      </Card>

    </ScreenShell>
  );
}
