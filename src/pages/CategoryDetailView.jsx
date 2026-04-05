import React from "react";
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
        headerTitle="Catégorie"
        headerSubtitle="Introuvable"
      >
        <section className="mainPageSection">
          <SectionHeader title="Catégorie introuvable" subtitle="Cette catégorie n’existe plus." />
          <div className="mainPageSectionBody">
            <AppInlineMetaCard text="Reviens à la bibliothèque pour choisir une autre catégorie." />
          </div>
        </section>
      </AppScreen>
    );
  }
  const whyText = (category.whyText || "").trim();

  return (
    <AppScreen
      headerTitle={category.name || "Catégorie"}
      headerSubtitle="Vue rattachée à Objectifs"
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
        <div className="mainPageSectionBody">
          <AppInlineMetaCard text={whyText || "Aucun mini-why pour cette catégorie."} />
        </div>
      </section>

      <section className="mainPageSection">
        <SectionHeader title={LABELS.goals} subtitle="Objectifs et actions déjà rattachés à cette catégorie." />
        <div className="mainPageSectionBody">
          {outcomeGoals.length ? (
            <div className="col gap12">
              {outcomeGoals.map((g) => {
                const linkedHabits = habitsByOutcome.get(g.id) || [];
                return (
                  <AppCard key={g.id} className="listItem">
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
                          <div className="col gap8 pl12">
                            {linkedHabits.map((h) => (
                              <div key={h.id} className="itemSub">
                                {h.title || "Action"}
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <div className="itemSub">Aucune action liée.</div>
                      )}
                    </div>
                  </AppCard>
                );
              })}
            </div>
          ) : (
            <AppInlineMetaCard text={`Aucun ${LABELS.goalLower} dans cette catégorie.`} />
          )}
        </div>
      </section>

      {unlinkedHabits.length ? (
        <section className="mainPageSection">
          <SectionHeader title="Actions non liées" subtitle="Actions présentes mais non rattachées à un objectif." />
          <div className="mainPageSectionBody">
            <div className="col gap10">
              {unlinkedHabits.map((h) => (
                <AppCard key={h.id} className="listItem">
                  <div className="itemSub">{h.title || "Action"}</div>
                </AppCard>
              ))}
            </div>
          </div>
        </section>
      ) : null}
    </AppScreen>
  );
}
