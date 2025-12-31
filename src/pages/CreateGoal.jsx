import React, { useEffect, useState } from "react";
import ScreenShell from "./_ScreenShell";
import { Button, Card, Input, Select } from "../components/UI";
import { uid } from "../utils/helpers";
import { createGoal } from "../logic/goals";

export default function CreateGoal({ data, setData, onCancel, onDone }) {
  const safeData = data && typeof data === "object" ? data : {};
  const backgroundImage = safeData?.profile?.whyImage || "";
  const categories = Array.isArray(safeData.categories) ? safeData.categories : [];
  const [categoryId, setCategoryId] = useState(categories[0]?.id || "");
  const [title, setTitle] = useState("");
  const [deadline, setDeadline] = useState("");

  useEffect(() => {
    if (categoryId) return;
    if (categories.length) setCategoryId(categories[0].id);
  }, [categories, categoryId]);

  const canSubmit = Boolean(categoryId && title.trim());

  function handleCreate() {
    if (!canSubmit || typeof setData !== "function") return;
    const cleanTitle = title.trim();
    const cleanDeadline = (deadline || "").trim();
    const id = uid();

    setData((prev) => {
      let next = createGoal(prev, {
        id,
        categoryId,
        title: cleanTitle,
        type: "OUTCOME",
        planType: "STATE",
        deadline: cleanDeadline,
      });

      const hasMain = categories.find((c) => c.id === categoryId)?.mainGoalId;
      if (!hasMain) {
        const nextCategories = (next.categories || []).map((cat) =>
          cat.id === categoryId ? { ...cat, mainGoalId: id } : cat
        );
        next = {
          ...next,
          categories: nextCategories,
          ui: { ...(next.ui || {}), mainGoalId: id, selectedCategoryId: categoryId },
        };
      }

      return next;
    });

    if (typeof onDone === "function") onDone();
  }

  return (
    <ScreenShell
      data={safeData}
      pageId="categories"
      headerTitle="Créer"
      headerSubtitle="Objectif"
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
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Nom de l’objectif" />
          <Input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} />

          {!categories.length ? (
            <div className="small2">Aucune catégorie disponible.</div>
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
