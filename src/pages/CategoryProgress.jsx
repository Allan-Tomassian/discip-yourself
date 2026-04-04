import React from "react";
import Gauge from "../components/Gauge";
import { getAccentForPage } from "../utils/_theme";
import { resolveCategoryColor } from "../utils/categoryPalette";
import { resolveGoalType } from "../domain/goalType";
import { LABELS } from "../ui/labels";
import { AppCard, AppScreen, GhostButton } from "../shared/ui/app";

const MEASURE_UNITS = {
  money: "€",
  counter: "",
  time: "min",
  energy: "pts",
  distance: "km",
  weight: "kg",
};

export default function CategoryProgress({ data, categoryId, onBack }) {
  const safeData = data && typeof data === "object" ? data : {};
  const categories = Array.isArray(safeData.categories) ? safeData.categories : [];
  const goals = Array.isArray(safeData.goals) ? safeData.goals : [];
  const category = categories.find((c) => c.id === categoryId) || null;

  const outcomeGoals = category?.id
    ? goals.filter((g) => {
        if (!g || g.categoryId !== category.id) return false;
        if (resolveGoalType(g) !== "OUTCOME") return false;
        const status = (g.status || "").toString().toLowerCase();
        // Progress page shows active outcomes by default
        if (status === "done" || status === "completed" || status === "finished" || status === "abandoned") return false;
        return true;
      })
    : [];

  if (!category) {
    return (
      <AppScreen
        accent={getAccentForPage(safeData, "home")}
        pageId="category-progress"
        headerTitle={<span className="textAccent">Progression</span>}
        headerSubtitle="Catégorie introuvable"
      >
        <AppCard variant="elevated">
          <div className="titleSm">Catégorie introuvable</div>
          <div className="small2">Cette catégorie n’existe plus.</div>
          <div className="mt12">
            <GhostButton className="btnBackCompact backBtn" onClick={onBack}>
              ← Retour
            </GhostButton>
          </div>
        </AppCard>
      </AppScreen>
    );
  }

  const accent = resolveCategoryColor(category, getAccentForPage(safeData, "home"));

  return (
    <AppScreen
      accent={accent}
      pageId="category-progress"
      backgroundImage={category.wallpaper || safeData.profile?.whyImage || ""}
      headerTitle={<span className="textAccent">Progression</span>}
      headerSubtitle={category.name || "Catégorie"}
    >
      <div className="stack stackGap12">
        <GhostButton className="btnBackCompact backBtn" onClick={onBack}>
          ← Retour
        </GhostButton>

        <AppCard variant="elevated" style={{ borderColor: accent }}>
          <div className="titleSm">{LABELS.goals}</div>
          {outcomeGoals.length ? (
            <div className="mt12 stack stackGap12">
              {outcomeGoals.map((g) => (
                <Gauge
                  key={g.id}
                  label={g.title || LABELS.goal}
                  currentValue={Number(g.currentValue) || 0}
                  targetValue={Number(g.targetValue) || 0}
                  unit={MEASURE_UNITS[g.measureType] || ""}
                  accentColor={accent}
                />
              ))}
            </div>
          ) : (
            <div className="small2 mt10">Aucun {LABELS.goalLower} dans cette catégorie.</div>
          )}
        </AppCard>
      </div>
    </AppScreen>
  );
}
