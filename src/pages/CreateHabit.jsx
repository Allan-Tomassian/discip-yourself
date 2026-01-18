import React, { useEffect, useMemo, useState } from "react";
import ScreenShell from "./_ScreenShell";
import { Button, Card, Input, Select } from "../components/UI";
import { uid } from "../utils/helpers";
import { createGoal } from "../logic/goals";
import { resolveGoalType } from "../domain/goalType";

// TOUR MAP:
// - primary_action: create action
// - key_elements: category select, goal select, title input, submit/cancel
// - optional_elements: empty state hints
export default function CreateHabit({ data, setData, onCancel, onDone, initialCategoryId, initialGoalId }) {
  const safeData = data && typeof data === "object" ? data : {};
  const backgroundImage = safeData?.profile?.whyImage || "";
  const categories = Array.isArray(safeData.categories) ? safeData.categories : [];
  const goals = Array.isArray(safeData.goals) ? safeData.goals : [];

  const [categoryId, setCategoryId] = useState(() => initialCategoryId || categories[0]?.id || "");
  const [parentId, setParentId] = useState(() => initialGoalId || "");
  const [title, setTitle] = useState("");

  useEffect(() => {
    if (!initialGoalId) return;
    if (parentId !== initialGoalId) setParentId(initialGoalId);
  }, [initialGoalId, parentId]);

  useEffect(() => {
    if (!categories.length) return;
    if (initialCategoryId && categories.some((c) => c.id === initialCategoryId)) {
      if (categoryId !== initialCategoryId) setCategoryId(initialCategoryId);
      return;
    }
    if (!categoryId) setCategoryId(categories[0].id);
  }, [categories, categoryId, initialCategoryId]);

  const outcomeGoals = useMemo(() => {
    if (!categoryId) return [];
    return goals.filter((g) => g.categoryId === categoryId && resolveGoalType(g) === "OUTCOME");
  }, [goals, categoryId]);

  const mainGoalId = useMemo(() => {
    const cat = categories.find((c) => c.id === categoryId);
    return cat?.mainGoalId || "";
  }, [categories, categoryId]);

  useEffect(() => {
    if (initialGoalId && parentId === initialGoalId) return;
    if (parentId && outcomeGoals.some((g) => g.id === parentId)) return;
    if (mainGoalId) {
      setParentId(mainGoalId);
      return;
    }
    setParentId(outcomeGoals[0]?.id || "");
  }, [outcomeGoals, parentId, mainGoalId, initialGoalId]);

  const canSubmit = Boolean(categoryId && parentId && title.trim());

  function handleCreate() {
    if (!canSubmit || typeof setData !== "function") return;
    const cleanTitle = title.trim();
    const id = uid();

    setData((prev) =>
      createGoal(prev, {
        id,
        categoryId,
        title: cleanTitle,
        type: "PROCESS",
        planType: "ACTION",
        parentId,
        cadence: "WEEKLY",
        target: 1,
        freqCount: 1,
        freqUnit: "WEEK",
        weight: 100,
      })
    );

    if (typeof onDone === "function") onDone({ habitId: id, categoryId, parentId });
  }

  return (
    <ScreenShell
      data={safeData}
      pageId="categories"
      headerTitle={<span data-tour-id="create-action-title">Créer</span>}
      headerSubtitle={
        <>
          <span style={{ opacity: 0.6 }}>3.</span> Action
        </>
      }
      backgroundImage={backgroundImage}
    >
      <div className="stack stackGap12">
        <Button
          variant="ghost"
          className="btnBackCompact backBtn"
          onClick={() => (typeof onCancel === "function" ? onCancel() : null)}
          data-tour-id="create-action-back"
        >
          ← Retour
        </Button>
        <Card accentBorder>
          <div className="p18 col" style={{ gap: 10 }}>
            <Select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              style={{ fontSize: 16 }}
              data-tour-id="create-action-category"
            >
              <option value="" disabled>
                Sélectionner une catégorie
              </option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name || "Catégorie"}
                </option>
              ))}
            </Select>

            <Select
              value={parentId}
              onChange={(e) => setParentId(e.target.value)}
              style={{ fontSize: 16 }}
              disabled={!outcomeGoals.length}
              data-tour-id="create-action-goal"
            >
              <option value="" disabled>
                Sélectionner un objectif
              </option>
              {outcomeGoals.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.title || "Objectif"}
                </option>
              ))}
            </Select>

            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Nom de l’action"
              data-tour-id="create-action-title-input"
            />

            {!categories.length ? <div className="small2">Aucune catégorie disponible.</div> : null}
            {categories.length && !outcomeGoals.length ? (
              <div className="small2">Aucun objectif dans cette catégorie.</div>
            ) : null}

            <div className="row" style={{ justifyContent: "flex-end", gap: 10 }}>
              <Button
                variant="ghost"
                onClick={() => (typeof onCancel === "function" ? onCancel() : null)}
                data-tour-id="create-action-cancel"
              >
                Annuler
              </Button>
              <Button onClick={handleCreate} disabled={!canSubmit} data-tour-id="create-action-submit">
                Créer
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </ScreenShell>
  );
}
