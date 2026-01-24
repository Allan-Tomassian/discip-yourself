import React, { useEffect } from "react";
import ScreenShell from "./_ScreenShell";
import { Button, Card } from "../components/UI";
import { normalizeCreationDraft, createEmptyDraft } from "../creation/creationDraft";
import { createGoal } from "../logic/goals";
import { uid } from "../utils/helpers";
import { setPrimaryCategory, setPrimaryGoalForCategory } from "../logic/priority";
import { todayLocalKey } from "../utils/dateKey";
import { ensureWindowForGoals } from "../logic/occurrencePlanner";

const DOWS = [
  { id: 1, label: "Lun" },
  { id: 2, label: "Mar" },
  { id: 3, label: "Mer" },
  { id: 4, label: "Jeu" },
  { id: 5, label: "Ven" },
  { id: 6, label: "Sam" },
  { id: 7, label: "Dim" },
];

function formatPriority(priority) {
  if (priority === "prioritaire") return "Prioritaire";
  if (priority === "bonus") return "Bonus";
  return "Secondaire";
}

function formatDays(days) {
  if (!Array.isArray(days) || !days.length) return "—";
  return days
    .map((day) => DOWS.find((d) => d.id === day)?.label)
    .filter(Boolean)
    .join(", ");
}

function formatDurationMinutes(value) {
  if (!Number.isFinite(value) || value <= 0) return "—";
  return `${value} min`;
}

function buildSchedule(item, daysOverride) {
  const days = Array.isArray(daysOverride)
    ? daysOverride
    : Array.isArray(item?.daysOfWeek)
      ? item.daysOfWeek
      : [];
  if (!item || !days.length) return null;
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "Europe/Paris";
  if (item.type === "outcome") {
    return {
      timezone,
      daysOfWeek: days,
      timeSlots: [],
      durationMinutes: null,
      remindersEnabled: false,
    };
  }
  if (!item.time) return null;
  const durationMinutes = Number.isFinite(item.durationMinutes) && item.durationMinutes > 0 ? item.durationMinutes : 60;
  return {
    timezone,
    daysOfWeek: days,
    timeSlots: [item.time],
    durationMinutes,
    remindBeforeMinutes: 10,
    allowSnooze: true,
    snoozeMinutes: 10,
    remindersEnabled: false,
  };
}

function isDraftComplete(draft) {
  const items = Array.isArray(draft?.rhythm?.items) ? draft.rhythm.items : [];
  if (!items.length) return false;
  if (draft?.rhythm?.hasConflicts) return false;
  const outcomes = Array.isArray(draft?.outcomes) ? draft.outcomes : [];
  const habits = Array.isArray(draft?.habits) ? draft.habits : [];
  const outcomeItems = new Map(items.filter((item) => item.type === "outcome").map((item) => [item.id, item]));
  for (const outcome of outcomes) {
    const item = outcomeItems.get(outcome.id);
    const days = Array.isArray(item?.daysOfWeek) ? item.daysOfWeek : [];
    if (!item || !days.length) return false;
  }
  const habitItems = new Map(items.filter((item) => item.type === "habit").map((item) => [item.id, item]));
  for (const habit of habits) {
    const item = habitItems.get(habit.id);
    if (!item) return false;
    const hasTime = Boolean(item.time);
    const hasDuration = Number.isFinite(item.durationMinutes) && item.durationMinutes > 0;
    const outcomeItem = outcomeItems.get(habit.outcomeId);
    const days = Array.isArray(outcomeItem?.daysOfWeek) ? outcomeItem.daysOfWeek : [];
    if (!hasTime || !hasDuration || !days.length) return false;
  }
  return true;
}

export default function CreateV2Review({ data, setData, onBack, onDone, onCancel, generationWindowDays = null }) {
  const safeData = data && typeof data === "object" ? data : {};
  const backgroundImage = safeData?.profile?.whyImage || "";
  const categories = Array.isArray(safeData.categories) ? safeData.categories : [];
  const goals = Array.isArray(safeData.goals) ? safeData.goals : [];
  const draft = normalizeCreationDraft(safeData?.ui?.createDraft);
  const rhythmItems = Array.isArray(draft?.rhythm?.items) ? draft.rhythm.items : [];
  const outcomes = Array.isArray(draft?.outcomes) ? draft.outcomes : [];
  const habits = Array.isArray(draft?.habits) ? draft.habits : [];

  const canConfirm = isDraftComplete(draft);

  useEffect(() => {
    if (canConfirm) return;
    if (typeof onBack === "function") onBack();
  }, [canConfirm, onBack]);

  function handleConfirm() {
    if (!canConfirm || typeof setData !== "function") return;
    setData((prev) => {
      let next = prev;
      const prevCategories = Array.isArray(next.categories) ? next.categories : [];
      const prevUi = next.ui || {};
      const prevOrder = Array.isArray(prevUi.categoryRailOrder) ? prevUi.categoryRailOrder : [];

      let categoryId = null;
      if (draft.category?.mode === "existing") {
        categoryId = draft.category.id || null;
      } else if (draft.category?.mode === "new") {
        categoryId = uid();
        const nextCategories = [
          ...prevCategories,
          {
            id: categoryId,
            name: draft.category.name || "Nouvelle catégorie",
            color: draft.category.color || "#7C3AED",
            wallpaper: "",
            whyText: draft.category.whyText || "",
            mainGoalId: null,
            priorityLevel: draft.category.priorityLevel || "normal",
          },
        ];
        const nextOrder = prevOrder.includes(categoryId) ? prevOrder : [...prevOrder, categoryId];
        const prevSel =
          prevUi.selectedCategoryByView && typeof prevUi.selectedCategoryByView === "object"
            ? prevUi.selectedCategoryByView
            : {};
        const isFirst = prevCategories.length === 0;
        const nextSelectedByView = { ...prevSel, home: categoryId, library: categoryId };
        const nextUi = isFirst
          ? {
              ...prevUi,
              selectedCategoryId: categoryId,
              librarySelectedCategoryId: categoryId,
              selectedCategoryByView: nextSelectedByView,
              categoryRailOrder: nextOrder,
            }
          : {
              ...prevUi,
              librarySelectedCategoryId: categoryId,
              selectedCategoryByView: nextSelectedByView,
              categoryRailOrder: nextOrder,
            };
        next = { ...next, categories: nextCategories, ui: nextUi };
        if (draft.category.priorityLevel === "primary") next = setPrimaryCategory(next, categoryId);
      }

      if (!categoryId) return prev;

      const outcomeIdMap = new Map();
      const createdProcessIds = [];
      let nextState = next;
      for (const outcome of outcomes) {
        if (!outcome || !outcome.id) continue;
        if (outcome.mode === "existing") {
          outcomeIdMap.set(outcome.id, outcome.id);
          continue;
        }
        const outcomeItem = rhythmItems.find((item) => item.id === outcome.id) || null;
        const schedule = buildSchedule(outcomeItem);
        const id = uid();
        let created = createGoal(
          nextState,
          {
            id,
            categoryId,
            title: outcome.title || "Objectif",
            type: "OUTCOME",
            planType: "STATE",
            schedule: schedule || undefined,
            deadline: outcome.deadline || "",
            priority: outcome.priority || "secondaire",
          }
        );
        if (outcome.priority === "prioritaire") {
          created = setPrimaryGoalForCategory(created, categoryId, id);
        }
        outcomeIdMap.set(outcome.id, id);
        nextState = created;
      }

      if (!outcomeIdMap.size) return prev;

      let finalState = nextState;
      const outcomeItems = new Map(
        rhythmItems.filter((item) => item.type === "outcome").map((item) => [item.id, item])
      );
      for (const habit of draft.habits || []) {
        if (!habit || !habit.title) continue;
        const item = rhythmItems.find((it) => it.id === habit.id) || null;
        const outcomeId = outcomeIdMap.get(habit.outcomeId);
        if (!outcomeId) continue;
        const outcomeItem = outcomeItems.get(habit.outcomeId) || null;
        const schedule = buildSchedule(item, outcomeItem?.daysOfWeek || []);
        const habitId = uid();
        finalState = createGoal(finalState, {
          id: habitId,
          categoryId,
          title: habit.title,
          type: "PROCESS",
          planType: "ACTION",
          parentId: outcomeId,
          cadence: "WEEKLY",
          target: 1,
          freqCount: 1,
          freqUnit: "WEEK",
          weight: 100,
          sessionMinutes: schedule?.durationMinutes || null,
          schedule: schedule || undefined,
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

      finalState = {
        ...finalState,
        ui: { ...(finalState.ui || {}), createDraft: createEmptyDraft(), createDraftWasCompleted: true },
      };
      return finalState;
    });

    if (typeof onDone === "function") onDone();
  }

  const categoryLabel =
    draft.category?.mode === "existing"
      ? categories.find((c) => c.id === draft.category.id)?.name
      : draft.category?.name;
  const categoryPriority =
    draft.category?.mode === "existing"
      ? categories.find((c) => c.id === draft.category.id)?.priorityLevel
      : draft.category?.priorityLevel;
  const categoryPriorityLabel = categoryPriority === "primary" ? "Prioritaire" : "Secondaire";
  const outcomeItems = new Map(
    rhythmItems.filter((item) => item.type === "outcome").map((item) => [item.id, item])
  );
  const habitItems = new Map(
    rhythmItems.filter((item) => item.type === "habit").map((item) => [item.id, item])
  );
  return (
    <ScreenShell
      data={safeData}
      pageId="categories"
      headerTitle="Créer"
      headerSubtitle={
        <>
          <span style={{ opacity: 0.6 }}>5.</span> Vérification
        </>
      }
      backgroundImage={backgroundImage}
    >
      <div className="stack stackGap12">
        <Button
          variant="ghost"
          className="btnBackCompact backBtn"
          onClick={() => {
            if (typeof onCancel === "function") {
              onCancel();
              return;
            }
            if (typeof onBack === "function") onBack();
          }}
        >
          ← Retour
        </Button>
        <Card accentBorder>
          <div className="p18 col" style={{ gap: 10 }}>
            <div className="titleSm">Résumé</div>
            <div className="small2">
              Catégorie: {categoryLabel || "—"}
              {categoryLabel ? <span style={{ opacity: 0.6 }}> · {categoryPriorityLabel}</span> : null}
            </div>
            <div className="small2">Démarre aujourd’hui automatiquement.</div>
            <div className="stack stackGap8" style={{ marginTop: 4 }}>
              <div className="small2" style={{ opacity: 0.7 }}>
                Objectifs
              </div>
              {outcomes.map((outcome) => {
                const existing = goals.find((g) => g.id === outcome.id);
                const label = outcome.mode === "existing" ? existing?.title : outcome.title;
                const priority = outcome.mode === "existing" ? existing?.priority : outcome.priority;
                const deadline = outcome.mode === "existing" ? existing?.deadline : outcome.deadline;
                const days = outcomeItems.get(outcome.id)?.daysOfWeek || [];
                return (
                  <div key={outcome.id} className="stack stackGap4">
                    <div className="small2">
                      <span style={{ fontWeight: 600 }}>{label || "Objectif"}</span>{" "}
                      <span style={{ opacity: 0.6 }}>· {formatPriority(priority)}</span>
                    </div>
                    <div className="small2" style={{ opacity: 0.7 }}>
                      {deadline ? ` · Date limite: ${deadline}` : ""}
                    </div>
                    <div className="small2" style={{ opacity: 0.7 }}>
                      Jours: {formatDays(days)}
                    </div>
                  </div>
                );
              })}
              {!outcomes.length ? <div className="small2">—</div> : null}
            </div>
            <div className="stack stackGap8" style={{ marginTop: 4 }}>
              <div className="small2" style={{ opacity: 0.7 }}>
                Actions
              </div>
              {habits.map((habit) => {
                const outcomeLabel =
                  outcomes.find((o) => o.id === habit.outcomeId)?.title ||
                  goals.find((g) => g.id === habit.outcomeId)?.title ||
                  "Objectif";
                const habitItem = habitItems.get(habit.id) || null;
                const days = outcomeItems.get(habit.outcomeId)?.daysOfWeek || [];
                return (
                  <div key={habit.id} className="stack stackGap4">
                    <div className="small2">
                      <span style={{ fontWeight: 600 }}>{habit.title}</span>{" "}
                      <span style={{ opacity: 0.6 }}>· {outcomeLabel}</span>
                    </div>
                    <div className="small2" style={{ opacity: 0.7 }}>
                      Heure: {habitItem?.time || "—"} · Durée: {formatDurationMinutes(habitItem?.durationMinutes)}
                    </div>
                    <div className="small2" style={{ opacity: 0.7 }}>
                      Jours: {formatDays(days)}
                    </div>
                  </div>
                );
              })}
              {!habits.length ? <div className="small2">—</div> : null}
            </div>
            <div className="small2">Rythme: {rhythmItems.length ? "OK" : "À définir"}</div>
            <div className="row" style={{ justifyContent: "flex-end", gap: 10, marginTop: 6 }}>
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
              <Button onClick={handleConfirm} disabled={!canConfirm}>
                Confirmer
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </ScreenShell>
  );
}
