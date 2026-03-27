import React from "react";
import ScreenShell from "./_ScreenShell";
import AccentItem from "../components/AccentItem";
import { getAccentForPage } from "../utils/_theme";
import { getCategoryUiVars } from "../utils/categoryAccent";
import { resolveGoalType } from "../domain/goalType";
import { isProcessLinkedToOutcome } from "../logic/linking";
import { LABELS } from "../ui/labels";
import { GateButton, GateSection } from "../shared/ui/gate/Gate";

function DetailCard({ children, className = "", ...props }) {
  const mergedClassName = ["GateMainSection", "GateSurfacePremium", "GateCardPremium", className].filter(Boolean).join(" ");
  return (
    <GateSection className={mergedClassName} collapsible={false} {...props}>
      {children}
    </GateSection>
  );
}

export default function CategoryDetailView({ data, categoryId, onOpenManage }) {
  const safeData = data && typeof data === "object" ? data : {};
  const categories = Array.isArray(safeData.categories) ? safeData.categories : [];
  const goals = Array.isArray(safeData.goals) ? safeData.goals : [];
  const category = categories.find((c) => c.id === categoryId) || null;

  const outcomeGoals = category?.id
    ? goals.filter((g) => g.categoryId === category.id && resolveGoalType(g) === "OUTCOME")
    : [];
  const processGoals = category?.id
    ? goals.filter((g) => g.categoryId === category.id && resolveGoalType(g) === "PROCESS")
    : [];

  const { habitsByOutcome, unlinkedHabits } = (() => {
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
  })();

  if (!category) {
    return (
      <ScreenShell
        accent={getAccentForPage(safeData, "home")}
        headerTitle={<span>Catégorie</span>}
        headerSubtitle="Introuvable"
      >
        <DetailCard>
          <div className="titleSm">Catégorie introuvable</div>
          <div className="small2">Cette catégorie n’existe plus.</div>
        </DetailCard>
      </ScreenShell>
    );
  }

  const accent = category.color || getAccentForPage(safeData, "home");
  const catAccentVars = getCategoryUiVars(category || accent, { level: "surface" });
  const whyText = (category.whyText || "").trim();

  return (
    <ScreenShell
      accent={accent}
      backgroundImage={category.wallpaper || safeData.profile?.whyImage || ""}
      headerTitle={<span>{category.name || "Catégorie"}</span>}
      headerSubtitle="Détail catégorie"
    >
      {typeof onOpenManage === "function" ? (
        <div className="row gap10">
          <GateButton variant="ghost" className="GatePressable" onClick={onOpenManage}>
            Gérer
          </GateButton>
        </div>
      ) : null}

      <DetailCard className="mt12">
        <div className="sectionTitle">Mini-why</div>
        <div className="small2">{whyText || "Aucun mini-why pour cette catégorie."}</div>
      </DetailCard>

      <DetailCard className="mt12">
        <div className="sectionTitle">{LABELS.goals}</div>
        {outcomeGoals.length ? (
          <div className="mt12 col gap12">
            {outcomeGoals.map((g) => {
              const linkedHabits = habitsByOutcome.get(g.id) || [];
              return (
                <div key={g.id} className="col gap8">
                  <AccentItem className="listItem" style={catAccentVars}>
                    <div className="row rowBetween gap8">
                      <div className="itemTitle">{g.title || LABELS.goal}</div>
                      {category?.mainGoalId && g.id === category.mainGoalId ? (
                        <span className="badge badgeAccent">
                          Prioritaire
                        </span>
                      ) : null}
                    </div>
                    {linkedHabits.length ? (
                      <div className="col gap8 mt8 pl12">
                        <div className="small2 textMuted">
                          Actions
                        </div>
                        {linkedHabits.map((h) => (
                          <AccentItem key={h.id} className="listItem" style={catAccentVars}>
                            <div className="itemTitle">{h.title || "Action"}</div>
                          </AccentItem>
                        ))}
                      </div>
                    ) : (
                      <div className="small2 mt8 pl12">
                        Aucune action liée.
                      </div>
                    )}
                  </AccentItem>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="small2 mt10">Aucun {LABELS.goalLower} dans cette catégorie.</div>
        )}
      </DetailCard>

      {unlinkedHabits.length ? (
        <DetailCard className="mt12">
          <div className="sectionTitle">Actions non liées</div>
          <div className="mt12 col gap10">
            {unlinkedHabits.map((h) => (
              <div key={h.id} className="listItem">
                <div className="itemTitle">{h.title || "Action"}</div>
              </div>
            ))}
          </div>
        </DetailCard>
      ) : null}
    </ScreenShell>
  );
}
