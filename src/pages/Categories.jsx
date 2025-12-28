import React from "react";
import ScreenShell from "./_ScreenShell";
import { Button, Card } from "../components/UI";
import { uid } from "../utils/helpers";
import { safePrompt } from "../utils/dialogs";

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

function formatCount(count, singular, plural) {
  if (count === 0) return `0 ${plural}`;
  if (count === 1) return `1 ${singular}`;
  return `${count} ${plural}`;
}

export default function Categories({ data, setData, onOpenPlan }) {
  const safeData = data && typeof data === "object" ? data : {};
  const categories = Array.isArray(safeData.categories) ? safeData.categories : [];
  const goals = Array.isArray(safeData.goals) ? safeData.goals : [];

  function addCategory() {
    const name = safePrompt("Nom :", "Nouvelle");
    if (!name) return;
    const cleanName = name.trim();
    if (!cleanName) return;
    const color = safePrompt("Couleur HEX :", "#FFFFFF") || "#FFFFFF";
    const cleanColor = color.trim();
    const id = uid();

    setData((prev) => {
      const prevCategories = Array.isArray(prev.categories) ? prev.categories : [];
      const nextCategories = [
        ...prevCategories,
        { id, name: cleanName, color: cleanColor, wallpaper: "", mainGoalId: null },
      ];
      const prevUi = prev.ui || {};
      const nextSelected = prevCategories.length === 0 ? id : prevUi.selectedCategoryId || id;
      return { ...prev, categories: nextCategories, ui: { ...prevUi, selectedCategoryId: nextSelected } };
    });
  }

  function openCategory(categoryId) {
    if (!categoryId) return;
    if (typeof onOpenPlan === "function") {
      onOpenPlan(categoryId);
      return;
    }
    setData((prev) => ({
      ...prev,
      ui: { ...(prev.ui || {}), selectedCategoryId: categoryId },
    }));
  }

  if (categories.length === 0) {
    return (
      <ScreenShell
        data={safeData}
        pageId="categories"
        headerTitle="Bibliothèque"
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
              <Button onClick={addCategory}>+ Ajouter une catégorie</Button>
            </div>
          </div>
        </Card>
      </ScreenShell>
    );
  }

  return (
    <ScreenShell
      data={safeData}
      pageId="categories"
      headerTitle="Bibliothèque"
      headerSubtitle="Catégories"
      backgroundImage={safeData?.profile?.whyImage || ""}
    >
      <div className="col">
        {categories.map((c) => {
          const categoryGoals = goals.filter((g) => g.categoryId === c.id);
          const objectives = categoryGoals.filter((g) => resolveGoalType(g) === "OUTCOME").length;
          const habits = categoryGoals.filter((g) => resolveGoalType(g) === "PROCESS").length;
          const summary =
            objectives || habits
              ? `${formatCount(habits, "habitude", "habitudes")} · ${formatCount(objectives, "objectif", "objectifs")}`
              : "Aucun élément";

          return (
            <Card key={c.id} accentBorder style={{ marginBottom: 12, borderColor: c.color || undefined }}>
              <div className="p18 row" style={{ justifyContent: "space-between" }}>
                <div>
                  <div className="titleSm">{c.name}</div>
                  <div className="small2">{summary}</div>
                </div>
                <Button variant="ghost" onClick={() => openCategory(c.id)}>
                  Ouvrir
                </Button>
              </div>
            </Card>
          );
        })}

        <Card accentBorder>
          <div className="p18 row" style={{ justifyContent: "space-between" }}>
            <div>
              <div className="titleSm">Nouvelle catégorie</div>
              <div className="small2">Ajoute un nouvel axe.</div>
            </div>
            <Button onClick={addCategory}>+ Ajouter</Button>
          </div>
        </Card>
      </div>
    </ScreenShell>
  );
}
