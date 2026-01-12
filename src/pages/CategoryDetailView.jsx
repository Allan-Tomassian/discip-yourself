import React, { useMemo } from "react";
import ScreenShell from "./_ScreenShell";
import { Button, Card } from "../components/UI";
import { getAccentForPage } from "../utils/_theme";
import { getCategoryAccentVars } from "../utils/categoryAccent";
import { resolveGoalType } from "../utils/goalType";

export default function CategoryDetailView({ data, categoryId, onBack, onOpenLibrary }) {
  const safeData = data && typeof data === "object" ? data : {};
  const categories = Array.isArray(safeData.categories) ? safeData.categories : [];
  const goals = Array.isArray(safeData.goals) ? safeData.goals : [];
  const category = categories.find((c) => c.id === categoryId) || null;

  const outcomeGoals = useMemo(() => {
    if (!category?.id) return [];
    return goals.filter((g) => g.categoryId === category.id && resolveGoalType(g) === "OUTCOME");
  }, [goals, category?.id]);

  const processGoals = useMemo(() => {
    if (!category?.id) return [];
    return goals.filter((g) => g.categoryId === category.id && resolveGoalType(g) === "PROCESS");
  }, [goals, category?.id]);

  const { habitsByOutcome, unlinkedHabits } = useMemo(() => {
    const byParent = new Map();
    const unlinked = [];
    const outcomeIds = new Set(outcomeGoals.map((g) => g.id));
    for (const habit of processGoals) {
      const parentId = typeof habit?.parentId === "string" ? habit.parentId : "";
      if (parentId && outcomeIds.has(parentId)) {
        const list = byParent.get(parentId) || [];
        list.push(habit);
        byParent.set(parentId, list);
      } else {
        unlinked.push(habit);
      }
    }
    return { habitsByOutcome: byParent, unlinkedHabits: unlinked };
  }, [processGoals, outcomeGoals]);

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
            <div className="mt12 col" style={{ gap: 12 }}>
              {outcomeGoals.map((g) => {
                const linkedHabits = habitsByOutcome.get(g.id) || [];
                return (
                  <div key={g.id} className="col" style={{ gap: 8 }}>
                    <div className="listItem catAccentRow" style={catAccentVars}>
                      <div className="itemTitle">{g.title || "Objectif"}</div>
                    </div>
                    {linkedHabits.length ? (
                      <div className="col" style={{ gap: 8, paddingLeft: 12 }}>
                        {linkedHabits.map((h) => (
                          <div key={h.id} className="listItem catAccentRow" style={catAccentVars}>
                            <div className="itemTitle">{h.title || "Habitude"}</div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="small2" style={{ paddingLeft: 12 }}>
                        Aucune habitude liée.
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="small2 mt10">Aucun objectif dans cette catégorie.</div>
          )}
        </div>
      </Card>

      {unlinkedHabits.length ? (
        <Card accentBorder style={{ marginTop: 12 }}>
          <div className="p18">
            <div className="sectionTitle">Habitudes non liées</div>
            <div className="mt12 col" style={{ gap: 10 }}>
              {unlinkedHabits.map((h) => (
                <div key={h.id} className="listItem catAccentRow" style={catAccentVars}>
                  <div className="itemTitle">{h.title || "Habitude"}</div>
                </div>
              ))}
            </div>
          </div>
        </Card>
      ) : null}
    </ScreenShell>
  );
}
