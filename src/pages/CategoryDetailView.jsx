import React from "react";
import AccentItem from "../components/AccentItem";
import { getAccentForPage } from "../utils/_theme";
import { getCategoryUiVars } from "../utils/categoryAccent";
import { resolveCategoryColor } from "../utils/categoryPalette";
import { resolveGoalType } from "../domain/goalType";
import { isProcessLinkedToOutcome } from "../logic/linking";
import { LABELS } from "../ui/labels";
import { AppCard, AppInlineMetaCard, AppScreen, GhostButton, SectionHeader, StatusBadge } from "../shared/ui/app";
import "../features/library/library.css";

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
      <AppScreen
        accent={getAccentForPage(safeData, "home")}
        headerTitle="Catégorie"
        headerSubtitle="Introuvable"
      >
        <section className="mainPageSection">
          <SectionHeader title="Catégorie introuvable" subtitle="Cette catégorie n’existe plus." />
          <AppCard>
            <AppInlineMetaCard text="Reviens à la bibliothèque pour choisir une autre catégorie." />
          </AppCard>
        </section>
      </AppScreen>
    );
  }

  const accent = resolveCategoryColor(category, getAccentForPage(safeData, "home"));
  const catAccentVars = getCategoryUiVars(category || accent, { level: "surface" });
  const whyText = (category.whyText || "").trim();

  return (
    <AppScreen
      accent={accent}
      backgroundImage={category.wallpaper || safeData.profile?.whyImage || ""}
      headerTitle={category.name || "Catégorie"}
      headerSubtitle="Détail catégorie"
      headerRight={
        typeof onOpenManage === "function" ? (
          <GhostButton type="button" size="sm" onClick={onOpenManage}>
            Gérer
          </GhostButton>
        ) : null
      }
    >
      <section className="mainPageSection">
        <SectionHeader title="Mini-why" subtitle="Contexte visible pour cette catégorie." />
        <AppCard>
          <AppInlineMetaCard text={whyText || "Aucun mini-why pour cette catégorie."} />
        </AppCard>
      </section>

      <section className="mainPageSection">
        <SectionHeader title={LABELS.goals} subtitle="Objectifs et actions déjà reliées." />
        <AppCard>
          {outcomeGoals.length ? (
            <div className="col gap12">
              {outcomeGoals.map((g) => {
                const linkedHabits = habitsByOutcome.get(g.id) || [];
                return (
                  <AccentItem key={g.id} className="listItem" style={catAccentVars}>
                    <div className="col gap8 minW0 wFull">
                      <div className="row rowBetween gap8 alignCenter">
                        <div className="itemTitle">{g.title || LABELS.goal}</div>
                        {category?.mainGoalId && g.id === category.mainGoalId ? (
                          <StatusBadge tone="info">Prioritaire</StatusBadge>
                        ) : null}
                      </div>
                      {linkedHabits.length ? (
                        <div className="col gap8">
                          <div className="small2 textMuted">Actions liées</div>
                          {linkedHabits.map((h) => (
                            <AccentItem key={h.id} className="listItem" style={catAccentVars}>
                              <div className="itemSub">{h.title || "Action"}</div>
                            </AccentItem>
                          ))}
                        </div>
                      ) : (
                        <div className="itemSub">Aucune action liée.</div>
                      )}
                    </div>
                  </AccentItem>
                );
              })}
            </div>
          ) : (
            <AppInlineMetaCard text={`Aucun ${LABELS.goalLower} dans cette catégorie.`} />
          )}
        </AppCard>
      </section>

      {unlinkedHabits.length ? (
        <section className="mainPageSection">
          <SectionHeader title="Actions non liées" subtitle="Actions présentes mais non rattachées à un objectif." />
          <AppCard>
            <div className="col gap10">
              {unlinkedHabits.map((h) => (
                <AccentItem key={h.id} className="listItem" style={catAccentVars}>
                  <div className="itemSub">{h.title || "Action"}</div>
                </AccentItem>
              ))}
            </div>
          </AppCard>
        </section>
      ) : null}
    </AppScreen>
  );
}
