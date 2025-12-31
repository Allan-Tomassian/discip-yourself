import React, { useEffect, useMemo, useState } from "react";
import ScreenShell from "./_ScreenShell";
import { Button, Card, Input, Select } from "../components/UI";
import { uid } from "../utils/helpers";
import { createGoal } from "../logic/goals";

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

export default function CreateHabit({ data, setData, onCancel, onDone }) {
  const safeData = data && typeof data === "object" ? data : {};
  const backgroundImage = safeData?.profile?.whyImage || "";
  const categories = Array.isArray(safeData.categories) ? safeData.categories : [];
  const goals = Array.isArray(safeData.goals) ? safeData.goals : [];

  const [categoryId, setCategoryId] = useState(categories[0]?.id || "");
  const [parentId, setParentId] = useState("");
  const [title, setTitle] = useState("");

  useEffect(() => {
    if (categoryId) return;
    if (categories.length) setCategoryId(categories[0].id);
  }, [categories, categoryId]);

  const outcomeGoals = useMemo(() => {
    if (!categoryId) return [];
    return goals.filter((g) => g.categoryId === categoryId && resolveGoalType(g) === "OUTCOME");
  }, [goals, categoryId]);

  const mainGoalId = useMemo(() => {
    const cat = categories.find((c) => c.id === categoryId);
    return cat?.mainGoalId || "";
  }, [categories, categoryId]);

  useEffect(() => {
    if (parentId && outcomeGoals.some((g) => g.id === parentId)) return;
    if (mainGoalId) {
      setParentId(mainGoalId);
      return;
    }
    setParentId(outcomeGoals[0]?.id || "");
  }, [outcomeGoals, parentId, mainGoalId]);

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

    if (typeof onDone === "function") onDone();
  }

  return (
    <ScreenShell
      data={safeData}
      pageId="categories"
      headerTitle="Créer"
      headerSubtitle={
        <>
          <span style={{ opacity: 0.6 }}>3.</span> Habitude
        </>
      }
      headerRight={
        <Button variant="ghost" onClick={() => (typeof onCancel === "function" ? onCancel() : null)}>
          Retour
        </Button>
      }
      headerAlign="flex-end"
      backgroundImage={backgroundImage}
    >
      <Card accentBorder>
        <div className="p18 col" style={{ gap: 10 }}>
          <Select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} style={{ fontSize: 16 }}>
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

          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Nom de l’habitude" />

          {!categories.length ? <div className="small2">Aucune catégorie disponible.</div> : null}
          {categories.length && !outcomeGoals.length ? (
            <div className="small2">Aucun objectif dans cette catégorie.</div>
          ) : null}

          <div className="row" style={{ justifyContent: "flex-end", gap: 10 }}>
            <Button variant="ghost" onClick={() => (typeof onCancel === "function" ? onCancel() : null)}>
              Annuler
            </Button>
            <Button onClick={handleCreate} disabled={!canSubmit}>
              Créer
            </Button>
          </div>
        </div>
      </Card>
    </ScreenShell>
  );
}
