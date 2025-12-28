import React, { useMemo, useState } from "react";
import ScreenShell from "./_ScreenShell";
import { Button, Card } from "../components/UI";
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

  const mainGoalId = focusCategory?.mainGoalId || null;
  const mainGoal = mainGoalId ? goals.find((g) => g.id === mainGoalId) : null;
  const habits = goals.filter(
    (g) =>
      g.categoryId === focusCategory?.id &&
      resolveGoalType(g) === "PROCESS" &&
      (mainGoalId ? g.parentId === mainGoalId : true)
  );
  const activeHabits = habits.filter((g) => g.status === "active");
  const nextHabit = activeHabits.find((g) => !todayChecks?.[g.id]?.[today]) || null;
  const nextHabitDone = nextHabit ? Boolean(todayChecks?.[nextHabit.id]?.[today]) : false;

  function setFocusCategory(nextId) {
    if (!nextId || typeof setData !== "function") return;
    setData((prev) => ({
      ...prev,
      ui: { ...(prev.ui || {}), selectedCategoryId: nextId },
    }));
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

  const accent = getAccentForPage(safeData, "home");
  const backgroundImage = profile.whyImage || "";
  const backgroundCss = getBackgroundCss({ data: safeData, pageId: "home", image: backgroundImage });
  const whyText = (profile.whyText || "").trim();
  const whyDisplay = whyText || "Ajoute ton pourquoi dans l’onboarding.";

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
            whiteSpace: showWhy ? "normal" : "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {whyDisplay}
        </div>
        <button className="linkBtn" onClick={() => setShowWhy((v) => !v)} aria-label="Afficher ou masquer le pourquoi">
          {showWhy ? "👁" : "👁‍🗨"}
        </button>
      </div>

      <div className="mt12">
        <FocusCategoryPicker
          categories={categories}
          value={focusCategory?.id || ""}
          onChange={setFocusCategory}
          label="Catégorie focus"
          emptyLabel="Catégorie à configurer"
        />
      </div>

      <Card accentBorder style={{ marginTop: 12, borderColor: accent }}>
        <div className="p18">
          <div className="titleSm">Action du jour</div>
          <div className="small2" style={{ marginTop: 4 }}>
            {focusCategory?.name || "Catégorie"}
          </div>

          {!mainGoal ? (
            <div className="mt12 col">
              <div className="small2">Catégorie à configurer.</div>
              <div className="mt10">
                <Button onClick={() => openPlanWith(focusCategory?.id, "__new_outcome__")}>Créer un objectif</Button>
              </div>
            </div>
          ) : nextHabit ? (
            <div className="mt12 col">
              <div style={{ fontWeight: 800, fontSize: 18 }}>{nextHabit.title || "Habitude"}</div>
              <div className="mt12 row" style={{ alignItems: "center", justifyContent: "space-between" }}>
                <Button onClick={() => markDoneToday(nextHabit.id)} disabled={nextHabitDone}>
                  {nextHabitDone ? "Déjà fait" : "Fait"}
                </Button>
                <Button variant="ghost" onClick={() => openPlanWith(focusCategory?.id, "__new_process__")}
                >
                  Ajouter une habitude
                </Button>
              </div>
            </div>
          ) : (
            <div className="mt12 col">
              <div className="small2">Aucune action aujourd’hui.</div>
              <div className="mt10">
                <Button onClick={() => openPlanWith(focusCategory?.id, "__new_process__")}>Ajouter une habitude</Button>
              </div>
            </div>
          )}
        </div>
      </Card>
    </ScreenShell>
  );
}
