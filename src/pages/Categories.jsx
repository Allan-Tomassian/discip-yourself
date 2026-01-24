// src/pages/Categories.jsx
import React, { useMemo } from "react";
import ScreenShell from "./_ScreenShell";
import { Button, Card, AccentItem } from "../components/UI";
import SortableBlocks from "../components/SortableBlocks";
import { getCategoryCounts } from "../logic/pilotage";
import { getCategoryAccentVars } from "../utils/categoryAccent";
import { resolveGoalType } from "../domain/goalType";
import { isProcessLinkedToOutcome, linkProcessToOutcome } from "../logic/linking";

// TOUR MAP:
// - primary_action: open category detail
// - key_elements: create button, category list, category cards
// - optional_elements: priority badge
function formatCount(count, singular, plural) {
  if (count === 0) return `0 ${plural}`;
  if (count === 1) return `1 ${singular}`;
  return `${count} ${plural}`;
}

export default function Categories({
  data,
  setData,
  onOpenManage,
}) {
  const safeData = data && typeof data === "object" ? data : {};
  const categories = Array.isArray(safeData.categories) ? safeData.categories : [];
  const goals = Array.isArray(safeData.goals) ? safeData.goals : [];
  const isEmpty = categories.length === 0;

  // IMPORTANT:
  // This page must not mutate ui.selectedCategoryId (used by Plan / CategoryDetail).
  // We isolate the Library selection using ui.librarySelectedCategoryId.
  const librarySelectedCategoryId = safeData?.ui?.librarySelectedCategoryId || null;
  const homeSelectedCategoryId =
    safeData?.ui?.selectedCategoryByView?.home || safeData?.ui?.selectedCategoryId || null;
  const libraryDetailExpandedId = safeData?.ui?.libraryDetailExpandedId || null;
  const libraryViewSelectedId = librarySelectedCategoryId || homeSelectedCategoryId || null;

  function markLibraryTouched() {
    try {
      sessionStorage.setItem("library:selectedCategoryTouched", "1");
    } catch (err) {
      void err;
    }
  }

  function setLibraryCategory(categoryId) {
    if (!categoryId) return;

    // Keep Library selection local to Library page only
    if (typeof setData === "function") {
      setData((prev) => {
        const prevUi = prev.ui || {};
        const prevSel =
          prevUi.selectedCategoryByView && typeof prevUi.selectedCategoryByView === "object"
            ? prevUi.selectedCategoryByView
            : {};
        return {
          ...prev,
          ui: {
            ...prevUi,
            librarySelectedCategoryId: categoryId,
            selectedCategoryByView: { ...prevSel, library: categoryId },
          },
        };
      });
    }
  }

  function setLibraryDetailExpanded(categoryId) {
    if (typeof setData !== "function") return;
    setData((prev) => {
      const prevUi = prev.ui || {};
      if (prevUi.libraryDetailExpandedId === categoryId) return prev;
      return { ...prev, ui: { ...prevUi, libraryDetailExpandedId: categoryId } };
    });
  }

  function clearLibraryDetailExpanded() {
    if (typeof setData !== "function") return;
    setData((prev) => {
      const prevUi = prev.ui || {};
      if (!prevUi.libraryDetailExpandedId) return prev;
      return { ...prev, ui: { ...prevUi, libraryDetailExpandedId: null } };
    });
  }

  function handleOpenDetail(categoryId) {
    if (!categoryId) return;
    markLibraryTouched();
    if (libraryDetailExpandedId === categoryId) {
      clearLibraryDetailExpanded();
      return;
    }
    setLibraryCategory(categoryId);
    setLibraryDetailExpanded(categoryId);
  }

  const categoryRailOrder = Array.isArray(safeData?.ui?.categoryRailOrder)
    ? safeData.ui.categoryRailOrder
    : [];
  const orderedCategories = useMemo(() => {
    if (!categoryRailOrder.length) return categories;
    const map = new Map(categories.map((c) => [c.id, c]));
    const ordered = categoryRailOrder.map((id) => map.get(id)).filter(Boolean);
    if (ordered.length === categories.length) return ordered;
    const missing = categories.filter((c) => !categoryRailOrder.includes(c.id));
    return ordered.concat(missing);
  }, [categories, categoryRailOrder]);

  const countsByCategory = useMemo(() => {
    const map = new Map();
    for (const c of categories) {
      const counts = getCategoryCounts(safeData, c.id);
      map.set(c.id, { habits: counts.processCount, objectives: counts.outcomesCount });
    }
    return map;
  }, [categories, safeData]);

  const selectedCategory = categories.find((c) => c.id === libraryDetailExpandedId) || null;
  const outcomeGoals = selectedCategory?.id
    ? goals.filter((g) => g.categoryId === selectedCategory.id && resolveGoalType(g) === "OUTCOME")
    : [];
  const processGoals = selectedCategory?.id
    ? goals.filter((g) => g.categoryId === selectedCategory.id && resolveGoalType(g) === "PROCESS")
    : [];
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
  const linkTargetId =
    (selectedCategory?.mainGoalId && outcomeGoals.some((g) => g.id === selectedCategory.mainGoalId)
      ? selectedCategory.mainGoalId
      : outcomeGoals[0]?.id) || null;

  return (
      <ScreenShell
        headerTitle={<span data-tour-id="library-title">Bibliothèque</span>}
        headerSubtitle="Catégories"
        backgroundImage={safeData?.profile?.whyImage || ""}
      >
      <div className="stack stackGap12 pageNarrow">
        <Card>
          <div className="p18">
            <div className="row rowBetween alignCenter">
              <div className="sectionTitle">Catégories</div>
            </div>

            <div className="mt12 col gap10" data-tour-id="library-category-list">
              {isEmpty ? (
                <div className="small2 textMuted">Aucune donnée pour le moment.</div>
              ) : (
                <SortableBlocks
                  items={orderedCategories}
                  getId={(item) => item.id}
                  onReorder={(nextItems) => {
                    if (typeof setData !== "function") return;
                    const nextOrder = nextItems.map((item) => item.id);
                    setData((prev) => ({
                      ...prev,
                      ui: { ...(prev.ui || {}), categoryRailOrder: nextOrder },
                    }));
                  }}
                  className="col"
                  renderItem={(c, drag) => {
                  const counts = countsByCategory.get(c.id) || { habits: 0, objectives: 0 };
                  const objectives = counts.objectives;
                  const habits = counts.habits;
                  const summary =
                    objectives || habits
                      ? `${formatCount(objectives, "objectif", "objectifs")} · ${formatCount(habits, "action", "actions")}`
                      : "Aucun élément";

                  const isSelected = libraryViewSelectedId === c.id;
                  const isExpanded = libraryDetailExpandedId === c.id;
                  const detailAccentVars = getCategoryAccentVars(c.color);
                  const detailWhy = (c.whyText || "").trim() || "Aucun mini-why pour cette catégorie.";
                  const { attributes, listeners, setActivatorNodeRef } = drag || {};

                  return (
                    <div key={c.id} className="col gap8">
                      <AccentItem
                        color={c.color}
                        selected={isSelected}
                        rightSlot={
                          <span className="row gap8">
                            <span className="small2 textMuted2">
                              {isExpanded ? "−" : "+"}
                            </span>
                            {drag ? (
                              <button
                                ref={setActivatorNodeRef}
                                {...listeners}
                                {...attributes}
                                className="dragHandle"
                                aria-label="Réorganiser"
                              >
                                ⋮⋮
                              </button>
                            ) : null}
                          </span>
                        }
                        onClick={() => handleOpenDetail(c.id)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            handleOpenDetail(c.id);
                          }
                        }}
                      >
                        <div>
                          <div className="itemTitle">{c.name}</div>
                          <div className="itemSub">{summary}</div>
                        </div>
                      </AccentItem>
                      {isExpanded ? (
                        <div className="col gap8 pl10" style={detailAccentVars}>
                          <div className="row rowBetween alignCenter">
                            <div className="small2 textMuted2">
                              Détails
                            </div>
                            {typeof onOpenManage === "function" ? (
                              <Button variant="ghost" onClick={() => onOpenManage(c.id)}>
                                Gérer
                              </Button>
                            ) : null}
                          </div>
                          <div className="listItem catAccentRow" style={detailAccentVars}>
                            <div className="small2 textMuted">
                              Mini-why
                            </div>
                            <div className="small2 mt6">
                              {detailWhy}
                            </div>
                          </div>
                          <div className="col gap8">
                            <div className="small2 textMuted">
                              Objectifs
                            </div>
                            {outcomeGoals.length ? (
                              <div className="col gap8">
                                {outcomeGoals.map((g) => {
                                  const linkedHabits = habitsByOutcome.get(g.id) || [];
                                  const isPrimaryGoal = c.mainGoalId && g.id === c.mainGoalId;
                                  return (
                                    <div key={g.id} className="listItem catAccentRow" style={detailAccentVars}>
                                      <div className="row rowBetween gap8">
                                        <div className="itemTitle">{g.title || "Objectif"}</div>
                                        {isPrimaryGoal ? (
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
                                            <div key={h.id} className="listItem catAccentRow" style={detailAccentVars}>
                                              <div className="itemTitle">{h.title || "Action"}</div>
                                            </div>
                                          ))}
                                        </div>
                                      ) : (
                                        <div className="small2 mt8 pl12">
                                          Aucune action liée.
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            ) : (
                              <div className="small2">Aucun objectif dans cette catégorie.</div>
                            )}
                          </div>
                          {unlinkedHabits.length ? (
                            <div className="col gap8">
                              <div className="small2 textMuted">
                                Actions non liées
                              </div>
                              <div className="col gap8">
                                {unlinkedHabits.map((h) => (
                                  <div key={h.id} className="listItem">
                                    <div className="row rowBetween gap8">
                                      <div className="itemTitle">{h.title || "Action"}</div>
                                      <Button
                                        variant="ghost"
                                        onClick={() => {
                                          if (!linkTargetId || typeof setData !== "function") return;
                                          setData((prev) => linkProcessToOutcome(prev, h.id, linkTargetId));
                                        }}
                                        disabled={!linkTargetId || typeof setData !== "function"}
                                      >
                                        Lier
                                      </Button>
                                    </div>
                                  </div>
                                ))}
                                {!linkTargetId ? (
                                  <div className="small2 textMuted">
                                    Ajoute un objectif pour pouvoir lier ces actions.
                                  </div>
                                ) : null}
                              </div>
                            </div>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  );
                }}
                />
              )}
            </div>
          </div>
        </Card>
      </div>
    </ScreenShell>
  );
}
