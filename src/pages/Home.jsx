import React, { useEffect, useMemo, useState } from "react";
import ScreenShell from "./_ScreenShell";
import { Button, Card, Select } from "../components/UI";
import { addDays, dayKey, dayStatus, startOfWeekKey, todayKey, yearKey } from "../utils/dates";
import { setMainGoal } from "../logic/goals";
import { incHabit, decHabit } from "../logic/habits";
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

export default function Home({ data, setData, onOpenLibrary, onOpenCreate, onOpenCreateCategory }) {
  const safeData = data && typeof data === "object" ? data : {};
  const selectedDateKey = safeData.ui?.selectedDate || todayKey();
  const selectedDate = new Date(`${selectedDateKey}T12:00:00`);
  const selectedStatus = dayStatus(selectedDateKey, new Date());
  const canValidate = selectedStatus === "today";
  const canEdit = selectedStatus !== "past";

  const [showWhy, setShowWhy] = useState(true);
  const [microState, setMicroState] = useState(() => initMicroState(selectedDateKey));
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

  const mainGoalId = typeof focusCategory?.mainGoalId === "string" ? focusCategory.mainGoalId : null;

  const outcomeGoals = useMemo(() => {
    if (!focusCategory?.id) return [];
    return goals.filter((g) => g.categoryId === focusCategory.id && resolveGoalType(g) === "OUTCOME");
  }, [goals, focusCategory?.id]);

  const selectedGoal = useMemo(() => {
    if (!focusCategory?.id || !mainGoalId) return null;
    return outcomeGoals.find((g) => g.id === mainGoalId) || null;
  }, [focusCategory?.id, mainGoalId, outcomeGoals]);

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

  const dayProgress = useMemo(() => {
    const total = activeHabits.length;
    const done = activeHabits.reduce(
      (sum, h) => sum + (getHabitCountForToday(h, checks, selectedDate) > 0 ? 1 : 0),
      0
    );
    return { total, done, ratio: total ? done / total : 0 };
  }, [activeHabits, checks, selectedDateKey]);

  const microItems = useMemo(() => {
    return microState.items;
  }, [microState.items]);

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
        status: dayStatus(key, new Date()),
      };
    });
  }, [selectedDateKey]);

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
  const catAccentVars = useMemo(() => getCategoryAccentVars(accent), [accent]);
  const lockMessage = selectedStatus === "past" ? "Lecture seule" : "Disponible le jour J";

  const whyText = (profile.whyText || "").trim();
  const whyDisplay = whyText || "Ajoute ton pourquoi dans l’onboarding.";

  const headerRight = categories.length ? (
    <div style={{ minWidth: 160 }}>
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
              width: `${Math.round(dayProgress.ratio * 100)}%`,
              height: "100%",
              background: "var(--muted)",
              borderRadius: 999,
            }}
          />
        </div>
        <div className="small2" style={{ minWidth: 36, textAlign: "right" }}>
          {dayProgress.done}/{dayProgress.total || 0}
        </div>
      </div>
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
              <div className="sectionTitle textAccent">Focus catégorie</div>
              <div className="mt10 catAccentField" style={catAccentVars}>
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
          </Card>

          <Card style={{ marginTop: 12 }}>
            <div className="p18">
              <div className="sectionTitle textAccent">Objectif principal</div>

              {outcomeGoals.length ? (
                <div className="mt10 catAccentField" style={catAccentVars}>
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
                <div className="mt12 col">
              <div className="small2">Aucun objectif principal.</div>
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
              <div className="sectionTitle textAccent">Habitudes</div>
              <div className="sectionSub">Du jour</div>

              {selectedGoal ? (
                activeHabits.length ? (
                  <div className="mt12 col" style={{ gap: 10 }}>
                    {activeHabits.map((h) => {
                      const done = getHabitCountForToday(h, checks, selectedDate) > 0;
                      return (
                        <div key={h.id} className="listItem catAccentRow" style={catAccentVars}>
                          <div className="row" style={{ alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                            <div style={{ minWidth: 0 }}>
                              <div className="itemTitle" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                {h.title || "Habitude"}
                              </div>
                            </div>
                            <Button
                              variant="ghost"
                              disabled={!canValidate}
                              onClick={() =>
                                setData((prev) => {
                                  const fn = done ? decHabit : incHabit;
                                  const next = fn(prev, h.id, selectedDate);
                                  return next && typeof next === "object" ? next : prev;
                                })
                              }
                            >
                              {done ? "Annuler" : "Valider"}
                            </Button>
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
                {microItems.map((item) => (
                  <div key={item.uid} className="listItem catAccentRow" style={catAccentVars}>
                    <div className="row" style={{ alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                      <div className="itemTitle" style={{ flex: 1, minWidth: 0 }}>
                        {item.label}
                      </div>
                      <Button
                        variant="ghost"
                        disabled={!canValidate}
                        onClick={() => {
                          setData((prev) => {
                            const checks = { ...(prev.checks || {}) };
                            const bucket = checks[item.id] || { daily: {}, weekly: {}, yearly: {} };
                            const cur = bucket.daily?.[selectedDateKey] || 0;
                            bucket.daily = { ...bucket.daily, [selectedDateKey]: cur + 1 };
                            checks[item.id] = bucket;
                            return { ...prev, checks };
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
                ))}
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
    </ScreenShell>
  );
}
