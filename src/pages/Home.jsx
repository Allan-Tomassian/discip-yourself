import React, { useEffect, useMemo, useState } from "react";
import ScreenShell from "./_ScreenShell";
import { Button, Card, Select } from "../components/UI";
import { addDays, dayKey, getDayStatus, todayKey } from "../utils/dates";
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
  const selectedStatus = getDayStatus(selectedDateKey, new Date());
  const canValidate = selectedStatus === "today";
  const canEdit = selectedStatus !== "past";
  const lockMessage = selectedStatus === "past" ? "Lecture seule" : "Disponible le jour J";

  const [showWhy, setShowWhy] = useState(true);
  const [microState, setMicroState] = useState(() => initMicroState(selectedDateKey));
  const [showDiscipline, setShowDiscipline] = useState(false);
  const profile = safeData.profile || {};
  const categories = Array.isArray(safeData.categories) ? safeData.categories : [];
  const goals = Array.isArray(safeData.goals) ? safeData.goals : [];
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

  const coreProgress = useMemo(() => {
    const activeIds = new Set(activeHabits.map((h) => h.id));
    const doneHabitIds = new Set(dayChecks.habits);
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
  }, [activeHabits, dayChecks, selectedGoal]);

  const disciplineStats = useMemo(() => {
    const todayUnique = new Set(Array.isArray(dayChecks.micro) ? dayChecks.micro : []);
    const microDoneToday = Math.min(3, todayUnique.size);
    let microDoneLast7 = 0;
    for (let i = 0; i < 7; i += 1) {
      const key = dayKey(addDays(selectedDate, -i));
      const bucket = checks?.[key];
      const list = Array.isArray(bucket?.micro) ? bucket.micro : [];
      const unique = new Set(list);
      microDoneLast7 += Math.min(3, unique.size);
    }
    const disciplinePct = Math.round((microDoneLast7 / 21) * 100);
    return { microDoneToday, microDoneLast7, disciplinePct };
  }, [checks, dayChecks.micro, selectedDateKey]);

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
  const catAccentVars = getCategoryAccentVars(accent);

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
              width: `${Math.round(coreProgress.ratio * 100)}%`,
              height: "100%",
              background: "var(--muted)",
              borderRadius: 999,
            }}
          />
        </div>
        <div className="small2" style={{ minWidth: 36, textAlign: "right" }}>
          {coreProgress.done}/{coreProgress.total || 0}
        </div>
      </div>
      <div className="mt10" style={{ display: "flex", justifyContent: "flex-end" }}>
        <button className="linkBtn" onClick={() => setShowDiscipline(true)} type="button">
          Discipline · {disciplineStats.microDoneToday}/3
        </button>
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
                      const done = dayChecks.habits.includes(h.id);
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
                                  const base = fn(prev, h.id, selectedDate);
                                  if (!base || typeof base !== "object") return prev;
                                  const nextChecks = { ...(base.checks || {}) };
                                  const rawBucket = nextChecks[selectedDateKey];
                                  const dayBucket =
                                    rawBucket && typeof rawBucket === "object" ? { ...rawBucket } : {};
                                  const habitIds = Array.isArray(dayBucket.habits) ? [...dayBucket.habits] : [];
                                  dayBucket.habits = done
                                    ? habitIds.filter((id) => id !== h.id)
                                    : habitIds.includes(h.id)
                                      ? habitIds
                                      : [...habitIds, h.id];
                                  nextChecks[selectedDateKey] = dayBucket;
                                  return { ...base, checks: nextChecks };
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
                {microItems.map((item) => {
                  const isMicroDone = dayChecks.micro.includes(item.id);
                  const canAddMicro = canValidate && disciplineStats.microDoneToday < 3 && !isMicroDone;
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
      {showDiscipline ? (
        <div className="modalBackdrop disciplineOverlay" onClick={() => setShowDiscipline(false)}>
          <Card className="disciplineCard" onClick={(e) => e.stopPropagation()}>
            <div className="row" style={{ alignItems: "center", justifyContent: "space-between" }}>
              <div className="titleSm">Discipline</div>
              <button className="linkBtn" type="button" onClick={() => setShowDiscipline(false)}>
                Fermer
              </button>
            </div>
            <div className="mt12 col" style={{ gap: 10 }}>
              <div className="row" style={{ justifyContent: "space-between" }}>
                <div className="small2">Aujourd’hui</div>
                <div className="titleSm">{disciplineStats.microDoneToday}/3</div>
              </div>
              <div className="row" style={{ justifyContent: "space-between" }}>
                <div className="small2">7 jours</div>
                <div className="titleSm">{disciplineStats.microDoneLast7}/21</div>
              </div>
              <div className="row" style={{ justifyContent: "space-between" }}>
                <div className="small2">Pourcentage</div>
                <div className="titleSm">{disciplineStats.disciplinePct}%</div>
              </div>
            </div>
          </Card>
        </div>
      ) : null}
    </ScreenShell>
  );
}
