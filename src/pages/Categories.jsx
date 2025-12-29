import React, { useMemo, useState } from "react";
import ScreenShell from "./_ScreenShell";
import { Button, Card, Input } from "../components/UI";
import { uid } from "../utils/helpers";
import { safePrompt } from "../utils/dialogs";
import { CATEGORY_TEMPLATES, findCategoryTemplateByLabel } from "../logic/templates";

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
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newCategoryTemplateId, setNewCategoryTemplateId] = useState(null);
  const [categorySuggestionsOpen, setCategorySuggestionsOpen] = useState(false);
  const [categoryQuery, setCategoryQuery] = useState("");

  function addCategory() {
    const cleanName = (newCategoryName || "").trim();
    if (!cleanName) return;
    const color = safePrompt("Couleur HEX :", "#FFFFFF") || "#FFFFFF";
    const cleanColor = color.trim();
    const id = uid();

    setData((prev) => {
      const prevCategories = Array.isArray(prev.categories) ? prev.categories : [];
      const nextCategories = [
        ...prevCategories,
        { id, name: cleanName, color: cleanColor, wallpaper: "", mainGoalId: null, templateId: newCategoryTemplateId },
      ];
      const prevUi = prev.ui || {};
      const nextSelected = prevCategories.length === 0 ? id : prevUi.selectedCategoryId || id;
      return { ...prev, categories: nextCategories, ui: { ...prevUi, selectedCategoryId: nextSelected } };
    });
    setNewCategoryName("");
    setNewCategoryTemplateId(null);
    setCategoryQuery("");
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
            <div className="mt12 col">
              <Input
                list="category-templates-library-empty"
                value={newCategoryName}
                onChange={(e) => {
                  const value = e.target.value;
                  setNewCategoryName(value);
                  const match = findCategoryTemplateByLabel(value);
                  setNewCategoryTemplateId(match ? match.id : null);
                }}
                placeholder="Nom de la catégorie"
              />
              <datalist id="category-templates-library-empty">
                {CATEGORY_TEMPLATES.map((t) => (
                  <option key={t.id} value={t.label} />
                ))}
              </datalist>
              <Button onClick={addCategory}>+ Ajouter une catégorie</Button>
            </div>
          </div>
        </Card>
      </ScreenShell>
    );
  }

  const filteredCategoryTemplates = useMemo(() => {
    const query = (categoryQuery || "").trim().toLowerCase();
    if (!query) return CATEGORY_TEMPLATES.slice(0, 12);
    return CATEGORY_TEMPLATES.filter((t) => t.label.toLowerCase().includes(query)).slice(0, 12);
  }, [categoryQuery]);

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
          <div className="p18 col" style={{ gap: 10 }}>
            <div>
              <div className="titleSm">Nouvelle catégorie</div>
              <div className="small2">Ajoute un nouvel axe.</div>
            </div>
            <Input
              list="category-templates-library"
              value={newCategoryName}
              onChange={(e) => {
                const value = e.target.value;
                setNewCategoryName(value);
                const match = findCategoryTemplateByLabel(value);
                setNewCategoryTemplateId(match ? match.id : null);
              }}
              placeholder="Nom de la catégorie"
            />
            <datalist id="category-templates-library">
              {CATEGORY_TEMPLATES.map((t) => (
                <option key={t.id} value={t.label} />
              ))}
            </datalist>
            <div className="row" style={{ alignItems: "center", justifyContent: "space-between" }}>
              <button className="linkBtn" onClick={() => setCategorySuggestionsOpen((v) => !v)}>
                {categorySuggestionsOpen ? "Masquer les suggestions" : "Suggestions"}
              </button>
              <Button onClick={addCategory}>+ Ajouter</Button>
            </div>
            {categorySuggestionsOpen ? (
              <div className="col" style={{ gap: 8 }}>
                <Input
                  value={categoryQuery}
                  onChange={(e) => setCategoryQuery(e.target.value)}
                  placeholder="Rechercher une suggestion"
                />
                <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
                  {filteredCategoryTemplates.map((t) => (
                    <button
                      key={t.id}
                      className="btn btnGhost"
                      onClick={() => {
                        setNewCategoryName(t.label);
                        setNewCategoryTemplateId(t.id);
                      }}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
                <div className="row" style={{ justifyContent: "flex-end" }}>
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setNewCategoryTemplateId(null);
                      setCategoryQuery("");
                    }}
                  >
                    Créer la mienne
                  </Button>
                </div>
              </div>
            ) : null}
          </div>
        </Card>
      </div>
    </ScreenShell>
  );
}
