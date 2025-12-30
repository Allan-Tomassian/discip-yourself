import React, { useEffect, useMemo, useState } from "react";
import ScreenShell from "./_ScreenShell";
import { Button, Card, Select } from "../components/UI";
import FocusCategoryPicker from "../components/FocusCategoryPicker";
import { todayKey } from "../utils/dates";
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

export default function Home({ data, setData, onOpenLibrary, onOpenPlan }) {
  const [showWhy, setShowWhy] = useState(true);
  const [whyExpanded, setWhyExpanded] = useState(false);
  const safeData = data && typeof data === "object" ? data : {};
  const profile = safeData.profile || {};
  const categories = Array.isArray(safeData.categories) ? safeData.categories : [];
  const goals = Array.isArray(safeData.goals) ? safeData.goals : [];
  const today = todayKey();
  const todayChecks = safeData.ui?.processChecks || {};

  const focusCategory = useMemo(() => {
    if (!categories.length) return null;
    const selected = categories.find((c) => c.id === safeData.ui?.selectedCategoryId) || null;
    if (selected) return selected;
    const withGoal = categories.find((c) =>
      goals.some((g) => g.categoryId === c.id && resolveGoalType(g) === "OUTCOME")
    );
    return withGoal || categories[0] || null;
  }, [categories, goals, safeData.ui?.selectedCategoryId]);

  const selectedGoalByCategory =
    safeData.ui?.selectedGoalByCategory && typeof safeData.ui.selectedGoalByCategory === "object"
      ? safeData.ui.selectedGoalByCategory
      : {};

  const outcomeGoals = useMemo(() => {
    if (!focusCategory?.id) return [];
    return goals.filter((g) => g.categoryId === focusCategory.id && resolveGoalType(g) === "OUTCOME");
  }, [goals, focusCategory?.id]);

  const selectedGoal = useMemo(() => {
    if (!focusCategory?.id) return null;
    const storedId = selectedGoalByCategory[focusCategory.id] || null;
    const stored = storedId ? outcomeGoals.find((g) => g.id === storedId) : null;
    if (stored) return stored;
    const active = outcomeGoals.find((g) => g.status === "active") || null;
    return active || outcomeGoals[0] || null;
  }, [focusCategory?.id, outcomeGoals, selectedGoalByCategory]);

  const processGoals = useMemo(() => {
    if (!focusCategory?.id) return [];
    return goals.filter((g) => g.categoryId === focusCategory.id && resolveGoalType(g) === "PROCESS");
  }, [goals, focusCategory?.id]);

  const linkedHabits = useMemo(() => {
    if (!selectedGoal?.id) return [];
    return processGoals.filter((g) => g.parentId === selectedGoal.id);
  }, [processGoals, selectedGoal?.id]);

  const habits = linkedHabits.length ? linkedHabits : processGoals;
  const activeHabits = habits.filter((g) => g.status === "active");
  const nextHabit = activeHabits.find((g) => !todayChecks?.[g.id]?.[today]) || null;
  const nextHabitDone = nextHabit ? Boolean(todayChecks?.[nextHabit.id]?.[today]) : false;

  // Cursor habit (small selector for "Action du jour")
  const [habitCursorId, setHabitCursorId] = useState(null);

  useEffect(() => {
    // Reset cursor when category/goal changes or list changes
    const ids = activeHabits.map((h) => h.id);
    if (!ids.length) {
      setHabitCursorId(null);
      return;
    }
    // Prefer nextHabit, otherwise keep current if still valid, otherwise first
    if (nextHabit?.id) {
      setHabitCursorId(nextHabit.id);
      return;
    }
    if (habitCursorId && ids.includes(habitCursorId)) return;
    setHabitCursorId(ids[0]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusCategory?.id, selectedGoal?.id, activeHabits.length, nextHabit?.id]);

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

  function setFocusCategory(nextId) {
    if (!nextId || typeof setData !== "function") return;
    setData((prev) => ({
      ...prev,
      ui: { ...(prev.ui || {}), selectedCategoryId: nextId },
    }));
  }

  function setSelectedGoal(goalId) {
    if (!focusCategory?.id || typeof setData !== "function") return;
    setData((prev) => {
      const prevUi = prev.ui || {};
      const prevMap =
        prevUi.selectedGoalByCategory && typeof prevUi.selectedGoalByCategory === "object"
          ? prevUi.selectedGoalByCategory
          : {};
      return {
        ...prev,
        ui: {
          ...prevUi,
          selectedGoalByCategory: { ...prevMap, [focusCategory.id]: goalId || null },
        },
      };
    });
  }

  function openPlanWith(categoryId, openGoalEditId) {
    if (!categoryId || typeof setData !== "function") return;
    setData((prev) => ({
      ...prev,
      ui: { ...(prev.ui || {}), selectedCategoryId: categoryId, openGoalEditId },
    }));
    if (typeof onOpenPlan === "function") onOpenPlan();
  }

  function markDoneToday(goalId) {
    if (!goalId || typeof setData !== "function") return;
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

  const accent = (focusCategory && focusCategory.color) ? focusCategory.color : getAccentForPage(safeData, "home");
  const backgroundImage = profile.whyImage || "";
  const backgroundCss = getBackgroundCss({ data: safeData, pageId: "home", image: backgroundImage });
  const whyText = (profile.whyText || "").trim();
  const whyDisplay = whyText || "Ajoute ton pourquoi dans l’onboarding.";
  const WHY_LIMIT = 150;
  const hasLongWhy = whyDisplay.length > WHY_LIMIT;
  const visibleWhy =
    !showWhy ? "Pourquoi masqué" : whyExpanded || !hasLongWhy ? whyDisplay : `${whyDisplay.slice(0, WHY_LIMIT)}…`;

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
          {outcomeGoals.length ? (
            <div className="mt12 col">
              <Select value={selectedGoal?.id || ""} onChange={(e) => setSelectedGoal(e.target.value)}>
                <option value="" disabled>
                  Choisir un objectif
                </option>
                {outcomeGoals.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.title || "Objectif"}
                  </option>
                ))}
              </Select>
              <div className="small2" style={{ marginTop: 8 }}>
                {selectedGoal?.title || "Objectif"}
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

      <Card accentBorder style={{ marginTop: 12 }}>
        <div className="p18">
          <div className="titleSm">Habitudes</div>
          <div className="small2">Liées à l’objectif sélectionné</div>
          {habits.length ? (
            <div className="mt12 col">
              {habits.map((h) => (
                <div key={h.id} className="listItem">
                  <div style={{ fontWeight: 700 }}>{h.title || "Habitude"}</div>
                </div>
              ))}
            </div>
          ) : (
            <div className="mt12 col">
              <div className="small2">Aucune habitude liée.</div>
              <div className="mt10">
                <Button
                  onClick={() =>
                    openPlanWith(focusCategory?.id, selectedGoal ? "__new_process__" : "__new_outcome__")
                  }
                >
                  {selectedGoal ? "Créer une habitude" : "Créer un objectif"}
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
                <div style={{ fontWeight: 800, fontSize: 18, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
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
                  Gérer
                </Button>
              </div>
            </div>
          ) : (
            <div className="mt12 col">
              <div className="small2">Aucune action aujourd’hui.</div>
              <div className="mt10">
                <Button onClick={() => openPlanWith(focusCategory?.id, selectedGoal ? "__new_process__" : null)}>
                  Ajouter une habitude
                </Button>
              </div>
            </div>
          )}
        </div>
      </Card>
    </ScreenShell>
  );
}
