import React, { useMemo, useState } from "react";
import ScreenShell from "./_ScreenShell";
import { Badge, Button, Card } from "../components/UI";
import { uid } from "../utils/helpers";
import { todayKey } from "../utils/dates";
import { createGoal } from "../logic/goals";
import { safePrompt } from "../utils/dialogs";

const UNIT_LABELS = {
  DAY: "jour",
  WEEK: "semaine",
  MONTH: "mois",
  QUARTER: "trimestre",
  YEAR: "an",
};

function templateSet(categoryName) {
  const name = (categoryName || "").toLowerCase();
  if (name.includes("sport")) {
    return [
      {
        id: "sport-1",
        label: "Forme physique",
        outcomeTitle: "Retrouver une forme solide",
        processTitle: "Entraînement court",
        freqCount: 3,
        freqUnit: "WEEK",
        sessionMinutes: 30,
      },
      {
        id: "sport-2",
        label: "Endurance",
        outcomeTitle: "Courir 5 km facilement",
        processTitle: "Course douce",
        freqCount: 2,
        freqUnit: "WEEK",
        sessionMinutes: 25,
      },
    ];
  }
  if (name.includes("travail") || name.includes("work")) {
    return [
      {
        id: "work-1",
        label: "Projet clé",
        outcomeTitle: "Livrer un livrable majeur",
        processTitle: "Session focus",
        freqCount: 4,
        freqUnit: "WEEK",
        sessionMinutes: 60,
      },
    ];
  }
  if (name.includes("sant")) {
    return [
      {
        id: "health-1",
        label: "Hygiène de vie",
        outcomeTitle: "Améliorer mon énergie",
        processTitle: "Marche quotidienne",
        freqCount: 5,
        freqUnit: "WEEK",
        sessionMinutes: 20,
      },
    ];
  }
  return [
    {
      id: "default-1",
      label: "Modèle rapide",
      outcomeTitle: `Progresser dans ${categoryName || "cet axe"}`,
      processTitle: "Action régulière",
      freqCount: 3,
      freqUnit: "WEEK",
      sessionMinutes: 30,
    },
  ];
}

export default function Categories({ data, setData, onOpenPlan }) {
  const [libraryCategoryId, setLibraryCategoryId] = useState(null);
  const safeData = data && typeof data === "object" ? data : {};
  const categories = Array.isArray(safeData.categories) ? safeData.categories : [];
  const goals = Array.isArray(safeData.goals) ? safeData.goals : [];

  const activeCategory = categories.find((c) => c.id === libraryCategoryId) || null;
  const templates = useMemo(
    () => (activeCategory ? templateSet(activeCategory.name) : []),
    [activeCategory?.name]
  );

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

  function createFromTemplate(category, tpl) {
    if (!category) return;
    const now = `${todayKey()}T09:00`;
    const outcomeId = uid();
    const shouldSetMain = !category.mainGoalId;
    setData((prev) => {
      let next = createGoal(prev, {
        id: outcomeId,
        categoryId: category.id,
        title: tpl.outcomeTitle,
        type: "OUTCOME",
        planType: "STATE",
        status: "queued",
        startAt: now,
      });
      next = createGoal(next, {
        id: uid(),
        categoryId: category.id,
        title: tpl.processTitle,
        type: "PROCESS",
        planType: "ACTION",
        status: "queued",
        startAt: now,
        freqCount: tpl.freqCount,
        freqUnit: tpl.freqUnit,
        cadence: tpl.freqUnit === "DAY" ? "DAILY" : tpl.freqUnit === "WEEK" ? "WEEKLY" : "YEARLY",
        target: tpl.freqCount,
        sessionMinutes: tpl.sessionMinutes,
        parentId: outcomeId,
        weight: 100,
      });
      const nextCategories = (next.categories || []).map((cat) =>
        cat.id === category.id && !cat.mainGoalId ? { ...cat, mainGoalId: outcomeId } : cat
      );
      return {
        ...next,
        categories: nextCategories,
        ui: {
          ...(next.ui || {}),
          selectedCategoryId: category.id,
          mainGoalId: shouldSetMain ? outcomeId : next.ui?.mainGoalId || null,
        },
      };
    });
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

  if (!activeCategory && libraryCategoryId) {
    return (
      <ScreenShell
        data={safeData}
        pageId="categories"
        headerTitle="Bibliothèque"
        headerSubtitle="État invalide"
        backgroundImage={safeData?.profile?.whyImage || ""}
      >
        <Card accentBorder>
          <div className="p18">
            <div className="titleSm">État invalide</div>
            <div className="small" style={{ marginTop: 6 }}>
              La catégorie demandée est introuvable.
            </div>
            <div className="mt12">
              <Button variant="ghost" onClick={() => setLibraryCategoryId(null)}>
                Retour à la bibliothèque
              </Button>
            </div>
          </div>
        </Card>
      </ScreenShell>
    );
  }

  if (!activeCategory) {
    return (
      <ScreenShell
        data={safeData}
        pageId="categories"
        headerTitle="Bibliothèque"
        headerSubtitle="Choisis une catégorie"
        backgroundImage={safeData?.profile?.whyImage || ""}
      >
        <div className="col">
          {categories.map((c) => {
            const count = goals.filter((g) => g.categoryId === c.id).length;
            return (
              <Card key={c.id} accentBorder style={{ marginBottom: 12, borderColor: c.color || undefined }}>
                <div className="p18 row" style={{ justifyContent: "space-between" }}>
                  <div>
                    <div className="titleSm">{c.name}</div>
                    <div className="small2">{count} objectifs</div>
                  </div>
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setLibraryCategoryId(c.id);
                      setData((prev) => ({
                        ...prev,
                        ui: { ...(prev.ui || {}), selectedCategoryId: c.id },
                      }));
                    }}
                  >
                    Ouvrir
                  </Button>
                </div>
              </Card>
            );
          })}

          <Card accentBorder>
            <div className="p18 row">
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

  return (
    <ScreenShell
      data={safeData}
      pageId="categories"
      headerTitle="Bibliothèque"
      headerSubtitle={activeCategory.name}
      backgroundImage={activeCategory.wallpaper || safeData?.profile?.whyImage || ""}
    >
      <Card accentBorder style={{ borderColor: activeCategory.color || undefined }}>
        <div className="p18">
          <div className="row" style={{ justifyContent: "space-between" }}>
            <div>
              <div className="titleSm">Modèles</div>
              <div className="small2">Un point de départ rapide.</div>
            </div>
            <Button variant="ghost" onClick={() => setLibraryCategoryId(null)}>
              Retour
            </Button>
          </div>

          <div className="mt12 col">
            {templates.map((tpl) => (
              <div key={tpl.id} className="listItem">
                <div style={{ fontWeight: 700 }}>{tpl.label}</div>
                <div className="small2" style={{ marginTop: 4 }}>
                  OBJECTIF : {tpl.outcomeTitle}
                </div>
                <div className="small2">HABITUDE : {tpl.processTitle}</div>
                <div className="mt10 row" style={{ justifyContent: "space-between" }}>
                  <Badge>
                    {tpl.freqCount} / {(UNIT_LABELS[tpl.freqUnit] || tpl.freqUnit || "").toLowerCase()}
                  </Badge>
                  <Button variant="ghost" onClick={() => createFromTemplate(activeCategory, tpl)}>
                    Utiliser
                  </Button>
                </div>
              </div>
            ))}
          </div>

          <div className="mt14">
            <Button
              onClick={() => {
                if (typeof onOpenPlan === "function") onOpenPlan(activeCategory.id);
                else setLibraryCategoryId(null);
              }}
            >
              Créer le mien
            </Button>
          </div>
        </div>
      </Card>
    </ScreenShell>
  );
}
