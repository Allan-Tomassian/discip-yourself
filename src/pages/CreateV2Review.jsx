import React, { useEffect, useMemo } from "react";
import ScreenShell from "./_ScreenShell";
import { Button, Card } from "../components/UI";
import { normalizeCreationDraft, createEmptyDraft } from "../creation/creationDraft";
import { createGoal } from "../logic/goals";
import { uid } from "../utils/helpers";
import { setPrimaryCategory, setPrimaryGoalForCategory } from "../logic/priority";

function buildSchedule(item) {
  if (!item || !item.time || !Array.isArray(item.daysOfWeek) || !item.daysOfWeek.length) return null;
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "Europe/Paris";
  const durationMinutes = Number.isFinite(item.durationMinutes) && item.durationMinutes > 0 ? item.durationMinutes : 60;
  return {
    timezone,
    daysOfWeek: item.daysOfWeek,
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
  return items.every((item) => {
    const days = Array.isArray(item.daysOfWeek) ? item.daysOfWeek : [];
    return Boolean(item.time) && Number.isFinite(item.durationMinutes) && item.durationMinutes > 0 && days.length > 0;
  });
}

export default function CreateV2Review({ data, setData, onBack, onDone }) {
  const safeData = data && typeof data === "object" ? data : {};
  const backgroundImage = safeData?.profile?.whyImage || "";
  const categories = Array.isArray(safeData.categories) ? safeData.categories : [];
  const goals = Array.isArray(safeData.goals) ? safeData.goals : [];
  const draft = useMemo(() => normalizeCreationDraft(safeData?.ui?.createDraft), [safeData?.ui?.createDraft]);
  const rhythmItems = Array.isArray(draft?.rhythm?.items) ? draft.rhythm.items : [];

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
      const prevGoals = Array.isArray(next.goals) ? next.goals : [];
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

      let outcomeId = null;
      if (draft.outcome?.mode === "existing") {
        outcomeId = draft.outcome.id || null;
      } else if (draft.outcome?.mode === "new") {
        const outcomeItem = rhythmItems.find((item) => item.id === "outcome") || null;
        const schedule = buildSchedule(outcomeItem);
        const id = uid();
        let created = createGoal(
          { ...next, goals: prevGoals },
          {
            id,
            categoryId,
            title: draft.outcome.title || "Objectif",
            type: "OUTCOME",
            planType: "STATE",
            schedule: schedule || undefined,
            deadline: draft.outcome.deadline || "",
            measureType: draft.outcome.measureType || null,
            targetValue: draft.outcome.targetValue ? Number(draft.outcome.targetValue) : null,
            currentValue: draft.outcome.targetValue ? 0 : null,
            priority: draft.outcome.priority || "secondaire",
          }
        );
        if (draft.outcome.priority === "prioritaire") {
          created = setPrimaryGoalForCategory(created, categoryId, id);
        }
        outcomeId = id;
        next = created;
      }

      if (!outcomeId) return prev;

      let finalState = next;
      for (const habit of draft.habits || []) {
        if (!habit || !habit.title) continue;
        const item = rhythmItems.find((it) => it.id === habit.id) || null;
        const schedule = buildSchedule(item);
        finalState = createGoal(finalState, {
          id: uid(),
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
      }

      finalState = {
        ...finalState,
        ui: { ...(finalState.ui || {}), createDraft: createEmptyDraft() },
      };
      return finalState;
    });

    if (typeof onDone === "function") onDone();
  }

  const categoryLabel =
    draft.category?.mode === "existing"
      ? categories.find((c) => c.id === draft.category.id)?.name
      : draft.category?.name;
  const outcomeLabel =
    draft.outcome?.mode === "existing"
      ? goals.find((g) => g.id === draft.outcome.id)?.title
      : draft.outcome?.title;

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
        <Button variant="ghost" className="btnBackCompact backBtn" onClick={onBack}>
          ← Retour
        </Button>
        <Card accentBorder>
          <div className="p18 col" style={{ gap: 10 }}>
            <div className="titleSm">Résumé</div>
            <div className="small2">Catégorie: {categoryLabel || "—"}</div>
            <div className="small2">Objectif: {outcomeLabel || "—"}</div>
            <div className="small2">Habitudes: {draft.habits?.length || 0}</div>
            <div className="small2">Rythme: {rhythmItems.length ? "OK" : "À définir"}</div>
            <div className="row" style={{ justifyContent: "flex-end", gap: 10, marginTop: 6 }}>
              <Button variant="ghost" onClick={onBack}>
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
