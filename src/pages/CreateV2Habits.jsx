import React, { useEffect, useMemo, useState } from "react";
import ScreenShell from "./_ScreenShell";
import { AccentItem, Button, Card, Input, Select } from "../components/UI";
import { createEmptyDraft, normalizeCreationDraft } from "../creation/creationDraft";
import { STEP_HABITS } from "../creation/creationSchema";
import { resolveGoalType } from "../domain/goalType";
import { uid } from "../utils/helpers";
import { createGoal } from "../logic/goals";
import { setPrimaryGoalForCategory } from "../logic/priority";
import { ensureWindowForGoals } from "../logic/occurrencePlanner";
import { todayLocalKey } from "../utils/dateKey";
import { createDefaultGoalSchedule } from "../logic/state";

export default function CreateV2Habits({
  data,
  setData,
  onBack,
  onDone,
  onCancel,
  canCreateAction = true,
  onOpenPaywall,
  isPremiumPlan = false,
  planLimits = null,
  generationWindowDays = null,
}) {
  const safeData = data && typeof data === "object" ? data : {};
  const backgroundImage = safeData?.profile?.whyImage || "";
  const goals = Array.isArray(safeData.goals) ? safeData.goals : [];
  const draft = useMemo(() => normalizeCreationDraft(safeData?.ui?.createDraft), [safeData?.ui?.createDraft]);
  const [title, setTitle] = useState("");
  const [linkToObjective, setLinkToObjective] = useState(() =>
    Boolean(draft.activeOutcomeId || draft.outcomes?.length)
  );
  const [error, setError] = useState("");

  const habits = Array.isArray(draft.habits) ? draft.habits : [];
  const outcomes = Array.isArray(draft.outcomes) ? draft.outcomes : [];
  const activeOutcomeId = draft.activeOutcomeId || outcomes[0]?.id || "";
  const availableOutcomes = useMemo(
    () => goals.filter((g) => g && resolveGoalType(g) === "OUTCOME"),
    [goals]
  );
  const hasAvailableOutcomes = availableOutcomes.length > 0;
  const [selectedOutcomeId, setSelectedOutcomeId] = useState(() =>
    activeOutcomeId || availableOutcomes[0]?.id || ""
  );
  const hasOutcome = Boolean(selectedOutcomeId);
  const categoryId = draft?.category?.mode === "existing" ? draft.category.id : "";
  const category = categoryId ? (safeData.categories || []).find((c) => c.id === categoryId) : null;
  const existingActionCount = useMemo(
    () => goals.filter((g) => resolveGoalType(g) === "PROCESS").length,
    [goals]
  );

  useEffect(() => {
    if (hasOutcome && error) setError("");
  }, [hasOutcome, error]);

  useEffect(() => {
    if (!selectedOutcomeId && hasAvailableOutcomes && linkToObjective) {
      setSelectedOutcomeId(availableOutcomes[0].id);
    }
  }, [availableOutcomes, hasAvailableOutcomes, linkToObjective, selectedOutcomeId]);

  useEffect(() => {
    if (!hasAvailableOutcomes && linkToObjective) {
      setLinkToObjective(false);
      setSelectedOutcomeId("");
      syncActiveOutcome("");
    }
  }, [hasAvailableOutcomes, linkToObjective]);

  function updateDraft(nextHabits) {
    if (typeof setData !== "function") return;
    setData((prev) => {
      const prevUi = prev.ui || {};
      return {
        ...prev,
        ui: {
          ...prevUi,
          createDraft: {
            ...normalizeCreationDraft(prevUi.createDraft),
            habits: nextHabits,
            activeOutcomeId: selectedOutcomeId || null,
            step: STEP_HABITS,
          },
        },
      };
    });
  }

  function syncActiveOutcome(nextId) {
    if (typeof setData !== "function") return;
    setData((prev) => {
      const prevUi = prev.ui || {};
      return {
        ...prev,
        ui: {
          ...prevUi,
          createDraft: {
            ...normalizeCreationDraft(prevUi.createDraft),
            activeOutcomeId: nextId || null,
            step: STEP_HABITS,
          },
        },
      };
    });
  }

  function addHabit() {
    const cleanTitle = title.trim();
    if (!cleanTitle) return;
    const limit = Number(planLimits?.actions) || 0;
    if (!isPremiumPlan && limit > 0 && existingActionCount + habits.length >= limit) {
      if (typeof onOpenPaywall === "function") onOpenPaywall("Limite d’actions atteinte.");
      return;
    }
    if (!canCreateAction) {
      if (typeof onOpenPaywall === "function") onOpenPaywall("Limite d’actions atteinte.");
      return;
    }
    const outcomeId = linkToObjective && selectedOutcomeId ? selectedOutcomeId : null;
    const nextHabits = [...habits, { id: uid(), title: "" + cleanTitle, outcomeId }];
    updateDraft(nextHabits);
    setTitle("");
  }

  function removeHabit(id) {
    const nextHabits = habits.filter((h) => h.id !== id);
    updateDraft(nextHabits);
  }

  function toggleHabitLink(habitId, shouldLink) {
    const nextHabits = habits.map((habit) => {
      if (habit.id !== habitId) return habit;
      if (shouldLink && selectedOutcomeId) return { ...habit, outcomeId: selectedOutcomeId };
      return { ...habit, outcomeId: null };
    });
    updateDraft(nextHabits);
  }

  function handleDone() {
    if (!habits.length) return;
    if (linkToObjective && !selectedOutcomeId) {
      setError("Choisis un objectif ou désactive le lien.");
      return;
    }
    if (hasOutcome && !outcomes[0] && !selectedOutcomeId) {
      setError("Complète l’objectif avant de terminer.");
      return;
    }
    if (typeof setData !== "function") return;
    setData((prev) => {
      let next = prev;
      const objective = outcomes[0] || null;
      const outcomeId = objective ? uid() : null;
      const createdProcessIds = [];

      if (objective && outcomeId) {
        next = createGoal(next, {
          id: outcomeId,
          categoryId,
          title: objective.title || "Objectif",
          type: "OUTCOME",
          planType: "STATE",
          deadline: objective.deadline || "",
          measureType: objective.measureType || null,
          targetValue: objective.targetValue ? Number(objective.targetValue) : null,
          currentValue: objective.targetValue ? 0 : null,
          priority: objective.priority || "secondaire",
        });
        if (objective.priority === "prioritaire") {
          next = setPrimaryGoalForCategory(next, categoryId, outcomeId);
        }
      }

      const baseSchedule = createDefaultGoalSchedule();
      let finalState = next;
      for (const habit of habits) {
        if (!habit || !habit.title) continue;
        const habitId = uid();
        finalState = createGoal(finalState, {
          id: habitId,
          categoryId,
          title: habit.title,
          type: "PROCESS",
          planType: "ACTION",
          parentId: habit.outcomeId && (outcomeId || selectedOutcomeId)
            ? outcomeId || selectedOutcomeId
            : null,
          cadence: "WEEKLY",
          target: 1,
          freqCount: 1,
          freqUnit: "WEEK",
          weight: 100,
          sessionMinutes: baseSchedule.durationMinutes || null,
          schedule: { ...baseSchedule },
        });
        createdProcessIds.push(habitId);
      }

      if (createdProcessIds.length) {
        const days =
          Number.isFinite(generationWindowDays) && generationWindowDays > 0
            ? Math.floor(generationWindowDays)
            : 14;
        finalState = ensureWindowForGoals(finalState, createdProcessIds, todayLocalKey(), days);
      }

      return {
        ...finalState,
        ui: { ...(finalState.ui || {}), createDraft: createEmptyDraft(), createDraftWasCompleted: true },
      };
    });
    if (typeof onDone === "function") onDone();
  }

  function getOutcomeLabel(id) {
    return (
      outcomes.find((o) => o.id === id)?.title ||
      goals.find((g) => g.id === id)?.title ||
      "Objectif"
    );
  }

  const outcomeLabel = hasOutcome ? getOutcomeLabel(selectedOutcomeId) : "Sans objectif";
  const objectiveColor = category?.color || "#64748B";

  return (
    <ScreenShell
      data={safeData}
      pageId="categories"
      headerTitle="Créer"
      headerSubtitle={
        <>
          <span className="textMuted2">2.</span> Actions · {outcomeLabel}
        </>
      }
      backgroundImage={backgroundImage}
    >
      <div className="stack stackGap12">
        <Button variant="ghost" className="btnBackCompact backBtn" onClick={onBack}>
          ← Retour
        </Button>
        <Card accentBorder>
          <div className="p18 col gap12">
            <div className="row gap8">
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Nouvelle action"
              />
              <Button onClick={addHabit} disabled={!title.trim()}>
                Ajouter
              </Button>
            </div>
            <div className="stack stackGap8">
              <label className="includeToggle">
                <input
                  type="checkbox"
                  checked={linkToObjective}
                  onChange={(e) => {
                    const next = e.target.checked;
                    setLinkToObjective(next);
                    if (!next) setSelectedOutcomeId("");
                    if (next && !selectedOutcomeId && hasAvailableOutcomes) {
                      setSelectedOutcomeId(availableOutcomes[0].id);
                    }
                    syncActiveOutcome(next ? selectedOutcomeId || availableOutcomes[0]?.id || "" : "");
                  }}
                  disabled={!hasAvailableOutcomes}
                />
                <span>Liée à un objectif</span>
              </label>
              <Select
                value={selectedOutcomeId}
                onChange={(e) => {
                  const nextValue = e.target.value;
                  setSelectedOutcomeId(nextValue);
                  syncActiveOutcome(nextValue);
                }}
                disabled={!linkToObjective || !hasAvailableOutcomes}
              >
                <option value="">Sans objectif</option>
                {availableOutcomes.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.title || "Objectif"}
                  </option>
                ))}
              </Select>
            </div>
            <div className="stack stackGap8">
              {habits.map((habit) => (
                <AccentItem
                  key={habit.id}
                  color={habit.outcomeId ? objectiveColor : null}
                  tone={habit.outcomeId ? "accent" : "neutral"}
                >
                  <div className="row rowBetween gap10 wFull">
                    <div className="small2 flex1">
                      {habit.title}
                      {habit.outcomeId ? (
                        <span className="textMuted2">
                          {" "}
                          · {getOutcomeLabel(habit.outcomeId)}
                        </span>
                      ) : null}
                    </div>
                    <label className="includeToggle">
                      <input
                        type="checkbox"
                        checked={Boolean(habit.outcomeId)}
                        onChange={(e) => toggleHabitLink(habit.id, e.target.checked)}
                        disabled={!hasAvailableOutcomes}
                      />
                      <span>Liée</span>
                    </label>
                    <Button variant="ghost" onClick={() => removeHabit(habit.id)}>
                      Retirer
                    </Button>
                  </div>
                </AccentItem>
              ))}
              {!habits.length ? <div className="small2">Ajoute au moins une action.</div> : null}
              {error ? <div className="small2 textAccent">{error}</div> : null}
            </div>
            <div className="row rowEnd gap10">
              <Button
                variant="ghost"
                onClick={() => {
                  if (typeof onCancel === "function") {
                    onCancel();
                    return;
                  }
                  if (typeof onBack === "function") onBack();
                }}
              >
                Annuler
              </Button>
              <Button onClick={handleDone} disabled={!habits.length}>
                Terminer
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </ScreenShell>
  );
}
