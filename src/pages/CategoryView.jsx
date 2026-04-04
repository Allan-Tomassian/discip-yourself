import React, { useEffect, useMemo } from "react";
import Gauge from "../components/Gauge";
import { getAccentForPage } from "../utils/_theme";
import { resolveCategoryColor } from "../utils/categoryPalette";
import { resolveGoalType } from "../domain/goalType";
import { LABELS } from "../ui/labels";
import CategoryManageInline from "../features/library/CategoryManageInline";
import { AppScreen, GhostButton, SectionHeader } from "../shared/ui/app";
import "../features/library/library.css";

// TOUR MAP:
// - primary_action: manage actions and advanced objectives in a category
// - key_elements: back button, category settings, action/objective sections
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
  onOpenCreateOutcome,
  onOpenCreateHabit,
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
    const targetSection = safeData?.ui?.manageScrollTo === "objectives" ? "objectives" : safeData?.ui?.manageScrollTo === "actions" ? "actions" : null;
    if (!targetSection) return;
    if (typeof document === "undefined") return;
    const section = document.querySelector(
      targetSection === "objectives" ? '[data-tour-id="manage-objectives-section"]' : '[data-tour-id="manage-actions-section"]'
    );
    const cta = document.querySelector(
      targetSection === "objectives" ? '[data-tour-id="manage-objectives-create"]' : '[data-tour-id="manage-actions-create"]'
    );
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
      <AppScreen
        headerTitle="Gestion de catégorie"
        headerSubtitle="Aucune catégorie"
        backgroundImage={safeData?.profile?.whyImage || ""}
      >
        <section className="mainPageSection">
          <SectionHeader
            title="Aucune catégorie"
            subtitle={`Commence par poser une catégorie claire puis une première ${LABELS.actionLower}. Les ${LABELS.goalsLower} servent ensuite à donner une direction.`}
          />
          <div className="mainPageSectionBody">
            <div className="libraryActionRow">
              <GhostButton type="button" size="sm" className="btnBackCompact backBtn" onClick={onBack} data-tour-id="manage-back">
                ← Retour
              </GhostButton>
            </div>
          </div>
        </section>
      </AppScreen>
    );
  }

  if (!category) {
    return (
      <AppScreen
        headerTitle="Gestion de catégorie"
        headerSubtitle="Catégorie introuvable"
        backgroundImage={safeData?.profile?.whyImage || ""}
      >
        <section className="mainPageSection">
          <SectionHeader
            title="Catégorie introuvable"
            subtitle="Cette catégorie n’existe plus."
          />
          <div className="mainPageSectionBody">
            <div className="libraryActionRow">
              <GhostButton type="button" size="sm" className="btnBackCompact backBtn" onClick={onBack} data-tour-id="manage-back">
                ← Retour
              </GhostButton>
            </div>
          </div>
        </section>
      </AppScreen>
    );
}

  const accent = resolveCategoryColor(category, getAccentForPage(safeData, "home"));
  const backgroundImage = category.wallpaper || safeData.profile?.whyImage || "";
  const headerRight = (
    <div className="manageHeaderRightWrap">
      <div className="manageHeaderRight">
        <GhostButton type="button" size="sm" className="btnBackCompact backBtn" onClick={onBack} data-tour-id="manage-back">
          ← Retour
        </GhostButton>
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
                accentColor={resolveCategoryColor(category, accent)}
              />
            ))}
            {typeof onOpenProgress === "function" ? (
              <GhostButton type="button" size="sm" className="libraryProgressButton" onClick={() => onOpenProgress(category.id)} aria-label="Voir la progression">
                →
              </GhostButton>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );

  return (
    <AppScreen
      accent={accent}
      backgroundImage={backgroundImage}
      headerTitle={
        <div data-tour-id="manage-title">
          <span data-tour-id="manage-category-name">{category.name || "Catégorie"}</span>
        </div>
      }
      headerSubtitle="Gestion de la catégorie"
      headerRight={headerRight}
      headerRowAlign="start"
    >
      <CategoryManageInline
        data={data}
        setData={setData}
        categoryId={resolvedCategoryId}
        onOpenCreateOutcome={onOpenCreateOutcome}
        onOpenCreateHabit={onOpenCreateHabit}
        onOpenPilotage={onOpenPilotage}
        onEditItem={onEditItem}
        onClose={onBack}
      />
    </AppScreen>
  );
}
