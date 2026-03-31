import React from "react";
import ScreenShell from "./_ScreenShell";
import AccentItem from "../components/AccentItem";
import { getAccentForPage } from "../utils/_theme";
import { getCategoryUiVars } from "../utils/categoryAccent";
import { resolveCategoryColor } from "../utils/categoryPalette";
import { resolveGoalType } from "../domain/goalType";
import { isProcessLinkedToOutcome } from "../logic/linking";
import { LABELS } from "../ui/labels";
import { GateButton, GateSection, GateSectionIntro } from "../shared/ui/gate/Gate";
import "../features/library/library.css";

function DetailCard({ children, className = "", ...props }) {
  const mergedClassName = ["GateSurfacePremium", "GateCardPremium", "GateSecondarySectionCard", className].filter(Boolean).join(" ");
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
        headerTitle="Catégorie"
        headerSubtitle="Introuvable"
      >
        <section className="mainPageSection">
          <GateSectionIntro title="Catégorie introuvable" subtitle="Cette catégorie n’existe plus." />
          <DetailCard>
            <div className="GateInlineMetaCard col gap8">
              <div className="GateRoleHelperText">Reviens à la bibliothèque pour choisir une autre catégorie.</div>
            </div>
          </DetailCard>
        </section>
      </ScreenShell>
    );
  }

  const accent = resolveCategoryColor(category, getAccentForPage(safeData, "home"));
  const catAccentVars = getCategoryUiVars(category || accent, { level: "surface" });
  const whyText = (category.whyText || "").trim();

  return (
    <ScreenShell
      accent={accent}
      backgroundImage={category.wallpaper || safeData.profile?.whyImage || ""}
      headerTitle={category.name || "Catégorie"}
      headerSubtitle="Détail catégorie"
      headerRight={
        typeof onOpenManage === "function" ? (
          <GateButton variant="ghost" size="sm" className="GatePressable" onClick={onOpenManage}>
            Gérer
          </GateButton>
        ) : null
      }
    >
      <section className="mainPageSection">
        <GateSectionIntro title="Mini-why" subtitle="Contexte visible pour cette catégorie." />
        <DetailCard>
          <div className="GateInlineMetaCard col gap8">
            <div className="GateRoleHelperText">{whyText || "Aucun mini-why pour cette catégorie."}</div>
          </div>
        </DetailCard>
      </section>

      <section className="mainPageSection">
        <GateSectionIntro title={LABELS.goals} subtitle="Objectifs et actions déjà reliées." />
        <DetailCard>
          {outcomeGoals.length ? (
            <div className="col gap12">
              {outcomeGoals.map((g) => {
                const linkedHabits = habitsByOutcome.get(g.id) || [];
                return (
                  <AccentItem key={g.id} className="listItem" style={catAccentVars}>
                    <div className="col gap8 minW0 wFull">
                      <div className="row rowBetween gap8 alignCenter">
                        <div className="GateRoleCardTitle">{g.title || LABELS.goal}</div>
                        {category?.mainGoalId && g.id === category.mainGoalId ? (
                          <span className="badge badgeAccent">Prioritaire</span>
                        ) : null}
                      </div>
                      {linkedHabits.length ? (
                        <div className="col gap8">
                          <div className="GateRoleCardMeta">Actions liées</div>
                          {linkedHabits.map((h) => (
                            <AccentItem key={h.id} className="listItem" style={catAccentVars}>
                              <div className="GateRoleHelperText">{h.title || "Action"}</div>
                            </AccentItem>
                          ))}
                        </div>
                      ) : (
                        <div className="GateRoleHelperText">Aucune action liée.</div>
                      )}
                    </div>
                  </AccentItem>
                );
              })}
            </div>
          ) : (
            <div className="GateInlineMetaCard col gap8">
              <div className="GateRoleHelperText">Aucun {LABELS.goalLower} dans cette catégorie.</div>
            </div>
          )}
        </DetailCard>
      </section>

      {unlinkedHabits.length ? (
        <section className="mainPageSection">
          <GateSectionIntro title="Actions non liées" subtitle="Actions présentes mais non rattachées à un objectif." />
          <DetailCard>
            <div className="col gap10">
              {unlinkedHabits.map((h) => (
                <AccentItem key={h.id} className="listItem" style={catAccentVars}>
                  <div className="GateRoleHelperText">{h.title || "Action"}</div>
                </AccentItem>
              ))}
            </div>
          </DetailCard>
        </section>
      ) : null}
    </ScreenShell>
  );
}
