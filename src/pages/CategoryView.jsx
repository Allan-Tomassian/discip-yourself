import React, { useEffect, useMemo, useState } from "react";
import ScreenShell from "./_ScreenShell";
import { Button, Card, IconButton } from "../components/UI";
import EditItemPanel from "../components/EditItemPanel";
import Gauge from "../components/Gauge";
import { getAccentForPage } from "../utils/_theme";
import { safeConfirm, safePrompt } from "../utils/dialogs";
import { uid } from "../utils/helpers";
import { updateGoal } from "../logic/goals";
import { isPrimaryCategory, isPrimaryGoal, setPrimaryCategory, setPrimaryGoalForCategory } from "../logic/priority";

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

const MEASURE_UNITS = {
  money: "€",
  counter: "",
  time: "min",
  energy: "pts",
  distance: "km",
  weight: "kg",
};

export default function CategoryView({ data, setData, categoryId, onBack, onOpenPlan, onOpenCreate, onOpenProgress }) {
  const safeData = data && typeof data === "object" ? data : {};
  const categories = Array.isArray(safeData.categories) ? safeData.categories : [];
  const goals = Array.isArray(safeData.goals) ? safeData.goals : [];
  const category = categories.find((c) => c.id === categoryId) || null;
  const [showWhy, setShowWhy] = useState(true);
  const [selectedOutcomeId, setSelectedOutcomeId] = useState(null);
  const [categoryMenuOpen, setCategoryMenuOpen] = useState(false);
  const [editTarget, setEditTarget] = useState(null);

  const outcomeGoals = useMemo(() => {
    if (!category?.id) return [];
    return goals.filter((g) => g.categoryId === category.id && resolveGoalType(g) === "OUTCOME");
  }, [goals, category?.id]);

  useEffect(() => {
    if (!category?.id) {
      setSelectedOutcomeId(null);
      return;
    }
    const mainId = category.mainGoalId && outcomeGoals.some((g) => g.id === category.mainGoalId)
      ? category.mainGoalId
      : null;
    const fallback = outcomeGoals[0]?.id || null;
    setSelectedOutcomeId((prev) => {
      if (prev && outcomeGoals.some((g) => g.id === prev)) return prev;
      return mainId || fallback;
    });
  }, [category?.id, category?.mainGoalId, outcomeGoals]);

  const selectedOutcome = useMemo(() => {
    if (!selectedOutcomeId) return null;
    return outcomeGoals.find((g) => g.id === selectedOutcomeId) || null;
  }, [outcomeGoals, selectedOutcomeId]);

  const processGoals = useMemo(() => {
    if (!category?.id) return [];
    return goals.filter((g) => g.categoryId === category.id && resolveGoalType(g) === "PROCESS");
  }, [goals, category?.id]);

  const linkedHabits = selectedOutcome ? processGoals.filter((g) => g.parentId === selectedOutcome.id) : [];
  const habits = linkedHabits.length ? linkedHabits : processGoals;

  const gaugeGoals = useMemo(() => {
    const main = category?.mainGoalId ? outcomeGoals.find((g) => g.id === category.mainGoalId) : null;
    const rest = main ? outcomeGoals.filter((g) => g.id !== main.id) : outcomeGoals;
    return main ? [main, ...rest] : outcomeGoals;
  }, [outcomeGoals, category?.mainGoalId]);
  const gaugeSlice = gaugeGoals.slice(0, 2);
  const reminders = Array.isArray(safeData.reminders) ? safeData.reminders : [];

  function openPlan(categoryIdValue, openGoalEditId) {
    if (!categoryIdValue || typeof setData !== "function") return;
    setData((prev) => {
      const prevUi = prev.ui || {};
      const prevSel =
        prevUi.selectedCategoryByView && typeof prevUi.selectedCategoryByView === "object"
          ? prevUi.selectedCategoryByView
          : {};
      return {
        ...prev,
        ui: {
          ...prevUi,
          openGoalEditId,
          selectedCategoryByView: { ...prevSel, plan: categoryIdValue },
        },
      };
    });
    if (typeof onOpenPlan === "function") onOpenPlan();
  }

  function renameCategory() {
    if (!category?.id || typeof setData !== "function") return;
    const nextName = safePrompt("Renommer la catégorie :", category.name || "");
    if (!nextName || !nextName.trim()) return;
    setData((prev) => ({
      ...prev,
      categories: (prev.categories || []).map((cat) =>
        cat.id === category.id ? { ...cat, name: nextName.trim() } : cat
      ),
    }));
  }

  function setCategoryPriority() {
    if (!category?.id || typeof setData !== "function") return;
    setData((prev) => setPrimaryCategory(prev, category.id));
  }

  function deleteCategory() {
    if (!category?.id || typeof setData !== "function") return;
    const ok = safeConfirm("Supprimer cette catégorie et tous ses éléments ?");
    if (!ok) return;
    setData((prev) => {
      const nextCategories = (prev.categories || []).filter((cat) => cat.id !== category.id);
      const nextGoals = (prev.goals || []).filter((g) => g.categoryId !== category.id);
      const nextHabits = (prev.habits || []).filter((h) => h.categoryId !== category.id);
      const nextUi = { ...(prev.ui || {}) };
      const nextSelected = nextCategories[0]?.id || null;
      if (nextUi.selectedCategoryId === category.id) nextUi.selectedCategoryId = nextSelected;
      if (nextUi.selectedCategoryByView) {
        const scv = { ...nextUi.selectedCategoryByView };
        if (scv.library === category.id) scv.library = nextSelected;
        if (scv.plan === category.id) scv.plan = nextSelected;
        if (scv.home === category.id) scv.home = nextSelected;
        nextUi.selectedCategoryByView = scv;
      }
      if (nextUi.sessionDraft?.objectiveId) {
        const stillExists = nextGoals.some((g) => g.id === nextUi.sessionDraft.objectiveId);
        if (!stillExists) nextUi.sessionDraft = null;
      }
      if (nextUi.activeSession?.habitIds) {
        const kept = nextUi.activeSession.habitIds.filter((id) => nextGoals.some((g) => g.id === id));
        if (!kept.length) nextUi.activeSession = null;
        else nextUi.activeSession = { ...nextUi.activeSession, habitIds: kept };
      }
      return {
        ...prev,
        categories: nextCategories,
        goals: nextGoals,
        habits: nextHabits,
        ui: nextUi,
      };
    });
    if (typeof onBack === "function") onBack();
  }

  function deleteGoal(goalId) {
    if (!goalId || typeof setData !== "function") return false;
    const ok = safeConfirm("Supprimer cet élément ?");
    if (!ok) return false;
    setData((prev) => {
      const goal = (prev.goals || []).find((g) => g.id === goalId);
      const isOutcome = resolveGoalType(goal) === "OUTCOME";
      let nextGoals = (prev.goals || []).filter((g) => g.id !== goalId);
      if (isOutcome) nextGoals = nextGoals.filter((g) => g.parentId !== goalId);
      const nextCategories = (prev.categories || []).map((cat) =>
        cat.mainGoalId === goalId ? { ...cat, mainGoalId: null } : cat
      );
      const nextUi = { ...(prev.ui || {}) };
      if (nextUi.sessionDraft?.objectiveId === goalId) nextUi.sessionDraft = null;
      if (nextUi.activeSession?.habitIds) {
        const kept = nextUi.activeSession.habitIds.filter((id) => nextGoals.some((g) => g.id === id));
        nextUi.activeSession = kept.length ? { ...nextUi.activeSession, habitIds: kept } : null;
      }
      return {
        ...prev,
        goals: nextGoals,
        categories: nextCategories,
        ui: nextUi,
      };
    });
    return true;
  }

  function openEditItem(item) {
    if (!item) return;
    const type = resolveGoalType(item);
    const itemReminders = reminders.filter((r) => r.goalId === item.id);
    setEditTarget({ item: { ...item, _reminders: itemReminders }, type });
  }

  function updateRemindersForGoal(prevReminders, goalId, config, fallbackLabel) {
    const base = Array.isArray(prevReminders) ? prevReminders : [];
    const others = base.filter((r) => r.goalId !== goalId);
    if (!config || !config.enabled) return others;
    const times = Array.isArray(config.times) ? config.times : [];
    if (!times.length) return others;

    const days = Array.isArray(config.days) && config.days.length ? config.days : [1, 2, 3, 4, 5, 6, 7];
    const channel = config.channel === "NOTIFICATION" ? "NOTIFICATION" : "IN_APP";
    const label = config.label || fallbackLabel || "Rappel";
    const existing = base.filter((r) => r.goalId === goalId);

    const nextForGoal = times.map((time, index) => {
      const prev = existing[index] || null;
      return {
        id: prev?.id || uid(),
        goalId,
        time,
        enabled: true,
        channel,
        days,
        label: prev?.label || label,
      };
    });

    return [...others, ...nextForGoal];
  }

  function handleSaveEdit(payload) {
    if (!editTarget?.item?.id || typeof setData !== "function") return;
    const goalId = editTarget.item.id;
    const categoryId = editTarget.item.categoryId;
    const updates = payload?.updates || {};
    const reminderConfig = payload?.reminderConfig || null;

    setData((prev) => {
      let next = updateGoal(prev, goalId, updates);
      if (editTarget.type === "OUTCOME" && updates.priorityLevel === "primary" && categoryId) {
        next = setPrimaryGoalForCategory(next, categoryId, goalId);
      }
      if (reminderConfig) {
        const label = updates.title || editTarget.item.title || "Rappel";
        const nextReminders = updateRemindersForGoal(next.reminders, goalId, reminderConfig, label);
        next = { ...next, reminders: nextReminders };
      }
      return next;
    });

    setEditTarget(null);
  }

  if (!categories.length) {
    return (
      <ScreenShell
        headerTitle={<span className="textAccent">Gérer</span>}
        headerSubtitle="Aucune catégorie"
        backgroundImage={safeData?.profile?.whyImage || ""}
      >
        <Card accentBorder>
          <div className="p18">
            <div className="titleSm">Aucune catégorie</div>
            <div className="small" style={{ marginTop: 6 }}>
              Ajoute une première catégorie pour commencer.
            </div>
            <div className="mt12">
              <Button variant="ghost" className="btnBackCompact backBtn" onClick={onBack}>
                ← Retour
              </Button>
            </div>
          </div>
        </Card>
      </ScreenShell>
    );
  }

  if (!category) {
    return (
      <ScreenShell
        headerTitle={<span className="textAccent">Gérer</span>}
        headerSubtitle="Catégorie introuvable"
        backgroundImage={safeData?.profile?.whyImage || ""}
      >
        <Card accentBorder>
          <div className="p18">
            <div className="titleSm">Catégorie introuvable</div>
            <div className="small" style={{ marginTop: 6 }}>
              Cette catégorie n’existe plus.
            </div>
            <div className="mt12">
              <Button variant="ghost" className="btnBackCompact backBtn" onClick={onBack}>
                ← Retour
              </Button>
            </div>
          </div>
        </Card>
      </ScreenShell>
    );
  }

  const accent = getAccentForPage(safeData, "home");
  const backgroundImage = category.wallpaper || safeData.profile?.whyImage || "";
  const whyText = (category.whyText || "").trim();
  const whyDisplay = whyText || "Aucun mini-why pour cette catégorie.";
  const headerRight = (
    <div style={{ minWidth: 0, maxWidth: 320, width: "100%" }}>
      <div className="col" style={{ gap: 8, alignItems: "flex-end" }}>
        {outcomeGoals.length ? (
          <div className="col" style={{ gap: 8, alignItems: "flex-end", width: "100%" }}>
            {gaugeSlice.map((g) => (
              <Gauge
                key={g.id}
                className="manageGauge"
                label={g.title || "Objectif"}
                currentValue={g.currentValue}
                targetValue={g.targetValue}
                unit={MEASURE_UNITS[g.measureType] || ""}
                accentColor={category.color || accent}
              />
            ))}
            <button
              className="linkBtn"
              type="button"
              onClick={() => (typeof onOpenProgress === "function" ? onOpenProgress(category.id) : null)}
              aria-label="Voir la progression"
            >
              →
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );

  return (
    <ScreenShell
      accent={accent}
      backgroundImage={backgroundImage}
      headerTitle={<span className="textAccent">Gérer</span>}
      headerSubtitle={
        <div className="stack stackGap12">
          <div>{category.name || "Catégorie"}</div>
          <Button variant="ghost" className="btnBackCompact backBtn" onClick={onBack}>
            ← Retour
          </Button>
        </div>
      }
      headerRight={headerRight}
      headerRowAlign="start"
    >
      <div style={{ "--catColor": category.color || "#7C3AED" }}>
        <Card accentBorder style={{ marginTop: 12, borderColor: category.color || undefined }}>
          <div className="p18">
            <div className="row" style={{ alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <div className="titleSm">Catégorie</div>
                <div className="small2">
                  {category.name || "Catégorie"}
                  {isPrimaryCategory(category) ? (
                    <span className="badge" style={{ marginLeft: 8, borderColor: "var(--accent)", color: "var(--accent)" }}>
                      Prioritaire
                    </span>
                  ) : null}
                </div>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <IconButton
                  icon="gear"
                  aria-label="Paramètres catégorie"
                  onClick={() => {
                    setCategoryMenuOpen((prev) => !prev);
                    setGoalMenuOpenId(null);
                    setHabitMenuOpenId(null);
                  }}
                />
                <IconButton
                  icon="close"
                  className="iconBtnDanger"
                  aria-label="Supprimer la catégorie"
                  onClick={deleteCategory}
                />
              </div>
            </div>
            {categoryMenuOpen ? (
              <div className="mt12 col" style={{ gap: 8 }}>
                <Button
                  variant="ghost"
                  onClick={() => {
                    renameCategory();
                    setCategoryMenuOpen(false);
                  }}
                >
                  Renommer
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => {
                    setCategoryPriority();
                    setCategoryMenuOpen(false);
                  }}
                  disabled={isPrimaryCategory(category)}
                >
                  {isPrimaryCategory(category) ? "Prioritaire" : "Définir comme prioritaire"}
                </Button>
              </div>
            ) : null}
          </div>
        </Card>

        <Card accentBorder style={{ marginTop: 12, borderColor: category.color || undefined }}>
          <div className="p18">
            <div className="row" style={{ alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <div className="titleSm">Mini-why</div>
                <div className="small2">Visible pour cette catégorie</div>
              </div>
              <button className="linkBtn" onClick={() => setShowWhy((v) => !v)}>
                {showWhy ? "Masquer" : "Afficher"}
              </button>
            </div>
            {showWhy ? <div className="mt12 small2">{whyDisplay}</div> : null}
          </div>
        </Card>

        <Card accentBorder style={{ marginTop: 12, borderColor: category.color || undefined }}>
          <div className="p18">
            <div className="titleSm">Objectifs</div>
            {outcomeGoals.length ? (
              <div className="mt12 col">
                {outcomeGoals.map((g) => (
                  <div key={g.id} className="listItem">
                    <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
                      <div>
                        <div style={{ fontWeight: 700 }}>
                          {g.title || "Objectif"}
                          {isPrimaryGoal(g) ? (
                            <span
                              className="badge"
                              style={{ marginLeft: 8, borderColor: "var(--accent)", color: "var(--accent)" }}
                            >
                              Prioritaire
                            </span>
                          ) : null}
                        </div>
                        <div className="small2">{g.id === category.mainGoalId ? "Principal" : "Secondaire"}</div>
                      </div>
                      <div style={{ display: "flex", gap: 8 }}>
                        <IconButton
                          icon="gear"
                          aria-label="Paramètres objectif"
                          onClick={() => openEditItem(g)}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="mt12 col">
                <div className="small2">Aucun objectif dans cette catégorie.</div>
                <div className="mt10">
                  <Button variant="ghost" onClick={() => (typeof onOpenCreate === "function" ? onOpenCreate() : null)}>
                    Créer
                  </Button>
                </div>
              </div>
            )}
          </div>
        </Card>

        <Card accentBorder style={{ marginTop: 12 }}>
          <div className="p18">
            <div className="titleSm">Habitudes</div>
            {habits.length ? (
              <div className="mt12 col">
                {habits.map((h) => (
                  <div key={h.id} className="listItem">
                    <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
                      <div style={{ fontWeight: 700 }}>{h.title || "Habitude"}</div>
                      <div style={{ display: "flex", gap: 8 }}>
                        <IconButton
                          icon="gear"
                          aria-label="Paramètres habitude"
                          onClick={() => openEditItem(h)}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="mt12 col">
                <div className="small2">Aucune habitude liée.</div>
                <div className="mt10">
                  <Button variant="ghost" onClick={() => (typeof onOpenCreate === "function" ? onOpenCreate() : null)}>
                    Créer
                  </Button>
                </div>
              </div>
            )}
          </div>
        </Card>

        <Card accentBorder style={{ marginTop: 12 }}>
          <div className="p18">
            <div className="titleSm">Outils</div>
            <div className="small2" style={{ marginTop: 6 }}>
              Timer, notifications et calendrier (bientôt).
            </div>
            <div className="mt10">
              <Button variant="ghost" onClick={() => openPlan(category.id)}>
                Ouvrir les outils
              </Button>
            </div>
          </div>
        </Card>
      </div>
      {editTarget ? (
        <EditItemPanel
          item={editTarget.item}
          type={editTarget.type}
          onSave={handleSaveEdit}
          onDelete={() => {
            const removed = deleteGoal(editTarget.item.id);
            if (removed) setEditTarget(null);
          }}
          onClose={() => setEditTarget(null)}
        />
      ) : null}
    </ScreenShell>
  );
}
