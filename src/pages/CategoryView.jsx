import React, { useEffect, useMemo } from "react";
import ScreenShell from "./_ScreenShell";
import { Button, Card } from "../components/UI";
import Gauge from "../components/Gauge";
import { getAccentForPage } from "../utils/_theme";
import { resolveGoalType } from "../domain/goalType";
import { LABELS } from "../ui/labels";
import CategoryManageInline from "../features/library/CategoryManageInline";

// TOUR MAP:
// - primary_action: manage goals/actions in a category
// - key_elements: back button, category settings, objectives/actions sections
// - optional_elements: pilotage link, mini-why toggle
const MEASURE_UNITS = {
  money: "€",
  counter: "",
  time: "min",
  energy: "pts",
  distance: "km",
  weight: "kg",
};

export default function CategoryView({
  data,
  setData,
  categoryId,
  onBack,
  onOpenPilotage,
  onOpenProgress,
  onEditItem,
}) {
  const safeData = data && typeof data === "object" ? data : {};
  const categories = useMemo(
    () => (Array.isArray(safeData.categories) ? safeData.categories : []),
    [safeData.categories]
  );
  const goals = useMemo(
    () => (Array.isArray(safeData.goals) ? safeData.goals : []),
    [safeData.goals]
  );
  const uiLibraryCategoryId =
    safeData?.ui?.selectedCategoryByView?.library || safeData?.ui?.librarySelectedCategoryId || null;
  const resolvedCategoryId =
    (uiLibraryCategoryId && categories.some((c) => c.id === uiLibraryCategoryId) && uiLibraryCategoryId) ||
    (categoryId && categories.some((c) => c.id === categoryId) && categoryId) ||
    categories[0]?.id ||
    null;
  const category = categories.find((c) => c.id === resolvedCategoryId) || null;

  useEffect(() => {
    if (safeData?.ui?.manageScrollTo !== "actions") return;
    if (typeof document === "undefined") return;
    const section = document.querySelector('[data-tour-id="manage-actions-section"]');
    const cta = document.querySelector('[data-tour-id="manage-actions-create"]');
    if (section && typeof section.scrollIntoView === "function") {
      section.scrollIntoView({ behavior: "smooth", block: "start" });
      section.classList.add("flashPulse");
    }
    if (cta) cta.classList.add("flashPulseBtn");
    if (typeof setData === "function") {
      setData((prev) => ({
        ...prev,
        ui: {
          ...(prev.ui || {}),
          manageScrollTo: null,
        },
      }));
    }
    const timeout = window.setTimeout(() => {
      if (section) section.classList.remove("flashPulse");
      if (cta) cta.classList.remove("flashPulseBtn");
    }, 1600);
    return () => window.clearTimeout(timeout);
  }, [safeData?.ui?.manageScrollTo, setData]);

  const outcomeGoals = useMemo(() => {
    if (!category?.id) return [];
    return goals.filter((g) => g.categoryId === category.id && resolveGoalType(g) === "OUTCOME");
  }, [category?.id, goals]);

  const gaugeGoals = useMemo(() => {
    const main = category?.mainGoalId ? outcomeGoals.find((g) => g.id === category.mainGoalId) : null;
    const rest = main ? outcomeGoals.filter((g) => g.id !== main.id) : outcomeGoals;
    return main ? [main, ...rest] : outcomeGoals;
  }, [category?.mainGoalId, outcomeGoals]);
  const gaugeSlice = gaugeGoals.slice(0, 2);

  if (!categories.length) {
    return (
      <ScreenShell
        headerTitle={<span data-tour-id="manage-title">Gérer</span>}
        headerSubtitle="Aucune catégorie"
        backgroundImage={safeData?.profile?.whyImage || ""}
      >
        <Card accentBorder>
          <div className="p18">
            <div className="titleSm">Aucune catégorie</div>
            <div className="small mt6">
              Crée un {LABELS.goalLower} ou une {LABELS.actionLower} depuis la bibliothèque pour commencer.
            </div>
            <div className="mt12">
              <Button variant="ghost" className="btnBackCompact backBtn" onClick={onBack} data-tour-id="manage-back">
                ← Retour
              </Button>
            </div>
          </div>
        </Card>
      </ScreenShell>
    );
  }

  if (!category) {
    return (
      <ScreenShell
        headerTitle={<span data-tour-id="manage-title">Gérer</span>}
        headerSubtitle="Catégorie introuvable"
        backgroundImage={safeData?.profile?.whyImage || ""}
      >
        <Card accentBorder>
          <div className="p18">
            <div className="titleSm">Catégorie introuvable</div>
            <div className="small mt6">
              Cette catégorie n’existe plus.
            </div>
            <div className="mt12">
              <Button variant="ghost" className="btnBackCompact backBtn" onClick={onBack} data-tour-id="manage-back">
                ← Retour
              </Button>
            </div>
          </div>
        </Card>
      </ScreenShell>
    );
  }

  const accent = category?.color || getAccentForPage(safeData, "home");
  const backgroundImage = category.wallpaper || safeData.profile?.whyImage || "";
  const headerRight = (
    <div className="panelNarrow">
      <div className="col gap8 alignEnd">
        {outcomeGoals.length ? (
          <div className="col gap8 alignEnd wFull">
            {gaugeSlice.map((g) => (
              <Gauge
                key={g.id}
                className="manageGauge"
                label={g.title || LABELS.goal}
                currentValue={g.currentValue}
                targetValue={g.targetValue}
                unit={MEASURE_UNITS[g.measureType] || ""}
                accentColor={category.color || accent}
              />
            ))}
            <button
              className="linkBtn"
              type="button"
              onClick={() => (typeof onOpenProgress === "function" ? onOpenProgress(category.id) : null)}
              aria-label="Voir la progression"
            >
              →
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );

  return (
    <ScreenShell
      accent={accent}
      backgroundImage={backgroundImage}
      headerTitle={<span data-tour-id="manage-title">Gérer</span>}
      headerSubtitle={
        <div className="stack stackGap12">
          <div data-tour-id="manage-category-name">{category.name || "Catégorie"}</div>
          <Button variant="ghost" className="btnBackCompact backBtn" onClick={onBack} data-tour-id="manage-back">
            ← Retour
          </Button>
        </div>
      }
      headerRight={headerRight}
      headerRowAlign="start"
    >
      <CategoryManageInline
        data={data}
        setData={setData}
        categoryId={resolvedCategoryId}
        onOpenPilotage={onOpenPilotage}
        onEditItem={onEditItem}
        onClose={onBack}
      />
    </ScreenShell>
  );
}
