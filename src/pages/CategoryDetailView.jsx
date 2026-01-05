import React, { useMemo } from "react";
import ScreenShell from "./_ScreenShell";
import { Button, Card } from "../components/UI";
import { getAccentForPage } from "../utils/_theme";
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

export default function CategoryDetailView({ data, categoryId, onBack, onOpenLibrary }) {
  const safeData = data && typeof data === "object" ? data : {};
  const categories = Array.isArray(safeData.categories) ? safeData.categories : [];
  const goals = Array.isArray(safeData.goals) ? safeData.goals : [];
  const category = categories.find((c) => c.id === categoryId) || null;

  const outcomeGoals = useMemo(() => {
    if (!category?.id) return [];
    return goals.filter((g) => g.categoryId === category.id && resolveGoalType(g) === "OUTCOME");
  }, [goals, category?.id]);

  const habits = useMemo(() => {
    if (!category?.id) return [];
    return goals.filter((g) => g.categoryId === category.id && resolveGoalType(g) === "PROCESS");
  }, [goals, category?.id]);

  if (!category) {
    return (
      <ScreenShell
        accent={getAccentForPage(safeData, "home")}
        headerTitle={<span className="textAccent">Catégorie</span>}
        headerSubtitle="Introuvable"
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
  const catAccentVars = getCategoryAccentVars(accent);
  const whyText = (category.whyText || "").trim();

  return (
    <ScreenShell
      accent={accent}
      backgroundImage={category.wallpaper || safeData.profile?.whyImage || ""}
      headerTitle={<span className="textAccent">{category.name || "Catégorie"}</span>}
      headerSubtitle="Détail catégorie"
    >
      <div className="row" style={{ gap: 10 }}>
        <Button variant="ghost" className="btnBackCompact backBtn" onClick={onBack}>
          ← Retour
        </Button>
        {typeof onOpenLibrary === "function" ? (
          <Button variant="ghost" onClick={onOpenLibrary}>
            Bibliothèque
          </Button>
        ) : null}
      </div>

      <Card accentBorder style={{ marginTop: 12 }}>
        <div className="p18">
          <div className="sectionTitle">Mini-why</div>
          <div className="small2 mt8">{whyText || "Aucun mini-why pour cette catégorie."}</div>
        </div>
      </Card>

      <Card accentBorder style={{ marginTop: 12 }}>
        <div className="p18">
          <div className="sectionTitle">Objectifs</div>
          {outcomeGoals.length ? (
            <div className="mt12 col" style={{ gap: 10 }}>
              {outcomeGoals.map((g) => (
                <div key={g.id} className="listItem catAccentRow" style={catAccentVars}>
                  <div className="itemTitle">{g.title || "Objectif"}</div>
                </div>
              ))}
            </div>
          ) : (
            <div className="small2 mt10">Aucun objectif dans cette catégorie.</div>
          )}
        </div>
      </Card>

      <Card accentBorder style={{ marginTop: 12 }}>
        <div className="p18">
          <div className="sectionTitle">Actions</div>
          {habits.length ? (
            <div className="mt12 col" style={{ gap: 10 }}>
              {habits.map((h) => (
                <div key={h.id} className="listItem catAccentRow" style={catAccentVars}>
                  <div className="itemTitle">{h.title || "Action"}</div>
                </div>
              ))}
            </div>
          ) : (
            <div className="small2 mt10">Aucune action liée.</div>
          )}
        </div>
      </Card>
    </ScreenShell>
  );
}
