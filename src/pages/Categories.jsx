// src/pages/Categories.jsx
import React, { useMemo } from "react";
import ScreenShell from "./_ScreenShell";
import { Button, Card } from "../components/UI";
import { getCategoryAccentVars } from "../utils/categoryAccent";

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

export default function Categories({ data, setData, onOpenLibraryCategory, onOpenCreate }) {
  const safeData = data && typeof data === "object" ? data : {};
  const categories = Array.isArray(safeData.categories) ? safeData.categories : [];
  const goals = Array.isArray(safeData.goals) ? safeData.goals : [];

  // IMPORTANT:
  // This page must not mutate ui.selectedCategoryId (used by Plan / CategoryDetail).
  // We isolate the Library selection using ui.librarySelectedCategoryId.
  const librarySelectedCategoryId = safeData?.ui?.librarySelectedCategoryId || null;

  function openCategory(categoryId) {
    if (!categoryId) return;

    // Keep Library selection local to Library page only
    if (typeof setData === "function") {
      setData((prev) => ({
        ...prev,
        ui: { ...(prev.ui || {}), librarySelectedCategoryId: categoryId },
      }));
    }

    // Navigation callback stays the same (parent decides what to do)
    if (typeof onOpenLibraryCategory === "function") {
      onOpenLibraryCategory(categoryId);
    }
  }

  if (categories.length === 0) {
    return (
      <ScreenShell
        data={safeData}
        pageId="categories"
        headerTitle="Bibliothèque"
        headerSubtitle="Aucune catégorie"
        headerRight={
          <Button
            variant="ghost"
            onClick={() => (typeof onOpenCreate === "function" ? onOpenCreate() : null)}
          >
            Créer
          </Button>
        }
        backgroundImage={safeData?.profile?.whyImage || ""}
      >
        <Card accentBorder>
          <div className="p18">
            <div className="titleSm">Aucune catégorie</div>
            <div className="small" style={{ marginTop: 6 }}>
              Ajoute une première catégorie pour commencer.
            </div>
          </div>
        </Card>
      </ScreenShell>
    );
  }

  const sortedCategories = useMemo(() => {
    if (!librarySelectedCategoryId) return categories;
    const copy = categories.slice();
    copy.sort((a, b) => (a.id === librarySelectedCategoryId ? -1 : b.id === librarySelectedCategoryId ? 1 : 0));
    return copy;
  }, [categories, librarySelectedCategoryId]);

  return (
    <ScreenShell
      data={safeData}
      pageId="categories"
      headerTitle="Bibliothèque"
      headerSubtitle="Catégories"
      headerRight={
        <Button
          variant="ghost"
          onClick={() => (typeof onOpenCreate === "function" ? onOpenCreate() : null)}
        >
          Créer
        </Button>
      }
      backgroundImage={safeData?.profile?.whyImage || ""}
    >
      <div className="col">
        {sortedCategories.map((c) => {
          const categoryGoals = goals.filter((g) => g.categoryId === c.id);
          const objectives = categoryGoals.filter((g) => resolveGoalType(g) === "OUTCOME").length;
          const habits = categoryGoals.filter((g) => resolveGoalType(g) === "PROCESS").length;
          const summary =
            objectives || habits
              ? `${formatCount(habits, "habitude", "habitudes")} · ${formatCount(objectives, "objectif", "objectifs")}`
              : "Aucun élément";

          return (
            <Card key={c.id} className="catAccentRow" style={{ marginBottom: 12, ...getCategoryAccentVars(c.color) }}>
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
      </div>
    </ScreenShell>
  );
}
