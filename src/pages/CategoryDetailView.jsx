import React, { useMemo } from "react";
import ScreenShell from "./_ScreenShell";
import { Button, Card } from "../components/UI";
import { getAccentForPage } from "../utils/_theme";
import { getCategoryAccentVars } from "../utils/categoryAccent";
import { resolveGoalType } from "../domain/goalType";
import { isProcessLinkedToOutcome } from "../logic/linking";

export default function CategoryDetailView({ data, categoryId, onOpenManage }) {
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
    for (const habit of processGoals) {
      const linkedOutcome = outcomeGoals.find((g) => g?.id && isProcessLinkedToOutcome(habit, g.id)) || null;
      if (linkedOutcome?.id) {
        const list = byParent.get(linkedOutcome.id) || [];
        list.push(habit);
        byParent.set(linkedOutcome.id, list);
        continue;
      }
      unlinked.push(habit);
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
      {typeof onOpenManage === "function" ? (
        <div className="row" style={{ gap: 10 }}>
          <Button variant="ghost" onClick={onOpenManage}>
            Gérer
          </Button>
        </div>
      ) : null}

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
                      <div className="row" style={{ justifyContent: "space-between", gap: 8 }}>
                        <div className="itemTitle">{g.title || "Objectif"}</div>
                        {category?.mainGoalId && g.id === category.mainGoalId ? (
                          <span className="small2" style={{ color: "var(--accent)" }}>
                            Prioritaire
                          </span>
                        ) : null}
                      </div>
                      {linkedHabits.length ? (
                        <div className="col" style={{ gap: 8, marginTop: 8, paddingLeft: 12 }}>
                          <div className="small2" style={{ color: "var(--accent)" }}>
                            Actions
                          </div>
                          {linkedHabits.map((h) => (
                            <div key={h.id} className="listItem catAccentRow" style={catAccentVars}>
                              <div className="itemTitle">{h.title || "Action"}</div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="small2" style={{ marginTop: 8, paddingLeft: 12 }}>
                          Aucune action liée.
                        </div>
                      )}
                    </div>
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
            <div className="sectionTitle">Actions non liées</div>
            <div className="mt12 col" style={{ gap: 10 }}>
              {unlinkedHabits.map((h) => (
                <div key={h.id} className="listItem catAccentRow" style={catAccentVars}>
                  <div className="itemTitle">{h.title || "Action"}</div>
                </div>
              ))}
            </div>
          </div>
        </Card>
      ) : null}
    </ScreenShell>
  );
}
