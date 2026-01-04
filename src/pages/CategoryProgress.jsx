import React, { useMemo } from "react";
import ScreenShell from "./_ScreenShell";
import { Button, Card } from "../components/UI";
import Gauge from "../components/Gauge";
import { getAccentForPage } from "../utils/_theme";

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

  const outcomeGoals = useMemo(() => {
    if (!category?.id) return [];
    return goals.filter((g) => g.categoryId === category.id && resolveGoalType(g) === "OUTCOME");
  }, [goals, category?.id]);

  if (!category) {
    return (
      <ScreenShell
        accent={getAccentForPage(safeData, "home")}
        headerTitle={<span className="textAccent">Progression</span>}
        headerSubtitle="Catégorie introuvable"
      >
        <Card accentBorder>
          <div className="p18">
            <div className="titleSm">Catégorie introuvable</div>
            <div className="small2 mt8">Cette catégorie n’existe plus.</div>
            <div className="mt12">
              <Button variant="ghost" className="btnBackCompact backBtn" onClick={onBack}>
                ← Retour
              </Button>
            </div>
          </div>
        </Card>
      </ScreenShell>
    );
  }

  const accent = category.color || getAccentForPage(safeData, "home");

  return (
    <ScreenShell
      accent={accent}
      backgroundImage={category.wallpaper || safeData.profile?.whyImage || ""}
      headerTitle={<span className="textAccent">Progression</span>}
      headerSubtitle={category.name || "Catégorie"}
    >
      <Button variant="ghost" className="btnBackCompact backBtn" onClick={onBack}>
        ← Retour
      </Button>

      <Card accentBorder style={{ marginTop: 12, borderColor: accent }}>
        <div className="p18">
          <div className="titleSm">Objectifs</div>
          {outcomeGoals.length ? (
            <div className="mt12 col" style={{ gap: 12 }}>
              {outcomeGoals.map((g) => (
                <Gauge
                  key={g.id}
                  label={g.title || "Objectif"}
                  currentValue={g.currentValue}
                  targetValue={g.targetValue}
                  unit={MEASURE_UNITS[g.measureType] || ""}
                  accentColor={accent}
                />
              ))}
            </div>
          ) : (
            <div className="small2 mt10">Aucun objectif dans cette catégorie.</div>
          )}
        </div>
      </Card>
    </ScreenShell>
  );
}
